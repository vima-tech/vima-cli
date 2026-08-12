package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 权限装载：username → 角色 → 角色关联菜单（sys_role_menu）→ Menu.perms 集合。
 * <p>
 * admin 角色（roleKey=admin）视为超级管理员，perms 直接返回 ["*"] 通配。
 * 每次请求都会查一次库（JwtFilter 调用）；H2/单机场景可接受，
 * 如需优化可在此加 Caffeine/Redis 缓存（key=username，用户/角色/菜单变更时失效）。
 */
@Service
@RequiredArgsConstructor
public class PermissionService {

    /** 超级管理员角色 roleKey。 */
    public static final String ADMIN_ROLE_KEY = "admin";
    /** 通配权限：拥有它即拥有全部按钮/接口权限。 */
    public static final String ALL_PERMS = "*";

    private final UserRepository userRepository;

    /**
     * 查该用户的按钮/接口权限串集合；admin 角色返回单元素 ["*"]。
     * 只统计启用状态（status=1）的角色与菜单，perms 为空的菜单（目录等）跳过。
     */
    @Transactional(readOnly = true)
    public Set<String> getPerms(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return Set.of();
        }
        boolean isAdmin = user.getRoles().stream()
                .filter(r -> r.getStatus() != null && r.getStatus() == 1)
                .anyMatch(r -> ADMIN_ROLE_KEY.equals(r.getRoleKey()));
        if (isAdmin) {
            return Set.of(ALL_PERMS);
        }
        Set<String> perms = new LinkedHashSet<>();
        user.getRoles().stream()
                .filter(r -> r.getStatus() != null && r.getStatus() == 1)
                .flatMap(r -> r.getMenus().stream())
                .filter(m -> m.getStatus() != null && m.getStatus() == 1)
                .map(m -> m.getPerms())
                .filter(p -> p != null && !p.isEmpty())
                .forEach(perms::add);
        return perms;
    }

    /**
     * 查该用户可见的菜单 path 列表（目录/菜单，不含按钮），供前端按权限过滤路由与侧边栏。
     */
    @Transactional(readOnly = true)
    public List<String> getMenuPaths(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return List.of();
        }
        return user.getRoles().stream()
                .filter(r -> r.getStatus() != null && r.getStatus() == 1)
                .flatMap(r -> r.getMenus().stream())
                .filter(m -> m.getStatus() != null && m.getStatus() == 1)
                // type: 1=目录 2=菜单 3=按钮（见 sys_menu_type 字典）；按钮无路由，排除
                .filter(m -> m.getType() != null && m.getType() != 3)
                .map(m -> m.getPath())
                .filter(p -> p != null && !p.isEmpty())
                .distinct()
                .sorted()
                .toList();
    }
}
