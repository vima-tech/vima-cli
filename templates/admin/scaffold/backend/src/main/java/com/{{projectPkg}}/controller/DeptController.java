package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.entity.Dept;
import com.{{projectPkg}}.service.DeptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/dept")
@RequiredArgsConstructor
public class DeptController {
    private final DeptService deptService;

    @PreAuthorize("@perm.has('system:dept:list')")
    @GetMapping("/list")
    public ApiResponse<List<Dept>> list() {
        return ApiResponse.success(deptService.listDepts());
    }

    /** 不加权限点：用户管理弹窗的部门下拉要用，只暴露部门名称树。 */
    @GetMapping("/tree")
    public ApiResponse<List<Dept>> tree() {
        return ApiResponse.success(deptService.getDeptTree());
    }

    @PreAuthorize("@perm.has('system:dept:add')")
    @PostMapping
    public ApiResponse<Dept> create(@RequestBody Dept dept) {
        return ApiResponse.success(deptService.createDept(dept));
    }

    @PreAuthorize("@perm.has('system:dept:edit')")
    @PutMapping
    public ApiResponse<Dept> update(@RequestBody Dept dept) {
        return ApiResponse.success(deptService.updateDept(dept));
    }

    @PreAuthorize("@perm.has('system:dept:remove')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deptService.deleteDept(id);
        return ApiResponse.success();
    }
}
