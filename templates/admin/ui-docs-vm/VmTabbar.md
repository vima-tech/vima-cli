# VmTabbar · 底部主导航（H5 专属组件）

> 组件：`<VmTabbar :items :active @change>`
> 小程序端**不用它**：原生 `tabBar` 在 `app.json` 里声明，性能与手感都更好

## 用途

H5 的底部主导航。`items` 与 spec 里该端的 `vima:menus` 一一对应——
mobile 端的「菜单」就是 tabbar，3–5 项。

## 结构

```html
<VmTabbar :items="tabs" :active="route.name" @change="onTab" />
```

```ts
const tabs = [
  { key: 'home', text: '首页' },
  { key: 'plan', text: '方案' },
  { key: 'mine', text: '我的' },
]
function onTab(key: string) { router.replace({ name: key }) }
```

页面内容区末尾要留出高度，否则最后一屏被压住——用 `vm-actionbar-safe` 占位。

## 不要这样用

- **超过 5 项**：手机上点不准，且文字会挤成两行。项数受 spec 的菜单声明约束，
  不要在组件里自由发挥。
- **与 `vm-actionbar` 同页**：两条固定底栏会叠在一起。有 tabbar 的页面，
  操作放在内容区里。
- **切 tab 用 `router.replace` 而不是 `push`**：否则返回键会在 tab 之间倒着走。
