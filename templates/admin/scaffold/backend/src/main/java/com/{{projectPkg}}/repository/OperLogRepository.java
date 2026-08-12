package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.OperLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface OperLogRepository extends JpaRepository<OperLog, Long>, JpaSpecificationExecutor<OperLog> {

    /**
     * 删除 time 之前的操作日志，返回删除条数。
     * 写成批量 delete 而不用派生的 deleteByOperTimeBefore：后者会先把命中行全部查进内存再逐条删，
     * 日志表动辄百万行，那样既慢又吃内存。
     */
    @Modifying
    @Query("delete from OperLog o where o.operTime < :time")
    int deleteOlderThan(@Param("time") LocalDateTime time);
}
