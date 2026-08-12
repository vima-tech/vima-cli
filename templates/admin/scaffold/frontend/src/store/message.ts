import { defineStore } from 'pinia'
import { ref } from 'vue'
import { layer } from '@vima-tech/ui-admin'
import { getMessageList, getUnreadCount } from '@/api/system'
import { useUserStore } from '@/store/user'

/** 推送到达时页面右上角通知的停留毫秒数（失效时间），到点自动消失 */
const NOTIFY_DURATION = 5000

/** 铃铛面板展示的最近消息条数；完整列表在消息中心页 */
const PANEL_SIZE = 5

export const useMessageStore = defineStore('message', () => {
  const unreadCount = ref(0)
  /** 铃铛面板的数据源（最新 PANEL_SIZE 条，含已读） */
  const recent = ref<any[]>([])
  const recentLoading = ref(false)

  let eventSource: EventSource | null = null

  async function fetchUnreadCount() {
    try {
      const res: any = await getUnreadCount()
      unreadCount.value = res.data || 0
    } catch {
      // ignore
    }
  }

  async function fetchRecent() {
    recentLoading.value = true
    try {
      const res: any = await getMessageList({ pageNum: 1, pageSize: PANEL_SIZE })
      recent.value = res.data?.records || []
    } catch {
      // 拉取失败时面板落到空态，不打断用户
    } finally {
      recentLoading.value = false
    }
  }

  /**
   * 建立 SSE 订阅（服务端实时推送）。
   *
   * EventSource 无法自定义请求头，token 只能走 query 参数——后端 TokenAuthFilter
   * 仅对 /message/stream 这一个端点接受这种携带方式。断线重连是 EventSource 的
   * 内建行为，不需要自己写重试。
   */
  function connect() {
    if (eventSource) return
    const userStore = useUserStore()
    if (!userStore.token) return

    eventSource = new EventSource(`/api/system/message/stream?token=${userStore.token}`)

    eventSource.addEventListener('sys-message', (event: MessageEvent) => {
      let msg: any
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      unreadCount.value++
      // 面板数据就地更新，铃铛不用重新拉一遍
      recent.value = [msg, ...recent.value].slice(0, PANEL_SIZE)
      // 页面内即时提示，NOTIFY_DURATION 后自动消失
      layer.notify({
        title: msg.title || '新消息',
        content: msg.content || '',
        time: NOTIFY_DURATION,
      })
    })
    // 后端的心跳是 SSE 注释帧，不会触发任何事件；连接出错时 EventSource 自动重连，
    // 这里不需要 onerror 处理
  }

  /** 退出登录/布局卸载时断开，避免持有失效 token 的连接反复重连打 401 */
  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
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
    recent,
    recentLoading,
    fetchUnreadCount,
    fetchRecent,
    connect,
    disconnect,
    decrement,
    clear,
  }
})
