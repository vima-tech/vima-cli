package com.{{projectPkg}}.service;

import com.{{projectPkg}}.security.OnlineToken;
import com.{{projectPkg}}.security.TokenStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OnlineUserService {
    private final TokenStore tokenStore;

    /** 当前在线用户列表（未过期登录态），按用户名排序。 */
    public List<OnlineToken> list() {
        return tokenStore.list();
    }

    /**
     * 强制下线指定用户（使其当前 token 失效）。
     *
     * @param username 被踢用户名
     * @param operator 当前操作者用户名（禁止踢自己）
     */
    public void kick(String username, String operator) {
        if (username.equals(operator)) {
            throw new IllegalArgumentException("不能强退自己，请使用退出登录");
        }
        tokenStore.removeTokenByUsername(username);
    }
}
