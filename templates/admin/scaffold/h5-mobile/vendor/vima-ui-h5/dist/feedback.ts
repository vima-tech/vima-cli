import { reactive } from 'vue'

/**
 * 函数式反馈 API（H5 专属；小程序端对应 wx.showToast / wx.showModal）。
 *
 * 与 admin 端 `@/utils/feedback` 同款约定：页面**不直接用组件**，
 * 而是 `toast('已保存')` / `await confirmAsync('确认删除？')`。
 * 原因：确认框是流程的一步，写成 Promise 才能和业务逻辑写在一起；
 * 拆成组件 + 回调必然出现「确认了没确认」的状态漂移。
 *
 * 使用前提：App.vue 根部各挂一次 <VmToast /> 与 <VmDialog />（骨架已挂好）。
 */

export const toastState = reactive({ visible: false, text: '' })

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function toast(text: string, duration = 2000): void {
  toastState.text = text
  toastState.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastState.visible = false
  }, duration)
}

export const dialogState = reactive({
  visible: false,
  title: '提示',
  content: '',
  okText: '确定',
  cancelText: '取消',
})

let dialogResolve: ((ok: boolean) => void) | null = null

export interface ConfirmOptions {
  title?: string
  okText?: string
  cancelText?: string
}

export function confirmAsync(content: string, options: ConfirmOptions = {}): Promise<boolean> {
  dialogState.content = content
  dialogState.title = options.title ?? '提示'
  dialogState.okText = options.okText ?? '确定'
  dialogState.cancelText = options.cancelText ?? '取消'
  dialogState.visible = true
  return new Promise<boolean>((resolve) => {
    dialogResolve = resolve
  })
}

export function resolveDialog(ok: boolean): void {
  dialogState.visible = false
  const fn = dialogResolve
  dialogResolve = null
  if (fn) fn(ok)
}
