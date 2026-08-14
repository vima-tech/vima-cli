# VmGrid · 图标宫格

> 类：`vm-grid4` `vm-grid-item` `vm-grid-icon` `vm-grid-icon-img` `vm-grid-name` `vm-grid-tag`

## 用途

首页/入口页的功能入口区，固定四列。

## 结构

```html
<view class="vm-card">
  <view class="vm-grid4">
    <view class="vm-grid-item" wx:for="{{entries}}" wx:key="key" bindtap="onGo" data-key="{{item.key}}">
      <view class="vm-grid-icon {{item.tone}}">
        <image class="vm-grid-icon-img" src="{{item.icon}}" />
      </view>
      <text class="vm-grid-name">{{item.name}}</text>
      <text class="vm-grid-tag">{{item.tag}}</text>
    </view>
  </view>
</view>
```

`vm-grid-tag`（入口下的小字说明）可省。

## 修饰类

`vm-grid-icon` 支持 `cyan` `green` `indigo` `amber` `red` `violet`，同 `VmTile`。

## 不要这样用

- **固定四列，不做三列/五列变体**。入口数不是 4 的倍数时补空位或重排，
  不要改栅格——各页列数不一致会让首页看起来是拼的。
- **入口名 2–4 个字**。`vm-grid-name` 允许两行，超过就该换更短的说法。
