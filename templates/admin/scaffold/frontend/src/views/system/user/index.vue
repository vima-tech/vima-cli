<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getUserList, createUser, updateUser, deleteUser, resetPassword } from '@/api/system'
import { getDeptTree } from '@/api/system'
import { getAllRoles } from '@/api/system'
import { exportUsers, getUserImportTemplate, importUsers } from '@/api/monitor'
import { confirmAsync, toastSuccess, toastError } from '@/utils/feedback'
import { intFlag } from '@/utils/form'
import { rule } from '@/utils/validate'
import DictTag from '@/components/common/DictTag.vue'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const deptTree = ref<any[]>([])
const allRoles = ref<any[]>([])

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  username: '',
  realName: '',
  deptId: undefined as number | undefined,
})

const form = reactive({
  id: undefined as number | undefined,
  username: '',
  realName: '',
  password: '',
  email: '',
  phone: '',
  deptId: undefined as number | undefined,
  roleIds: [] as number[],
  status: 1,
})

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const statusOn = intFlag(form, 'status')

// 校验规则见 utils/validate.ts；「必填」与「格式」是两条独立规则——
// 除 required 外，VForm 对空值一律跳过，所以选填字段只写格式规则即可。
const rules = {
  username: [rule.required('请输入用户名'), rule.username()],
  realName: [rule.required('请输入真实姓名'), rule.length(2, 20)],
  password: [rule.required('请输入密码')],
  email: [rule.email()],
  phone: [rule.mobile()],
}

/*
 * 列宽约定：邮箱此前是唯一没写宽度的列，把剩余的 700 多像素全吃了下去，
 * 表格中间空出一大条。这里给每个内容列定宽，剩余宽度留给末列的操作列——
 * 内容左侧成组，空白落在表格最右边缘。
 */
