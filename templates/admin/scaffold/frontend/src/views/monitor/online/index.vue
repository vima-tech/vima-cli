<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getOnlineList, kickOnline } from '@/api/monitor'
import type { OnlineToken } from '@/api/monitor'
import { confirmAsync, toastSuccess } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<OnlineToken[]>([])
const keyword = ref('')

/*
 * 在线列表来自 Redis 的全量扫描，接口不带筛选参数，数据量也只有当前活跃会话，
 * 因此按用户名的过滤放在前端做，不给后端加一个只服务于一个输入框的参数。
 */
const filteredData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return tableData.value
  return tableData.value.filter((row) => row.username?.toLowerCase().includes(kw))
})

// 三列表格没有长文本列：两列定宽，剩余宽度留给末列，空白落在最右边缘
const columns = [
  { key: 'username', title: '用户名', width: 240 },
  { key: 'expiresAt', title: '过期时间', width: 260, customSlot: 'expiresAt' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
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
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="用户名">
          <VInput v-model="keyword" placeholder="按用户名过滤" clearable />
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton @click="fetchData">刷新</VButton>
      </div>

      <VTable :loading="loading" :data-source="filteredData" :columns="columns">
        <template #expiresAt="{ row }">
          <VCountdown :value="row.expiresAt" format="HH:mm:ss" suffix="后过期" />
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'monitor:online:kick'" size="sm" type="danger" @click="handleKick(row)">踢下线</VButton>
        </template>
      </VTable>
    </VCard>
  </div>
</template>
