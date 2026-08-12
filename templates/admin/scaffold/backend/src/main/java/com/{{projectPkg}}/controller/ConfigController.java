package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysConfig;
import com.{{projectPkg}}.service.ConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/system/config")
@RequiredArgsConstructor
public class ConfigController {
    private final ConfigService configService;

    @GetMapping("/list")
    public ApiResponse<PageResponse<SysConfig>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(configService.listConfigs(pageNum, pageSize));
    }

    @GetMapping("/key/{configKey}")
    public ApiResponse<String> getByKey(@PathVariable String configKey) {
        String value = configService.getConfigValue(configKey);
        return ApiResponse.success(value);
    }

    @PostMapping
    public ApiResponse<SysConfig> create(@RequestBody SysConfig config) {
        try {
            return ApiResponse.success(configService.createConfig(config));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping
    public ApiResponse<SysConfig> update(@RequestBody SysConfig config) {
        return ApiResponse.success(configService.updateConfig(config));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        configService.deleteConfig(id);
        return ApiResponse.success();
    }
}
