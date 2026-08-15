package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Message;
import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import com.{{projectPkg}}.service.MessagePushService;
import com.{{projectPkg}}.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 站内信是"本人语义"的功能（查自己的、读自己的），全员可用，故整个控制器
 * 不挂权限点——这是有意为之的鉴权边界，不是遗漏。发送同理（演示用途）。
 */
@RestController
@RequestMapping("/api/system/message")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService messageService;
    private final MessagePushService messagePushService;
    private final UserRepository userRepository;

    /**
     * SSE 订阅端点（实时推送通道）。前端用 EventSource 连接；EventSource 无法
     * 自定义请求头，token 从 query 参数带入，由 TokenAuthFilter 对本端点特殊放行。
     *
     * 注意：这里必须直接用 authentication.getName()，不能调 getUserId()——
     * 本端点的请求线程里不允许任何 JPA 查询，否则 OSIV 会让每个订阅
     * 攥死一条数据库连接，原因见 MessagePushService 的注释。
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Authentication authentication) {
        return messagePushService.subscribe(authentication.getName());
    }

    @GetMapping("/list")
    public ApiResponse<PageResponse<Message>> list(
            Authentication authentication,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        Long userId = getUserId(authentication);
        PageResponse<Message> page = messageService.listMessages(userId, status, pageNum, pageSize);
        return ApiResponse.success(page);
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> getUnreadCount(Authentication authentication) {
        Long userId = getUserId(authentication);
        return ApiResponse.success(messageService.getUnreadCount(userId));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(@PathVariable Long id) {
        messageService.markAsRead(id);
        return ApiResponse.success();
    }

    @PutMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(Authentication authentication) {
        Long userId = getUserId(authentication);
        messageService.markAllAsRead(userId);
        return ApiResponse.success();
    }

    @PostMapping
    public ApiResponse<Message> send(@RequestBody Message message) {
        return ApiResponse.success(messageService.sendMessage(message));
    }

    private Long getUserId(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        return user.getId();
    }
}
