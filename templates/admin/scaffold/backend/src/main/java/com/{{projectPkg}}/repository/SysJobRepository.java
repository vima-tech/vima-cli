package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.SysJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SysJobRepository extends JpaRepository<SysJob, Long> {
    Page<SysJob> findByNameContaining(String name, Pageable pageable);
    List<SysJob> findByStatus(Integer status);
}
