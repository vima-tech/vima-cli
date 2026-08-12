<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'
import { intFlag } from '@/utils/form'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dataDialogVisible = ref(false)
const dialogTitle = ref('新增字典类型')
const currentTypeId = ref<number>()
const currentTypeName = ref('')

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  dictName: '',
  dictCode: '',
})

const form = reactive({
  id: undefined as number | undefined,
  dictName: '',
  dictCode: '',
  remark: '',
  status: 1,
})

const dataForm = reactive({
  id: undefined as number | undefined,
  typeId: undefined as number | undefined,
  dictLabel: '',
  dictValue: '',
  sort: 0,
  remark: '',
  status: 1,
})

const dataList = ref<any[]>([])

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const statusOn = intFlag(form, 'status')
const dataStatusOn = intFlag(dataForm, 'status')

// 备注是唯一自由列，其余定宽；操作列不写 width，由 VTable 按行内按钮文案自动算
const columns = [
  { key: 'dictName', title: '字典名称', width: 220 },
  { key: 'dictCode', title: '字典编码', width: 240, ellipsisTooltip: true },
  { key: 'remark', title: '备注', ellipsisTooltip: true },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const dataColumns = [
  { key: 'dictLabel', title: '标签', width: 200 },
  { key: 'dictValue', title: '值', ellipsisTooltip: true },
  { key: 'sort', title: '排序', width: 80 },
  { key: 'status', title: '状态', width: 90, customSlot: 'dataStatus' },
  { title: '操作', key: 'dataOperator', customSlot: 'dataOperator' },
]

const resetForm = () => {
  form.id = undefined
  form.dictName = ''
  form.dictCode = ''
  form.remark = ''
  form.status = 1
}

const resetDataForm = () => {
  dataForm.id = undefined
  dataForm.dictLabel = ''
  dataForm.dictValue = ''
  dataForm.sort = 0
  dataForm.remark = ''
  dataForm.status = 1
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增字典类型'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑字典类型'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除吗？'))) return
  await request.delete(`/system/dict/type/${id}`)
  fetchData()
}

const handleSubmit = async () => {
  if (form.id) {
    await request.put('/system/dict/type', form)
  } else {
    await request.post('/system/dict/type', form)
  }
  dialogVisible.value = false
  fetchData()
}

const handleManageData = async (row: any) => {
  currentTypeId.value = row.id
  currentTypeName.value = row.dictName
  await fetchDataList(row.id)
  dataDialogVisible.value = true
}

const handleAddData = () => {
  resetDataForm()
  dataForm.typeId = currentTypeId.value
}

const handleEditData = (row: any) => {
  Object.assign(dataForm, row)
}

const handleDeleteData = async (id: number) => {
  if (!(await confirmAsync('确定要删除吗？'))) return
  await request.delete(`/system/dict/data/${id}`)
  fetchDataList(currentTypeId.value!)
}

const handleSubmitData = async () => {
  if (dataForm.id) {
    await request.put('/system/dict/data', dataForm)
  } else {
    await request.post('/system/dict/data', dataForm)
  }
  resetDataForm()
  fetchDataList(currentTypeId.value!)
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/system/dict/type/list', { params: queryParams })
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
  queryParams.dictName = ''
  queryParams.dictCode = ''
  handleSearch()
}

const fetchDataList = async (typeId: number) => {
  const res: any = await request.get(`/system/dict/data/list/${typeId}`)
  dataList.value = res.data || []
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="字典管理">
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="字典名称">
          <VInput v-model="queryParams.dictName" placeholder="请输入字典名称" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem label="字典编码">
          <VInput v-model="queryParams.dictCode" placeholder="请输入字典编码" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:dict:add'" type="primary" @click="handleAdd">新增字典</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #operator="{ row }">
          <VButton size="sm" @click="handleManageData(row)">数据</VButton>
          <VButton v-auth="'system:dict:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:dict:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
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
        <VFormItem label="字典名称">
          <VInput v-model="form.dictName" placeholder="请输入字典名称" />
        </VFormItem>
        <VFormItem label="字典编码">
          <VInput v-model="form.dictCode" :disabled="!!form.id" placeholder="请输入字典编码" />
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

    <VLayer v-model="dataDialogVisible" :title="`字典数据 - ${currentTypeName}`" area="700px">
      <div class="toolbar">
        <VButton v-auth="'system:dict:add'" type="primary" size="sm" @click="handleAddData">新增数据</VButton>
      </div>
      <VTable :data-source="dataList" :columns="dataColumns">
        <template #dataStatus="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #dataOperator="{ row }">
          <VButton v-auth="'system:dict:edit'" size="sm" @click="handleEditData(row)">编辑</VButton>
          <VButton v-auth="'system:dict:remove'" size="sm" type="danger" @click="handleDeleteData(row.id)">删除</VButton>
        </template>
      </VTable>

      <VForm :model="dataForm" label-width="80px" style="margin-top: 16px;">
        <VFormItem label="标签">
          <VInput v-model="dataForm.dictLabel" placeholder="请输入标签" />
        </VFormItem>
        <VFormItem label="值">
          <VInput v-model="dataForm.dictValue" placeholder="请输入值" />
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="dataForm.sort" :min="0" />
        </VFormItem>
        <VFormItem label="状态">
          <VSwitch v-model="dataStatusOn" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dataDialogVisible = false">关闭</VButton>
        <VButton type="primary" @click="handleSubmitData">保存</VButton>
      </template>
    </VLayer>
  </div>
</template>
