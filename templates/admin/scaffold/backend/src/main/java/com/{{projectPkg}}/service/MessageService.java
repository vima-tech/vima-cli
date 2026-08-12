package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Message;
import com.{{projectPkg}}.repository.MessageRepository;
import com.{{projectPkg}}.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MessageService {
    private final MessageRepository messageRepository;
    private final MessagePushService messagePushService;
    private final UserRepository userRepository;

    public PageResponse<Message> listMessages(Long userId, Integer status, int pageNum, int pageSize) {
        Page<Message> page;
        
        if (status != null) {
            page = messageRepository.findByUserIdAndStatusOrderByCreateTimeDesc(userId, status, PageRequest.of(pageNum - 1, pageSize));
        } else {
            page = messageRepository.findByUserIdOrderByCreateTimeDesc(userId, PageRequest.of(pageNum - 1, pageSize));
        }

        return PageResponse.<Message>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public long getUnreadCount(Long userId) {
        return messageRepository.countByUserIdAndStatus(userId, 0);
    }

    public void markAsRead(Long id) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("消息不存在"));
        message.setStatus(1);
        messageRepository.save(message);
    }

    public void markAllAsRead(Long userId) {
        Page<Message> page = messageRepository.findByUserIdAndStatusOrderByCreateTimeDesc(
                userId, 0, PageRequest.of(0, Integer.MAX_VALUE));
        
        page.getContent().forEach(m -> m.setStatus(1));
        messageRepository.saveAll(page.getContent());
    }

    public Message sendMessage(Message message) {
        Message saved = messageRepository.save(message);
        // 入库成功后实时下发。接收方不在线时 push 是空操作，消息仍能从列表拉到——
        // SSE 只负责"在线时立刻看到"，不承担可靠送达。
        // 推送注册表按 username 组织（原因见 MessagePushService），这里查一次收件人用户名；
        // 本方法跑在普通短请求里，查询用完即还连接，没有 SSE 那个攥连接的问题
        userRepository.findById(saved.getUserId())
                .ifPresent(user -> messagePushService.push(user.getUsername(), "sys-message", saved));
        return saved;
    }
}
