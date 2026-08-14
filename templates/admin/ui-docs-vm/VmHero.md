# VmHero · 顶部主视觉（词表 `banner`）

> 类：`vm-hero` `vm-hero-fx` `vm-hero-glow` `vm-hero-body` `vm-hero-title` `vm-hero-sub`
> `vm-hero-rule-l` `vm-hero-rule-r` `vm-hero-panel` `vm-hero-panel-hd` `vm-hero-panel-title`
> `vm-hero-panel-note` `vm-hero-panel-text`

## 用途

海军蓝渐变的顶部主视觉，用于首页与各模块入口页。`vm-hero-fx`（网格底纹）与
`vm-hero-glow`（青色光晕）是纯 CSS 装饰层，不放内容；正文一律放进 `vm-hero-body`。

## 结构

```html
<view class="vm-hero">
  <view class="vm-hero-fx"></view>
  <view class="vm-hero-glow"></view>
  <view class="vm-hero-body">
    <view class="vm-badge"><view class="vm-badge-dot"></view>服务运行中</view>
    <view class="vm-hero-title">院外营养随访</view>
    <view class="vm-hero-sub">
      <view class="vm-hero-rule-l"></view>PATIENT SERVICE<view class="vm-hero-rule-r"></view>
    </view>
  </view>
</view>
```

主视觉里要放一段须知/依据时，用面板（同样放在 `vm-hero-body` 之后、`vm-hero` 之内）：

```html
<view class="vm-hero-panel">
  <view class="vm-hero-panel-hd">
    <text class="vm-hero-panel-title">随访须知</text>
    <text class="vm-hero-panel-note">每周一次</text>
  </view>
  <view class="vm-hero-panel-text">按医嘱完成本周记录后，营养师会在 24 小时内回复。</view>
</view>
```

## 不要这样用

- **一页只用一次**。第二块主视觉会把页面重心打散，也会让 `vm-sheet` 的负边距对不上。
- **深色面上的文字不要自己配色**：用 `vm-hero-title`/`vm-hero-sub`/`vm-hero-panel-text`，
  它们引的是 `--vm-on-dark-*` 一族，换肤时跟着走。
- 装饰层 `vm-hero-fx`/`vm-hero-glow` 里**不要塞内容**（它们 `pointer-events: none`，点不到）。

## H5 端差异

结构与类完全相同。要注意的是**「banner 是图还是字」**：

- 本组件是**文字主视觉**（渐变底 + 标题 + 副标题），不是图片轮播。
- 需要图片轮播时：小程序用原生 `<swiper>`，H5 自己写一个横向 `overflow-x: auto`
  + `scroll-snap-type: x mandatory` 的容器（不必引轮播库）。两端都**不要**把轮播塞进
  `vm-hero`——它有固定的深色底与内边距，图片压在上面读不清。
