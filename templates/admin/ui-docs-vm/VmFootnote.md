# VmFootnote · 页脚与链接

> 类：`vm-footnote` `vm-footnote-brand` `vm-footnote-hotline` `vm-hot` `vm-agreement`
> `vm-link` `vm-link-strong`

## 用途

页面底部的品牌行、求助热线、协议声明，以及正文里的链接文字。

## 结构

```html
<view class="vm-footnote">
  <view class="vm-footnote-brand">院外营养患者管理系统</view>
  <view class="vm-footnote-hotline">
    咨询热线 <text class="vm-hot" bindtap="onCall">400-000-0000</text>
  </view>
</view>

<view class="vm-agreement">
  登录即表示同意<text class="vm-link-strong" bindtap="onTerms">《用户协议》</text>
  与<text class="vm-link-strong" bindtap="onPrivacy">《隐私政策》</text>
</view>
```

`vm-hot` 是可拨打的号码，点击走 `wx.makePhoneCall`。

## 不要这样用

- **热线号码必须真的能拨**：给了 `vm-hot` 样式却不绑 `makePhoneCall`，
  用户点了没反应比不给更糟。
- **协议链接必须点得开**：合规要求，不能只是蓝字。
