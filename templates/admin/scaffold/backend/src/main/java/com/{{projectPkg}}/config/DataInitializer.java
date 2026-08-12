package com.{{projectPkg}}.config;

import com.{{projectPkg}}.entity.*;
import com.{{projectPkg}}.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final MenuRepository menuRepository;
    private final DeptRepository deptRepository;
    private final DictTypeRepository dictTypeRepository;
    private final DictDataRepository dictDataRepository;
    private final SysConfigRepository sysConfigRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("数据已存在，跳过初始化");
            return;
        }

        log.info("开始初始化数据...");

        // 创建部门
        Dept rootDept = new Dept();
        rootDept.setName("总公司");
        rootDept.setSort(0);
        rootDept.setStatus(1);
        rootDept = deptRepository.save(rootDept);

        Dept techDept = new Dept();
        techDept.setName("技术部");
        techDept.setParentId(rootDept.getId());
        techDept.setSort(1);
        techDept.setStatus(1);
        techDept = deptRepository.save(techDept);

        // 创建菜单
        Menu systemMenu = new Menu();
        systemMenu.setName("系统管理");
        systemMenu.setPath("/system");
        systemMenu.setIcon("⚙️");
        systemMenu.setSort(1);
        systemMenu.setType(1);
        systemMenu.setStatus(1);
        systemMenu = menuRepository.save(systemMenu);

        Menu userMenu = new Menu();
        userMenu.setName("用户管理");
        userMenu.setPath("/system/user");
        userMenu.setIcon("👤");
        userMenu.setParentId(systemMenu.getId());
        userMenu.setSort(1);
        userMenu.setType(2);
        userMenu.setStatus(1);
        userMenu.setPerms("system:user:list");
        userMenu = menuRepository.save(userMenu);

        Menu roleMenu = new Menu();
        roleMenu.setName("角色管理");
        roleMenu.setPath("/system/role");
        roleMenu.setIcon("🔑");
        roleMenu.setParentId(systemMenu.getId());
        roleMenu.setSort(2);
        roleMenu.setType(2);
        roleMenu.setStatus(1);
        roleMenu.setPerms("system:role:list");
        roleMenu = menuRepository.save(roleMenu);

        Menu menuMenu = new Menu();
        menuMenu.setName("菜单管理");
        menuMenu.setPath("/system/menu");
        menuMenu.setIcon("📋");
        menuMenu.setParentId(systemMenu.getId());
        menuMenu.setSort(3);
        menuMenu.setType(2);
        menuMenu.setStatus(1);
        menuMenu.setPerms("system:menu:list");
        menuMenu = menuRepository.save(menuMenu);

        Menu deptMenu = new Menu();
        deptMenu.setName("部门管理");
        deptMenu.setPath("/system/dept");
        deptMenu.setIcon("🏢");
        deptMenu.setParentId(systemMenu.getId());
        deptMenu.setSort(4);
        deptMenu.setType(2);
        deptMenu.setStatus(1);
        deptMenu.setPerms("system:dept:list");
        deptMenu = menuRepository.save(deptMenu);

        // 系统监控目录及子菜单
        // Menu.type 语义（对应 sys_menu_type 字典种子）：1=目录 2=菜单 3=按钮
        Menu monitorMenu = new Menu();
        monitorMenu.setName("系统监控");
        monitorMenu.setPath("/monitor");
        monitorMenu.setIcon("📊");
        monitorMenu.setSort(2);
        monitorMenu.setType(1);
        monitorMenu.setStatus(1);
        monitorMenu = menuRepository.save(monitorMenu);

        Menu onlineMenu = new Menu();
        onlineMenu.setName("在线用户");
        onlineMenu.setPath("/monitor/online");
        onlineMenu.setIcon("🟢");
        onlineMenu.setParentId(monitorMenu.getId());
        onlineMenu.setSort(1);
        onlineMenu.setType(2);
        onlineMenu.setStatus(1);
        onlineMenu.setPerms("monitor:online:list");
        onlineMenu = menuRepository.save(onlineMenu);

        Menu jobMenu = new Menu();
        jobMenu.setName("定时任务");
        jobMenu.setPath("/monitor/job");
        jobMenu.setIcon("⏰");
        jobMenu.setParentId(monitorMenu.getId());
        jobMenu.setSort(2);
        jobMenu.setType(2);
        jobMenu.setStatus(1);
        jobMenu.setPerms("monitor:job:list");
        jobMenu = menuRepository.save(jobMenu);

        // 按钮型子菜单（type=3）：不参与路由，仅承载 perms 做按钮级鉴权
        List<Menu> buttons = new ArrayList<>();
        // 用户管理下的 7 个按钮
        buttons.add(createButton(userMenu.getId(), "用户查询", "system:user:list", 1));
        buttons.add(createButton(userMenu.getId(), "用户新增", "system:user:add", 2));
        buttons.add(createButton(userMenu.getId(), "用户修改", "system:user:edit", 3));
        buttons.add(createButton(userMenu.getId(), "用户删除", "system:user:remove", 4));
        buttons.add(createButton(userMenu.getId(), "重置密码", "system:user:resetPwd", 5));
        buttons.add(createButton(userMenu.getId(), "用户导出", "system:user:export", 6));
        buttons.add(createButton(userMenu.getId(), "用户导入", "system:user:import", 7));
        // 定时任务下的 5 个动作按钮（list 在菜单本身上）
        buttons.add(createButton(jobMenu.getId(), "任务新增", "monitor:job:add", 1));
        buttons.add(createButton(jobMenu.getId(), "任务修改", "monitor:job:edit", 2));
        buttons.add(createButton(jobMenu.getId(), "任务删除", "monitor:job:remove", 3));
        buttons.add(createButton(jobMenu.getId(), "立即执行", "monitor:job:run", 4));
        buttons.add(createButton(jobMenu.getId(), "启停切换", "monitor:job:toggle", 5));
        // 在线用户下的强退按钮
        buttons.add(createButton(onlineMenu.getId(), "强退用户", "monitor:online:kick", 1));

        // 创建角色
        Role adminRole = new Role();
        adminRole.setRoleName("管理员");
        adminRole.setRoleKey("admin");
        adminRole.setSort(0);
        adminRole.setStatus(1);
        adminRole.setRemark("超级管理员");
        Set<Menu> adminMenus = new HashSet<>();
        adminMenus.add(systemMenu);
        adminMenus.add(userMenu);
        adminMenus.add(roleMenu);
        adminMenus.add(menuMenu);
        adminMenus.add(deptMenu);
        // admin 角色关联全部监控菜单与按钮（鉴权上 admin 走 "*" 通配，这里保证菜单管理页数据完整）
        adminMenus.add(monitorMenu);
        adminMenus.add(onlineMenu);
        adminMenus.add(jobMenu);
        adminMenus.addAll(buttons);
        adminRole.setMenus(adminMenus);
        adminRole = roleRepository.save(adminRole);

        Role userRole = new Role();
        userRole.setRoleName("普通用户");
        userRole.setRoleKey("user");
        userRole.setSort(1);
        userRole.setStatus(1);
        userRole.setRemark("普通用户");
        Set<Menu> userMenus = new HashSet<>();
        // 普通用户（test 账号）只给三个 list 级菜单，不给任何按钮 → 用于演示按钮级权限隐藏
        userMenus.add(userMenu);
        userMenus.add(onlineMenu);
        userMenus.add(jobMenu);
        userRole.setMenus(userMenus);
        userRole = roleRepository.save(userRole);

        // 创建用户
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setRealName("管理员");
        admin.setEmail("admin@example.com");
        admin.setPhone("13800138000");
        admin.setDeptId(rootDept.getId());
        admin.setStatus(1);
        Set<Role> adminRoles = new HashSet<>();
        adminRoles.add(adminRole);
        admin.setRoles(adminRoles);
        userRepository.save(admin);

        User testUser = new User();
        testUser.setUsername("test");
        testUser.setPassword(passwordEncoder.encode("test123"));
        testUser.setRealName("测试用户");
        testUser.setEmail("test@example.com");
        testUser.setPhone("13800138001");
        testUser.setDeptId(techDept.getId());
        testUser.setStatus(1);
        Set<Role> testRoles = new HashSet<>();
        testRoles.add(userRole);
        testUser.setRoles(testRoles);
        userRepository.save(testUser);

        // 初始化字典
        initDicts();

        // 初始化系统配置
        initConfigs();

        log.info("数据初始化完成！");
        log.info("管理员账号: admin / admin123");
        log.info("测试账号: test / test123");
    }

    /** 建一条按钮型菜单（type=3，见 sys_menu_type 字典）：无路由，仅以 perms 承载按钮级权限点。 */
    private Menu createButton(Long parentId, String name, String perms, int sort) {
        Menu button = new Menu();
        button.setName(name);
        button.setParentId(parentId);
        button.setSort(sort);
        button.setType(3);
        button.setStatus(1);
        button.setPerms(perms);
        return menuRepository.save(button);
    }

    private void initDicts() {
        // 用户状态字典
        DictType statusDict = new DictType();
        statusDict.setDictName("用户状态");
        statusDict.setDictCode("sys_user_status");
        statusDict.setRemark("用户状态字典");
        statusDict = dictTypeRepository.save(statusDict);

        DictData statusNormal = new DictData();
        statusNormal.setTypeId(statusDict.getId());
        statusNormal.setDictLabel("正常");
        statusNormal.setDictValue("1");
        statusNormal.setSort(0);
        dictDataRepository.save(statusNormal);

        DictData statusDisabled = new DictData();
        statusDisabled.setTypeId(statusDict.getId());
        statusDisabled.setDictLabel("禁用");
        statusDisabled.setDictValue("0");
        statusDisabled.setSort(1);
        dictDataRepository.save(statusDisabled);

        // 性别字典
        DictType genderDict = new DictType();
        genderDict.setDictName("性别");
        genderDict.setDictCode("sys_gender");
        genderDict.setRemark("性别字典");
        genderDict = dictTypeRepository.save(genderDict);

        DictData genderMale = new DictData();
        genderMale.setTypeId(genderDict.getId());
        genderMale.setDictLabel("男");
        genderMale.setDictValue("1");
        genderMale.setSort(0);
        dictDataRepository.save(genderMale);

        DictData genderFemale = new DictData();
        genderFemale.setTypeId(genderDict.getId());
        genderFemale.setDictLabel("女");
        genderFemale.setDictValue("2");
        genderFemale.setSort(1);
        dictDataRepository.save(genderFemale);

        DictData genderUnknown = new DictData();
        genderUnknown.setTypeId(genderDict.getId());
        genderUnknown.setDictLabel("未知");
        genderUnknown.setDictValue("0");
        genderUnknown.setSort(2);
        dictDataRepository.save(genderUnknown);

        // 菜单类型字典
        DictType menuTypeDict = new DictType();
        menuTypeDict.setDictName("菜单类型");
        menuTypeDict.setDictCode("sys_menu_type");
        menuTypeDict.setRemark("菜单类型字典");
        menuTypeDict = dictTypeRepository.save(menuTypeDict);

        String[] menuTypes = {"目录", "菜单", "按钮"};
        for (int i = 0; i < menuTypes.length; i++) {
            DictData data = new DictData();
            data.setTypeId(menuTypeDict.getId());
            data.setDictLabel(menuTypes[i]);
            data.setDictValue(String.valueOf(i + 1));
            data.setSort(i);
            dictDataRepository.save(data);
        }
    }

    private void initConfigs() {
        SysConfig siteName = new SysConfig();
        siteName.setConfigName("网站名称");
        siteName.setConfigKey("sys.site.name");
        siteName.setConfigValue("{{projectName}}");
        siteName.setRemark("系统网站名称");
        sysConfigRepository.save(siteName);

        SysConfig siteDesc = new SysConfig();
        siteDesc.setConfigName("网站描述");
        siteDesc.setConfigKey("sys.site.desc");
        siteDesc.setConfigValue("企业级后台管理系统");
        siteDesc.setRemark("系统网站描述");
        sysConfigRepository.save(siteDesc);

        SysConfig uploadSize = new SysConfig();
        uploadSize.setConfigName("上传文件大小限制");
        uploadSize.setConfigKey("sys.upload.max-size");
        uploadSize.setConfigValue("10");
        uploadSize.setRemark("单位MB");
        sysConfigRepository.save(uploadSize);

        SysConfig passwordPolicy = new SysConfig();
        passwordPolicy.setConfigName("密码最小长度");
        passwordPolicy.setConfigKey("sys.password.min-length");
        passwordPolicy.setConfigValue("6");
        passwordPolicy.setRemark("密码最小长度要求");
        sysConfigRepository.save(passwordPolicy);
    }
}
