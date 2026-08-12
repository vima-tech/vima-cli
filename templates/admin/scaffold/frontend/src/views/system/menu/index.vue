<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getMenuList, createMenu, updateMenu, deleteMenu } from '@/api/system'
import { confirmAsync } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增菜单')

const form = reactive({
  id: undefined as number | undefined,
  parentId: 0,
  name: '',
  path: '',
  component: '',
  icon: '',
  sort: 0,
  type: 1,
  visible: 1,
  status: 1,
  perms: '',
})

const rules = {
  name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
}

const menuTypeOptions = [
  { value: 1, label: '目录' },
  { value: 2, label: '菜单' },
  { value: 3, label: '按钮' },
]

const columns = [
  { key: 'name', title: '菜单名称', width: 200 },
  { key: 'icon', title: '图标', width: 80, customSlot: 'icon' },
  { key: 'type', title: '类型', width: 80, customSlot: 'type' },
  { key: 'sort', title: '排序', width: 80 },
  { key: 'path', title: '路由地址' },
  { key: 'component', title: '组件路径' },
  { key: 'perms', title: '权限标识' },
  { key: 'visible', title: '可见', width: 80, customSlot: 'visible' },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.parentId = 0
  form.name = ''
  form.path = ''
  form.component = ''
  form.icon = ''
  form.sort = 0
  form.type = 1
  form.visible = 1
  form.status = 1
  form.perms = ''
}

const handleAdd = (parentId: number = 0) => {
  resetForm()
  form.parentId = parentId
  dialogTitle.value = '新增菜单'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑菜单'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除该菜单吗？'))) return
  try {
    await deleteMenu(id)
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await updateMenu(form)
    } else {
      await createMenu(form)
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
    const res: any = await getMenuList()
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
    <VCard title="菜单管理">
      <div class="toolbar">
        <VButton type="primary" @click="handleAdd()">新增菜单</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns" :tree-props="{ children: 'children' }">
        <template #icon="{ row }">
          <span>{{ row.icon }}</span>
        </template>
        <template #type="{ row }">
          <VTag :type="row.type === 1 ? 'primary' : row.type === 2 ? 'success' : 'info'">
            {{ row.type === 1 ? '目录' : row.type === 2 ? '菜单' : '按钮' }}
          </VTag>
        </template>
        <template #visible="{ row }">
          <VTag :type="row.visible === 1 ? 'success' : 'danger'">
            {{ row.visible === 1 ? '是' : '否' }}
          </VTag>
        </template>
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

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="600px">
      <VForm :model="form" :rules="rules" label-width="100px">
        <VFormItem label="上级菜单">
          <VSelect v-model="form.parentId" placeholder="选择上级菜单" clearable>
            <VSelectOption :value="0" label="顶级菜单" />
          </VSelect>
        </VFormItem>
        <VFormItem label="菜单类型" prop="type">
          <VRadioGroup v-model="form.type">
            <VRadio v-for="item in menuTypeOptions" :key="item.value" :value="item.value" :label="item.label" />
          </VRadioGroup>
        </VFormItem>
        <VFormItem label="菜单名称" prop="name">
          <VInput v-model="form.name" placeholder="请输入菜单名称" />
        </VFormItem>
        <VFormItem v-if="form.type !== 3" label="路由地址">
          <VInput v-model="form.path" placeholder="请输入路由地址" />
        </VFormItem>
        <VFormItem v-if="form.type === 2" label="组件路径">
          <VInput v-model="form.component" placeholder="请输入组件路径" />
        </VFormItem>
        <VFormItem v-if="form.type !== 1" label="权限标识">
          <VInput v-model="form.perms" placeholder="请输入权限标识" />
        </VFormItem>
        <VFormItem v-if="form.type !== 3" label="图标">
          <VInput v-model="form.icon" placeholder="请输入图标" />
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="form.sort" :min="0" />
        </VFormItem>
        <VFormItem v-if="form.type !== 3" label="可见">
          <VSwitch v-model="form.visible" :active-value="1" :inactive-value="0" active-text="显示" inactive-text="隐藏" />
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
