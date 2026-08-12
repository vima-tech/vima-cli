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

import java.io.IOException;

@RestController
@RequestMapping("/api/system/file")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;
    private final UserRepository userRepository;

    @PostMapping("/upload")
    public ApiResponse<SysFile> upload(@RequestParam("file") MultipartFile file, Authentication authentication) {
        try {
            User user = userRepository.findByUsername(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("用户不存在"));
            SysFile sysFile = fileService.upload(file, user.getId(), user.getUsername());
            return ApiResponse.success(sysFile);
        } catch (IOException e) {
            return ApiResponse.error("上传失败: " + e.getMessage());
        }
    }

    @GetMapping("/list")
    public ApiResponse<PageResponse<SysFile>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(fileService.listFiles(pageNum, pageSize));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        try {
            fileService.deleteFile(id);
            return ApiResponse.success();
        } catch (IOException e) {
            return ApiResponse.error("删除失败: " + e.getMessage());
        }
    }
}
