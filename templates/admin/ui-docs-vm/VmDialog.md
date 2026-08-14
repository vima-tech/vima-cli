# VmDialog · 确认框（H5 专属组件）

> 函数式 API：`confirmAsync(content, options?) => Promise<boolean>`
> 小程序端对应：`wx.showModal`

## 用途

需要用户明确决策、且**决策结果决定后续代码走向**的场景：删除、作废、放弃编辑。

## 用法

```ts
import { confirmAsync, toast } from '@ui'

async function onDelete(id: string) {
  const ok = await confirmAsync('删除后不可恢复，确认删除这条随访记录？', {
    title: '确认删除',
    okText: '删除',
  })
  if (!ok) return
  await removeRecord(id)
  toast('已删除')
}
```

写成 Promise 是刻意的：确认是流程的一步，`await` 才能和业务逻辑写在一起。
拆成「组件 + 回调」必然出现「确认了没确认」的状态漂移。

## 不要这样用

- **不要用原生 `confirm()`/`alert()`**：样式不可控，且在 iOS 上会阻塞页面。
- **不要用它做表单**：多字段输入用 `VmPopup`（底部面板）。
- **文案必须说清后果**（「删除后不可恢复」），不要只写「确认吗？」。
