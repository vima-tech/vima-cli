package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Message;
import com.{{projectPkg}}.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MessageService {
    private final MessageRepository messageRepository;

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
        return messageRepository.save(message);
    }
}
