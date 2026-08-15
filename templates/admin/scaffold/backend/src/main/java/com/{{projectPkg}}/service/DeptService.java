package com.{{projectPkg}}.service;

import com.{{projectPkg}}.entity.Dept;
import com.{{projectPkg}}.repository.DeptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeptService {
    private final DeptRepository deptRepository;

    public List<Dept> listDepts() {
        return deptRepository.findByStatusOrderBySort(1);
    }

    public List<Dept> getDeptTree() {
        List<Dept> allDepts = deptRepository.findByStatusOrderBySort(1);
        return buildTree(allDepts, 0L);
    }

    public Dept createDept(Dept dept) {
        return deptRepository.save(dept);
    }

    public Dept updateDept(Dept dept) {
        Dept existing = deptRepository.findById(dept.getId())
                .orElseThrow(() -> new IllegalArgumentException("部门不存在"));
        
        existing.setName(dept.getName());
        existing.setParentId(dept.getParentId());
        existing.setSort(dept.getSort());
        existing.setLeader(dept.getLeader());
        existing.setPhone(dept.getPhone());
        existing.setEmail(dept.getEmail());
        existing.setStatus(dept.getStatus());
        
        return deptRepository.save(existing);
    }

    public void deleteDept(Long id) {
        deptRepository.deleteById(id);
    }

    private List<Dept> buildTree(List<Dept> depts, Long parentId) {
        return depts.stream()
                .filter(d -> parentId.equals(d.getParentId()))
                .map(d -> {
                    d.setChildren(buildTree(depts, d.getId()));
                    return d;
                })
                .collect(Collectors.toList());
    }
}
