# ActionGroup（A27 · 骨架组件 `src/components/common/ActionGroup.vue`）

> PDL `priority` 声明的框架吸收层：规格只说「谁重要、谁可收」，
> 「收几个」由本组件按密度档计算（compact 2 / default 3 / loose 4）。
> 「放不放得下」永远不写死在规格里——那条路实测证伪过（声明 220 渲染 286）。

## 用法（表格操作列 / 卡片头动作 / 工具区通用）

```vue
<ActionGroup
  size="sm"
  density="compact"
  :actions="[
    { label: '编辑', priority: 'primary',   onClick: () => onEdit(row) },
    { label: '详情', priority: 'secondary', onClick: () => onDetail(row) },
    { label: '导出', priority: 'overflow',  onClick: () => onExport(row) },
    { label: '作废', priority: 'overflow',  onClick: () => onVoid(row), disabled: row.locked },
  ]"
/>
```

- `priority: 'overflow'` 恒收进「更多」下拉；未标 overflow 但超出密度容量的按声明顺序顺延收起。
- `primary` 渲染为实心强调；一处动作组只该有一个 primary（V-DSN-05 在规格层拦双主）。
- 表格行内 `size="sm"`（既有规范：行内动作一律 sm）。

## 不要这样用

- **不要自己拼 VButton + VDropdown 重造收纳**——收纳容量与密度档的对应关系在这里，
  自拼的版本不会跟着密度变。
- **不要给 rowActions 超过 3 个可见动作还不标 overflow**（V-DSN-06 会提醒）。
