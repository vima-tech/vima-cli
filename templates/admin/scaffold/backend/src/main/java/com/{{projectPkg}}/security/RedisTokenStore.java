package com.{{projectPkg}}.security;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Redis 登录态存储：token → username 正查 + username → token 反查，两条 key 同 TTL。
 * <p>
 * 反查索引让"同一账号重复登录顶掉旧会话""管理员强制某人下线""改密后强制重登"
 * 都变成一次 O(1) 删除；过期由 Redis 的 TTL 负责，无需清理任务。
 */
@Component
@RequiredArgsConstructor
public class RedisTokenStore implements TokenStore {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String TOKEN_PREFIX = "token:";
    private static final String USER_TOKEN_PREFIX = "user:token:";

    @Override
    public void saveToken(String token, String username, long ttlMillis) {
        // 同一用户重复登录：先失效旧 token，避免旧会话继续可用、也避免在线列表里出现两条
        Object oldToken = redisTemplate.opsForValue().get(USER_TOKEN_PREFIX + username);
        if (oldToken != null && !oldToken.toString().equals(token)) {
            redisTemplate.delete(TOKEN_PREFIX + oldToken);
        }
        redisTemplate.opsForValue().set(TOKEN_PREFIX + token, username, ttlMillis, TimeUnit.MILLISECONDS);
        redisTemplate.opsForValue().set(USER_TOKEN_PREFIX + username, token, ttlMillis, TimeUnit.MILLISECONDS);
    }

    @Override
    public String getUsernameByToken(String token) {
        if (token == null) {
            return null;
        }
        Object username = redisTemplate.opsForValue().get(TOKEN_PREFIX + token);
        return username != null ? username.toString() : null;
    }

    @Override
    public void refreshToken(String token, String username, long ttlMillis) {
        if (token == null || username == null) {
            return;
        }
        // EXPIRE 对不存在的 key 是空操作，不会把已被踢掉的登录态复活
        redisTemplate.expire(TOKEN_PREFIX + token, ttlMillis, TimeUnit.MILLISECONDS);
        redisTemplate.expire(USER_TOKEN_PREFIX + username, ttlMillis, TimeUnit.MILLISECONDS);
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
        if (username == null) {
            return;
        }
        Object token = redisTemplate.opsForValue().get(USER_TOKEN_PREFIX + username);
        if (token != null) {
            redisTemplate.delete(TOKEN_PREFIX + token);
        }
        redisTemplate.delete(USER_TOKEN_PREFIX + username);
    }
}
