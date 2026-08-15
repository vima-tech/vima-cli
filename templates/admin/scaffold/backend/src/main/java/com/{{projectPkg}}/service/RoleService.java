package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Menu;
import com.{{projectPkg}}.entity.Role;
import com.{{projectPkg}}.repository.MenuRepository;
import com.{{projectPkg}}.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleService {
    private final RoleRepository roleRepository;
    private final MenuRepository menuRepository;
    /** 角色的启用状态与菜单授权会影响一批用户的权限，改动后需整体失效权限缓存。 */
    private final PermissionService permissionService;

    public PageResponse<Role> listRoles(String roleName, String roleKey, int pageNum, int pageSize) {
        Specification<Role> spec = Specification.where(null);

        if (roleName != null && !roleName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("roleName"), "%" + roleName + "%"));
        }
        if (roleKey != null && !roleKey.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("roleKey"), "%" + roleKey + "%"));
        }

        Page<Role> page = roleRepository.findAll(spec, PageRequest.of(pageNum - 1, pageSize, Sort.by("sort")));

        return PageResponse.<Role>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public List<Role> getAllRoles() {
        return roleRepository.findAll(Sort.by("sort"));
    }

    public Role createRole(Role role) {
        if (roleRepository.existsByRoleKey(role.getRoleKey())) {
            throw new IllegalArgumentException("角色标识已存在");
        }
        return roleRepository.save(role);
    }

    public Role updateRole(Role role) {
        Role existing = roleRepository.findById(role.getId())
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
        
        existing.setRoleName(role.getRoleName());
        existing.setSort(role.getSort());
        existing.setStatus(role.getStatus());
        existing.setRemark(role.getRemark());
        
        Role saved = roleRepository.save(existing);
        // status 可能被停用，持该角色的用户权限随之变化
        permissionService.evictAll();
        return saved;
    }

    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
        // roleKey=admin 是 PermissionService 写死的超管通配标识，删掉它系统就没有超管了。
        // updateRole 不复制 roleKey（改不掉），删除是唯一能碰掉它的口子，必须堵上。
        if (PermissionService.ADMIN_ROLE_KEY.equals(role.getRoleKey())) {
            throw new IllegalArgumentException("内置管理员角色不可删除");
        }
        roleRepository.deleteById(id);
        permissionService.evictAll();
    }

    public List<Long> getRoleMenuIds(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
        return role.getMenus().stream().map(Menu::getId).collect(Collectors.toList());
    }

    public void assignRoleMenus(Long roleId, List<Long> menuIds) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
        
        List<Menu> menus = menuRepository.findAllById(menuIds);
        role.setMenus(new HashSet<>(menus));
        roleRepository.save(role);
        // 授权变更直接改写这批人的按钮级权限，必须立刻生效
        permissionService.evictAll();
    }
}
