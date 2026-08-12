package com.{{projectPkg}}.jobs;

/**
 * 定时任务处理器接口。实现类注册为 Spring Bean 后，
 * 即可在任务管理中通过 key 绑定并调度。
 */
public interface JobHandler {
    /** 任务唯一标识，供 SysJob.jobKey 绑定 */
    String key();

    /** 任务执行体 */
    void execute();
}
