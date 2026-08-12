package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.DictData;
import com.{{projectPkg}}.entity.DictType;
import com.{{projectPkg}}.service.DictService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/system/dict")
@RequiredArgsConstructor
public class DictController {
    private final DictService dictService;

    @PreAuthorize("@perm.has('system:dict:list')")
    @GetMapping("/type/list")
    public ApiResponse<PageResponse<DictType>> listTypes(
            @RequestParam(required = false) String dictName,
            @RequestParam(required = false) String dictCode,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(dictService.listDictTypes(dictName, dictCode, pageNum, pageSize));
    }

    @PreAuthorize("@perm.has('system:dict:add')")
    @PostMapping("/type")
    public ApiResponse<DictType> createType(@RequestBody DictType dictType) {
        try {
            return ApiResponse.success(dictService.createDictType(dictType));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PreAuthorize("@perm.has('system:dict:edit')")
    @PutMapping("/type")
    public ApiResponse<DictType> updateType(@RequestBody DictType dictType) {
        return ApiResponse.success(dictService.updateDictType(dictType));
    }

    @PreAuthorize("@perm.has('system:dict:remove')")
    @DeleteMapping("/type/{id}")
    public ApiResponse<Void> deleteType(@PathVariable Long id) {
        dictService.deleteDictType(id);
        return ApiResponse.success();
    }

    @PreAuthorize("@perm.has('system:dict:list')")
    @GetMapping("/data/list/{typeId}")
    public ApiResponse<List<DictData>> listDataByTypeId(@PathVariable Long typeId) {
        return ApiResponse.success(dictService.listDictDataByTypeId(typeId));
    }

    /** 不加权限点：useDict 在各业务页运行时按 code 取字典项，属于全员基础读。 */
    @GetMapping("/data/code/{dictCode}")
    public ApiResponse<List<DictData>> listDataByTypeCode(@PathVariable String dictCode) {
        return ApiResponse.success(dictService.listDictDataByTypeCode(dictCode));
    }

    @PreAuthorize("@perm.has('system:dict:add')")
    @PostMapping("/data")
    public ApiResponse<DictData> createData(@RequestBody DictData dictData) {
        return ApiResponse.success(dictService.createDictData(dictData));
    }

    @PreAuthorize("@perm.has('system:dict:edit')")
    @PutMapping("/data")
    public ApiResponse<DictData> updateData(@RequestBody DictData dictData) {
        return ApiResponse.success(dictService.updateDictData(dictData));
    }

    @PreAuthorize("@perm.has('system:dict:remove')")
    @DeleteMapping("/data/{id}")
    public ApiResponse<Void> deleteData(@PathVariable Long id) {
        dictService.deleteDictData(id);
        return ApiResponse.success();
    }
}
