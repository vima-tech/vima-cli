import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUnreadCount } from '@/api/system'

export const useMessageStore = defineStore('message', () => {
  const unreadCount = ref(0)

  async function fetchUnreadCount() {
    try {
      const res: any = await getUnreadCount()
      unreadCount.value = res.data || 0
    } catch {
      // ignore
    }
  }

  function decrement() {
    if (unreadCount.value > 0) unreadCount.value--
  }

  function clear() {
    unreadCount.value = 0
  }

  return {
    unreadCount,
    fetchUnreadCount,
    decrement,
    clear,
  }
})
