<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()

interface MenuItem {
  path: string
  title: string
  icon?: string
  /** 后端菜单 path：渲染时按 store.menuPaths 过滤的依据；不填 = 登录即可见（非 RBAC 管控页） */
  requiredMenuPath?: string
  children?: MenuItem[]
}

const menuList: MenuItem[] = [
  { path: '/dashboard', title: '仪表盘', icon: '📊' },
  {
    path: '/system',
    title: '系统管理',
    icon: '⚙️',
    requiredMenuPath: '/system',
    children: [
      { path: '/system/user', title: '用户管理', icon: '👤', requiredMenuPath: '/system/user' },
      { path: '/system/role', title: '角色管理', icon: '🔑', requiredMenuPath: '/system/role' },
      { path: '/system/menu', title: '菜单管理', icon: '📋', requiredMenuPath: '/system/menu' },
      { path: '/system/dept', title: '部门管理', icon: '🏢', requiredMenuPath: '/system/dept' },
      { path: '/system/dict', title: '字典管理', icon: '📖', requiredMenuPath: '/system/dict' },
      { path: '/system/config', title: '系统配置', icon: '⚙️', requiredMenuPath: '/system/config' },
      { path: '/system/file', title: '文件管理', icon: '📁', requiredMenuPath: '/system/file' },
      { path: '/system/log/oper', title: '操作日志', icon: '📝', requiredMenuPath: '/system/log/oper' },
      { path: '/system/log/login', title: '登录日志', icon: '📝', requiredMenuPath: '/system/log/login' },
    ],
  },
  {
    path: '/monitor',
    title: '系统监控',
    icon: '📡',
    requiredMenuPath: '/monitor',
    children: [
      { path: '/monitor/online', title: '在线用户', icon: '🟢', requiredMenuPath: '/monitor/online' },
      { path: '/monitor/job', title: '定时任务', icon: '⏰', requiredMenuPath: '/monitor/job' },
    ],
  },
  { path: '/message', title: '消息中心', icon: '🔔' },
]

// admin（perms 含 "*"）全显；未声明 requiredMenuPath 的基础页登录即可见；其余按后端下发的 menuPaths 过滤
const canShow = (item: MenuItem) =>
  !item.requiredMenuPath || userStore.hasPerm('*') || userStore.menuPaths.includes(item.requiredMenuPath)

const visibleMenus = computed<MenuItem[]>(() =>
  menuList
    .map((item) => {
      if (!item.children) return canShow(item) ? item : null
      const children = item.children.filter(canShow)
      // 分组按「有无可见子项」决定显隐，避免出现空分组标题
      return children.length ? { ...item, children } : null
    })
    .filter((item): item is MenuItem => item !== null)
)

const activeMenu = computed(() => route.path)

const handleMenuClick = (item: MenuItem) => {
  router.push(item.path)
}
</script>

<template>
  <!--
    宽度走 class 而不是 props：VSide 只是个语义标签，没有 collapsed / width 属性，
    传进去只会原样落成 <aside collapsed width> 这样的无效 HTML 属性，不产生任何效果。
  -->
  <VSide class="sidebar" :class="{ 'is-collapsed': appStore.sidebarCollapsed }">
    <div class="logo">
      <span v-if="!appStore.sidebarCollapsed">{{projectName}}</span>
      <span v-else>{{projectAbbr}}</span>
    </div>
    <nav class="menu">
      <template v-for="item in visibleMenus" :key="item.path">
        <div v-if="!item.children" class="menu-item" :class="{ active: activeMenu === item.path }" @click="handleMenuClick(item)">
          <span class="icon">{{ item.icon }}</span>
          <span v-if="!appStore.sidebarCollapsed" class="title">{{ item.title }}</span>
        </div>
        <div v-else class="menu-group">
          <div class="menu-group-title">
            <span class="icon">{{ item.icon }}</span>
            <span v-if="!appStore.sidebarCollapsed">{{ item.title }}</span>
          </div>
          <div class="menu-group-items">
            <div v-for="child in item.children" :key="child.path" class="menu-item" :class="{ active: activeMenu === child.path }" @click="handleMenuClick(child)">
              <span class="icon">{{ child.icon }}</span>
              <span v-if="!appStore.sidebarCollapsed" class="title">{{ child.title }}</span>
            </div>
          </div>
        </div>
      </template>
    </nav>
  </VSide>
</template>

<style scoped>
/*
 * 框架把 .vui-side 定成 flex:none，宽度必须由宿主自己给——不给的话侧栏会缩到内容宽度。
 * 高度不用管：VLayout 是横向 flex，侧栏自然拉满通高。
 */
.sidebar {
  width: 220px;
  background: #304156;
  color: #bfcbd9;
  overflow-y: auto;
  transition: width 0.2s;
}

.sidebar.is-collapsed {
  width: 64px;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  background: #2b2f3a;
}

.menu {
  padding: 8px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.2s;
  color: #bfcbd9;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.menu-item.active {
  background: var(--v-primary);
  color: #fff;
}

.menu-group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  font-size: 12px;
  color: #909399;
  text-transform: uppercase;
}

.menu-group-items .menu-item {
  padding-left: 48px;
}

.icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.title {
  flex: 1;
  font-size: 14px;
}
</style>
