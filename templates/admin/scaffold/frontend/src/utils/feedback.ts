/**
 * 统一的用户反馈入口。
 *
 * 不要在业务代码里用原生 confirm() / alert()：它们会阻塞主线程、样式不受控、
 * 在 iframe 与自动化测试里行为还不一致。框架自带的 layer 服务负责这些场景。
 *
 * layer.confirm 是回调式的，直接替换原生 confirm 会把 `if (!confirm()) return`
 * 这种写法拆成回调金字塔，所以这里包一层 Promise，保持业务代码是线性的。
 */
import { layer } from '@vima-tech/ui-admin'

/**
 * 二次确认。用法与原生 confirm 一致，但要 await：
 *
 *     if (!(await confirmAsync('确定要删除该用户吗？'))) return
 */
export function confirmAsync(content: string, title = '请确认'): Promise<boolean> {
  return new Promise((resolve) => {
    layer.confirm(content, {
      title,
      btn: [
        {
          text: '确定',
          callback: (index) => {
            layer.close(index)
            resolve(true)
          }
        },
        {
          text: '取消',
          callback: (index) => {
            layer.close(index)
            resolve(false)
          }
        }
      ]
    })
  })
}

/** 轻提示，替代 alert()。icon: 0=信息 1=成功 2=警告 */
export function toast(content: string, icon = 0) {
  return layer.msg(content, { icon })
}

/** 操作成功提示 */
export const toastSuccess = (content: string) => toast(content, 1)

/** 操作失败提示 */
export const toastError = (content: string) => toast(content, 2)
