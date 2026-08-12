import { computed, type WritableComputedRef } from 'vue'

/**
 * 把「后端用 0/1 表示的开关字段」接到 VSwitch 上。
 *
 * 为什么需要这层：VSwitch 只有 modelValue 一个值属性，没有 active-value / inactive-value。
 * 它读的时候把 1 / '1' / true 都当作开（所以直接绑整型字段，初始显示是对的，看不出问题），
 * 但**点一下之后 emit 的是布尔**——form.status 就从 1 变成了 true，提交上去后端字段是
 * Integer，Jackson 直接反序列化失败。这个坑的隐蔽之处在于：不动开关就一切正常。
 *
 * 用法（在 setup 里建一次，不要写在模板里，否则每次渲染都新建一个 computed）：
 *   const statusOn = intFlag(form, 'status')
 *   <VSwitch v-model="statusOn" />
 */
export function intFlag<T extends Record<string, any>>(
  target: T,
  key: keyof T,
): WritableComputedRef<boolean> {
  return computed({
    get: () => target[key] === 1 || target[key] === true || target[key] === '1',
    set: (on: boolean) => {
      ;(target[key] as any) = on ? 1 : 0
    },
  })
}
