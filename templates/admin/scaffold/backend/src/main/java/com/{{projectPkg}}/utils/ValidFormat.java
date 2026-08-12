package com.{{projectPkg}}.utils;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 声明式格式校验，配合 {@code @Valid} 使用：
 *
 * <pre>{@code
 * public class UserRequest {
 *     @NotBlank(message = "手机号不能为空")
 *     @ValidFormat(ValidateUtil.Format.MOBILE)
 *     private String phone;
 * }
 * }</pre>
 *
 * <p>只做「格式对不对」，不管「填没填」——空值一律放行，必填交给 {@code @NotBlank}。
 * 上下限这类数值区间也不归它管，叠加 {@code @DecimalMin} / {@code @Max} 即可。
 *
 * <p>不写 message 时用 {@link ValidateUtil.Format} 自带的默认文案；
 * 校验失败由 GlobalExceptionHandler 统一转成 40001。
 *
 * <p>一个注解 + 一个枚举覆盖全部格式，是为了避免 @Mobile/@IdCard/@Email... 一堆
 * 只差一个断言的注解类——新增格式只需往枚举里加一项。
 */
@Documented
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidFormatValidator.class)
public @interface ValidFormat {

    /** 校验哪种格式。 */
    ValidateUtil.Format value();

    /** 自定义错误文案；留空则用枚举项自带的默认文案。 */
    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
