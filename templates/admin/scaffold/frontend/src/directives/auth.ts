import type { App, Directive } from 'vue'
import { useUserStore } from '@/store/user'

/**
 * v-auth 权限指令。
 *
 * 用法：
 *   <VButton v-auth="'system:user:add'">新增</VButton>
 *   <VButton v-auth="['system:user:add', 'system:user:edit']">保存</VButton>
 *
 * 值为 perms 串或串数组：任一命中（或用户 perms 含 "*" 通配，即 admin）则保留元素，
 * 否则把元素从 DOM 移除。不用 v-if 是为了让权限点以字符串字面量出现在模板里，
 * 方便全局 grep 对账 perms 契约。
 */
const authDirective: Directive<HTMLElement, string | string[] | undefined> = {
  mounted(el, binding) {
    const value = binding.value
    // 没给值视为不做权限约束，保留元素
    if (!value || (Array.isArray(value) && value.length === 0)) return

    const required = Array.isArray(value) ? value : [value]
    const userStore = useUserStore()
    const pass = required.some((perm) => userStore.hasPerm(perm))
    if (!pass) {
      el.parentNode?.removeChild(el)
    }
  },
}

export default authDirective

/** 在 main.ts 里调用，注册全局 v-auth 指令 */
export function setupAuthDirective(app: App) {
  app.directive('auth', authDirective)
}
