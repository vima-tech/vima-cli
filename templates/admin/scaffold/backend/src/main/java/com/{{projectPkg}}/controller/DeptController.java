package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.entity.Dept;
import com.{{projectPkg}}.service.DeptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/dept")
@RequiredArgsConstructor
public class DeptController {
    private final DeptService deptService;

    @GetMapping("/list")
    public ApiResponse<List<Dept>> list() {
        return ApiResponse.success(deptService.listDepts());
    }

    @GetMapping("/tree")
    public ApiResponse<List<Dept>> tree() {
        return ApiResponse.success(deptService.getDeptTree());
    }

    @PostMapping
    public ApiResponse<Dept> create(@RequestBody Dept dept) {
        return ApiResponse.success(deptService.createDept(dept));
    }

    @PutMapping
    public ApiResponse<Dept> update(@RequestBody Dept dept) {
        return ApiResponse.success(deptService.updateDept(dept));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deptService.deleteDept(id);
        return ApiResponse.success();
    }
}
