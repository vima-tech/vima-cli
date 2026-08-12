package com.{{projectPkg}}.security;

import org.springframework.context.annotation.Lazy;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 权限码注册表：从全部 Controller 的 @PreAuthorize("@perm.has('xx:yy:zz')") 注解里
 * 提取代码中真实存在的权限码，作为「菜单管理」页权限标识下拉的唯一数据源。
 * 选项由代码派生而非手工维护——新业务模块只要写了注解，前端自动出现新选项，
 * 从机制上消灭"菜单里手抄权限串抄错、静默失效"这类配置漂移。
 */
@Component
public class PermRegistry {
    /** 与 PermChecker 的调用形态严格对应：只认 @perm.has('单引号字面量')。 */
    private static final Pattern PERM_HAS = Pattern.compile("@perm\\.has\\('([^']+)'\\)");

    /** 权限码格式：模块:实体:动作，各段字母开头、字母数字组成（如 system:user:resetPwd）。 */
    public static final Pattern PERM_FORMAT =
            Pattern.compile("^[a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*$");

    private final RequestMappingHandlerMapping handlerMapping;
    private volatile List<String> cached;

    /** @Lazy 避免与 MVC 基础设施的初始化顺序耦合：首次真正取值时 MVC 早已就绪。 */
    public PermRegistry(@Lazy RequestMappingHandlerMapping handlerMapping) {
        this.handlerMapping = handlerMapping;
    }

    /** 代码中全部权限码，去重排序。结果缓存——注解在运行期不会变。 */
    public List<String> getPermOptions() {
        List<String> result = cached;
        if (result == null) {
            synchronized (this) {
                if (cached == null) {
                    cached = scan();
                }
                result = cached;
            }
        }
        return result;
    }

    public boolean isKnown(String perm) {
        return getPermOptions().contains(perm);
    }

    private List<String> scan() {
        TreeSet<String> perms = new TreeSet<>();
        for (HandlerMethod method : handlerMapping.getHandlerMethods().values()) {
            PreAuthorize annotation = method.getMethodAnnotation(PreAuthorize.class);
            if (annotation == null) {
                annotation = method.getBeanType().getAnnotation(PreAuthorize.class);
            }
            if (annotation == null) {
                continue;
            }
            Matcher matcher = PERM_HAS.matcher(annotation.value());
            while (matcher.find()) {
                perms.add(matcher.group(1));
            }
        }
        return List.copyOf(perms);
    }
}
