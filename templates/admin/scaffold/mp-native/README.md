# {{projectName}} · 微信小程序端（`{{appId}}`）

原生小程序 + TypeScript，无框架、无转译层。UI 用 vendored `vima-ui-mp` 类契约框架。

## 跑起来

1. 微信开发者工具 → 导入项目 → 选**本目录**（不是项目根）
2. AppID 选「测试号」即可（`project.config.json` 里留的是 `touristappid`）
3. 详情 → 本地设置 → 勾「不校验合法域名」（开发期连 `http://localhost:8080`）

`miniprogramRoot` 是 `src/`，所以工具里看到的根就是 `src/`。

## 目录

```
src/
  app.ts / app.json / app.wxss   全局入口（登录态、适老化、tabBar、样式引入）
  config.ts                      BASE_URL 等端级配置
  api/                           按模块一文件，只放接口封装（任务生成）
  pages/<name>/                  一页四文件 .ts/.json/.wxml/.wxss
  components/                    本端共享自定义组件（共享层，改动需令牌）
  utils/                         共享工具（共享层，改动需令牌）
    request.ts                   ★ 统一请求门面，唯一允许发网络请求的地方
    auth.ts / report.ts
  vendor/vima-ui-mp/             ★ UI 框架（共享层，不要改 dist/）
scripts/collect-runtime-errors.mjs   A7 运行时证据采集（见下）
```

## 三条硬纪律

1. **所有请求走 `utils/request.ts` 的门面**，路径写字面量。
   直接 `wx.request` 会让 `vima validate` 的 V-CODE-01 对账失明——
   接口不在契约里查不出来、调了别的端的接口（越权）也查不出来。
2. **样式只用 `vm-*` 类与 `var(--vm-*)` 令牌**，不写裸色值/裸字号。
   页面私有样式确有必要时写在本页 `.wxss`，通用的提到框架里（框架改动需共享层令牌）。
   注意两处 JSON 里用不了 CSS 变量、只能写字面值，改主题时必须一起改：
   `app.json` 的 `tabBar.color`/`selectedColor`、`app.wxss` 的 `page { background-color }`。
3. **`vendor/vima-ui-mp/dist/` 不改**。要覆盖就在自己的 wxss 里重定义令牌；
   改 vendor 会在下次 `vima update` 拉新版时被静默盖掉（见 vendor/PATCHES.md）。

## 页面结构约定（机检看这个）

业务页由任务生成，页面根节点带 `data-page`、区块容器带 `data-block`：

```html
<view class="vm-page" data-page="PAGE-07">
  <view class="vm-body">
    <view data-block="search">…</view>
    <view data-block="list">…</view>
  </view>
</view>
```

`post-write` hook 会把这两个标记与 `docs/review/prototype.manifest.json` 逐条对账——
少一个区块、写了个原型里没有的区块，落盘即报。骨架自带的两个页面是**壳层页**，
不属于 spec 页面，所以不带 `data-page`。

## A7 运行时证据

```bash
npm run runtime:collect     # 需要微信开发者工具 + 已打开「服务端口」
```

采集到 `<项目根>/.vima/reports/runtime-errors.{{appId}}.jsonl`。
工具不在场时**不写文件**，`/check` 会如实报「该端无运行时证据通道」——
空文件会被读成「跑过且零错误」，那比没有证据更糟。
