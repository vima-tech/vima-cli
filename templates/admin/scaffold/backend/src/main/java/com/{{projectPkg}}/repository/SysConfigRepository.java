package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.SysConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SysConfigRepository extends JpaRepository<SysConfig, Long>, JpaSpecificationExecutor<SysConfig> {
    Optional<SysConfig> findByConfigKey(String configKey);
    boolean existsByConfigKey(String configKey);
}
