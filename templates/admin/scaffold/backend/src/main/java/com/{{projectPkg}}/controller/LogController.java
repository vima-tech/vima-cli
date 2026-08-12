package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.LoginLog;
import com.{{projectPkg}}.entity.OperLog;
import com.{{projectPkg}}.service.LogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/system/log")
@RequiredArgsConstructor
public class LogController {
    private final LogService logService;

    @GetMapping("/oper/list")
    public ApiResponse<PageResponse<OperLog>> listOperLogs(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(logService.listOperLogs(pageNum, pageSize));
    }

    @DeleteMapping("/oper/clear")
    public ApiResponse<Void> clearOperLogs() {
        logService.clearOperLogs();
        return ApiResponse.success();
    }

    @GetMapping("/login/list")
    public ApiResponse<PageResponse<LoginLog>> listLoginLogs(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(logService.listLoginLogs(pageNum, pageSize));
    }

    @DeleteMapping("/login/clear")
    public ApiResponse<Void> clearLoginLogs() {
        logService.clearLoginLogs();
        return ApiResponse.success();
    }
}
