package com.{{projectPkg}}.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtUtil {

    @Value("${jwt.secret:change-me-in-production-secret-key-must-be-at-least-256-bits-long!!}")
    private String secret;

    @Value("${jwt.expiration:86400000}")
    private long expiration;

    private final TokenStore tokenStore;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String username) {
        String token = UUID.randomUUID().toString().replace("-", "");
        tokenStore.saveToken(token, username, expiration);
        return token;
    }

    public String getUsernameFromToken(String token) {
        return tokenStore.getUsernameByToken(token);
    }

    public boolean validateToken(String token) {
        return tokenStore.getUsernameByToken(token) != null;
    }

    public void removeToken(String token) {
        tokenStore.removeToken(token);
    }

    public void removeTokenByUsername(String username) {
        tokenStore.removeTokenByUsername(username);
    }
}
