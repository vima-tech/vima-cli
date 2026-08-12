package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.LoginLog;
import com.{{projectPkg}}.entity.OperLog;
import com.{{projectPkg}}.service.LogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/log")
@RequiredArgsConstructor
public class LogController {
    private final LogService logService;

    @PreAuthorize("@perm.has('system:operlog:list')")
    @GetMapping("/oper/list")
    public ApiResponse<PageResponse<OperLog>> listOperLogs(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(logService.listOperLogs(module, username, status, pageNum, pageSize));
    }

    @PreAuthorize("@perm.has('system:operlog:remove')")
    @DeleteMapping("/oper/clear")
    public ApiResponse<Void> clearOperLogs() {
        logService.clearOperLogs();
        return ApiResponse.success();
    }

    @PreAuthorize("@perm.has('system:loginlog:list')")
    @GetMapping("/login/list")
    public ApiResponse<PageResponse<LoginLog>> listLoginLogs(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(logService.listLoginLogs(username, status, pageNum, pageSize));
    }

    @PreAuthorize("@perm.has('system:loginlog:remove')")
    @DeleteMapping("/login/clear")
    public ApiResponse<Void> clearLoginLogs() {
        logService.clearLoginLogs();
        return ApiResponse.success();
    }
}