const columns = [
  { key: 'username', title: '用户名', width: 130 },
  { key: 'realName', title: '姓名', width: 120 },
  { key: 'deptName', title: '部门', width: 140 },
  { key: 'email', title: '邮箱', width: 240, ellipsisTooltip: true },
  { key: 'phone', title: '手机', width: 140 },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.username = ''
  form.realName = ''
  form.password = ''
  form.email = ''
  form.phone = ''
  form.deptId = undefined
  form.roleIds = []
  form.status = 1
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增用户'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑用户'
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除该用户吗？'))) return
  try {
    await deleteUser(id)
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleResetPassword = async (row: any) => {
  if (!(await confirmAsync(`确定要重置 ${row.username} 的密码吗？`))) return
  try {
    await resetPassword({ userId: row.id, newPassword: '123456' })
    toastSuccess('密码已重置为: 123456')
  } catch (error) {
    console.error(error)
  }
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await updateUser(form)
    } else {
      await createUser(form)
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

// ===== 导出 / 导入 =====

const importVisible = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importResult = ref('')
const importErrors = ref<string[]>([])

/** 把 blob 存成本地文件 */
const saveBlob = (data: Blob, filename: string) => {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** 从 content-disposition 解析文件名，解析不到用 fallback */
const filenameFrom = (res: any, fallback: string) => {
  const disposition: string = res.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
  return match ? decodeURIComponent(match[1]) : fallback
}

const handleExport = async () => {
  try {
    const res: any = await exportUsers(queryParams)
    saveBlob(res.data, filenameFrom(res, '用户列表.xlsx'))
  } catch (error) {
    console.error(error)
    toastError('导出失败')
  }
}

const handleOpenImport = () => {
  importFile.value = null
  importResult.value = ''
  importErrors.value = []
  importVisible.value = true
}

const handleDownloadTemplate = async () => {
  try {
    const res: any = await getUserImportTemplate()
    saveBlob(res.data, filenameFrom(res, '用户导入模板.xlsx'))
  } catch (error) {
    console.error(error)
    toastError('模板下载失败')
  }
}

/** VUpload 只负责选文件：beforeUpload 里接住文件，返回 false 阻止组件自行上传 */
const handleFileSelect = (files: FileList | File[]) => {
  const file = Array.isArray(files) ? files[0] : files.item(0)
  importFile.value = file || null
  return false
}

const handleImport = async () => {
  if (!importFile.value) {
    toastError('请先选择文件')
    return
  }
  importing.value = true
  importResult.value = ''
  importErrors.value = []
  try {
    const res: any = await importUsers(importFile.value)
    const data = res.data || {}
    const errors: string[] = data.errors || []
    importResult.value = `导入完成：成功 ${data.successCount ?? 0} 条，失败 ${data.failCount ?? errors.length} 条`
    importErrors.value = errors
    fetchData()
  } catch (error: any) {
    console.error(error)
    toastError(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const handleSearch = () => {
  queryParams.pageNum = 1
  fetchData()
}

const handleReset = () => {
  queryParams.username = ''
  queryParams.realName = ''
  queryParams.deptId = undefined
  handleSearch()
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await getUserList(queryParams)
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchOptions = async () => {
  try {
    const [deptRes, roleRes] = await Promise.all([getDeptTree(), getAllRoles()])
    deptTree.value = (deptRes as any).data || []
    allRoles.value = (roleRes as any).data || []
  } catch (error) {
    console.error(error)
  }
}

/**
 * /system/dept/tree 返回的是嵌套结构（子部门挂在 children 上）。
 * 下拉框只能吃平铺列表：不摊平的话子部门根本没有对应 option，
 * 选中值就会因为查不到 label 而回退成部门编号。缩进保留层级可读性。
 */
const flattenDepts = (nodes: any[], depth = 0): any[] =>
  nodes.flatMap((node) => [
    { id: node.id, label: `${'　'.repeat(depth)}${node.name}` },
    ...flattenDepts(node.children || [], depth + 1),
  ])

const deptOptions = computed(() => flattenDepts(deptTree.value))

onMounted(() => {
  fetchData()
  fetchOptions()
})
</script>

<template>
  <div class="vui-page">
    <VCard title="用户管理">
      <!--
        搜索栏必须写 layout="inline"。VForm 没有 inline 这个 prop，只有 layout；
        写成 <VForm inline> 会原样落成一个无效 HTML 属性，表单仍按 horizontal 渲染，
        每个查询条件独占一整行、控件被拉到上千像素宽——看起来像"设计得难看"，其实是属性名写错了。
      -->
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="用户名">
          <VInput v-model="queryParams.username" placeholder="请输入用户名" clearable />
        </VFormItem>
        <VFormItem label="姓名">
          <VInput v-model="queryParams.realName" placeholder="请输入姓名" clearable />
        </VFormItem>
        <VFormItem label="部门">
          <VSelect v-model="queryParams.deptId" placeholder="请选择部门" clearable>
            <VSelectOption v-for="item in deptOptions" :key="item.id" :value="item.id" :label="item.label" />
          </VSelect>
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:user:add'" type="primary" @click="handleAdd">新增用户</VButton>
        <VButton v-auth="'system:user:export'" @click="handleExport">导出</VButton>
        <VButton v-auth="'system:user:import'" @click="handleOpenImport">导入</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <DictTag type="sys_user_status" :value="row.status" />
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'system:user:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:user:resetPwd'" size="sm" @click="handleResetPassword(row)">重置密码</VButton>
          <VButton v-auth="'system:user:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>

      <VPagination
        v-model:current="queryParams.pageNum"
        :page-size="queryParams.pageSize"
        :total="total"
        @change="fetchData"
      />
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="600px">
      <VForm :model="form" :rules="rules" label-width="100px">
        <VFormItem label="用户名" prop="username">
          <VInput v-model="form.username" :disabled="!!form.id" placeholder="请输入用户名" />
        </VFormItem>
        <VFormItem label="姓名" prop="realName">
          <VInput v-model="form.realName" placeholder="请输入姓名" />
        </VFormItem>
        <VFormItem v-if="!form.id" label="密码" prop="password">
          <VInput v-model="form.password" type="password" placeholder="请输入密码" />
        </VFormItem>
        <VFormItem label="邮箱">
          <VInput v-model="form.email" placeholder="请输入邮箱" />
        </VFormItem>
        <VFormItem label="手机">
          <VInput v-model="form.phone" placeholder="请输入手机" />
        </VFormItem>
        <VFormItem label="部门">
          <VSelect v-model="form.deptId" placeholder="请选择部门" clearable>
            <VSelectOption v-for="item in deptOptions" :key="item.id" :value="item.id" :label="item.label" />
          </VSelect>
        </VFormItem>
        <VFormItem label="角色">
          <VSelect v-model="form.roleIds" multiple placeholder="请选择角色">
            <!-- 后端 Role 实体的字段是 roleName，写成 item.name 会拿到 undefined，选中项回退显示角色编号 -->
            <VSelectOption v-for="item in allRoles" :key="item.id" :value="item.id" :label="item.roleName" />
          </VSelect>
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

    <VLayer v-model="importVisible" title="导入用户" area="520px">
      <div class="import-step">
        <span class="import-step-label">1. 下载模板</span>
        <VButton size="sm" @click="handleDownloadTemplate">下载导入模板</VButton>
      </div>
      <div class="import-step">
        <span class="import-step-label">2. 选择文件</span>
        <VUpload accept=".xlsx,.xls" :before-upload="handleFileSelect">
          <VButton size="sm" type="primary">选择文件</VButton>
        </VUpload>
        <span v-if="importFile" class="import-file">{{ importFile.name }}</span>
      </div>
      <div v-if="importResult" class="import-result">
        <div>{{ importResult }}</div>
        <ul v-if="importErrors.length" class="import-errors">
          <li v-for="(err, index) in importErrors" :key="index">{{ err }}</li>
        </ul>
      </div>
      <template #footer>
        <VButton @click="importVisible = false">关闭</VButton>
        <VButton type="primary" :loading="importing" :disabled="importing" @click="handleImport">开始导入</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.import-step {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.import-step-label {
  color: var(--v-text-sub);
  font-size: 14px;
}

.import-file {
  color: var(--v-text-weak);
  font-size: var(--v-font-small);
}

.import-result {
  padding: 8px 12px;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-sm);
  background: var(--v-bg-soft);
  font-size: var(--v-font-small);
}

.import-errors {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--v-error-strong);
}

.import-errors li {
  line-height: 1.8;
}
</style>
