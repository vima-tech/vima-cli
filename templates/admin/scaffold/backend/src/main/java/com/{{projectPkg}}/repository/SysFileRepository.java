package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.SysFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SysFileRepository extends JpaRepository<SysFile, Long> {
    Page<SysFile> findAllByOrderByCreateTimeDesc(Pageable pageable);
}
