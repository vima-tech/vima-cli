package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.DictData;
import com.{{projectPkg}}.entity.DictType;
import com.{{projectPkg}}.repository.DictDataRepository;
import com.{{projectPkg}}.repository.DictTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DictService {
    private final DictTypeRepository dictTypeRepository;
    private final DictDataRepository dictDataRepository;

    public PageResponse<DictType> listDictTypes(String dictName, String dictCode, int pageNum, int pageSize) {
        Page<DictType> page = dictTypeRepository.findAll(PageRequest.of(pageNum - 1, pageSize, Sort.by("id").descending()));
        return PageResponse.<DictType>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public DictType createDictType(DictType dictType) {
        if (dictTypeRepository.existsByDictCode(dictType.getDictCode())) {
            throw new RuntimeException("字典编码已存在");
        }
        return dictTypeRepository.save(dictType);
    }

    public DictType updateDictType(DictType dictType) {
        DictType existing = dictTypeRepository.findById(dictType.getId())
                .orElseThrow(() -> new RuntimeException("字典类型不存在"));
        existing.setDictName(dictType.getDictName());
        existing.setRemark(dictType.getRemark());
        existing.setStatus(dictType.getStatus());
        return dictTypeRepository.save(existing);
    }

    public void deleteDictType(Long id) {
        dictTypeRepository.deleteById(id);
        dictDataRepository.deleteAll(dictDataRepository.findByTypeIdOrderBySort(id));
    }

    public List<DictData> listDictDataByTypeCode(String dictCode) {
        DictType type = dictTypeRepository.findByDictCode(dictCode)
                .orElseThrow(() -> new RuntimeException("字典类型不存在"));
        return dictDataRepository.findByTypeIdAndStatusOrderBySort(type.getId(), 1);
    }

    public List<DictData> listDictDataByTypeId(Long typeId) {
        return dictDataRepository.findByTypeIdOrderBySort(typeId);
    }

    public DictData createDictData(DictData dictData) {
        return dictDataRepository.save(dictData);
    }

    public DictData updateDictData(DictData dictData) {
        DictData existing = dictDataRepository.findById(dictData.getId())
                .orElseThrow(() -> new RuntimeException("字典数据不存在"));
        existing.setDictLabel(dictData.getDictLabel());
        existing.setDictValue(dictData.getDictValue());
        existing.setSort(dictData.getSort());
        existing.setRemark(dictData.getRemark());
        existing.setStatus(dictData.getStatus());
        return dictDataRepository.save(existing);
    }

    public void deleteDictData(Long id) {
        dictDataRepository.deleteById(id);
    }
}
