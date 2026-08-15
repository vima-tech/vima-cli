package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.Role;
import com.{{projectPkg}}.service.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/role")
@RequiredArgsConstructor
public class RoleController {
    private final RoleService roleService;

    @PreAuthorize("@perm.has('system:role:list')")
    @GetMapping("/list")
    public ApiResponse<PageResponse<Role>> list(
            @RequestParam(required = false) String roleName,
            @RequestParam(required = false) String roleKey,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        PageResponse<Role> page = roleService.listRoles(roleName, roleKey, pageNum, pageSize);
        return ApiResponse.success(page);
    }

    /** 不加权限点：用户管理弹窗的角色下拉要用，只暴露角色名称级信息。 */
    @GetMapping("/all")
    public ApiResponse<List<Role>> getAll() {
        return ApiResponse.success(roleService.getAllRoles());
    }

    @PreAuthorize("@perm.has('system:role:add')")
    @PostMapping
    public ApiResponse<Role> create(@RequestBody Role role) {
        try {
            return ApiResponse.success(roleService.createRole(role));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PreAuthorize("@perm.has('system:role:edit')")
    @PutMapping
    public ApiResponse<Role> update(@RequestBody Role role) {
        return ApiResponse.success(roleService.updateRole(role));
    }

    @PreAuthorize("@perm.has('system:role:remove')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        roleService.deleteRole(id);
        return ApiResponse.success();
    }

    @PreAuthorize("@perm.has('system:role:list')")
    @GetMapping("/{roleId}/menus")
    public ApiResponse<List<Long>> getRoleMenuIds(@PathVariable Long roleId) {
        return ApiResponse.success(roleService.getRoleMenuIds(roleId));
    }

    @PreAuthorize("@perm.has('system:role:edit')")
    @PostMapping("/assign-menus")
    public ApiResponse<Void> assignMenus(@RequestBody Map<String, Object> params) {
        Long roleId = Long.valueOf(params.get("roleId").toString());
        @SuppressWarnings("unchecked")
        List<Long> menuIds = ((List<Number>) params.get("menuIds")).stream()
                .map(Number::longValue)
                .toList();
        roleService.assignRoleMenus(roleId, menuIds);
        return ApiResponse.success();
    }
}
