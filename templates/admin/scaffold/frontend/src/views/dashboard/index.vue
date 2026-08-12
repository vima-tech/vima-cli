<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

const stats = ref([
  { title: '用户总数', value: 128, icon: '👥', color: '#409eff' },
  { title: '角色总数', value: 5, icon: '🔑', color: '#67c23a' },
  { title: '菜单总数', value: 32, icon: '📋', color: '#e6a23c' },
  { title: '部门总数', value: 8, icon: '🏢', color: '#f56c6c' },
])

const shortcuts = [
  { title: '用户管理', icon: '👤', path: '/system/user' },
  { title: '角色管理', icon: '🔑', path: '/system/role' },
  { title: '菜单管理', icon: '📋', path: '/system/menu' },
  { title: '部门管理', icon: '🏢', path: '/system/dept' },
  { title: '消息中心', icon: '🔔', path: '/message' },
  { title: '个人中心', icon: '⚙️', path: '/profile' },
]

const recentActivities = [
  { time: '10:30', user: 'admin', action: '登录系统' },
  { time: '10:25', user: '张三', action: '修改了用户信息' },
  { time: '10:20', user: '李四', action: '新增了角色' },
  { time: '10:15', user: '王五', action: '删除了菜单' },
]
</script>

<template>
  <div class="dashboard">
    <div class="welcome">
      <h2>欢迎回来，{{ userStore.realName || userStore.username }}</h2>
      <p>今天是 {{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</p>
    </div>

    <div class="stats-row">
      <VCard v-for="item in stats" :key="item.title" class="stat-card">
        <div class="stat-icon" :style="{ background: item.color }">{{ item.icon }}</div>
        <div class="stat-info">
          <div class="stat-value">{{ item.value }}</div>
          <div class="stat-title">{{ item.title }}</div>
        </div>
      </VCard>
    </div>

    <div class="content-row">
      <VCard title="快捷操作" class="shortcuts-card">
        <div class="shortcuts">
          <div v-for="item in shortcuts" :key="item.path" class="shortcut-item" @click="router.push(item.path)">
            <span class="icon">{{ item.icon }}</span>
            <span class="title">{{ item.title }}</span>
          </div>
        </div>
      </VCard>
      <VCard title="最近活动" class="activities-card">
        <div class="activities">
          <div v-for="(item, index) in recentActivities" :key="index" class="activity-item">
            <span class="time">{{ item.time }}</span>
            <span class="content">{{ item.user }} {{ item.action }}</span>
          </div>
        </div>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 0;
}

.welcome {
  margin-bottom: 24px;
}

.welcome h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 8px;
}

.welcome p {
  color: #999;
  font-size: 14px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-title {
  font-size: 14px;
  color: #999;
}

.content-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.shortcuts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.shortcut-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border-radius: 8px;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.2s;
}

.shortcut-item:hover {
  background: #ecf5ff;
  transform: translateY(-2px);
}

.shortcut-item .icon {
  font-size: 32px;
}

.shortcut-item .title {
  font-size: 14px;
  color: #333;
}

.activities {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  gap: 12px;
  font-size: 14px;
}

.activity-item .time {
  color: #999;
  min-width: 50px;
}

.activity-item .content {
  color: #333;
}
</style>
