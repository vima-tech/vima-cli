package com.{{projectPkg}}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class SchedulingConfig {

    @Value("${scheduler.shutdown.wait:true}")
    private boolean waitForTasksOnShutdown;

    @Value("${scheduler.shutdown.await-seconds:30}")
    private int awaitTerminationSeconds;

    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("sys-job-");
        scheduler.setWaitForTasksToCompleteOnShutdown(waitForTasksOnShutdown);
        if (waitForTasksOnShutdown) {
            scheduler.setAwaitTerminationSeconds(awaitTerminationSeconds);
        }
        return scheduler;
    }
}
