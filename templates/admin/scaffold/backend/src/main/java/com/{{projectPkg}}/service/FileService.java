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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {
    private final SysFileRepository fileRepository;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${file.base-url:http://localhost:8080}")
    private String baseUrl;

    public SysFile upload(MultipartFile file, Long userId, String username) throws IOException {
        String originalName = file.getOriginalFilename();
        String ext = originalName.substring(originalName.lastIndexOf("."));
        String fileName = UUID.randomUUID().toString() + ext;

        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        Path filePath = uploadPath.resolve(fileName);
        file.transferTo(filePath.toFile());

        SysFile sysFile = new SysFile();
        sysFile.setFileName(fileName);
        sysFile.setOriginalName(originalName);
        sysFile.setFilePath(filePath.toString());
        sysFile.setFileUrl(baseUrl + "/uploads/" + fileName);
        sysFile.setFileSize(file.getSize());
        sysFile.setFileType(file.getContentType());
        sysFile.setFileExt(ext);
        sysFile.setUploadUserId(userId);
        sysFile.setUploadUsername(username);

        return fileRepository.save(sysFile);
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
        SysFile file = fileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("文件不存在"));
        Files.deleteIfExists(Paths.get(file.getFilePath()));
        fileRepository.deleteById(id);
    }
}
