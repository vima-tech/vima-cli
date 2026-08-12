package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    Page<Message> findByUserIdOrderByCreateTimeDesc(Long userId, Pageable pageable);
    
    Page<Message> findByUserIdAndStatusOrderByCreateTimeDesc(Long userId, Integer status, Pageable pageable);
    
    long countByUserIdAndStatus(Long userId, Integer status);
}
