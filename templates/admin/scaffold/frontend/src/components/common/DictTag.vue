<script setup lang="ts">
import { computed } from 'vue'
import { useDict } from '@/utils/dict'

/**
 * 字典标签：按字典类型 + 值渲染带语义色的 VTag。
 *
 *   <DictTag type="sys_user_status" :value="row.status" />
 *
 * 颜色规则（简单稳定）：字典项 remark 若恰为 VTag 语义色名则用之；
 * 否则按字典值 hash 到固定色板，同一个值永远同一个颜色。
 */
const props = defineProps<{
  type: string
  value: string | number
}>()

const { options, labelOf } = useDict(props.type)

const TAG_TYPES = ['primary', 'success', 'warning', 'danger', 'info']

const tagType = computed(() => {
  const v = String(props.value)
  const item = options.value.find((o) => o.value === v)
  if (item?.remark && TAG_TYPES.includes(item.remark)) {
    return item.remark
  }
  let hash = 0
  for (let i = 0; i < v.length; i++) {
    hash = (hash * 31 + v.charCodeAt(i)) >>> 0
  }
  return TAG_TYPES[hash % TAG_TYPES.length]
})
</script>

<template>
  <VTag :type="tagType">{{ labelOf(value) }}</VTag>
</template>
