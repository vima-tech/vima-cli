<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { useMessageStore } from '@/store/message'
import { markAsRead, markAllAsRead } from '@/api/system'
import { formatDateTime } from '@/utils/datetime'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const messageStore = useMessageStore()

const displayName = computed(() => userStore.realName || userStore.username || '未命名用户')
const avatarText = computed(() => displayName.value.charAt(0).toUpperCase())
const unreadText = computed(() =>
  messageStore.unreadCount > 99 ? '99+' : String(messageStore.unreadCount),
)

// 布局挂载 = 用户已登录：拉一次未读数点亮角标，并建立 SSE 订阅接收实时推送。
// 卸载（退出登录回到 /login）时断开，防止拿着失效 token 的连接反复重连。
onMounted(() => {
  messageStore.fetchUnreadCount()
  messageStore.connect()
})
onBeforeUnmount(() => {
  messageStore.disconnect()
})

/** 面板里点某条消息：未读则标记已读；已读的点击无副作用 */
const handleMessageRead = async (msg: any) => {
  if (msg.status === 1) return
  try {
    await markAsRead(msg.id)
    msg.status = 1
    messageStore.decrement()
  } catch (error) {
    console.error(error)
  }
}

const handleReadAll = async () => {
  try {
    await markAllAsRead()
    messageStore.recent.forEach((msg) => (msg.status = 1))
    messageStore.clear()
  } catch (error) {
    console.error(error)
  }
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'password':
      router.push('/profile?tab=password')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      userStore.logout()
      break
  }
}
</script>

