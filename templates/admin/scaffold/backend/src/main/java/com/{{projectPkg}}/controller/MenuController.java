package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.entity.Menu;
import com.{{projectPkg}}.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/menu")
@RequiredArgsConstructor
public class MenuController {
    private final MenuService menuService;

    @GetMapping("/list")
    public ApiResponse<List<Menu>> list() {
        return ApiResponse.success(menuService.listMenus());
    }

    @GetMapping("/tree")
    public ApiResponse<List<Menu>> tree() {
        return ApiResponse.success(menuService.getMenuTree());
    }

    @PostMapping
    public ApiResponse<Menu> create(@RequestBody Menu menu) {
        return ApiResponse.success(menuService.createMenu(menu));
    }

    @PutMapping
    public ApiResponse<Menu> update(@RequestBody Menu menu) {
        return ApiResponse.success(menuService.updateMenu(menu));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        menuService.deleteMenu(id);
        return ApiResponse.success();
    }
}
