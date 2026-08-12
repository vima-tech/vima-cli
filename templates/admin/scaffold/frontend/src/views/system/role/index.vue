<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getRoleList, createRole, updateRole, deleteRole, getRoleMenuIds, assignRoleMenus } from '@/api/system'
import { getMenuTree } from '@/api/system'
import { confirmAsync, toastSuccess } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const menuDialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const menuTree = ref<any[]>([])
const currentRoleId = ref<number>()
const selectedMenuIds = ref<number[]>([])

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  roleName: '',
  roleKey: '',
})

const form = reactive({
  id: undefined as number | undefined,
  roleName: '',
  roleKey: '',
  sort: 0,
  status: 1,
  remark: '',
})

const rules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleKey: [{ required: true, message: '请输入角色标识', trigger: 'blur' }],
}

const columns = [
  { key: 'roleName', title: '角色名称', width: 150 },
  { key: 'roleKey', title: '角色标识', width: 150 },
  { key: 'sort', title: '排序', width: 80 },
  { key: 'status', title: '状态', width: 80, customSlot: 'status' },
  { key: 'remark', title: '备注' },
  { key: 'createTime', title: '创建时间', width: 180 },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.roleName = ''
  form.roleKey = ''
  form.sort = 0
  form.status = 1
  form.remark = ''
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增角色'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑角色'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除该角色吗？'))) return
  try {
    await deleteRole(id)
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await updateRole(form)
    } else {
      await createRole(form)
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleAssignMenu = async (row: any) => {
  currentRoleId.value = row.id
  try {
    const [treeRes, idsRes] = await Promise.all([getMenuTree(), getRoleMenuIds(row.id)])
    menuTree.value = (treeRes as any).data || []
    selectedMenuIds.value = (idsRes as any).data || []
    menuDialogVisible.value = true
  } catch (error) {
    console.error(error)
  }
}

const handleMenuSubmit = async () => {
  try {
    await assignRoleMenus({
      roleId: currentRoleId.value!,
      menuIds: selectedMenuIds.value,
    })
    menuDialogVisible.value = false
    toastSuccess('菜单分配成功')
  } catch (error) {
    console.error(error)
  }
}

const handleSearch = () => {
  queryParams.pageNum = 1
  fetchData()
}

const handleReset = () => {
  queryParams.roleName = ''
  queryParams.roleKey = ''
  handleSearch()
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await getRoleList(queryParams)
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
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
    <VCard title="角色管理">
      <VForm inline>
        <VFormItem label="角色名称">
          <VInput v-model="queryParams.roleName" placeholder="请输入角色名称" clearable />
        </VFormItem>
        <VFormItem label="角色标识">
          <VInput v-model="queryParams.roleKey" placeholder="请输入角色标识" clearable />
        </VFormItem>
        <VFormItem>
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton type="primary" @click="handleAdd">新增角色</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </VTag>
        </template>
        <template #operator="{ row }">
          <VButton size="small" @click="handleEdit(row)">编辑</VButton>
          <VButton size="small" @click="handleAssignMenu(row)">分配菜单</VButton>
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
      <VForm :model="form" :rules="rules" label-width="100px">
        <VFormItem label="角色名称" prop="roleName">
          <VInput v-model="form.roleName" placeholder="请输入角色名称" />
        </VFormItem>
        <VFormItem label="角色标识" prop="roleKey">
          <VInput v-model="form.roleKey" placeholder="请输入角色标识" />
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="form.sort" :min="0" />
        </VFormItem>
        <VFormItem label="状态">
          <VSwitch v-model="form.status" :active-value="1" :inactive-value="0" active-text="正常" inactive-text="禁用" />
        </VFormItem>
        <VFormItem label="备注">
          <VTextarea v-model="form.remark" placeholder="请输入备注" />
        </VFormItem>
      </VForm>
      <template #footer>
        <VButton @click="dialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleSubmit">确定</VButton>
      </template>
    </VLayer>

    <VLayer v-model="menuDialogVisible" title="分配菜单" area="500px">
      <VTree :data="menuTree" :props="{ label: 'name', children: 'children' }" show-checkbox node-key="id" :default-checked-keys="selectedMenuIds" @check="(keys: any) => selectedMenuIds = keys" />
      <template #footer>
        <VButton @click="menuDialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleMenuSubmit">确定</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
