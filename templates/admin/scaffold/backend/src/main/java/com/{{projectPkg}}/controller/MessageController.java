package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Message;
import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import com.{{projectPkg}}.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/system/message")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService messageService;
    private final UserRepository userRepository;

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
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return user.getId();
    }
}
