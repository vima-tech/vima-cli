package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.Menu;
import com.{{projectPkg}}.repository.MenuRepository;
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
        return menuRepository.save(menu);
    }

    public Menu updateMenu(Menu menu) {
        Menu existing = menuRepository.findById(menu.getId())
                .orElseThrow(() -> new RuntimeException("菜单不存在"));
        
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
        
        return menuRepository.save(existing);
    }

    public void deleteMenu(Long id) {
        menuRepository.deleteById(id);
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
