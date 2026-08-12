package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.OperLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperLogRepository extends JpaRepository<OperLog, Long> {
    Page<OperLog> findAllByOrderByOperTimeDesc(Pageable pageable);
}
