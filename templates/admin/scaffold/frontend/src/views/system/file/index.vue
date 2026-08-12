<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync, toastSuccess, toastError } from '@/utils/feedback'
import { formatDateTime } from '@/utils/datetime'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const uploadDialogVisible = ref(false)
const uploadFile = ref<File | null>(null)
const uploading = ref(false)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  originalName: '',
})

/*
 * 这张表没有「长文本」列——文件名给足 420px 已经够用，剩余宽度交给末列的操作列，
 * 空白落在表格最右边缘、所有内容之后，而不是在中间撑出一条几百像素的空档。
 */
const columns = [
  { key: 'originalName', title: '文件名', width: 420, ellipsisTooltip: true },
  { key: 'fileType', title: '类型', width: 140 },
  { key: 'fileSize', title: '大小', width: 110, customSlot: 'fileSize' },
  { key: 'uploadUsername', title: '上传人', width: 120 },
  { key: 'createTime', title: '上传时间', width: 170, customSlot: 'createTime' },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const handleOpenUpload = () => {
  uploadFile.value = null
  uploadDialogVisible.value = true
}

/** VUpload 只负责选文件：beforeUpload 里接住文件，返回 false 阻止组件自行上传 */
const handleFileSelect = (files: FileList | File[]) => {
  const file = Array.isArray(files) ? files[0] : files.item(0)
  uploadFile.value = file || null
  return false
}

const handleClearFile = () => {
  uploadFile.value = null
}

const handleUpload = async () => {
  if (!uploadFile.value) {
    toastError('请先选择文件')
    return
  }

  const formData = new FormData()
  formData.append('file', uploadFile.value)

  uploading.value = true
  try {
    await request.post('/system/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    toastSuccess('上传成功')
    uploadDialogVisible.value = false
    fetchData()
  } catch (error: any) {
    console.error(error)
    toastError(error?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const handleDelete = async (id: number) => {
  if (!(await confirmAsync('确定要删除吗？'))) return
  await request.delete(`/system/file/${id}`)
  fetchData()
}

const handleDownload = (url: string) => {
  window.open(url)
}

const fetchData = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/system/file/list', { params: queryParams })
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  queryParams.pageNum = 1
  fetchData()
}

const handleReset = () => {
  queryParams.originalName = ''
  handleSearch()
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="文件管理">
      <VForm layout="inline" class="v-searchbar">
        <VFormItem label="文件名">
          <VInput v-model="queryParams.originalName" placeholder="请输入文件名" clearable @keyup.enter="handleSearch" />
        </VFormItem>
        <VFormItem class="v-searchbar-actions">
          <VButton type="primary" @click="handleSearch">搜索</VButton>
          <VButton @click="handleReset">重置</VButton>
        </VFormItem>
      </VForm>

      <div class="toolbar">
        <VButton v-auth="'system:file:upload'" type="primary" @click="handleOpenUpload">上传文件</VButton>
      </div>

      <!-- 空态给一句话和主动作，而不是只留一个「暂无数据」占位 -->
      <VEmpty v-if="!loading && !tableData.length" description="还没有上传任何文件">
        <template #footer>
          <VButton v-auth="'system:file:upload'" type="primary" @click="handleOpenUpload">上传文件</VButton>
        </template>
      </VEmpty>

      <VTable v-else :loading="loading" :data-source="tableData" :columns="columns">
        <template #fileSize="{ row }">
          <span>{{ formatFileSize(row.fileSize) }}</span>
        </template>
        <template #createTime="{ row }">
          <span>{{ formatDateTime(row.createTime) }}</span>
        </template>
        <template #operator="{ row }">
          <VButton size="sm" @click="handleDownload(row.fileUrl)">下载</VButton>
          <VButton v-auth="'system:file:remove'" size="sm" type="danger" @click="handleDelete(row.id)">删除</VButton>
        </template>
      </VTable>

      <VPagination
        v-model:current="queryParams.pageNum"
        :page-size="queryParams.pageSize"
        :total="total"
        @change="fetchData"
      />
    </VCard>

    <VLayer v-model="uploadDialogVisible" title="上传文件" area="480px">
      <!--
        VUpload 自身就渲染一个虚线边框的 <button> 作为触发器，
        再往插槽里塞一个 VButton 会变成「按钮套按钮」：虚线框里孤零零一颗蓝按钮。
        这里只往插槽放文本层级，把触发器本体撑成整块选择区。
      -->
      <VUpload class="upload-picker" :before-upload="handleFileSelect">
        <span class="upload-picker-icon" aria-hidden="true">↑</span>
        <span class="upload-picker-title">点击选择文件</span>
        <span class="upload-picker-hint">单次上传一个文件，大小不超过 10MB</span>
      </VUpload>

      <div v-if="uploadFile" class="upload-picked">
        <span class="upload-picked-name" :title="uploadFile.name">{{ uploadFile.name }}</span>
        <span class="upload-picked-size">{{ formatFileSize(uploadFile.size) }}</span>
        <VButton size="sm" @click="handleClearFile">移除</VButton>
      </div>

      <template #footer>
        <VButton @click="uploadDialogVisible = false">关闭</VButton>
        <VButton type="primary" :loading="uploading" :disabled="uploading" @click="handleUpload">
          开始上传
        </VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
/* 选择区：占满弹窗内容宽度，点哪儿都能选文件，而不是只有中间一颗小按钮可点。 */
.upload-picker {
  display: block;
}

.upload-picker :deep(.vui-upload-trigger) {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  gap: var(--v-gap-sm);
  padding: 26px 20px;
  border: 1px dashed var(--v-border-strong);
  border-radius: var(--v-radius-ctl);
  background: var(--v-bg-soft);
  box-shadow: none;
  color: var(--v-text-body);
  font-weight: var(--v-weight-medium);
  transition: border-color var(--v-duration) var(--v-ease), background var(--v-duration) var(--v-ease);
}

.upload-picker :deep(.vui-upload-trigger:hover) {
  border-color: var(--v-primary);
  background: var(--v-info-soft);
}

.upload-picker-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--v-radius-pill);
  background: var(--v-surface);
  box-shadow: inset 0 0 0 1px var(--v-border);
  color: var(--v-primary);
  font-size: 18px;
  line-height: 1;
}

.upload-picker-title {
  color: var(--v-text-title);
  font-size: var(--v-font-body);
  font-weight: var(--v-weight-semibold);
}

.upload-picker-hint {
  /* 12px 小字压在雾蓝底上，用 --v-text-weak 对比度不足 4.5:1，退一档到 --v-text-sub。 */
  color: var(--v-text-sub);
  font-size: var(--v-font-xs);
  font-weight: 400;
}

/* 已选文件独立成行：文件名、大小、移除动作各就各位，不再和按钮挤在一条基线上。 */
.upload-picked {
  display: flex;
  align-items: center;
  gap: var(--v-gap-md);
  margin-top: var(--v-gap-md);
  padding: 10px 12px;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-sm);
  background: var(--v-surface);
}

.upload-picked-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--v-text-body);
  font-size: var(--v-font-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-picked-size {
  flex: none;
  color: var(--v-text-weak);
  font-size: var(--v-font-xs);
}
</style>
