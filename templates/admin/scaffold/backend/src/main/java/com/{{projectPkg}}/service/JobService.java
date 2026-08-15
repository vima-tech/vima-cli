package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysJob;
import com.{{projectPkg}}.jobs.JobHandler;
import com.{{projectPkg}}.repository.SysJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class JobService {
    private final SysJobRepository sysJobRepository;
    private final JobRegistrar jobRegistrar;

    public PageResponse<SysJob> listJobs(String name, int pageNum, int pageSize) {
        Pageable pageable = PageRequest.of(pageNum - 1, pageSize, Sort.by("id").descending());
        Page<SysJob> page = StringUtils.hasText(name)
                ? sysJobRepository.findByNameContaining(name, pageable)
                : sysJobRepository.findAll(pageable);
        return PageResponse.<SysJob>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public SysJob createJob(SysJob job) {
        validate(job);
        job.setId(null);
        if (job.getStatus() == null) {
            job.setStatus(0);
        }
        SysJob saved = sysJobRepository.save(job);
        if (saved.getStatus() == 1) {
            jobRegistrar.register(saved);
        }
        return saved;
    }

    public SysJob updateJob(Long id, SysJob job) {
        SysJob existing = sysJobRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在"));
        job.setId(id);
        validate(job);
        existing.setName(job.getName());
        existing.setJobKey(job.getJobKey());
        existing.setCron(job.getCron());
        existing.setRemark(job.getRemark());
        if (job.getStatus() != null) {
            existing.setStatus(job.getStatus());
        }
        SysJob saved = sysJobRepository.save(existing);
        jobRegistrar.unregister(saved.getId());
        if (saved.getStatus() == 1) {
            jobRegistrar.register(saved);
        }
        return saved;
    }

    public void deleteJob(Long id) {
        jobRegistrar.unregister(id);
        sysJobRepository.deleteById(id);
    }

    /** 启停切换：0->1 登记调度，1->0 注销调度 */
    public SysJob toggleJob(Long id) {
        SysJob job = sysJobRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在"));
        if (job.getStatus() == 1) {
            job.setStatus(0);
            SysJob saved = sysJobRepository.save(job);
            jobRegistrar.unregister(saved.getId());
            return saved;
        }
        validate(job);
        job.setStatus(1);
        SysJob saved = sysJobRepository.save(job);
        jobRegistrar.register(saved);
        return saved;
    }

    /** 立即执行一次，不影响既有调度计划 */
    public void runOnce(Long id) {
        SysJob job = sysJobRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在"));
        JobHandler handler = jobRegistrar.getHandler(job.getJobKey());
        if (handler == null) {
            throw new IllegalArgumentException("任务处理器不存在: " + job.getJobKey()
                    + "，可选: " + jobRegistrar.availableKeys());
        }
        handler.execute();
    }

    private void validate(SysJob job) {
        if (!StringUtils.hasText(job.getName())) {
            throw new IllegalArgumentException("任务名称不能为空");
        }
        if (!StringUtils.hasText(job.getCron())) {
            throw new IllegalArgumentException("cron 表达式不能为空");
        }
        try {
            CronExpression.parse(job.getCron());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("cron 表达式非法: " + job.getCron());
        }
        if (!StringUtils.hasText(job.getJobKey())
                || jobRegistrar.getHandler(job.getJobKey()) == null) {
            throw new IllegalArgumentException("jobKey 未注册: " + job.getJobKey()
                    + "，可选: " + jobRegistrar.availableKeys());
        }
    }
}
