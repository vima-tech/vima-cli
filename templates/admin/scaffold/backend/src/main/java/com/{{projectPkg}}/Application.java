package com.{{projectPkg}};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
// 注解驱动调度（@Scheduled）的开关，目前唯一使用方是 MessagePushService 的 SSE 心跳。
// 业务定时任务（jobs/）走 JobRegistrar 编程式注册，不依赖这个注解；
// 两者共用 SchedulingConfig 里的 taskScheduler 线程池（@EnableScheduling 按 bean 名自动拾取）。
@EnableScheduling
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
