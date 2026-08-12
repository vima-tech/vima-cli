import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storage } from '@/utils/storage'

/**
 * 页签条位置：
 * - bar：顶栏下方独立一条，页签可用宽度更大，适合常年开十几个页签（默认）
 * - header：内嵌顶栏中段，全站只有一条横条，首屏最省高度
 * 在「个人设置」页切换，随 storage 持久化。
 */
export type TabPlacement = 'header' | 'bar'

const TAB_PLACEMENTS: TabPlacement[] = ['header', 'bar']

export interface WorkspaceTab {
  path: string
  title: string
  name: string
}

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(storage.get('sidebarCollapsed') || false)
  const activeMenu = ref('dashboard')
  // 读到历史脏值（改过 key、降级过版本）时回落默认值，不让未知字符串漏进 class 名
  const stored = storage.get('tabPlacement')
  const tabPlacement = ref<TabPlacement>(TAB_PLACEMENTS.includes(stored) ? stored : 'bar')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    storage.set('sidebarCollapsed', sidebarCollapsed.value)
  }

  function setActiveMenu(menu: string) {
    activeMenu.value = menu
  }

  function setTabPlacement(value: TabPlacement) {
    if (!TAB_PLACEMENTS.includes(value)) return
    tabPlacement.value = value
    storage.set('tabPlacement', value)
  }

  /*
   * 已打开的页签放在 store 而不是 TabBar 组件里：切换 tabPlacement 时 TabBar 会在
   * 顶栏与独立条之间换位置（两处 v-if），组件被销毁重建——状态留在组件里的话，
   * 用户开着十几个页签调一下位置就全没了。
   */
  const tabs = ref<WorkspaceTab[]>([])
  const activeTab = ref('')

  return {
    sidebarCollapsed,
    activeMenu,
    tabPlacement,
    tabs,
    activeTab,
    toggleSidebar,
    setActiveMenu,
    setTabPlacement,
  }
})
