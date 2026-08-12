<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getRoleList, createRole, updateRole, deleteRole, getRoleMenuIds, assignRoleMenus } from '@/api/system'
import { getMenuTree } from '@/api/system'
import { confirmAsync, toastSuccess } from '@/utils/feedback'
import { intFlag } from '@/utils/form'
import { formatDateTime } from '@/utils/datetime'

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

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const statusOn = intFlag(form, 'status')

const rules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleKey: [{ required: true, message: '请输入角色标识', trigger: 'blur' }],
}

// 备注是唯一自由列；创建时间 170px 配合 formatDateTime 的 `2026-08-12 19:17:15`
const columns = [
  { key: 'roleName', title: '角色名称', width: 170 },
  { key: 'roleKey', title: '角色标识', width: 190, ellipsisTooltip: true },
  { key: 'sort', title: '排序', width: 90 },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { key: 'remark', title: '备注', ellipsisTooltip: true },
  { key: 'createTime', title: '创建时间', width: 170, customSlot: 'createTime' },
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

// 编辑时角色标识只读：后端 updateRole 本就不落库 roleKey（防 admin 通配标识被改），
// 前端再放开输入就是"能填、存完不生效"的假象
const isEdit = computed(() => form.id !== undefined)

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

// checkedKeys 只含全选节点；后端 getMenuTreeByRoleId 从 parentId=0 逐层组树，
// 父菜单 id 不入库时整个分支会从侧栏消失，所以提交前把勾选节点的所有祖先（含半选父菜单）补上。
const withAncestors = (nodes: any[], checked: Set<number>, ancestors: number[] = [], out = new Set<number>()) => {
  for (const node of nodes) {
    if (checked.has(node.id)) {
      ancestors.forEach((id) => out.add(id))
      out.add(node.id)
    }
    if (node.children?.length) withAncestors(node.children, checked, [...ancestors, node.id], out)
  }
  return out
}

const handleMenuSubmit = async () => {
  try {
    await assignRoleMenus({
      roleId: currentRoleId.value!,
      menuIds: [...withAncestors(menuTree.value, new Set(selectedMenuIds.value))],
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
      <!-- layout="inline" 才是 VForm 的行内布局开关；没有 inline 这个 prop（见 ui-docs/VForm.md） -->
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="角色名称">
          <VInput v-model="queryParams.roleName" placeholder="请输入角色名称" clearable />
        </VFormItem>
        <VFormItem label="角色标识">
          <VInput v-model="queryParams.roleKey" placeholder="请输入角色标识" clearable />
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:role:add'" type="primary" @click="handleAdd">新增角色</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #createTime="{ row }">
          <span>{{ formatDateTime(row.createTime) }}</span>
        </template>
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </VTag>
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'system:role:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:role:edit'" size="sm" @click="handleAssignMenu(row)">分配菜单</VButton>
          <!-- admin 是内置超管角色，后端拒删（RoleService），前端直接不给入口 -->
          <VButton
            v-if="row.roleKey !== 'admin'"
            v-auth="'system:role:remove'"
            size="sm"
            type="danger"
            @click="handleDelete(row.id)"
          >删除</VButton>
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
          <VInput v-model="form.roleKey" placeholder="请输入角色标识" :disabled="isEdit" />
          <p v-if="isEdit" class="form-hint">角色标识创建后不可修改（admin 为内置超管通配标识）</p>
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="form.sort" :min="0" />
        </VFormItem>
        <VFormItem label="状态">
          <VSwitch v-model="statusOn" />
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
      <VTree
        :data="menuTree"
        show-checkbox
        default-expand-all
        :checked-keys="selectedMenuIds"
        @update:checked-keys="(keys: any) => (selectedMenuIds = keys)"
      />
      <template #footer>
        <VButton @click="menuDialogVisible = false">取消</VButton>
        <VButton type="primary" @click="handleMenuSubmit">确定</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.form-hint {
  margin-top: 4px;
  color: var(--v-text-weak);
  font-size: var(--v-font-xs);
}
</style>
