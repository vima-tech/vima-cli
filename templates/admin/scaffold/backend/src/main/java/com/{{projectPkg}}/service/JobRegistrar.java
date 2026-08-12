package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.SysJob;
import com.{{projectPkg}}.jobs.JobHandler;
import com.{{projectPkg}}.repository.SysJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 任务登记簿：维护 jobKey -> JobHandler 的映射，
 * 以及 jobId -> ScheduledFuture 的调度句柄；
 * 应用启动时把 status=1 的任务注册到调度器。
 */
@Slf4j
@Component
public class JobRegistrar implements ApplicationRunner {
    private final SysJobRepository sysJobRepository;
    private final ThreadPoolTaskScheduler taskScheduler;
    private final Map<String, JobHandler> handlers;
    private final Map<Long, ScheduledFuture<?>> futures = new ConcurrentHashMap<>();

    public JobRegistrar(SysJobRepository sysJobRepository,
                        ThreadPoolTaskScheduler taskScheduler,
                        List<JobHandler> jobHandlers) {
        this.sysJobRepository = sysJobRepository;
        this.taskScheduler = taskScheduler;
        this.handlers = jobHandlers.stream()
                .collect(Collectors.toMap(JobHandler::key, Function.identity()));
    }

    @Override
    public void run(ApplicationArguments args) {
        List<SysJob> enabled = sysJobRepository.findByStatus(1);
        for (SysJob job : enabled) {
            register(job);
        }
        log.info("[JobRegistrar] {} enabled job(s) scheduled on startup", enabled.size());
    }

    /** 可绑定的全部 jobKey */
    public Set<String> availableKeys() {
        return handlers.keySet();
    }

    public JobHandler getHandler(String jobKey) {
        return handlers.get(jobKey);
    }

    /** 注册（或重登记）一个任务：先注销旧的，再按 cron 调度 */
    public void register(SysJob job) {
        unregister(job.getId());
        JobHandler handler = handlers.get(job.getJobKey());
        if (handler == null) {
            log.warn("[JobRegistrar] job {} skipped: no handler for key '{}'", job.getId(), job.getJobKey());
            return;
        }
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> safeExecute(job, handler),
                new CronTrigger(job.getCron()));
        futures.put(job.getId(), future);
        log.info("[JobRegistrar] job {} ({}) scheduled with cron '{}'", job.getId(), job.getName(), job.getCron());
    }

    /** 注销一个任务：cancel 并移除句柄，成对于 register */
    public void unregister(Long jobId) {
        ScheduledFuture<?> future = futures.remove(jobId);
        if (future != null) {
            future.cancel(false);
            log.info("[JobRegistrar] job {} unscheduled", jobId);
        }
    }

    private void safeExecute(SysJob job, JobHandler handler) {
        try {
            handler.execute();
        } catch (Exception e) {
            log.error("[JobRegistrar] job {} ({}) execute failed: {}", job.getId(), job.getName(), e.getMessage(), e);
        }
    }
}
