package com.{{projectPkg}}.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 登录态签发与校验。
 * <p>
 * <b>这里签发的不是 JWT，而是不透明随机串（opaque token），映射关系存在 Redis。</b>
 * 选它而不是自包含 JWT，是因为管理后台需要"能立刻作废一个已发出的凭证"：
 * 强制下线、改密重登、账号禁用都要求服务端说了算，而签名 JWT 在过期前无法撤销。
 * 代价是每次请求要查一次 Redis——对管理后台的量级完全够用。
 * <p>
 * 所以本类与 {@link TokenAuthFilter} 都不叫 Jwt*：项目里没有任何 JWT，
 * 叫 JwtUtil/JwtFilter 只会让人以为改个 secret 就能换签名算法。
 */
@Component
@RequiredArgsConstructor
public class TokenService {

    /** 登录态存活毫秒数。 */
    @Value("${auth.token-ttl:86400000}")
    private long tokenTtl;

    private final TokenStore tokenStore;

    public String generateToken(String username) {
        String token = UUID.randomUUID().toString().replace("-", "");
        tokenStore.saveToken(token, username, tokenTtl);
        return token;
    }

    public String getUsernameFromToken(String token) {
        return tokenStore.getUsernameByToken(token);
    }

    public boolean validateToken(String token) {
        return tokenStore.getUsernameByToken(token) != null;
    }

    /**
     * 滑动续期：持续操作的用户不该在登录满 24h 时被硬踢下线。
     * 由 {@link TokenAuthFilter} 在每次认证通过后调用（两次 EXPIRE，不额外查库）。
     * <p>
     * 没有做"剩余时间不足才续"的优化：查剩余 TTL 本身就要一次 Redis 往返，
     * 和直接续期一样贵，加判断只会多一次往返。
     */
    public void renewToken(String token, String username) {
        tokenStore.refreshToken(token, username, tokenTtl);
    }

    public void removeToken(String token) {
        tokenStore.removeToken(token);
    }

    public void removeTokenByUsername(String username) {
        tokenStore.removeTokenByUsername(username);
    }
}
