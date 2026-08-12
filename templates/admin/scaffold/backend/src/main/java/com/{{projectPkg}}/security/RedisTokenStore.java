package com.{{projectPkg}}.security;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Redis Token 存储：多实例共享登录态时使用。
 * 启用方式：application.yml 设置 app.token-store=redis，并配置 spring.data.redis.*。
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.token-store", havingValue = "redis")
public class RedisTokenStore implements TokenStore {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String TOKEN_PREFIX = "token:";
    private static final String USER_TOKEN_PREFIX = "user:token:";

    @Override
    public void saveToken(String token, String username, long ttlMillis) {
        String tokenKey = TOKEN_PREFIX + token;
        String userTokenKey = USER_TOKEN_PREFIX + username;

        redisTemplate.opsForValue().set(tokenKey, username, ttlMillis, TimeUnit.MILLISECONDS);
        redisTemplate.opsForValue().set(userTokenKey, token, ttlMillis, TimeUnit.MILLISECONDS);
    }

    @Override
    public String getUsernameByToken(String token) {
        Object username = redisTemplate.opsForValue().get(TOKEN_PREFIX + token);
        return username != null ? username.toString() : null;
    }

    @Override
    public List<OnlineToken> list() {
        // 用 SCAN 而非 KEYS，避免一次性阻塞 Redis；但仍是全库游标遍历 token:* + 每个 key 一次 GET + TTL，
        // 复杂度 O(全库 key 数 + 在线数 * 2 次往返)。在线用户量大时代价明显，
        // 届时可改为单独维护一个 ZSET 索引（member=username, score=过期时间戳）直接范围查询。
        List<OnlineToken> result = new ArrayList<>();
        long now = System.currentTimeMillis();
        ScanOptions options = ScanOptions.scanOptions().match(TOKEN_PREFIX + "*").count(500).build();
        try (Cursor<String> cursor = redisTemplate.scan(options)) {
            while (cursor.hasNext()) {
                String key = cursor.next();
                Object username = redisTemplate.opsForValue().get(key);
                Long ttlMillis = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
                if (username == null || ttlMillis == null || ttlMillis < 0) {
                    continue; // 已过期/无 TTL 的条目不算在线
                }
                result.add(new OnlineToken(username.toString(), now + ttlMillis));
            }
        }
        result.sort(Comparator.comparing(OnlineToken::username));
        return result;
    }

    @Override
    public void removeToken(String token) {
        String username = getUsernameByToken(token);
        if (username != null) {
            redisTemplate.delete(USER_TOKEN_PREFIX + username);
        }
        redisTemplate.delete(TOKEN_PREFIX + token);
    }

    @Override
    public void removeTokenByUsername(String username) {
        Object token = redisTemplate.opsForValue().get(USER_TOKEN_PREFIX + username);
        if (token != null) {
            redisTemplate.delete(TOKEN_PREFIX + token);
        }
        redisTemplate.delete(USER_TOKEN_PREFIX + username);
    }
}
