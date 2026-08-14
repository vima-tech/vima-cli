# VmHud · 图片强调

> 类：`vm-hud` `vm-hud-tag` `vm-img-scrim`

## 用途

重点图片位上的四角标记（`vm-hud`）、深色标签（`vm-hud-tag`）与底部渐隐遮罩
（`vm-img-scrim`，让压在图上的白字读得清）。三者都是绝对定位，父容器必须
`position: relative; overflow: hidden`。

## 结构

```html
<view class="vm-card" style="position:relative">
  <image src="{{cover}}" mode="aspectFill" />
  <view class="vm-img-scrim"></view>
  <view class="vm-hud tl"></view>
  <view class="vm-hud br"></view>
  <view class="vm-hud-tag" style="left:12px;bottom:12px">本周宣教</view>
</view>
```

## 修饰类

`vm-hud` 必须带方位：`tl` `tr` `bl` `br`（左上/右上/左下/右下），一般成对用对角两个。

## 不要这样用

- **不要四角全上**。四个角同时标会把图片框成「取景器」，喧宾夺主；对角两个足够。
- 没有图片的地方不要用——它们是给图像加强调的，纯色块上只是噪点。
