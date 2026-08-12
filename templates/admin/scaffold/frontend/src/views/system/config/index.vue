<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增配置')

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
})

const form = reactive({
  id: undefined as number | undefined,
  configName: '',
  configKey: '',
  configValue: '',
  remark: '',
  status: 1,
})

const columns = [
  { key: 'configName', title: '配置名称' },
  { key: 'configKey', title: '配置键' },
  { key: 'configValue', title: '配置值' },
  { key: 'remark', title: '备注' },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
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
  const res: any = await request.get('/system/config/list', { params: queryParams })
  tableData.value = res.data?.records || []
  total.value = res.data?.total || 0
  loading.value = false
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="系统配置">
      <div class="toolbar">
        <VButton type="primary" @click="handleAdd">新增配置</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</VTag>
        </template>
        <template #operator="{ row }">
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
          <VSwitch v-model="form.status" :active-value="1" :inactive-value="0" active-text="正常" inactive-text="禁用" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleSubmit">确定</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
