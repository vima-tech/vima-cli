<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getDeptList, createDept, updateDept, deleteDept } from '@/api/system'
import { confirmAsync } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增部门')

const form = reactive({
  id: undefined as number | undefined,
  parentId: 0,
  name: '',
  sort: 0,
  leader: '',
  phone: '',
  email: '',
  status: 1,
})

const rules = {
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
}

const columns = [
  { key: 'name', title: '部门名称', width: 200 },
  { key: 'sort', title: '排序', width: 80 },
  { key: 'leader', title: '负责人', width: 120 },
  { key: 'phone', title: '联系电话', width: 120 },
  { key: 'email', title: '邮箱' },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { key: 'createTime', title: '创建时间', width: 180 },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.parentId = 0
  form.name = ''
  form.sort = 0
  form.leader = ''
  form.phone = ''
  form.email = ''
  form.status = 1
}

const handleAdd = (parentId: number = 0) => {
  resetForm()
  form.parentId = parentId
  dialogTitle.value = '新增部门'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑部门'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除该部门吗？'))) return
  try {
    await deleteDept(id)
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await updateDept(form)
    } else {
      await createDept(form)
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await getDeptList()
    tableData.value = res.data || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="部门管理">
      <div class="toolbar">
        <VButton type="primary" @click="handleAdd()">新增部门</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns" :tree-props="{ children: 'children' }">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </VTag>
        </template>
        <template #operator="{ row }">
          <VButton size="small" @click="handleAdd(row.id)">新增</VButton>
          <VButton size="small" @click="handleEdit(row)">编辑</VButton>
          <VButton size="small" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="500px">
      <VForm :model="form" :rules="rules" label-width="100px">
        <VFormItem label="上级部门">
          <VSelect v-model="form.parentId" placeholder="选择上级部门" clearable>
            <VSelectOption :value="0" label="顶级部门" />
          </VSelect>
        </VFormItem>
        <VFormItem label="部门名称" prop="name">
          <VInput v-model="form.name" placeholder="请输入部门名称" />
        </VFormItem>
        <VFormItem label="负责人">
          <VInput v-model="form.leader" placeholder="请输入负责人" />
        </VFormItem>
        <VFormItem label="联系电话">
          <VInput v-model="form.phone" placeholder="请输入联系电话" />
        </VFormItem>
        <VFormItem label="邮箱">
          <VInput v-model="form.email" placeholder="请输入邮箱" />
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="form.sort" :min="0" />
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
