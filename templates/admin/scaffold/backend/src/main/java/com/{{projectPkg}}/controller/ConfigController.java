package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysConfig;
import com.{{projectPkg}}.service.ConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/config")
@RequiredArgsConstructor
public class ConfigController {
    private final ConfigService configService;

    @PreAuthorize("@perm.has('system:config:list')")
    @GetMapping("/list")
    public ApiResponse<PageResponse<SysConfig>> list(
            @RequestParam(required = false) String configName,
            @RequestParam(required = false) String configKey,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(configService.listConfigs(configName, configKey, pageNum, pageSize));
    }

    /** 不加权限点：站点名称等配置在登录后各处运行时读取，属于全员基础读。 */
    @GetMapping("/key/{configKey}")
    public ApiResponse<String> getByKey(@PathVariable String configKey) {
        String value = configService.getConfigValue(configKey);
        return ApiResponse.success(value);
    }

    @PreAuthorize("@perm.has('system:config:add')")
    @PostMapping
    public ApiResponse<SysConfig> create(@RequestBody SysConfig config) {
        try {
            return ApiResponse.success(configService.createConfig(config));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PreAuthorize("@perm.has('system:config:edit')")
    @PutMapping
    public ApiResponse<SysConfig> update(@RequestBody SysConfig config) {
        return ApiResponse.success(configService.updateConfig(config));
    }

    @PreAuthorize("@perm.has('system:config:remove')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        configService.deleteConfig(id);
        return ApiResponse.success();
    }
}
