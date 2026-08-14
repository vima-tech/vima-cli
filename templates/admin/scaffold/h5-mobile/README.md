# {{projectName}} · 移动端 H5（`{{appId}}`）

Vue 3 + Vite + TypeScript，UI 用 vendored `vima-ui-h5`——与小程序端**同一套类契约与令牌**。

## 跑起来

```bash
npm install
npm run dev        # http://localhost:5174（/api 已代理到 localhost:8080）
npm run build:check
```

手机上看：开发者工具切设备模拟（375×812），或用局域网 IP + `--host`。

## 目录

```
src/
  main.ts            全局入口（注册框架、A7 上报、路由）
  App.vue            路由出口 + VmTabbar/VmToast/VmDialog 各挂一次 + 适老化根类
  router/index.ts    路由表（name 与 tabbar key、spec 菜单三处一致）
  api/               按模块一文件，只放接口封装（任务生成）
  views/             业务页面（任务生成）
  components/        本端共享组件（共享层，改动需令牌）
  utils/
    request.ts       ★ 统一请求门面，唯一允许发网络请求的地方
    prefs.ts         适老化开关
vendor/vima-ui-h5/   ★ UI 框架（共享层，不要改 dist/）
```

`@` → `src/`，`@ui` → `vendor/vima-ui-h5/dist`（别名在 vite.config.ts）。

## 三条硬纪律

1. **所有请求走 `utils/request.ts` 的门面**，路径写字面量。
   直接 `axios`/`fetch` 会让 `vima validate` 的 V-CODE-01 对账失明——
   接口不在契约里查不出来、调了别的端的接口（越权）也查不出来。
2. **样式只用 `vm-*` 类与 `var(--vm-*)` 令牌**，不写裸色值/裸字号。
   页面私有样式写在本页 `<style scoped>`。
3. **`vendor/vima-ui-h5/dist/` 不改**。要覆盖就在自己的 css 里重定义令牌；
   它与小程序端同名文件字节一致，改一行会让 vima-cli 的单测直接红。

## 页面结构约定（机检看这个）

业务页由任务生成，页面根节点带 `data-page`、区块容器带 `data-block`：

```html
<template>
  <div class="vm-body" data-page="PAGE-07">
    <div data-block="search">…</div>
    <div data-block="list">…</div>
  </div>
</template>
```

> `vm-page` 在 `App.vue` 的根上（令牌作用域与适老化都挂在那里），页面组件本身
> 从 `vm-body`／`vm-sheet` 开始写，不要再套一层 `vm-page`。

## A7 运行时证据

`npm run dev` 期间的未捕获错误自动落盘到
`<项目根>/.vima/reports/runtime-errors.{{appId}}.jsonl`，供 `/check` 与 Verifier 取证。
构建产物不含任何上报代码。
