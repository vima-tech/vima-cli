<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { getMenuList, getPermOptions, createMenu, updateMenu, deleteMenu } from '@/api/system'
import { confirmAsync } from '@/utils/feedback'
import { intFlag } from '@/utils/form'
import { toTree, toTreeOptions } from '@/utils/tree'
import { MENU_ICON_PRESETS, DEFAULT_MENU_ICON, resolveMenuIcon } from '@/utils/menuIcons'

const loading = ref(false)
// 平铺原始数据单独留一份：过滤要重新接树，而「上级菜单」下拉必须基于全量（同部门管理）
const flatData = ref<any[]>([])
const keyword = ref('')
const expandAll = ref(true)
const dialogVisible = ref(false)
const dialogTitle = ref('新增菜单')
const formRef = ref()

const form = reactive({
  id: undefined as number | undefined,
  parentId: 0,
  name: '',
  path: '',
  component: '',
  icon: DEFAULT_MENU_ICON,
  sort: 0,
  type: 1,
  visible: 1,
  status: 1,
  perms: '',
})

// VSwitch 只吃布尔，后端字段是 0/1，中间必须过一层（原因见 utils/form.ts）
const visibleOn = intFlag(form, 'visible')
const statusOn = intFlag(form, 'status')

const rules = {
  name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
}

const menuTypeOptions = [
  { value: 1, label: '目录' },
  { value: 2, label: '菜单' },
  { value: 3, label: '按钮' },
]

/*
 * 权限标识不做自由输入：合法值 = 代码里 @PreAuthorize 真实存在的权限码（后端扫描注解下发），
 * 手抄错一个字母不会报错、只会让按钮静默失效，所以从机制上禁止手抄。
 * 老数据里可能有代码已不存在的码——编辑时并进选项并标注，避免打开弹窗就把原值弄丢。
 */
const permOptions = ref<string[]>([])
const knownPerms = computed(() => new Set(permOptions.value))
const permSelectOptions = computed(() => {
  const options = permOptions.value.map((p) => ({ value: p, label: p }))
  if (form.perms && !knownPerms.value.has(form.perms)) {
    options.unshift({ value: form.perms, label: `${form.perms}（代码中不存在）` })
  }
  return options
})

/*
 * 上级菜单候选：顶级 + 目录/菜单。
 * 按钮（type=3）不能当上级——它自己都不进路由；编辑时排除自身与子孙，避免把父级设成自己。
 */
const allTree = computed(() => toTree(flatData.value))

