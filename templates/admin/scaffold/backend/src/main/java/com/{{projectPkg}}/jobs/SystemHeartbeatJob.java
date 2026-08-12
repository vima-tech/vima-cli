package com.{{projectPkg}}.jobs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 示例任务：系统心跳，仅打印一行日志。
 */
@Slf4j
@Component
public class SystemHeartbeatJob implements JobHandler {

    @Override
    public String key() {
        return "systemHeartbeat";
    }

    @Override
    public void execute() {
        log.info("[SystemHeartbeatJob] heartbeat ok");
    }
}
