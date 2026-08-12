package com.{{projectPkg}}.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 按钮级权限校验器，配合方法安全使用：
 * <pre>@PreAuthorize("@perm.has('system:user:add')")</pre>
 * 当前用户 authorities 中含目标权限串、或含 "*"（admin 通配）即放行。
 * authorities 由 {@link TokenAuthFilter} 在认证时装入。
 */
@Component("perm")
public class PermChecker {

    public boolean has(String perm) {
        if (perm == null || perm.isEmpty()) {
            return false;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String value = authority.getAuthority();
            if ("*".equals(value) || perm.equals(value)) {
                return true;
            }
        }
        return false;
    }
}
