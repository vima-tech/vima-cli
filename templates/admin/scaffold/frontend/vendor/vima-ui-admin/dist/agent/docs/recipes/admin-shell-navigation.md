# Recipe：admin-shell-navigation

## 适用与边界

用于具有固定侧栏、顶部栏、路由出口的后台系统。内容型网站或无需路由的单页工具不使用本 Recipe。

## 数据契约

- `shell.title`：系统名称。
- `shell.navigation[]`：`label`、以 `/` 开头的 `route`、Manifest 中存在的 SVG `icon`。
- `routes[]`：路由路径和已存在的 `pageId`。

## 结构与交互

`VLayout.vui-layout-fill → VSide + VBody → VHeader + RouterView`。侧栏导航使用 `RouterLink`；当前路由、无权限菜单和未知路由由宿主路由 Adapter 处理。

## 状态与质量

- 导航加载失败时保留系统标题和可访问的错误页。
- 窄屏由宿主决定侧栏折叠策略，不能给页面根写 `100vh`。
- 每个导航图标使用 `VIcon`，禁止 Emoji。
- 测试路由可达、键盘 Tab 顺序、当前项语义和页面内部滚动。

## 产物示例与交付等级

`examples/admin-shell-navigation.json` 是 AppSpec v1，使用 `createArtifactPlan` 生成壳层、路由和页面文件。交付等级为 `scaffold`；权限菜单、当前路由语义和窄屏导航仍属于集成要求。

## 响应式与可访问性

390px 窄屏下导航应收起为有名按钮；路由切换后焦点转移到页面主标题，导航顺序与 DOM 顺序一致。
