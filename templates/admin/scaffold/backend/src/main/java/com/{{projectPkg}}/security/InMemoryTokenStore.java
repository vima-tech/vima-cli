package com.{{projectPkg}}.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 内存 Token 存储（缺省实现）：ConcurrentHashMap + 过期时间惰性清理。
 * 不依赖任何外部服务，进程重启后登录态丢失；多实例部署请切换 app.token-store=redis。
 */
@Component
@ConditionalOnProperty(name = "app.token-store", havingValue = "memory", matchIfMissing = true)
public class InMemoryTokenStore implements TokenStore {

    private record TokenEntry(String username, long expiresAt) {
        boolean expired(long now) {
            return now >= expiresAt;
        }
    }

    /** token → (username, 过期时间) */
    private final ConcurrentHashMap<String, TokenEntry> tokens = new ConcurrentHashMap<>();
    /** username → token 反查索引 */
    private final ConcurrentHashMap<String, String> userTokens = new ConcurrentHashMap<>();

    @Override
    public void saveToken(String token, String username, long ttlMillis) {
        // 同一用户重复登录：先失效旧 token，保持索引一致
        String oldToken = userTokens.put(username, token);
        if (oldToken != null && !oldToken.equals(token)) {
            tokens.remove(oldToken);
        }
        tokens.put(token, new TokenEntry(username, System.currentTimeMillis() + ttlMillis));
        purgeExpired();
    }

    @Override
    public String getUsernameByToken(String token) {
        if (token == null) {
            return null;
        }
        TokenEntry entry = tokens.get(token);
        if (entry == null) {
            return null;
        }
        if (entry.expired(System.currentTimeMillis())) {
            // 惰性清理：命中已过期条目时顺手移除
            tokens.remove(token, entry);
            userTokens.remove(entry.username(), token);
            return null;
        }
        return entry.username();
    }

    @Override
    public List<OnlineToken> list() {
        purgeExpired();
        return tokens.values().stream()
                .map(e -> new OnlineToken(e.username(), e.expiresAt()))
                .sorted(Comparator.comparing(OnlineToken::username))
                .toList();
    }

    @Override
    public void removeToken(String token) {
        if (token == null) {
            return;
        }
        TokenEntry entry = tokens.remove(token);
        if (entry != null) {
            userTokens.remove(entry.username(), token);
        }
    }

    @Override
    public void removeTokenByUsername(String username) {
        if (username == null) {
            return;
        }
        String token = userTokens.remove(username);
        if (token != null) {
            tokens.remove(token);
        }
    }

    /** 全量惰性清理：写入时触发，避免长期只写不读导致过期条目堆积。 */
    private void purgeExpired() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, TokenEntry>> it = tokens.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, TokenEntry> e = it.next();
            if (e.getValue().expired(now)) {
                it.remove();
                userTokens.remove(e.getValue().username(), e.getKey());
            }
        }
    }
}
