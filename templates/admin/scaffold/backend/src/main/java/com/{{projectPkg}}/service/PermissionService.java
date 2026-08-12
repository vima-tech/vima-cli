package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * 权限装载：username → 角色 → 角色关联菜单（sys_role_menu）→ Menu.perms 集合。
 * <p>
 * admin 角色（roleKey=admin）视为超级管理员，perms 直接返回 ["*"] 通配。
 * <p>
 * <b>三个查询都走 Redis 缓存。</b>TokenAuthFilter 每个请求都要取一次 perms，直连数据库意味着
 * 每次点击都多一趟 JOIN 查询；缓存键按用户名分片，用户/角色/菜单变更时由下面的
 * {@link #evict(String)} / {@link #evictAll()} 主动失效，TTL 只作兜底。
 * 失效点在 UserService / RoleService / MenuService 的写方法里。
 */
@Service
@RequiredArgsConstructor
public class PermissionService {

    /** 超级管理员角色 roleKey。 */
    public static final String ADMIN_ROLE_KEY = "admin";
    /** 通配权限：拥有它即拥有全部按钮/接口权限。 */
    public static final String ALL_PERMS = "*";

    /** 缓存键前缀，evictAll 按此做 SCAN。 */
    private static final String CACHE_PREFIX = "perm:";
    private static final String PERMS_KEY = CACHE_PREFIX + "perms:";
    private static final String PATHS_KEY = CACHE_PREFIX + "paths:";
    private static final String ICONS_KEY = CACHE_PREFIX + "icons:";

    private final UserRepository userRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.perm-cache-ttl:1800}")
    private long cacheTtlSeconds;

    /**
     * 查该用户的按钮/接口权限串集合；admin 角色返回单元素 ["*"]。
     * 只统计启用状态（status=1）的角色与菜单，perms 为空的菜单（目录等）跳过。
     */
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Set<String> getPerms(String username) {
        Object cached = redisTemplate.opsForValue().get(PERMS_KEY + username);
        if (cached instanceof List<?> list) {
            return new LinkedHashSet<>((List<String>) list);
        }
        Set<String> perms = loadPerms(username);
        // 空集合也缓存：查无此人/无权限的请求同样会每次打到 TokenAuthFilter，不缓存等于放开缓存穿透
        cache(PERMS_KEY + username, new ArrayList<>(perms));
        return perms;
    }

    /**
     * 查该用户可见的菜单 path 列表（目录/菜单，不含按钮），供前端按权限过滤路由与侧边栏。
     */
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<String> getMenuPaths(String username) {
        Object cached = redisTemplate.opsForValue().get(PATHS_KEY + username);
        if (cached instanceof List<?> list) {
            return new ArrayList<>((List<String>) list);
        }
        List<String> paths = loadMenuPaths(username);
        cache(PATHS_KEY + username, new ArrayList<>(paths));
        return paths;
    }

    /**
     * 查该用户可见菜单的 path → icon 映射，供前端侧边栏取图标。
     * <p>
     * 单独给一份而不是塞进 menuPaths：menuPaths 是前端过滤菜单用的判定集合，
     * 语义是"能不能看"，往里塞展示属性会让两件事互相牵扯。
     * icon 的取值范围由前端 src/utils/menuIcons.ts 的预设集约束，
     * 后端不校验——查不到的名字前端会自动回落到默认图标，不会渲染成空白。
     */
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Map<String, String> getMenuIcons(String username) {
        Object cached = redisTemplate.opsForValue().get(ICONS_KEY + username);
        if (cached instanceof Map<?, ?> map) {
            return new LinkedHashMap<>((Map<String, String>) map);
        }
        Map<String, String> icons = loadMenuIcons(username);
        cache(ICONS_KEY + username, new LinkedHashMap<>(icons));
        return icons;
    }

    /** 失效单个用户的权限缓存：改其角色、重置密码、禁用、删除时调用。 */
    public void evict(String username) {
        if (username == null || username.isEmpty()) {
            return;
        }
        redisTemplate.delete(List.of(PERMS_KEY + username, PATHS_KEY + username, ICONS_KEY + username));
    }

    /**
     * 失效全部用户的权限缓存：角色的菜单授权、菜单本身的 perms/状态变更会影响一批人，
     * 挨个反查受影响用户不值当，直接清空重建。
     */
    public void evictAll() {
        ScanOptions options = ScanOptions.scanOptions().match(CACHE_PREFIX + "*").count(500).build();
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redisTemplate.scan(options)) {
            while (cursor.hasNext()) {
                keys.add(cursor.next());
            }
        }
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    private void cache(String key, Object value) {
        redisTemplate.opsForValue().set(key, value, cacheTtlSeconds, TimeUnit.SECONDS);
    }

    private Set<String> loadPerms(String username) {
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

    private List<String> loadMenuPaths(String username) {
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

    private Map<String, String> loadMenuIcons(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return Map.of();
        }
        Map<String, String> icons = new LinkedHashMap<>();
        user.getRoles().stream()
                .filter(r -> r.getStatus() != null && r.getStatus() == 1)
                .flatMap(r -> r.getMenus().stream())
                .filter(m -> m.getStatus() != null && m.getStatus() == 1)
                .filter(m -> m.getType() != null && m.getType() != 3)
                .filter(m -> m.getPath() != null && !m.getPath().isEmpty())
                .filter(m -> m.getIcon() != null && !m.getIcon().isEmpty())
                // 同一 path 多角色重复出现时保留先到的那个，不覆盖
                .forEach(m -> icons.putIfAbsent(m.getPath(), m.getIcon()));
        return icons;
    }
}
