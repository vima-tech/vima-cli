package com.{{projectPkg}}.security;

import java.util.List;

/**
 * Token 存储抽象：登录态的保存 / 查询 / 失效。
 * <p>
 * 通过 application.yml 的 {@code app.token-store} 切换实现：
 * <ul>
 *   <li>{@code memory}（缺省）— {@link InMemoryTokenStore}，零外部依赖，适合开发与单机部署；</li>
 *   <li>{@code redis} — {@link RedisTokenStore}，多实例共享登录态时使用。</li>
 * </ul>
 */
public interface TokenStore {

    /** 保存 token → username 映射（同时维护 username → token 反查索引），ttlMillis 毫秒后过期。 */
    void saveToken(String token, String username, long ttlMillis);

    /** 列出当前所有未过期的登录态（在线用户），按用户名排序。 */
    List<OnlineToken> list();

    /** 按 token 查用户名；不存在或已过期返回 null。 */
    String getUsernameByToken(String token);

    /** 使指定 token 失效（连同其用户的反查索引）。 */
    void removeToken(String token);

    /** 使指定用户当前的 token 失效（踢下线 / 改密后强制重登）。 */
    void removeTokenByUsername(String username);
}
