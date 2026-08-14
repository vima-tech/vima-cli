# VmToast · 轻提示（H5 专属组件）

> 函数式 API：`toast(text, duration?)`，从 `vendor/vima-ui-h5/dist` 导入
> 小程序端对应：`wx.showToast`

## 用途

一次性、不阻断的结果反馈：「已保存」「已提交」。

## 用法

页面**不直接用组件**（组件在 `App.vue` 根部已挂一次），只调函数：

```ts
import { toast } from '@ui'

async function onSubmit() {
  await saveRecord(form)
  toast('已保存')
}
```

## 不要这样用

- **不要用它报错误详情**：失败要让用户知道下一步怎么办，用 `confirmAsync`
  或页内错误块；一闪而过的吐司读不完也回不去。
- **不要连续弹多条**：后一条会顶掉前一条，用户只看得到最后一条。
  多个结果合并成一句话。
- **不要用它代替加载态**：加载中用 `VmLoading`。
