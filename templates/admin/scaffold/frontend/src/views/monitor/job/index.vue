<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getJobList, createJob, updateJob, deleteJob, runJob, toggleJob } from '@/api/monitor'
import { confirmAsync, toastSuccess } from '@/utils/feedback'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const loading = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增任务')

const form = reactive({
  id: undefined as number | undefined,
  jobName: '',
  jobKey: '',
  cron: '',
  remark: '',
  status: 1,
})

const rules = {
  jobName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  jobKey: [{ required: true, message: '请输入 jobKey', trigger: 'blur' }],
  cron: [{ required: true, message: '请输入 cron 表达式', trigger: 'blur' }],
}

const columns = [
  { key: 'jobName', title: '任务名称', width: 160 },
  { key: 'jobKey', title: 'jobKey', width: 160 },
  { key: 'cron', title: 'cron 表达式', width: 140 },
  { key: 'status', title: '状态', width: 90, customSlot: 'status' },
  { key: 'remark', title: '备注' },
  { title: '操作', key: 'operator', width: 220, customSlot: 'operator' },
]

const resetForm = () => {
  form.id = undefined
  form.jobName = ''
  form.jobKey = ''
  form.cron = ''
  form.remark = ''
  form.status = 1
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增任务'
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(form, row)
  dialogTitle.value = '编辑任务'
  dialogVisible.value = true
}

const handleDelete = async (row: any) => {
  if (!(await confirmAsync(`确定要删除任务「${row.jobName}」吗？`))) return
  try {
    await deleteJob(row.id)
    toastSuccess('已删除')
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleRun = async (row: any) => {
  if (!(await confirmAsync(`确定立即执行一次「${row.jobName}」吗？`))) return
  try {
    await runJob(row.id)
    toastSuccess('已触发执行')
  } catch (error) {
    console.error(error)
  }
}

const handleToggle = async (row: any) => {
  try {
    await toggleJob(row.id)
    toastSuccess(row.status === 1 ? '已停用' : '已启用')
  } catch (error) {
    console.error(error)
  } finally {
    fetchData()
  }
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await updateJob(form)
    } else {
      await createJob(form)
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
    const res: any = await getJobList()
    // 兼容分页包装（records）与纯列表两种返回
    tableData.value = res.data?.records || res.data || []
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
    <VCard title="定时任务">
      <div class="toolbar">
        <VButton v-auth="'monitor:job:add'" type="primary" @click="handleAdd">新增任务</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #status="{ row }">
          <!-- 开关即 toggle：无 toggle 权限时禁用但仍可见状态 -->
          <VSwitch
            :model-value="row.status === 1"
            :disabled="!userStore.hasPerm('monitor:job:toggle')"
            @change="handleToggle(row)"
          />
        </template>
        <template #operator="{ row }">
          <VButton v-auth="'monitor:job:edit'" size="small" @click="handleEdit(row)">编辑</VButton>
          <VButton v-auth="'monitor:job:run'" size="small" @click="handleRun(row)">执行一次</VButton>
          <VButton v-auth="'monitor:job:remove'" size="small" type="danger" @click="handleDelete(row)">删除</VButton>
        </template>
      </VTable>
    </VCard>

    <VLayer v-model="dialogVisible" :title="dialogTitle" area="560px">
      <VForm :model="form" :rules="rules" label-width="100px">
        <VFormItem label="任务名称" prop="jobName">
          <VInput v-model="form.jobName" placeholder="请输入任务名称" />
        </VFormItem>
        <VFormItem label="jobKey" prop="jobKey">
          <VInput v-model="form.jobKey" :disabled="!!form.id" placeholder="任务标识，对应后端注册的任务" />
        </VFormItem>
        <VFormItem label="cron 表达式" prop="cron">
          <VInput v-model="form.cron" placeholder="如 0 0/30 * * * ?" />
          <div class="form-tip">Spring cron 六段式：秒 分 时 日 月 周。示例：「0 0/30 * * * ?」每 30 分钟；「0 0 2 * * ?」每天凌晨 2 点。</div>
        </VFormItem>
        <VFormItem label="备注">
          <VTextarea v-model="form.remark" placeholder="请输入备注" />
        </VFormItem>
        <VFormItem label="状态">
          <!-- VSwitch 只有 modelValue/disabled 两个 props，1/0 映射在这里做 -->
          <VSwitch :model-value="form.status === 1" @change="form.status = form.status === 1 ? 0 : 1" />
          <span class="form-tip-inline">{{ form.status === 1 ? '启用' : '停用' }}</span>
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

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.form-tip-inline {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}
</style>