<template>
  <!--
    整页外壳。vui-layout-fill 让它撑满 #app（style.css 已给 html/body/#app 高度）。

    顶栏通栏、侧栏在其下方，是为了让那条深蓝 hero 横贯整个宽度——侧栏切进去会把主视觉截断。
    实现上没有和框架对着干：外层 VLayout 的直接子元素里没有 VSide，所以它保持纵向；
    侧栏放在内层 VLayout 里，由框架自己的 `.vui-layout:has(> .vui-side)` 规则转成横向。

    页签有两种摆放，由「个人设置」切换（appStore.tabPlacement），下面两处 v-if 二选一：
    默认独立成条（页签宽度大），或并入顶栏成「品牌｜页签｜用户/工具」单条（省一条横条的高度）。
    面包屑已退役——页签本身就表达「你在哪」，深蓝顶栏上再摆一行会与页签打架。
    外壳的样式全部在 src/styles/shell.css，这里不写 <style>。
  -->
  <VLayout class="vui-layout-fill">
    <VHeader class="v-shell-header">
      <div class="v-brand">
        <span class="v-brand-mark" aria-hidden="true"><VIcon name="app" size="18" /></span>
        <span class="v-brand-copy">
          <strong>{{projectName}}</strong>
          <small>ADMIN CONSOLE</small>
        </span>
      </div>

      <TabBar v-if="appStore.tabPlacement === 'header'" />

      <div class="v-header-actions">
        <VDropdown placement="bottom-end">
          <!--
            触发器要放在 VDropdown 的默认插槽，菜单放 #content。
            插槽名写错（比如 #dropdown）不会报错，只是菜单永远不出现。
          -->
          <div class="v-header-user" role="button" tabindex="0">
            <span class="v-header-user-icon" aria-hidden="true">{{ avatarText }}</span>
            <span class="v-header-user-copy">
              <small>当前用户</small>
              <strong>{{ displayName }}</strong>
            </span>
          </div>
          <template #content>
            <VDropdownMenu>
              <VDropdownMenuItem @click="handleCommand('profile')">个人中心</VDropdownMenuItem>
              <VDropdownMenuItem @click="handleCommand('password')">修改密码</VDropdownMenuItem>
              <VDropdownMenuItem @click="handleCommand('settings')">个人设置</VDropdownMenuItem>
              <!-- VDropdownMenuItem 只有 disabled 一个 prop；divided 之类写上去只是个无效 HTML 属性 -->
              <VDropdownMenuItem @click="handleCommand('logout')">退出登录</VDropdownMenuItem>
            </VDropdownMenu>
          </template>
        </VDropdown>

        <!-- 折叠侧栏的开关在侧栏页脚（Sidebar.vue），不占顶栏位置 -->
        <div class="v-header-tools">
          <!--
            铃铛点击就地弹出消息面板，不跳页；完整列表仍在 /message 页（面板底部入口）。
            VDropdown 的浮层上有"点击即关闭"的处理（冒泡到浮层根节点触发），
            所以面板主体挂 @click.stop 才能在标记已读等操作后保持打开；
            底部"查看全部"刻意不 stop——让它冒泡关掉面板，再跳转整页。
          -->
          <VDropdown placement="bottom-end">
            <button
              type="button"
              class="v-header-tool"
              aria-label="消息中心"
              @click="messageStore.fetchRecent()"
            >
              <VIcon name="bell" size="17" />
              <span v-if="messageStore.unreadCount > 0" class="v-header-badge">{{
                unreadText
              }}</span>
            </button>
            <template #content>
              <div class="v-msg-panel">
                <div class="v-msg-panel-body" @click.stop>
                  <div class="v-msg-panel-head">
                    <strong>消息中心</strong>
                    <button
                      v-if="messageStore.unreadCount > 0"
                      type="button"
                      class="v-msg-panel-action"
                      @click="handleReadAll"
                    >
                      全部已读
                    </button>
                  </div>
                  <div v-if="messageStore.recent.length" class="v-msg-panel-list">
                    <div
                      v-for="msg in messageStore.recent"
                      :key="msg.id"
                      class="v-msg-panel-item"
                      :class="{ unread: msg.status === 0 }"
                      @click="handleMessageRead(msg)"
                    >
                      <span class="v-msg-panel-dot" aria-hidden="true"></span>
                      <div class="v-msg-panel-copy">
                        <strong>{{ msg.title }}</strong>
                        <p v-if="msg.content">{{ msg.content }}</p>
                        <small>{{ formatDateTime(msg.createTime) }}</small>
                      </div>
                    </div>
                  </div>
                  <!-- 首次打开时列表还在路上，先别闪一下"暂无消息" -->
                  <VEmpty v-else-if="!messageStore.recentLoading" description="暂无消息" />
                </div>
                <button type="button" class="v-msg-panel-foot" @click="router.push('/message')">
                  查看全部消息
                </button>
              </div>
            </template>
          </VDropdown>
          <VFullscreen v-slot="{ toggle, isFullscreen }">
            <button
              type="button"
              class="v-header-tool"
              :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
              @click="toggle()"
            >
              <VIcon :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" size="17" />
            </button>
          </VFullscreen>
        </div>
      </div>
    </VHeader>

    <VLayout class="v-shell-inner">
      <Sidebar />
      <VBody>
        <!-- 默认：页签在顶栏下方自成一条（「个人设置」可改为并入顶栏，两处 v-if 二选一） -->
        <TabBar v-if="appStore.tabPlacement === 'bar'" />
        <!--
          路由出口。这里只负责「把剩下的高度交给页面」，不负责内边距和滚动——
          那两件事归页面根 .vui-page（框架契约）。

          不要退回 min-height: calc(100vh - 58px)：58 是顶栏高度硬编码，改高就错位；
          而 min-height 撑不出确定高度，页面里的表格拿不到高度、只能一路往下长，
          滚动条最终落在整页上，搜索栏和分页会跟着划走。
        -->
        <div class="v-workspace-content">
          <!--
            这里**不能**加 mode="out-in"。路由组件都是 () => import() 懒加载的：
            out-in 会先把旧页面放完离场动画，而此刻新页面还是个未解析的异步组件（一个占位注释），
            离场结束后 enter 落在注释上，等 chunk 真正解析完也不会再触发一次 —— 表现是
            路由变了、标签页和面包屑都对，内容区却是空白。
            生产构建里 chunk 早已就绪，碰巧躲过，所以这个坑只在 npm run dev 下出现。
            默认（同时进出）模式下新旧页面会短暂共存：shell.css 里给离场页 position:absolute 错开布局，
            并把入场动画推迟到离场淡完之后（fade-through），避免两页同时半透明时背景透出来闪一下。
          -->
          <router-view v-slot="{ Component }">
            <transition name="v-fade">
              <keep-alive>
                <component :is="Component" />
              </keep-alive>
            </transition>
          </router-view>
        </div>
      </VBody>
    </VLayout>
  </VLayout>
</template>
