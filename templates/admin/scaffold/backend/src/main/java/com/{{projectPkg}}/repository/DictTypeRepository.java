package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.DictType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface DictTypeRepository extends JpaRepository<DictType, Long>, JpaSpecificationExecutor<DictType> {
    Optional<DictType> findByDictCode(String dictCode);
    boolean existsByDictCode(String dictCode);
}
