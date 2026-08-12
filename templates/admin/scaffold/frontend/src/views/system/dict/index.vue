<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'

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

const columns = [
  { key: 'dictName', title: '字典名称' },
  { key: 'dictCode', title: '字典编码' },
  { key: 'remark', title: '备注' },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const dataColumns = [
  { key: 'dictLabel', title: '标签' },
  { key: 'dictValue', title: '值' },
  { key: 'sort', title: '排序', width: 60 },
  { key: 'status', title: '状态', width: 80, customSlot: 'dataStatus' },
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
  const res: any = await request.get('/system/dict/type/list', { params: queryParams })
  tableData.value = res.data?.records || []
  total.value = res.data?.total || 0
  loading.value = false
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
      <div class="toolbar">
        <VButton type="primary" @click="handleAdd">新增字典</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #operator="{ row }">
          <VButton size="small" @click="handleManageData(row)">数据</VButton>
          <VButton size="small" @click="handleEdit(row)">编辑</VButton>
          <VButton size="small" type="danger" @click="handleDelete(row.id)">删除</VButton>
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
          <VSwitch v-model="form.status" :active-value="1" :inactive-value="0" active-text="正常" inactive-text="禁用" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleSubmit">确定</VButton>
      </template>
    </VLayer>

    <VLayer v-model="dataDialogVisible" :title="`字典数据 - ${currentTypeName}`" area="700px">
      <div class="toolbar">
        <VButton type="primary" size="small" @click="handleAddData">新增数据</VButton>
      </div>
      <VTable :data-source="dataList" :columns="dataColumns" size="small">
        <template #dataStatus="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #dataOperator="{ row }">
          <VButton size="small" @click="handleEditData(row)">编辑</VButton>
          <VButton size="small" type="danger" @click="handleDeleteData(row.id)">删除</VButton>
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
          <VSwitch v-model="dataForm.status" :active-value="1" :inactive-value="0" active-text="正常" inactive-text="禁用" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dataDialogVisible = false">关闭</VButton>
        <VButton type="primary" @click="handleSubmitData">保存</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
