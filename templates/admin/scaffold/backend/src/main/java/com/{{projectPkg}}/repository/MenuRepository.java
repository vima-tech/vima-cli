package com.{{projectPkg}}.repository;

import com.{{projectPkg}}.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MenuRepository extends JpaRepository<Menu, Long> {
    List<Menu> findByParentIdOrderBySort(Long parentId);
    
    List<Menu> findByStatusOrderBySort(Integer status);
    
    @Query("SELECT m FROM Menu m WHERE m.id IN (SELECT rm.id FROM Role r JOIN r.menus rm WHERE r.id = :roleId)")
    List<Menu> findByRoleId(Long roleId);
}
