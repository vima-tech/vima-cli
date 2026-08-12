package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.LoginLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface LoginLogRepository extends JpaRepository<LoginLog, Long>, JpaSpecificationExecutor<LoginLog> {

    /** 删除 time 之前的登录日志，返回删除条数。批量 delete 的理由同 OperLogRepository */
    @Modifying
    @Query("delete from LoginLog l where l.loginTime < :time")
    int deleteOlderThan(@Param("time") LocalDateTime time);
}
