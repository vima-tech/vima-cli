package com.{{projectPkg}}.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sys_login_log")
public class LoginLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", length = 50)
    private String username;

    @Column(name = "ip", length = 50)
    private String ip;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "browser", length = 50)
    private String browser;

    @Column(name = "os", length = 50)
    private String os;

    @Column(name = "status")
    private Integer status = 1;

    @Column(name = "msg", length = 500)
    private String msg;

    @Column(name = "login_time")
    private LocalDateTime loginTime;

    @PrePersist
    public void prePersist() {
        this.loginTime = LocalDateTime.now();
    }
}
