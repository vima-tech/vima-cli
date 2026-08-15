package com.{{projectPkg}}.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;

/** 基于 Redis 的登录失败窗口计数；多实例共享，且 key 不暴露用户名/IP 明文。 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final String PREFIX = "auth:login-attempt:";

    private final StringRedisTemplate redisTemplate;

    public void assertAllowed(String ip, String username) {
        String value = redisTemplate.opsForValue().get(key(ip, username));
        if (value != null && Integer.parseInt(value) >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("登录尝试过于频繁，请 15 分钟后再试");
        }
    }

    public void recordFailure(String ip, String username) {
        String key = key(ip, username);
        Long attempts = redisTemplate.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(key, WINDOW);
        }
    }

    public void clear(String ip, String username) {
        redisTemplate.delete(key(ip, username));
    }

    private String key(String ip, String username) {
        String raw = String.valueOf(ip) + '\0' + String.valueOf(username).toLowerCase(Locale.ROOT);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return PREFIX + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JVM 缺少 SHA-256", e);
        }
    }
}
