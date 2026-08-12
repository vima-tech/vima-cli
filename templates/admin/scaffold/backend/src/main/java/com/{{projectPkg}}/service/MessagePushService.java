package com.{{projectPkg}}.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 站内信实时推送通道（SSE）。
 *
 * 选 SSE 而不是 WebSocket：站内信只需要服务端 → 浏览器的单向下行，
 * SseEmitter 是 spring-webmvc 内建能力（零新增依赖），浏览器端 EventSource
 * 原生支持且自带断线重连；WebSocket 的双向通道在这里用不上。
 *
 * emitter 注册表放在实例内存里（单实例部署口径）。多实例部署时消息可能
 * 落在没有持有目标用户连接的实例上，需要换成 Redis pub/sub 把推送广播
 * 到所有实例——属于部署形态变更，此处不预置。
 */
@Service
public class MessagePushService {

    /**
     * username → 该用户当前打开的所有连接（同一账号可能开着多个标签页）。
     *
     * 用 username 而不是 userId 做 key 是刻意的：订阅请求的处理线程里绝不能碰数据库——
     * SSE 请求在 OSIV（open-in-view，Spring Boot 默认开启）下会把 EntityManager 绑定到
     * 整个异步请求生命周期，一旦在这个请求里执行过任何 JPA 查询，它拿到的数据库连接
     * 就会被攥到连接断开为止；每个订阅漏一条，连接池（默认 10）很快被打满，全站 API
     * 跟着卡死。username 在认证对象里现成就有，订阅路径因此做到零查询。
     */
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * 订阅。timeout 传 0 表示不因空闲而超时——SSE 是长连接，空闲是常态；
     * 连接死活由 30s 心跳探测判定，而不是靠超时。
     */
    public SseEmitter subscribe(String username) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(username, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(username, emitter));
        emitter.onTimeout(() -> remove(username, emitter));
        emitter.onError(e -> remove(username, emitter));
        try {
            // 立刻发一帧：EventSource 的 open 事件要等首帧到达才触发，
            // 不发的话前端要等到第一条业务消息才知道通道通了
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove(username, emitter);
        }
        return emitter;
    }

    /** 向某用户的全部在线连接推送一条命名事件；发送失败的连接顺手清理掉 */
    public void push(String username, String event, Object data) {
        List<SseEmitter> list = emitters.get(username);
        if (list == null) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(event).data(data));
            } catch (Exception e) {
                remove(username, emitter);
            }
        }
    }

    /**
     * 心跳：SSE 注释帧（浏览器端不触发任何事件）。一是防代理/网关掐掉空闲长连接，
     * 二是把已经死掉但没触发回调的连接从注册表里清出去。
     * 依赖 Application 上的 @EnableScheduling。
     */
    @Scheduled(fixedRate = 30_000)
    public void heartbeat() {
        emitters.forEach((username, list) -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    remove(username, emitter);
                }
            }
        });
    }

    private void remove(String username, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(username);
        if (list == null) {
            return;
        }
        list.remove(emitter);
        if (list.isEmpty()) {
            emitters.remove(username, list);
        }
    }
}
