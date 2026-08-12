package com.{{projectPkg}}.security;

/**
 * 在线用户条目：一个未过期 token 对应一名在线用户。
 *
 * @param username  登录用户名
 * @param expiresAt 过期时间（毫秒时间戳）
 */
public record OnlineToken(String username, long expiresAt) {
}
