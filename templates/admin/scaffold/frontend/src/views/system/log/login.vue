<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'
import { formatDateTime } from '@/utils/datetime'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  username: '',
  status: undefined as number | undefined,
})

// 消息列是唯一自由列；登录时间 170px 配合 formatDateTime 的 19 位输出
const columns = [
  { key: 'username', title: '用户名', width: 140 },
  { key: 'ip', title: 'IP', width: 140 },
  { key: 'browser', title: '浏览器', width: 120 },
  { key: 'os', title: '操作系统', width: 120 },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { key: 'msg', title: '消息', ellipsisTooltip: true },
  { key: 'loginTime', title: '登录时间', width: 170, customSlot: 'loginTime' },
]

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/system/log/login/list', { params: queryParams })
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  queryParams.pageNum = 1
  fetchData()
}

const handleReset = () => {
  queryParams.username = ''
  queryParams.status = undefined
  handleSearch()
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
      <template #extra>
        <VButton v-auth="'system:loginlog:remove'" type="danger" @click="handleClear">清空日志</VButton>
      </template>

      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="用户名">
          <VInput v-model="queryParams.username" placeholder="请输入用户名" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem label="状态">
          <VSelect v-model="queryParams.status" placeholder="全部状态" clearable>
            <VSelectOption :value="1" label="成功" />
            <VSelectOption :value="0" label="失败" />
          </VSelect>
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '成功' : '失败' }}</VTag>
        </template>
        <template #loginTime="{ row }">
          <span>{{ formatDateTime(row.loginTime) }}</span>
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
