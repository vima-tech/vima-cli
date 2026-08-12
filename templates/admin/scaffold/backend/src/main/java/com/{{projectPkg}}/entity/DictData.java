package com.{{projectPkg}}.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sys_dict_data")
public class DictData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "type_id", nullable = false)
    private Long typeId;

    @Column(name = "dict_label", nullable = false, length = 100)
    private String dictLabel;

    @Column(name = "dict_value", nullable = false, length = 100)
    private String dictValue;

    @Column
    private Integer sort = 0;

    @Column(length = 500)
    private String remark;

    @Column(nullable = false)
    private Integer status = 1;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
