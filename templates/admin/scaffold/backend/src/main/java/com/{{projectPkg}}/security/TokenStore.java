package com.{{projectPkg}}.security;

import java.util.List;

/**
 * 登录态存储抽象：token 的保存 / 查询 / 续期 / 失效。
 * <p>
 * 唯一实现是 {@link RedisTokenStore}——登录态必须活过进程重启、且多实例要共享，
 * 所以 Redis 是本脚手架的必需组件而非可选项。曾经的进程内存实现已移除：
 * 它会让每次重启后端都把所有人踢下线，且不同实例各存各的。
 */
public interface TokenStore {

    /** 保存 token → username 映射（同时维护 username → token 反查索引），ttlMillis 毫秒后过期。 */
    void saveToken(String token, String username, long ttlMillis);

    /** 列出当前所有未过期的登录态（在线用户），按用户名排序。 */
    List<OnlineToken> list();

    /** 按 token 查用户名；不存在或已过期返回 null。 */
    String getUsernameByToken(String token);

    /**
     * 滑动续期：把该 token 及其反查索引的存活时间重置为 ttlMillis。
     * username 由调用方传入（认证时已查得），省掉一次反查往返；token 已消失时不会复活它。
     */
    void refreshToken(String token, String username, long ttlMillis);

    /** 使指定 token 失效（连同其用户的反查索引）。 */
    void removeToken(String token);

    /** 使指定用户当前的 token 失效（踢下线 / 改密后强制重登）。 */
    void removeTokenByUsername(String username);
}
