package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.security.OnlineToken;
import com.{{projectPkg}}.service.OnlineUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitor/online")
@RequiredArgsConstructor
public class OnlineUserController {
    private final OnlineUserService onlineUserService;

    @GetMapping
    @PreAuthorize("@perm.has('monitor:online:list')")
    public ApiResponse<List<OnlineToken>> list() {
        return ApiResponse.success(onlineUserService.list());
    }

    @DeleteMapping("/{username}")
    @PreAuthorize("@perm.has('monitor:online:kick')")
    public ApiResponse<Void> kick(@PathVariable String username, Authentication authentication) {
        try {
            onlineUserService.kick(username, authentication.getName());
            return ApiResponse.success();
        } catch (Exception e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }
}
