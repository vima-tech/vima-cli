package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysFile;
import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import com.{{projectPkg}}.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/file")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;
    private final UserRepository userRepository;

    @PreAuthorize("@perm.has('system:file:upload')")
    @PostMapping("/upload")
    public ApiResponse<SysFile> upload(@RequestParam("file") MultipartFile file, Authentication authentication) throws IOException {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        SysFile sysFile = fileService.upload(file, user.getId(), user.getUsername());
        return ApiResponse.success(sysFile);
    }

    @PreAuthorize("@perm.has('system:file:list')")
    @GetMapping("/list")
    public ApiResponse<PageResponse<SysFile>> list(
            @RequestParam(required = false) String originalName,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(fileService.listFiles(originalName, pageNum, pageSize));
    }

    @PreAuthorize("@perm.has('system:file:list')")
    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        SysFile file = fileService.getFile(id);
        Resource resource = new FileSystemResource(fileService.pathOf(file));
        if (!resource.exists() || !resource.isReadable()) {
            throw new IllegalArgumentException("文件不存在或不可读取");
        }
        String disposition = ContentDisposition.attachment()
                .filename(file.getOriginalName(), StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(resource);
    }

    @PreAuthorize("@perm.has('system:file:remove')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) throws IOException {
        fileService.deleteFile(id);
        return ApiResponse.success();
    }
}
