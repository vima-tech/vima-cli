<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getOnlineList, kickOnline } from '@/api/monitor'
import type { OnlineToken } from '@/api/monitor'
import { confirmAsync, toastSuccess } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<OnlineToken[]>([])

const columns = [
  { key: 'username', title: '用户名', width: 200 },
  { key: 'expiresAt', title: '过期时间', customSlot: 'expiresAt' },
  { title: '操作', key: 'operator', width: 120, customSlot: 'operator' },
]

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await getOnlineList()
    tableData.value = res.data || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const handleKick = async (row: OnlineToken) => {
  if (!(await confirmAsync(`确定要将 ${row.username} 踢下线吗？`))) return
  try {
    await kickOnline(row.username)
    toastSuccess('已踢下线')
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="在线用户">
      <div class="toolbar">
        <VButton @click="fetchData">刷新</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #expiresAt="{ row }">
          <VCountdown :value="row.expiresAt" format="HH:mm:ss" suffix="后过期" />
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'monitor:online:kick'" size="small" type="danger" @click="handleKick(row)">踢下线</VButton>
        </template>
      </VTable>
    </VCard>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
