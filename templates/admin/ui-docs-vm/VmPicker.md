# VmPicker · 选择器（控件 `select` / `date` / `time` / `tree`）

> 类：`vm-picker`

## 用途

包住原生 `<picker>` 的可点区域，外观与 `vm-input` 一致。
下拉选择、日期、时间**都用它**——小程序的原生 picker 是系统级滚轮，
自己实现的滚轮在低端机上必然更差。

## 结构

```html
<!-- 下拉选择 -->
<view class="vm-field">
  <text class="vm-label">科室</text>
  <picker mode="selector" range="{{depts}}" range-key="name" value="{{deptIndex}}" bindchange="onDept">
    <view class="vm-picker {{form.deptName ? '' : 'placeholder'}}">
      <text>{{form.deptName || '请选择科室'}}</text>
      <view class="vm-chev"></view>
    </view>
  </picker>
</view>

<!-- 日期 -->
<picker mode="date" value="{{form.date}}" start="2020-01-01" bindchange="onDate">
  <view class="vm-picker {{form.date ? '' : 'placeholder'}}">
    <text>{{form.date || '请选择日期'}}</text>
    <view class="vm-chev"></view>
  </view>
</picker>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `placeholder` | 未选值时整行弱化（必须按值动态拼，否则选完还是灰的） |
| `with-icon` | 左侧留图标位 |

## 不要这样用

- **树形选择（`tree`）在小程序里没有对应控件**：用 `mode="multiSelector"` 做多级联动。
  层级超过 3 层就该回去改设计——手机上没人能在滚轮里逛一棵树。
- **不要把 `<picker>` 的 `class` 写成 `vm-picker`**：picker 是包装元素，
  样式要落在它内部的 `<view>` 上，否则点击区域与视觉框对不齐。

## H5 端差异

浏览器没有系统滚轮选择器，按类型换原生控件，外观仍套 `.vm-picker`：

| 控件 | H5 写法 |
|---|---|
| `select` | `<select class="vm-picker">`（移动浏览器会调起系统选择器） |
| `date` | `<input type="date" class="vm-input">` |
| `time` | `<input type="time" class="vm-input">` |
| `tree` | 两级 `<select>` 联动；层级 > 2 请回去改设计 |

不要为此引第三方滚轮组件——系统控件的可访问性和输入法配合是自己做不出来的。
