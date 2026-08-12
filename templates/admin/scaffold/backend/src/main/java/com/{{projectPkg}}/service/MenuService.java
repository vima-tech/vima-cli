package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.Menu;
import com.{{projectPkg}}.repository.MenuRepository;
import com.{{projectPkg}}.security.PermRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MenuService {
    private final MenuRepository menuRepository;
    /** 菜单的 perms/status/path 变更会改写所有关联角色的权限视图。 */
    private final PermissionService permissionService;

    public List<Menu> listMenus() {
        return menuRepository.findByStatusOrderBySort(1);
    }

    public List<Menu> getMenuTree() {
        List<Menu> allMenus = menuRepository.findByStatusOrderBySort(1);
        return buildTree(allMenus, 0L);
    }

    public List<Menu> getMenuTreeByRoleId(Long roleId) {
        List<Menu> menus = menuRepository.findByRoleId(roleId);
        return buildTree(menus, 0L);
    }

    public Menu createMenu(Menu menu) {
        menu.setPerms(normalizePerms(menu.getPerms()));
        return menuRepository.save(menu);
    }

    public Menu updateMenu(Menu menu) {
        Menu existing = menuRepository.findById(menu.getId())
                .orElseThrow(() -> new RuntimeException("菜单不存在"));

        menu.setPerms(normalizePerms(menu.getPerms()));
        existing.setName(menu.getName());
        existing.setParentId(menu.getParentId());
        existing.setPath(menu.getPath());
        existing.setComponent(menu.getComponent());
        existing.setIcon(menu.getIcon());
        existing.setSort(menu.getSort());
        existing.setType(menu.getType());
        existing.setVisible(menu.getVisible());
        existing.setStatus(menu.getStatus());
        existing.setPerms(menu.getPerms());
        
        Menu saved = menuRepository.save(existing);
        permissionService.evictAll();
        return saved;
    }

    public void deleteMenu(Long id) {
        menuRepository.deleteById(id);
        permissionService.evictAll();
    }

    /**
     * 权限标识只做格式校验（模块:实体:动作），不强校验"必须存在于代码注解中"：
     * 正常流程是先部署带 @PreAuthorize 的代码再配菜单，但也允许先配后发。
     * 是否与代码一致由前端用 PermRegistry 的选项对账并对漂移项标红提示。
     */
    private String normalizePerms(String perms) {
        if (perms == null || perms.isBlank()) {
            return null;
        }
        String trimmed = perms.trim();
        if (trimmed.length() > 100) {
            throw new IllegalArgumentException("权限标识长度不能超过 100 字符");
        }
        if (!PermRegistry.PERM_FORMAT.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("权限标识格式应为 模块:实体:动作（如 system:user:add）");
        }
        return trimmed;
    }

    private List<Menu> buildTree(List<Menu> menus, Long parentId) {
        return menus.stream()
                .filter(m -> parentId.equals(m.getParentId()))
                .map(m -> {
                    m.setChildren(buildTree(menus, m.getId()));
                    return m;
                })
                .collect(Collectors.toList());
    }
}
