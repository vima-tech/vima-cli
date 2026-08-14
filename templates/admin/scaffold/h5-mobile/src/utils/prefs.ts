import { ref, watch } from 'vue'

/**
 * 端级偏好（适老化开关）。
 * 用一个模块级 ref 而不是引 pinia：本骨架只有这一项跨页状态，
 * 为它装一整套状态管理属于镀金。真出现第二、第三项跨页状态时再引。
 */
const KEY = 'vm_aging'

export const aging = ref<boolean>(localStorage.getItem(KEY) === '1')

watch(aging, (v) => {
  localStorage.setItem(KEY, v ? '1' : '0')
})
