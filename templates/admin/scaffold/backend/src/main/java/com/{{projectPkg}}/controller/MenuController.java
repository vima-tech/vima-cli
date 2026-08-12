package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.entity.Menu;
import com.{{projectPkg}}.security.PermRegistry;
import com.{{projectPkg}}.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/menu")
@RequiredArgsConstructor
public class MenuController {
    private final MenuService menuService;
    private final PermRegistry permRegistry;

    @GetMapping("/list")
    @PreAuthorize("@perm.has('system:menu:list')")
    public ApiResponse<List<Menu>> list() {
        return ApiResponse.success(menuService.listMenus());
    }

    /** 角色管理页「分配菜单」弹窗也用这棵树，所以给角色授权时通常连带勾选菜单查询。 */
    @GetMapping("/tree")
    @PreAuthorize("@perm.has('system:menu:list')")
    public ApiResponse<List<Menu>> tree() {
        return ApiResponse.success(menuService.getMenuTree());
    }

    /** 「权限标识」下拉的数据源：代码中真实存在的权限码（见 PermRegistry）。 */
    @GetMapping("/perm-options")
    @PreAuthorize("@perm.has('system:menu:list')")
    public ApiResponse<List<String>> permOptions() {
        return ApiResponse.success(permRegistry.getPermOptions());
    }

    @PostMapping
    @PreAuthorize("@perm.has('system:menu:add')")
    public ApiResponse<Menu> create(@RequestBody Menu menu) {
        return ApiResponse.success(menuService.createMenu(menu));
    }

    @PutMapping
    @PreAuthorize("@perm.has('system:menu:edit')")
    public ApiResponse<Menu> update(@RequestBody Menu menu) {
        return ApiResponse.success(menuService.updateMenu(menu));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('system:menu:remove')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        menuService.deleteMenu(id);
        return ApiResponse.success();
    }
}
