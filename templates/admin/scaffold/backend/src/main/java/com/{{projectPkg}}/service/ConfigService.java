package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysConfig;
import com.{{projectPkg}}.repository.SysConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ConfigService {
    private final SysConfigRepository configRepository;

    public PageResponse<SysConfig> listConfigs(String configName, String configKey, int pageNum, int pageSize) {
        Specification<SysConfig> spec = Specification.where(null);

        if (configName != null && !configName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("configName"), "%" + configName + "%"));
        }
        if (configKey != null && !configKey.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("configKey"), "%" + configKey + "%"));
        }

        Page<SysConfig> page = configRepository.findAll(spec, PageRequest.of(pageNum - 1, pageSize, Sort.by("id").descending()));
        return PageResponse.<SysConfig>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public String getConfigValue(String configKey) {
        return configRepository.findByConfigKey(configKey)
                .map(SysConfig::getConfigValue)
                .orElse(null);
    }

    public SysConfig createConfig(SysConfig config) {
        if (configRepository.existsByConfigKey(config.getConfigKey())) {
            throw new IllegalArgumentException("配置键已存在");
        }
        return configRepository.save(config);
    }

    public SysConfig updateConfig(SysConfig config) {
        SysConfig existing = configRepository.findById(config.getId())
                .orElseThrow(() -> new IllegalArgumentException("配置不存在"));
        existing.setConfigName(config.getConfigName());
        existing.setConfigValue(config.getConfigValue());
        existing.setRemark(config.getRemark());
        existing.setStatus(config.getStatus());
        return configRepository.save(existing);
    }

    public void deleteConfig(Long id) {
        configRepository.deleteById(id);
    }
}
