package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.SysJob;
import com.{{projectPkg}}.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/monitor/job")
@RequiredArgsConstructor
public class JobController {
    private final JobService jobService;

    @GetMapping
    @PreAuthorize("@perm.has('monitor:job:list')")
    public ApiResponse<PageResponse<SysJob>> list(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(jobService.listJobs(name, pageNum, pageSize));
    }

    @PostMapping
    @PreAuthorize("@perm.has('monitor:job:add')")
    public ApiResponse<SysJob> create(@RequestBody SysJob job) {
        try {
            return ApiResponse.success(jobService.createJob(job));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('monitor:job:edit')")
    public ApiResponse<SysJob> update(@PathVariable Long id, @RequestBody SysJob job) {
        try {
            return ApiResponse.success(jobService.updateJob(id, job));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('monitor:job:remove')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        jobService.deleteJob(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/run")
    @PreAuthorize("@perm.has('monitor:job:run')")
    public ApiResponse<Void> run(@PathVariable Long id) {
        try {
            jobService.runOnce(id);
            return ApiResponse.success();
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping("/{id}/toggle")
    @PreAuthorize("@perm.has('monitor:job:toggle')")
    public ApiResponse<SysJob> toggle(@PathVariable Long id) {
        try {
            return ApiResponse.success(jobService.toggleJob(id));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
