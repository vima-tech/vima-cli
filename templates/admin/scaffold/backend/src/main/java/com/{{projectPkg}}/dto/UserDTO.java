package com.{{projectPkg}}.dto;

import com.{{projectPkg}}.utils.ValidFormat;
import com.{{projectPkg}}.utils.ValidateUtil;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * 用户读写共用体。校验注解只在入参（@Valid 标注的 @RequestBody）上生效，
 * 出参走同一个类不受影响。
 */
@Data
public class UserDTO {
    private Long id;

    @NotBlank(message = "用户名不能为空")
    @ValidFormat(ValidateUtil.Format.USERNAME)
    private String username;

    @NotBlank(message = "真实姓名不能为空")
    @Size(min = 2, max = 20, message = "真实姓名长度需在 2~20 之间")
    private String realName;

    @ValidFormat(ValidateUtil.Format.EMAIL)
    private String email;

    @ValidFormat(ValidateUtil.Format.MOBILE)
    private String phone;
    private Long deptId;
    private String deptName;
    private Integer status;
    private LocalDateTime createTime;
    private Set<Long> roleIds;
}
