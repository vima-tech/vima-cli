# VmChoice · 选项按钮组（控件 `radio` / `checkbox`）

> 类：`vm-choice`

## 用途

2–4 个选项的单选/多选。比原生 `<radio>` 的小圆点好点得多——
手机上点击目标要够大。

## 结构

```html
<!-- 单选 -->
<view class="vm-field">
  <text class="vm-label">性别</text>
  <view style="display:flex;gap:12px">
    <view class="vm-choice {{form.sex === '1' ? 'active' : ''}}"
          bindtap="onSex" data-v="1">男</view>
    <view class="vm-choice {{form.sex === '2' ? 'active' : ''}}"
          bindtap="onSex" data-v="2">女</view>
  </view>
</view>
```

多选同理，`active` 由「值在已选数组里」决定。

## 修饰类

| 类 | 作用 |
|---|---|
| `active` | 选中态（蓝框 + 浅蓝底 + 蓝字） |

## 不要这样用

- **超过 4 个选项改用 `VmPicker`**：一行塞不下就会折行，折行后的按钮组很难扫读。
- **选中态不要只靠颜色**：`active` 同时改了边框与底色，别把它简化成只换字色。
- 选项超过 8 个字用 `VmPicker`，`vm-choice` 是等宽平分的，长文案会被压扁。
