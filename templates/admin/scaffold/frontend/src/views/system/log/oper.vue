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
  module: undefined as string | undefined,
  username: '',
  status: undefined as number | undefined,
})

// 后端 AOP 记录的模块名是 Controller 类名，这里映射为菜单中文名；
// 业务自建的 Controller 未收录时回落到类名本身
const MODULE_LABELS: Record<string, string> = {
  UserController: '用户管理',
  RoleController: '角色管理',
  MenuController: '菜单管理',
  DeptController: '部门管理',
  DictController: '字典管理',
  ConfigController: '系统配置',
  FileController: '文件管理',
  LogController: '日志管理',
  MessageController: '消息中心',
  OnlineUserController: '在线用户',
  JobController: '定时任务',
}

const moduleLabel = (module: string) => MODULE_LABELS[module] || module || '-'

// 筛选下拉给的是中文名，传给后端的仍是类名——两边口径不同，映射只此一处
const moduleOptions = Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label }))

/*
 * 列宽约定（见 styles/base.css 的表格小节）：短字段定宽，请求地址作为唯一自由列吃掉剩余宽度。
 * 时间列 170px 是配合 formatDateTime 后的 `2026-08-12 19:17:15` 定的——
 * 直接渲染后端的 ISO 串需要 213px，此前 180px 每行都被裁掉 33px。
 */
const columns = [
  { key: 'module', title: '模块', width: 100, customSlot: 'module', ellipsisTooltip: true },
  { key: 'method', title: '方法', width: 200, ellipsisTooltip: true },
  { key: 'requestUrl', title: '请求地址', ellipsisTooltip: true },
  { key: 'requestMethod', title: '请求方式', width: 90 },
  { key: 'username', title: '操作人', width: 100 },
  { key: 'ip', title: 'IP', width: 120 },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { key: 'costTime', title: '耗时', width: 90, customSlot: 'costTime' },
  { key: 'operTime', title: '操作时间', width: 170, customSlot: 'operTime' },
]

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/system/log/oper/list', { params: queryParams })
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
  queryParams.module = undefined
  queryParams.username = ''
  queryParams.status = undefined
  handleSearch()
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
      <template #extra>
        <VButton v-auth="'system:operlog:remove'" type="danger" @click="handleClear">清空日志</VButton>
      </template>

      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="模块">
          <VSelect v-model="queryParams.module" placeholder="全部模块" clearable>
            <VSelectOption v-for="item in moduleOptions" :key="item.value" :value="item.value" :label="item.label" />
          </VSelect>
        </VFormItem>
        <VFormItem label="操作人">
          <VInput v-model="queryParams.username" placeholder="请输入操作人" clearable @keyup.enter="handleSearch" />
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
        <template #module="{ row }">
          <span>{{ moduleLabel(row.module) }}</span>
        </template>
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '成功' : '失败' }}</VTag>
        </template>
        <template #costTime="{ row }">
          <span>{{ row.costTime }}ms</span>
        </template>
        <template #operTime="{ row }">
          <span>{{ formatDateTime(row.operTime) }}</span>
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
