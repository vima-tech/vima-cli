package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.DictData;
import com.{{projectPkg}}.entity.DictType;
import com.{{projectPkg}}.service.DictService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/dict")
@RequiredArgsConstructor
public class DictController {
    private final DictService dictService;

    @GetMapping("/type/list")
    public ApiResponse<PageResponse<DictType>> listTypes(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ApiResponse.success(dictService.listDictTypes(null, null, pageNum, pageSize));
    }

    @PostMapping("/type")
    public ApiResponse<DictType> createType(@RequestBody DictType dictType) {
        try {
            return ApiResponse.success(dictService.createDictType(dictType));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping("/type")
    public ApiResponse<DictType> updateType(@RequestBody DictType dictType) {
        return ApiResponse.success(dictService.updateDictType(dictType));
    }

    @DeleteMapping("/type/{id}")
    public ApiResponse<Void> deleteType(@PathVariable Long id) {
        dictService.deleteDictType(id);
        return ApiResponse.success();
    }

    @GetMapping("/data/list/{typeId}")
    public ApiResponse<List<DictData>> listDataByTypeId(@PathVariable Long typeId) {
        return ApiResponse.success(dictService.listDictDataByTypeId(typeId));
    }

    @GetMapping("/data/code/{dictCode}")
    public ApiResponse<List<DictData>> listDataByTypeCode(@PathVariable String dictCode) {
        return ApiResponse.success(dictService.listDictDataByTypeCode(dictCode));
    }

    @PostMapping("/data")
    public ApiResponse<DictData> createData(@RequestBody DictData dictData) {
        return ApiResponse.success(dictService.createDictData(dictData));
    }

    @PutMapping("/data")
    public ApiResponse<DictData> updateData(@RequestBody DictData dictData) {
        return ApiResponse.success(dictService.updateDictData(dictData));
    }

    @DeleteMapping("/data/{id}")
    public ApiResponse<Void> deleteData(@PathVariable Long id) {
        dictService.deleteDictData(id);
        return ApiResponse.success();
    }
}
