<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getMessageList, markAsRead, markAllAsRead } from '@/api/system'
import { useMessageStore } from '@/store/message'

const messageStore = useMessageStore()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const activeTab = ref('all')

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  status: undefined as number | undefined,
})

const tabs = [
  { key: 'all', label: '全部消息', status: undefined },
  { key: 'unread', label: '未读消息', status: 0 },
  { key: 'read', label: '已读消息', status: 1 },
]

const columns = [
  { key: 'title', title: '标题', customSlot: 'title' },
  { key: 'content', title: '内容' },
  { key: 'type', title: '类型', width: 100, customSlot: 'type' },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { key: 'createTime', title: '时间', width: 180 },
]

const handleTabClick = (tab: any) => {
  queryParams.status = tab.status
  queryParams.pageNum = 1
  fetchData()
}

const handleRead = async (row: any) => {
  if (row.status === 1) return
  try {
    await markAsRead(row.id)
    row.status = 1
    messageStore.decrement()
  } catch (error) {
    console.error(error)
  }
}

const handleReadAll = async () => {
  try {
    await markAllAsRead()
    messageStore.clear()
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await getMessageList(queryParams)
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="消息中心">
      <template #header-extra>
        <VButton @click="handleReadAll">全部已读</VButton>
      </template>

      <VTab v-model="activeTab" @change="handleTabClick">
        <VTabItem v-for="tab in tabs" :key="tab.key" :id="tab.key" :title="tab.label" />
      </VTab>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #title="{ row }">
          <div class="message-title" :class="{ unread: row.status === 0 }" @click="handleRead(row)">
            <span v-if="row.status === 0" class="dot"></span>
            {{ row.title }}
          </div>
        </template>
        <template #type="{ row }">
          <VTag :type="row.type === 1 ? 'primary' : row.type === 2 ? 'warning' : 'info'">
            {{ row.type === 1 ? '系统通知' : row.type === 2 ? '待办提醒' : '其他' }}
          </VTag>
        </template>
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '已读' : '未读' }}
          </VTag>
        </template>
      </VTable>

      <VPagination
        v-model:current="queryParams.pageNum"
        :page-size="queryParams.pageSize"
        :total="total"
        @change="fetchData"
      />
    </VCard>
  </div>
</template>

<style scoped>
.message-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.message-title:hover {
  color: var(--v-primary);
}

.message-title.unread {
  font-weight: bold;
  color: #333;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
}
</style>
