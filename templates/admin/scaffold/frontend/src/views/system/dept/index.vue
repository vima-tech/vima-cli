<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { getDeptList, createDept, updateDept, deleteDept } from '@/api/system'
import { confirmAsync } from '@/utils/feedback'
import { intFlag } from '@/utils/form'
import { formatDateTime } from '@/utils/datetime'
import { toTree, toTreeOptions } from '@/utils/tree'

const loading = ref(false)
// 后端给的是平铺列表，树在前端接（见 utils/tree.ts）。原始平铺数据单独留一份：
// 关键字过滤后要重新接树，而「上级部门」下拉必须始终基于全量，不能跟着筛选结果缩水。
const flatData = ref<any[]>([])
const keyword = ref('')
const expandAll = ref(true)
const dialogVisible = ref(false)
const dialogTitle = ref('新增部门')
const formRef = ref()

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

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const statusOn = intFlag(form, 'status')

const rules = {
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
}

const allTree = computed(() => toTree(flatData.value))

/*
 * 关键字命中的是部门名或负责人。父级被筛掉时 toTree 会把命中节点当根节点处理
 * （见 utils/tree.ts 的注释），所以过滤后的结果不会整棵子树消失。
 */
const tableData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return allTree.value
  const hit = flatData.value.filter(
    (d: any) =>
      d.name?.toLowerCase().includes(kw) || d.leader?.toLowerCase().includes(kw)
  )
  return toTree(hit)
})

/*
 * 搜索时强制铺开：命中项可能挂在某个收起的父级下面，不展开就是「搜到了却看不见」。
 * 清空关键字不自动收回，免得刚定位到的那一行又被折叠掉。
 */
watch(keyword, (value) => {
  if (value.trim()) expandAll.value = true
})

// 上级部门候选：顶级 + 所有部门；编辑时排除自身与子孙，避免把父级设成自己
const parentOptions = computed(() =>
  toTreeOptions(allTree.value, { rootLabel: '顶级部门', excludeId: form.id })
)

// 邮箱是唯一自由列；创建时间 170px 配合 formatDateTime
const columns = [
  { key: 'name', title: '部门名称', width: 240 },
  { key: 'sort', title: '排序', width: 90 },
  { key: 'leader', title: '负责人', width: 130 },
  { key: 'phone', title: '联系电话', width: 150 },
  { key: 'email', title: '邮箱', ellipsisTooltip: true },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { key: 'createTime', title: '创建时间', width: 170, customSlot: 'createTime' },
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

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增部门'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  resetForm()
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
  // rules 光声明不生效，得显式跑一次；校验不过时 validate 会抛，直接不提交
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
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
    flatData.value = res.data || []
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
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="部门名称">
          <VInput v-model="keyword" placeholder="按名称或负责人过滤" clearable />
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:dept:add'" type="primary" @click="handleAdd()">新增部门</VButton>
        <!-- 一键铺开/收拢整棵树；单行的展开由表格每行自己的箭头控制，两者互不冲突 -->
        <VButton @click="expandAll = !expandAll">{{ expandAll ? '全部折叠' : '全部展开' }}</VButton>
      </div>

      <VTable
        :loading="loading"
        :data-source="tableData"
        :columns="columns"
        :tree-props="{ children: 'children' }"
        :default-expand-all="expandAll"
      >
        <template #createTime="{ row }">
          <span>{{ formatDateTime(row.createTime) }}</span>
        </template>
        <template #status="{ row }">
          <VTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </VTag>
        </template>
        <!--
          操作列只放「针对这一行」的动作。新增属于页面级功能，放在工具栏一处即可——
          要建子部门，在弹窗里选「上级部门」就行。
        -->
        <template #operator="{ row }">
          <VButton v-auth="'system:dept:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:dept:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="500px">
      <VForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <VFormItem label="上级部门">
          <VSelect v-model="form.parentId" :options="parentOptions" placeholder="选择上级部门" />
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
