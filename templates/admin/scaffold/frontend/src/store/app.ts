import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storage } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(storage.get('sidebarCollapsed') || false)
  const activeMenu = ref('dashboard')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    storage.set('sidebarCollapsed', sidebarCollapsed.value)
  }

  function setActiveMenu(menu: string) {
    activeMenu.value = menu
  }

  return {
    sidebarCollapsed,
    activeMenu,
    toggleSidebar,
    setActiveMenu,
  }
})
