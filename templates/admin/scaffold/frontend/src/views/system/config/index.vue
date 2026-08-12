<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'
import { intFlag } from '@/utils/form'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增配置')

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  configName: '',
  configKey: '',
})

const form = reactive({
  id: undefined as number | undefined,
  configName: '',
  configKey: '',
  configValue: '',
  remark: '',
  status: 1,
})

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const statusOn = intFlag(form, 'status')

// 配置值与备注是两列自由列，剩余宽度在两者之间分，不会像原来那样全砸给一列
const columns = [
  { key: 'configName', title: '配置名称', width: 220 },
  { key: 'configKey', title: '配置键', width: 260, ellipsisTooltip: true },
  { key: 'configValue', title: '配置值', ellipsisTooltip: true },
  { key: 'remark', title: '备注', ellipsisTooltip: true },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.configName = ''
  form.configKey = ''
  form.configValue = ''
  form.remark = ''
  form.status = 1
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增配置'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑配置'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除吗？'))) return
  await request.delete(`/system/config/${id}`)
  fetchData()
}

const handleSubmit = async () => {
  if (form.id) {
    await request.put('/system/config', form)
  } else {
    await request.post('/system/config', form)
  }
  dialogVisible.value = false
  fetchData()
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/system/config/list', { params: queryParams })
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
  queryParams.configName = ''
  queryParams.configKey = ''
  handleSearch()
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="系统配置">
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="配置名称">
          <VInput v-model="queryParams.configName" placeholder="请输入配置名称" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem label="配置键">
          <VInput v-model="queryParams.configKey" placeholder="请输入配置键" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:config:add'" type="primary" @click="handleAdd">新增配置</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'system:config:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:config:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>

      <VPagination
        v-model:current="queryParams.pageNum"
        :page-size="queryParams.pageSize"
        :total="total"
        @change="fetchData"
      />
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="500px">
      <VForm :model="form" label-width="100px">
        <VFormItem label="配置名称">
          <VInput v-model="form.configName" placeholder="请输入配置名称" />
        </VFormItem>
        <VFormItem label="配置键">
          <VInput v-model="form.configKey" :disabled="!!form.id" placeholder="请输入配置键" />
        </VFormItem>
        <VFormItem label="配置值">
          <VTextarea v-model="form.configValue" placeholder="请输入配置值" />
        </VFormItem>
        <VFormItem label="备注">
          <VTextarea v-model="form.remark" placeholder="请输入备注" />
        </VFormItem>
        <VFormItem label="状态">
          <VSwitch v-model="statusOn" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleSubmit">确定</VButton>
      </template>
    </VLayer>
  </div>
</template>
