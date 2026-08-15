package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysFile;
import com.{{projectPkg}}.repository.SysFileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "csv", "xls", "xlsx", "doc", "docx", "zip");
    private final SysFileRepository fileRepository;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    public SysFile upload(MultipartFile file, Long userId, String username) throws IOException {
        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        String safeOriginalName = Paths.get(originalName).getFileName().toString();
        int dot = safeOriginalName.lastIndexOf('.');
        if (dot <= 0 || dot == safeOriginalName.length() - 1) {
            throw new IllegalArgumentException("文件必须包含有效扩展名");
        }
        String extension = safeOriginalName.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("不支持的文件类型：" + extension);
        }
        String ext = "." + extension;
        String fileName = UUID.randomUUID() + ext;

        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        Path filePath = uploadPath.resolve(fileName).normalize();
        file.transferTo(filePath.toFile());

        SysFile sysFile = new SysFile();
        sysFile.setFileName(fileName);
        sysFile.setOriginalName(safeOriginalName);
        sysFile.setFilePath(filePath.toString());
        sysFile.setFileSize(file.getSize());
        sysFile.setFileType(file.getContentType());
        sysFile.setFileExt(ext);
        sysFile.setUploadUserId(userId);
        sysFile.setUploadUsername(username);

        SysFile saved = fileRepository.save(sysFile);
        saved.setFileUrl("/api/system/file/" + saved.getId() + "/download");
        return fileRepository.save(saved);
    }

    /** 文件名按上传时的原始名模糊匹配——列表展示的就是它，磁盘上的 UUID 名对用户没有意义。 */
    public PageResponse<SysFile> listFiles(String originalName, int pageNum, int pageSize) {
        Specification<SysFile> spec = Specification.where(null);

        if (originalName != null && !originalName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("originalName"), "%" + originalName + "%"));
        }

        Page<SysFile> page = fileRepository.findAll(spec,
                PageRequest.of(pageNum - 1, pageSize, Sort.by(Sort.Direction.DESC, "createTime")));
        return PageResponse.<SysFile>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public void deleteFile(Long id) throws IOException {
        SysFile file = getFile(id);
        Files.deleteIfExists(pathOf(file));
        fileRepository.deleteById(id);
    }

    public SysFile getFile(Long id) {
        return fileRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("文件不存在"));
    }

    /** 数据库中的路径同样按上传根目录约束，防止被误改后读写项目外文件。 */
    public Path pathOf(SysFile file) {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path target = Paths.get(file.getFilePath()).toAbsolutePath().normalize();
        if (!target.startsWith(root)) {
            throw new IllegalStateException("文件路径超出上传目录");
        }
        return target;
    }
}
