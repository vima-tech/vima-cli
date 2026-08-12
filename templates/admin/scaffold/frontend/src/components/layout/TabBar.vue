<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Tab {
  path: string
  title: string
  name: string
}

const route = useRoute()
const router = useRouter()
const tabs = ref<Tab[]>([])
const activeTab = ref('')

const addTab = () => {
  const path = route.path
  const title = route.meta?.title as string
  const name = route.name as string

  if (!title || route.meta?.hidden) return

  const exists = tabs.value.find((t) => t.path === path)
  if (!exists) {
    tabs.value.push({ path, title, name })
  }
  activeTab.value = path
}

const handleTabClick = (path: string) => {
  router.push(path)
}

const handleTabClose = (path: string) => {
  const index = tabs.value.findIndex((t) => t.path === path)
  if (index === -1) return

  tabs.value.splice(index, 1)

  if (path === activeTab.value) {
    const nextTab = tabs.value[index] || tabs.value[index - 1]
    if (nextTab) {
      router.push(nextTab.path)
    } else {
      router.push('/dashboard')
    }
  }
}

const handleCloseOther = () => {
  tabs.value = tabs.value.filter((t) => t.path === activeTab.value || t.path === '/dashboard')
}

const handleCloseAll = () => {
  tabs.value = [{ path: '/dashboard', title: '仪表盘', name: 'Dashboard' }]
  router.push('/dashboard')
}

watch(route, addTab, { immediate: true })
</script>

<template>
  <div class="tab-bar">
    <div class="tabs">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: activeTab === tab.path }"
        @click="handleTabClick(tab.path)"
      >
        <span class="tab-title">{{ tab.title }}</span>
        <span
          v-if="tab.path !== '/dashboard'"
          class="tab-close"
          @click.stop="handleTabClose(tab.path)"
        >
          ×
        </span>
      </div>
    </div>
    <div class="tab-actions">
      <VDropdown trigger="click">
        <VButton size="small">操作</VButton>
        <template #dropdown>
          <VDropdownMenu>
            <VDropdownMenuItem @click="handleCloseOther">关闭其他</VDropdownMenuItem>
            <VDropdownMenuItem @click="handleCloseAll">关闭全部</VDropdownMenuItem>
          </VDropdownMenu>
        </template>
      </VDropdown>
    </div>
  </div>
</template>

<style scoped>
/*
 * VBody 是纵向 flex，子项默认 flex-shrink:1——内容区一高，标签栏就会被压扁。
 * 顶栏和侧栏由框架的 .vui-header / .vui-side 保证不压缩，自定义的这层要自己声明。
 */
.tab-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 0 16px;
  border-bottom: 1px solid #e4e7ed;
}

.tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  background: #f5f7fa;
  border-radius: 4px 4px 0 0;
  white-space: nowrap;
}

.tab-item:hover {
  color: var(--v-primary);
}

.tab-item.active {
  color: var(--v-primary);
  background: #fff;
  border-bottom: 2px solid var(--v-primary);
}

.tab-close {
  font-size: 14px;
  color: #999;
}

.tab-close:hover {
  color: #f56c6c;
}

.tab-actions {
  margin-left: 16px;
}
</style>
