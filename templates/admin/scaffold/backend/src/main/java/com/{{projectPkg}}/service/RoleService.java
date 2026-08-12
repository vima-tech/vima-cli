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
            throw new RuntimeException("角色标识已存在");
        }
        return roleRepository.save(role);
    }

    public Role updateRole(Role role) {
        Role existing = roleRepository.findById(role.getId())
                .orElseThrow(() -> new RuntimeException("角色不存在"));
        
        existing.setRoleName(role.getRoleName());
        existing.setSort(role.getSort());
        existing.setStatus(role.getStatus());
        existing.setRemark(role.getRemark());
        
        return roleRepository.save(existing);
    }

    public void deleteRole(Long id) {
        roleRepository.deleteById(id);
    }

    public List<Long> getRoleMenuIds(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("角色不存在"));
        return role.getMenus().stream().map(Menu::getId).collect(Collectors.toList());
    }

    public void assignRoleMenus(Long roleId, List<Long> menuIds) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("角色不存在"));
        
        List<Menu> menus = menuRepository.findAllById(menuIds);
        role.setMenus(new HashSet<>(menus));
        roleRepository.save(role);
    }
}
