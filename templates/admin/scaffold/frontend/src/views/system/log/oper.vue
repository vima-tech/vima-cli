<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
})

const columns = [
  { key: 'module', title: '模块', width: 120 },
  { key: 'method', title: '方法', width: 150 },
  { key: 'requestUrl', title: '请求地址' },
  { key: 'requestMethod', title: '请求方式', width: 80 },
  { key: 'username', title: '操作人', width: 100 },
  { key: 'ip', title: 'IP', width: 120 },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { key: 'costTime', title: '耗时', width: 80, customSlot: 'costTime' },
  { key: 'operTime', title: '操作时间', width: 180 },
]

const fetchData = async () => {
  loading.value = true
  const res: any = await request.get('/system/log/oper/list', { params: queryParams })
  tableData.value = res.data?.records || []
  total.value = res.data?.total || 0
  loading.value = false
}

const handleClear = async () => {
  if (!(await confirmAsync('确定要清空所有操作日志吗？'))) return
  await request.delete('/system/log/oper/clear')
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="操作日志">
      <template #header-extra>
        <VButton type="danger" @click="handleClear">清空日志</VButton>
      </template>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '成功' : '失败' }}</VTag>
        </template>
        <template #costTime="{ row }">
          <span>{{ row.costTime }}ms</span>
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

<style scoped></style>
