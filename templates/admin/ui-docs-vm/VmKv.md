# VmKv · 键值行（词表 `detail`）

> 类：`vm-kv` `vm-kv-label` `vm-kv-value`

## 用途

只读详情的主力形态：左标签定宽、右值自适应、超长自动折行。
详情页 90% 的内容都是它——不要为此另造表格。

## 结构

```html
<view class="vm-card">
  <view class="vm-kv">
    <text class="vm-kv-label">姓名</text>
    <text class="vm-kv-value">张桂芳</text>
  </view>
  <view class="vm-kv">
    <text class="vm-kv-label">诊断</text>
    <text class="vm-kv-value">慢性肾病 3 期，合并低蛋白血症</text>
  </view>
</view>
```

标签列固定 88px。标签超过 4 个字会挤，这时**缩短标签**，不要改宽度——
一页里各行标签宽度不一致，比标签长一点更难读。

## 不要这样用

- **不要用它做可编辑表单**。要能改就是 `VmField` + `VmInput`/`VmPicker`。
- **值为空时写「—」或「未填写」**，不要留空白行：空白让人分不清「没数据」还是「没渲染」。
- 需要一行多值（如三个指标并排）时用 `VmMetric`，不要在 `vm-kv-value` 里塞 flex 布局。
