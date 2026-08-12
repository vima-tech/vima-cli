package com.{{projectPkg}}.utils;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * {@link ValidFormat} 的执行器：把校验委派给 {@link ValidateUtil.Format}。
 */
public class ValidFormatValidator implements ConstraintValidator<ValidFormat, String> {

    private ValidateUtil.Format format;
    private String message;

    @Override
    public void initialize(ValidFormat annotation) {
        this.format = annotation.value();
        this.message = annotation.message();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (format.test(value)) {
            return true;
        }

        // 注解没写 message 时，换成枚举项自带的文案。
        // 必须先 disable 默认约束，否则默认的空 message 也会一起冒出去。
        if (message == null || message.isBlank()) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(format.getMessage()).addConstraintViolation();
        }
        return false;
    }
}
