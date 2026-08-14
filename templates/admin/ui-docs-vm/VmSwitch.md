# VmSwitch · 开关行（控件 `switch`）

> 类：`vm-switch-row`

## 用途

左标签右开关的一整行。开关本身用**原生 `<switch>`**，框架只管这一行的排布——
系统控件的手感和无障碍支持是自己画不出来的。

## 结构

```html
<view class="vm-card">
  <view class="vm-kv">
    <view class="vm-switch-row" style="flex:1">
      <text>接收随访提醒</text>
      <switch checked="{{form.notify}}" bindchange="onToggle" color="#2f73c5" />
    </view>
  </view>
</view>
```

`color` 只能写字面值（原生组件属性吃不到 CSS 变量），取值须与 `--vm-primary` 一致；
换主题时这里要一起改。

## 不要这样用

- **开关的语义必须是「立即生效」**。需要点「保存」才生效的用 `VmChoice`——
  用户对开关的预期就是拨完即生效。
- 标签要写成陈述句（「接收随访提醒」），不要写成问句或带「是否」。

## H5 端差异

没有原生 `<switch>`，用带 `role="switch"` 的 `<input type="checkbox">`：

```html
<div class="vm-switch-row">
  <span>接收随访提醒</span>
  <input type="checkbox" role="switch" v-model="form.notify" />
</div>
```

开关的外观由 `global.css` 提供（框架已画好），页面只写上面这三行结构。
`color` 属性也不存在——于是 H5 端少一处必须同步的裸色值。