/* 关键字命中菜单名或权限标识——排查「这个按钮归谁管」时用后者更快 */
const tableData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return allTree.value
  const hit = flatData.value.filter(
    (m: any) => m.name?.toLowerCase().includes(kw) || m.perms?.toLowerCase().includes(kw)
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

const parentOptions = computed(() =>
  toTreeOptions(allTree.value, {
    rootLabel: '顶级菜单',
    excludeId: form.id,
    filter: (node) => node.type !== 3,
  })
)

/*
 * 十列的宽表：路由地址与组件路径定宽并截断（配 title 提示），只留权限标识一列自由伸缩，
 * 因为排查权限时要看全。窄屏下仍会横向滚动——十列表格没法不滚，但截断让每列都还能读。
 */
const columns = [
  { key: 'name', title: '菜单名称', width: 200 },
  { key: 'icon', title: '图标', width: 80, customSlot: 'icon' },
  { key: 'type', title: '类型', width: 90, customSlot: 'type' },
  { key: 'sort', title: '排序', width: 80 },
  { key: 'path', title: '路由地址', width: 190, ellipsisTooltip: true },
  { key: 'component', title: '组件路径', width: 170, ellipsisTooltip: true },
  { key: 'perms', title: '权限标识', customSlot: 'perms' },
  { key: 'visible', title: '可见', width: 80, customSlot: 'visible' },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.parentId = 0
  form.name = ''
  form.path = ''
  form.component = ''
  form.icon = DEFAULT_MENU_ICON
  form.sort = 0
  form.type = 1
  form.visible = 1
  form.status = 1
  form.perms = ''
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增菜单'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  resetForm()
  Object.assign(form, row)
  // 老数据里的 icon 可能是 emoji 或已废弃的名字，落到表单里要先归一到预设值
  form.icon = resolveMenuIcon(row.icon)
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
  // rules 光声明不生效，得显式跑一次；校验不过时 validate 会抛，直接不提交
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
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
    flatData.value = res.data || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchPermOptions = async () => {
  try {
    const res: any = await getPermOptions()
    permOptions.value = res.data || []
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  fetchData()
  fetchPermOptions()
})
</script>

<template>
  <div class="vui-page">
    <VCard title="菜单管理">
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="菜单名称">
          <VInput v-model="keyword" placeholder="按名称或权限标识过滤" clearable />
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:menu:add'" type="primary" @click="handleAdd">新增菜单</VButton>
        <!-- 一键铺开/收拢整棵树；单行的展开由表格每行自己的箭头控制，两者互不冲突 -->
        <VButton @click="expandAll = !expandAll">{{ expandAll ? '全部折叠' : '全部展开' }}</VButton>
      </div>

      <!--
        操作列只放「针对这一行」的动作。新增属于页面级功能，放在工具栏一处即可——
        每行挂一个「新增」既把操作列撑宽，又让人以为新增出来的东西和这一行有别的关系；
        要建子菜单，在弹窗里选「上级菜单」就行。
      -->
      <VTable
        :loading="loading"
        :data-source="tableData"
        :columns="columns"
        :tree-props="{ children: 'children' }"
        :default-expand-all="expandAll"
      >
        <!-- 按钮（type=3）不进导航、表单里也不给设图标，这里跟着留空，别显示一个用不上的默认图标 -->
        <template #icon="{ row }">
          <VIcon v-if="row.type !== 3" :name="resolveMenuIcon(row.icon)" size="17" />
          <span v-else>-</span>
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
        <!-- 配置漂移可视化：库里的权限码在代码注解中已不存在时标红，这类码授出去不会生效。
             permOptions 未加载完成前不判定，避免整列闪一遍红 -->
        <template #perms="{ row }">
          <span v-if="!row.perms">-</span>
          <span v-else-if="permOptions.length === 0 || knownPerms.has(row.perms)">{{ row.perms }}</span>
          <span v-else title="代码中不存在该权限标识，授权后不会生效">
            <VTag type="danger">{{ row.perms }} ⚠</VTag>
          </span>
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'system:menu:edit'" size="sm" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'system:menu:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="600px">
      <VForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <VFormItem label="上级菜单">
          <VSelect v-model="form.parentId" :options="parentOptions" placeholder="选择上级菜单" />
        </VFormItem>
        <VFormItem label="菜单类型" prop="type">
          <!-- 用 :options，不要 <VRadio :label="...">：VRadio 没有 label 属性，
               文字要放默认插槽，写成属性会原样落到 <input> 上，渲染出三个没有文字的圆点。 -->
          <VRadioGroup v-model="form.type" :options="menuTypeOptions" />
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
          <!-- 选项由代码派生（perm-options 接口），不开自由输入：理由见上方 permSelectOptions -->
          <VSelect
            v-model="form.perms"
            :options="permSelectOptions"
            show-search
            clearable
            placeholder="选择代码中存在的权限码"
          />
        </VFormItem>
        <VFormItem v-if="form.type !== 3" label="图标">
          <!-- 只能从预设里挑，不提供自由输入：理由见 utils/menuIcons.ts -->
          <div class="icon-picker">
            <button
              v-for="item in MENU_ICON_PRESETS"
              :key="item.name"
              type="button"
              class="icon-option"
              :class="{ 'is-active': form.icon === item.name }"
              :title="`${item.label}（${item.name}）`"
              :aria-pressed="form.icon === item.name"
              @click="form.icon = item.name"
            >
              <VIcon :name="item.name" size="17" />
            </button>
          </div>
          <p class="icon-picked">
            已选：<VIcon :name="resolveMenuIcon(form.icon)" size="14" />
            <code>{{ form.icon }}</code>
          </p>
        </VFormItem>
        <VFormItem label="排序">
          <VInputNumber v-model="form.sort" :min="0" />
        </VFormItem>
        <VFormItem v-if="form.type !== 3" label="可见">
          <VSwitch v-model="visibleOn" />
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

<style scoped>
/* 图标面板高度封顶到约三行，超出内部滚动——不能让它把弹窗顶长 */
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 132px;
  padding: 8px;
  overflow-y: auto;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-sm);
  background: var(--v-bg-soft);
}

.icon-option {
  width: 34px;
  height: 34px;
  display: inline-grid;
  border: 1px solid transparent;
  border-radius: var(--v-radius-sm);
  color: var(--v-text-sub);
  background: var(--v-surface);
  cursor: pointer;
  place-items: center;
  transition:
    color 160ms var(--v-ease),
    border-color 160ms var(--v-ease),
    background 160ms var(--v-ease);
}

.icon-option:hover {
  border-color: color-mix(in srgb, var(--v-primary) 32%, var(--v-border));
  color: var(--v-primary-strong);
}

.icon-option.is-active {
  border-color: var(--v-primary);
  color: var(--v-surface);
  background: var(--v-primary);
}

.icon-picked {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--v-text-weak);
  font-size: var(--v-font-xs);
}

.icon-picked code {
  color: var(--v-text-sub);
  font-family: var(--v-font-mono);
}
</style>
