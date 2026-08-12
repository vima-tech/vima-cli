<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { useMessageStore } from '@/store/message'
import Sidebar from './Sidebar.vue'
import Breadcrumb from './Breadcrumb.vue'
import TabBar from './TabBar.vue'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()
const messageStore = useMessageStore()

const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'password':
      router.push('/profile?tab=password')
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
    VLayout 直接子元素里有 VSide，会自动转成横向：侧栏通高、顶栏在 VBody 里只压住内容区。
  -->
  <VLayout class="vui-layout-fill">
    <Sidebar />
    <VBody>
      <VHeader class="header">
        <div class="header-left">
          <VButton class="collapse-btn" @click="appStore.toggleSidebar">
            {{ appStore.sidebarCollapsed ? '☰' : '✕' }}
          </VButton>
          <Breadcrumb />
        </div>
        <div class="header-right">
          <div class="header-item message" @click="router.push('/message')">
            <span class="icon">🔔</span>
            <span v-if="messageStore.unreadCount > 0" class="badge">
              {{ messageStore.unreadCount > 99 ? '99+' : messageStore.unreadCount }}
            </span>
          </div>
          <VDropdown trigger="click">
            <div class="user-info">
              <span class="avatar">{{ userStore.realName?.charAt(0) || 'U' }}</span>
              <span class="name">{{ userStore.realName || userStore.username }}</span>
            </div>
            <template #dropdown>
              <VDropdownMenu>
                <VDropdownMenuItem @click="handleCommand('profile')">
                  <span>👤</span> 个人中心
                </VDropdownMenuItem>
                <VDropdownMenuItem @click="handleCommand('password')">
                  <span>🔒</span> 修改密码
                </VDropdownMenuItem>
                <VDropdownMenuItem divided @click="handleCommand('logout')">
                  <span>🚪</span> 退出登录
                </VDropdownMenuItem>
              </VDropdownMenu>
            </template>
          </VDropdown>
        </div>
      </VHeader>
      <TabBar />
      <div class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </VBody>
  </VLayout>
</template>

<style scoped>
/* flex:none 不用写，框架已给 .vui-header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.collapse-btn {
  padding: 8px;
  font-size: 18px;
}

.header-item {
  position: relative;
  cursor: pointer;
  padding: 8px;
}

.header-item:hover {
  background: rgba(0, 0, 0, 0.025);
}

.icon {
  font-size: 20px;
}

.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #f56c6c;
  color: #fff;
  font-size: 12px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  padding: 0 4px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.user-info:hover {
  background: rgba(0, 0, 0, 0.025);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--v-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.name {
  font-size: 14px;
  color: #333;
}

/*
 * 路由出口。这里只负责「把剩下的高度交给页面」，不负责内边距和滚动——
 * 那两件事归页面根 .vui-page（框架契约）。
 *
 * 原先写的是 min-height: calc(100vh - 120px) + overflow-y: auto：
 * 120 是顶栏加标签栏的高度硬编码，任何一处改高就错位；
 * 而 min-height 撑不出确定高度，页面里的表格拿不到高度、只能一路往下长，
 * 滚动条最终落在整页上，搜索栏和分页会跟着划走。
 */
.main-content {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  background: #f5f7fa;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
