package com.{{projectPkg}};

import com.{{projectPkg}}.security.PermRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 上下文冒烟测试：`mvn -q test` 的最低真实信号（完成定义第四道门的后端半）。
 *
 * 通过即代表：全部 Bean 装配成功 + JPA 依 H2 建表成功 + DataInitializer 种子数据跑通。
 * 这不是业务测试——业务模块的测试由各自任务补充；本用例保证「mvn test 恒绿」
 * 不再是因为一个测试都没有。Redis 使用 Lettuce 惰性连接，上下文装配不要求
 * Redis 服务在线（登录链路才要求）。
 */
@SpringBootTest
class ApplicationTests {

    @Autowired
    private PermRegistry permRegistry;

    @Test
    void contextLoads() {
    }

    /**
     * PermRegistry 是菜单页「权限标识」下拉的唯一数据源：注解扫描一旦静默失效
     * （返回空表），下拉就没有任何选项可选。这里锁住"扫得到、格式对"两个底线。
     */
    @Test
    void permRegistryScansAnnotations() {
        List<String> perms = permRegistry.getPermOptions();
        assertFalse(perms.isEmpty(), "PermRegistry 未从 @PreAuthorize 注解扫描到任何权限码");
        assertTrue(perms.contains("system:user:remove"), "应包含 UserController 声明的 system:user:remove");
        for (String perm : perms) {
            assertTrue(PermRegistry.PERM_FORMAT.matcher(perm).matches(), "权限码格式非法：" + perm);
        }
    }
}
