package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.*;
import com.{{projectPkg}}.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        try {
            String ip = getClientIp(httpRequest);
            String userAgent = httpRequest.getHeader("User-Agent");
            LoginResponse response = authService.login(request, ip, userAgent);
            return ApiResponse.success(response);
        } catch (IllegalArgumentException e) {
            // 用 400 而非 401：401 在本项目里专指"登录态失效，请重新登录"，前端见到它会清态跳登录页。
            // 登录接口本身失败（账号不存在/密码错/被禁用）属业务错误，只该把 message 弹出来。
            return ApiResponse.error(400, e.getMessage());
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip.contains(",") ? ip.split(",")[0].trim() : ip;
    }

    @GetMapping("/user-info")
    public ApiResponse<Object> getUserInfo(Authentication authentication) {
        try {
            Object info = authService.getUserInfo(authentication.getName());
            return ApiResponse.success(info);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        try {
            authService.changePassword(authentication.getName(), request);
            return ApiResponse.success();
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            authService.logout(token);
        }
        return ApiResponse.success();
    }
}
