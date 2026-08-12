package com.{{projectPkg}}.jobs;

import com.{{projectPkg}}.service.LogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 数据库日志清理任务（jobKey=dbLogCleanup）：
 * 删除 log.retain-days 天之前的操作日志与登录日志。
 *
 * 与 LogArchiveJob 共用同一个保留天数，但拆成两个任务：
 * 一个动磁盘、一个动数据库，失败域不同（数据库连不上不该连累文件归档），
 * 也便于按需单独停用。
 */
@Slf4j
@Component
public class DbLogRetentionJob implements JobHandler {

    private final LogService logService;
    private final int retainDays;

    public DbLogRetentionJob(LogService logService,
                             @Value("${log.retain-days:30}") int retainDays) {
        this.logService = logService;
        this.retainDays = retainDays;
    }

    @Override
    public String key() {
        return "dbLogCleanup";
    }

    @Override
    public void execute() {
        if (retainDays < 1) {
            log.error("[DbLogRetentionJob] 配置非法：log.retain-days={} 必须 ≥ 1，本次不执行", retainDays);
            return;
        }
        LocalDateTime deleteBefore = LocalDateTime.now().minusDays(retainDays);
        int operDeleted = logService.purgeOperLogsBefore(deleteBefore);
        int loginDeleted = logService.purgeLoginLogsBefore(deleteBefore);
        log.info("[DbLogRetentionJob] 清理 {} 之前的日志：操作日志 {} 条，登录日志 {} 条（保留 {} 天）",
                deleteBefore, operDeleted, loginDeleted, retainDays);
    }
}
