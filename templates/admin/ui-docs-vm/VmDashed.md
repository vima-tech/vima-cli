# VmDashed · 虚线动作区

> 类：`vm-dashed`

## 用途

一次性动作的强调入口：获取微信手机号、拍照识别、扫码录入。
虚线边框传达「这里要你做一个动作」，与实心按钮（提交表单）区分开。

## 结构

```html
<view class="vm-field">
  <text class="vm-label">手机号</text>
  <button class="vm-dashed" open-type="getPhoneNumber" bindgetphonenumber="onPhone">
    使用微信绑定手机号
  </button>
</view>
```

需要微信授权能力（`getPhoneNumber`/`getUserProfile`）时它必须是 `<button>`——
小程序只允许从 button 的 open-type 触发这些能力，套在 view 上点了没反应。

## 不要这样用

- **一屏最多一个**。它比主按钮还显眼，两个并存会让用户不知道该先点哪个。
- **不要用它替代主按钮**：表单提交是 `VmButton` 的 `vm-btn-primary`。
