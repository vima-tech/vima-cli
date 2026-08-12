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
  { key: 'username', title: '用户名', width: 120 },
  { key: 'ip', title: 'IP', width: 120 },
  { key: 'browser', title: '浏览器', width: 100 },
  { key: 'os', title: '操作系统', width: 100 },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { key: 'msg', title: '消息' },
  { key: 'loginTime', title: '登录时间', width: 180 },
]

const fetchData = async () => {
  loading.value = true
  const res: any = await request.get('/system/log/login/list', { params: queryParams })
  tableData.value = res.data?.records || []
  total.value = res.data?.total || 0
  loading.value = false
}

const handleClear = async () => {
  if (!(await confirmAsync('确定要清空所有登录日志吗？'))) return
  await request.delete('/system/log/login/clear')
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="登录日志">
      <template #header-extra>
        <VButton type="danger" @click="handleClear">清空日志</VButton>
      </template>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '成功' : '失败' }}</VTag>
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
