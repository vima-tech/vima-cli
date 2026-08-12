<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { confirmAsync } from '@/utils/feedback'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const uploadDialogVisible = ref(false)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
})

const columns = [
  { key: 'originalName', title: '文件名' },
  { key: 'fileType', title: '类型', width: 120 },
  { key: 'fileSize', title: '大小', width: 100, customSlot: 'fileSize' },
  { key: 'uploadUsername', title: '上传人', width: 100 },
  { key: 'createTime', title: '上传时间', width: 180 },
  { title: '操作', key: 'operator', customSlot: 'operator' },
]

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const handleUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const formData = new FormData()
  formData.append('file', input.files[0])

  try {
    await request.post('/system/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    uploadDialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error(error)
  }
  input.value = ''
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
  const res: any = await request.get('/system/file/list', { params: queryParams })
  tableData.value = res.data?.records || []
  total.value = res.data?.total || 0
  loading.value = false
}

onMounted(fetchData)
</script>

<template>
  <div class="vui-page">
    <VCard title="文件管理">
      <div class="toolbar">
        <VButton type="primary" @click="uploadDialogVisible = true">上传文件</VButton>
      </div>

      <VTable :loading="loading" :data-source="tableData" :columns="columns">
        <template #fileSize="{ row }">
          <span>{{ formatFileSize(row.fileSize) }}</span>
        </template>
        <template #operator="{ row }">
          <VButton size="small" @click="handleDownload(row.fileUrl)">下载</VButton>
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

    <VLayer v-model="uploadDialogVisible" title="上传文件" area="400px">
      <div class="upload-area">
        <input type="file" @change="handleUpload" />
      </div>
      <template #footer>
        <VButton @click="uploadDialogVisible = false">关闭</VButton>
      </template>
    </VLayer>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}

.upload-area {
  padding: 20px;
}
</style>
