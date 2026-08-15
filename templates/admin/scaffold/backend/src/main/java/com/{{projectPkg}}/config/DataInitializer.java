package com.{{projectPkg}}.config;

import com.{{projectPkg}}.entity.*;
import com.{{projectPkg}}.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.security.SecureRandom;

@Slf4j
@Component
@RequiredArgsConstructor
// 必须早于 JobRegistrar（无 @Order，视同最低优先级）：否则首次启动时
// initJobs() 种下的任务当次不会被调度，要等下一次重启才生效。
@Order(0)
public class DataInitializer implements CommandLineRunner {
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final MenuRepository menuRepository;
    private final DeptRepository deptRepository;
    private final DictTypeRepository dictTypeRepository;
    private final DictDataRepository dictDataRepository;
    private final SysConfigRepository sysConfigRepository;
    private final SysJobRepository sysJobRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.initial-admin-password:}")
    private String configuredAdminPassword;

    @Value("${app.seed-test-user:false}")
    private boolean seedTestUser;

    @Value("${app.initial-test-password:}")
    private String configuredTestPassword;

    @Override
    public void run(String... args) {
        // 内置定时任务按 jobKey 缺则补，且必须放在"跳过初始化"之前：
        // 老库升级到新版本时同样能拿到新增的内置任务，否则永远补不上。
        ensureBuiltinJobs();

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
        // icon 只能取前端预设集里的名字（src/utils/menuIcons.ts 的 MENU_ICON_PRESETS）。
        // 这里曾经存的是 emoji：表格里能看见，但侧边栏拿它去查图标注册表查不到，等于没设。
        Menu systemMenu = new Menu();
        systemMenu.setName("系统管理");
        systemMenu.setPath("/system");
        systemMenu.setIcon("settings");
        systemMenu.setSort(1);
        systemMenu.setType(1);
        systemMenu.setStatus(1);
        systemMenu = menuRepository.save(systemMenu);

        Menu userMenu = new Menu();
        userMenu.setName("用户管理");
        userMenu.setPath("/system/user");
        userMenu.setIcon("users");
        userMenu.setParentId(systemMenu.getId());
        userMenu.setSort(1);
        userMenu.setType(2);
        userMenu.setStatus(1);
        userMenu.setPerms("system:user:list");
        userMenu = menuRepository.save(userMenu);

        Menu roleMenu = new Menu();
        roleMenu.setName("角色管理");
        roleMenu.setPath("/system/role");
        roleMenu.setIcon("shield-check");
        roleMenu.setParentId(systemMenu.getId());
        roleMenu.setSort(2);
        roleMenu.setType(2);
        roleMenu.setStatus(1);
        roleMenu.setPerms("system:role:list");
        roleMenu = menuRepository.save(roleMenu);

        Menu menuMenu = new Menu();
        menuMenu.setName("菜单管理");
        menuMenu.setPath("/system/menu");
        menuMenu.setIcon("list");
        menuMenu.setParentId(systemMenu.getId());
        menuMenu.setSort(3);
        menuMenu.setType(2);
        menuMenu.setStatus(1);
        menuMenu.setPerms("system:menu:list");
        menuMenu = menuRepository.save(menuMenu);

        Menu deptMenu = new Menu();
        deptMenu.setName("部门管理");
        deptMenu.setPath("/system/dept");
        deptMenu.setIcon("building");
        deptMenu.setParentId(systemMenu.getId());
        deptMenu.setSort(4);
        deptMenu.setType(2);
        deptMenu.setStatus(1);
        deptMenu.setPerms("system:dept:list");
        deptMenu = menuRepository.save(deptMenu);

        // 名称/图标与 Sidebar.vue 静态项保持同名同图标；perms 与对应 Controller 注解一致
        Menu dictMenu = createPage(systemMenu.getId(), "字典管理", "/system/dict", "file-text", 5, "system:dict:list");
        Menu configMenu = createPage(systemMenu.getId(), "系统配置", "/system/config", "settings", 6, "system:config:list");
        Menu fileMenu = createPage(systemMenu.getId(), "文件管理", "/system/file", "folder", 7, "system:file:list");
        Menu operLogMenu = createPage(systemMenu.getId(), "操作日志", "/system/log/oper", "edit", 8, "system:operlog:list");
        Menu loginLogMenu = createPage(systemMenu.getId(), "登录日志", "/system/log/login", "log-in", 9, "system:loginlog:list");

        // 系统监控目录及子菜单
        // Menu.type 语义（对应 sys_menu_type 字典种子）：1=目录 2=菜单 3=按钮
        Menu monitorMenu = new Menu();
        monitorMenu.setName("系统监控");
        monitorMenu.setPath("/monitor");
        monitorMenu.setIcon("monitor");
        monitorMenu.setSort(2);
        monitorMenu.setType(1);
        monitorMenu.setStatus(1);
        monitorMenu = menuRepository.save(monitorMenu);

        Menu onlineMenu = new Menu();
        onlineMenu.setName("在线用户");
        onlineMenu.setPath("/monitor/online");
        onlineMenu.setIcon("user");
        onlineMenu.setParentId(monitorMenu.getId());
        onlineMenu.setSort(1);
        onlineMenu.setType(2);
        onlineMenu.setStatus(1);
        onlineMenu.setPerms("monitor:online:list");
        onlineMenu = menuRepository.save(onlineMenu);

        Menu jobMenu = new Menu();
        jobMenu.setName("定时任务");
        jobMenu.setPath("/monitor/job");
        jobMenu.setIcon("clock");
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
        // 角色管理下的 3 个按钮（分配菜单复用 system:role:edit，不单设权限点）
        buttons.add(createButton(roleMenu.getId(), "角色新增", "system:role:add", 1));
        buttons.add(createButton(roleMenu.getId(), "角色修改", "system:role:edit", 2));
        buttons.add(createButton(roleMenu.getId(), "角色删除", "system:role:remove", 3));
        // 菜单管理下的 3 个按钮
        buttons.add(createButton(menuMenu.getId(), "菜单新增", "system:menu:add", 1));
        buttons.add(createButton(menuMenu.getId(), "菜单修改", "system:menu:edit", 2));
        buttons.add(createButton(menuMenu.getId(), "菜单删除", "system:menu:remove", 3));
        // 部门管理下的 3 个按钮
        buttons.add(createButton(deptMenu.getId(), "部门新增", "system:dept:add", 1));
        buttons.add(createButton(deptMenu.getId(), "部门修改", "system:dept:edit", 2));
        buttons.add(createButton(deptMenu.getId(), "部门删除", "system:dept:remove", 3));
        // 字典管理下的 3 个按钮（字典类型与字典项共用一组权限点）
        buttons.add(createButton(dictMenu.getId(), "字典新增", "system:dict:add", 1));
        buttons.add(createButton(dictMenu.getId(), "字典修改", "system:dict:edit", 2));
        buttons.add(createButton(dictMenu.getId(), "字典删除", "system:dict:remove", 3));
        // 系统配置下的 3 个按钮
        buttons.add(createButton(configMenu.getId(), "配置新增", "system:config:add", 1));
        buttons.add(createButton(configMenu.getId(), "配置修改", "system:config:edit", 2));
        buttons.add(createButton(configMenu.getId(), "配置删除", "system:config:remove", 3));
        // 文件管理下的 2 个按钮
        buttons.add(createButton(fileMenu.getId(), "文件上传", "system:file:upload", 1));
        buttons.add(createButton(fileMenu.getId(), "文件删除", "system:file:remove", 2));
        // 日志清空按钮（操作/登录各一）
        buttons.add(createButton(operLogMenu.getId(), "清空操作日志", "system:operlog:remove", 1));
        buttons.add(createButton(loginLogMenu.getId(), "清空登录日志", "system:loginlog:remove", 1));

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
        adminMenus.add(dictMenu);
        adminMenus.add(configMenu);
        adminMenus.add(fileMenu);
        adminMenus.add(operLogMenu);
        adminMenus.add(loginLogMenu);
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
        String adminPassword = initialPassword("admin", configuredAdminPassword);
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRealName("管理员");
        admin.setEmail("admin@example.com");
        admin.setPhone("13800138000");
        admin.setDeptId(rootDept.getId());
        admin.setStatus(1);
        Set<Role> adminRoles = new HashSet<>();
        adminRoles.add(adminRole);
        admin.setRoles(adminRoles);
        userRepository.save(admin);

        if (seedTestUser) {
            User testUser = new User();
            testUser.setUsername("test");
            testUser.setPassword(passwordEncoder.encode(initialPassword("test", configuredTestPassword)));
            testUser.setRealName("测试用户");
            testUser.setEmail("test@example.com");
            testUser.setPhone("13800138001");
            testUser.setDeptId(techDept.getId());
            testUser.setStatus(1);
            Set<Role> testRoles = new HashSet<>();
            testRoles.add(userRole);
            testUser.setRoles(testRoles);
            userRepository.save(testUser);
        }

        // 初始化字典
        initDicts();

        // 初始化系统配置
        initConfigs();

        log.info("数据初始化完成！");
        log.info("管理员账号已初始化：admin（密码来自环境配置或本次启动生成值）");
    }

    private String initialPassword(String username, String configured) {
        if (configured != null && !configured.isBlank()) {
            if (configured.length() < 12) {
                throw new IllegalArgumentException(username + " 初始密码至少 12 位");
            }
            return configured;
        }
        StringBuilder value = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            value.append(PASSWORD_CHARS.charAt(SECURE_RANDOM.nextInt(PASSWORD_CHARS.length())));
        }
        log.warn("未配置 {} 初始密码，已安全随机生成；请立即保存并首次登录后修改：{}", username, value);
        return value.toString();
    }

    /** 建一条页面型菜单（type=2）：path 须与前端路由及 Sidebar 静态项一致，perms 承载页面级查询权限。 */
    private Menu createPage(Long parentId, String name, String path, String icon, int sort, String perms) {
        Menu menu = new Menu();
        menu.setName(name);
        menu.setPath(path);
        menu.setIcon(icon);
        menu.setParentId(parentId);
        menu.setSort(sort);
        menu.setType(2);
        menu.setStatus(1);
        menu.setPerms(perms);
        return menuRepository.save(menu);
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

    /**
     * 内置定时任务，按 jobKey 幂等补齐（已存在的不动，不会覆盖用户改过的 cron / 停用状态）。
     * status=1 的任务由 JobRegistrar 在启动时注册，后台「任务管理」里可改 cron 或停用。
     * 注意：删掉的内置任务会在下次启动时被重新补上——不需要就停用（status=0），别删。
     */
    private void ensureBuiltinJobs() {
        ensureJob("日志归档", "logArchive", "0 30 2 * * ?",
                "每日 02:30 压缩超过 log.compress-after-days 天的日志文件，并删除超过 log.retain-days 天的日志文件");
        ensureJob("数据库日志清理", "dbLogCleanup", "0 0 3 * * ?",
                "每日 03:00 删除超过 log.retain-days 天的操作日志与登录日志");
    }

    private void ensureJob(String name, String jobKey, String cron, String remark) {
        if (sysJobRepository.existsByJobKey(jobKey)) {
            return;
        }
        SysJob job = new SysJob();
        job.setName(name);
        job.setJobKey(jobKey);
        job.setCron(cron);
        job.setStatus(1);
        job.setRemark(remark);
        sysJobRepository.save(job);
        log.info("已补齐内置定时任务：{}（{}，cron={}）", name, jobKey, cron);
    }
}
