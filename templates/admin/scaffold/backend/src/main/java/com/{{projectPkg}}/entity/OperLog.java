package com.{{projectPkg}}.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sys_oper_log")
public class OperLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "module", length = 50)
    private String module;

    @Column(name = "description", length = 200)
    private String description;

    @Column(name = "method", length = 200)
    private String method;

    @Column(name = "request_url", length = 500)
    private String requestUrl;

    @Column(name = "request_method", length = 20)
    private String requestMethod;

    @Column(name = "request_params", columnDefinition = "TEXT")
    private String requestParams;

    @Column(name = "response_result", columnDefinition = "TEXT")
    private String responseResult;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "username", length = 50)
    private String username;

    @Column(name = "ip", length = 50)
    private String ip;

    @Column(name = "status")
    private Integer status = 1;

    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String errorMsg;

    @Column(name = "cost_time")
    private Long costTime;

    @Column(name = "oper_time")
    private LocalDateTime operTime;

    @PrePersist
    public void prePersist() {
        this.operTime = LocalDateTime.now();
    }
}
