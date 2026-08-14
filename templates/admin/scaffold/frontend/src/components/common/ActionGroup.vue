<script setup lang="ts">
/**
 * ActionGroup —— 动作组收纳（A27 C-A27-05：按密度档自动把溢出动作收进「更多」）。
 *
 * 这是 PDL `priority` 声明的框架吸收层（L1）：规格只说「谁重要、谁可收」，
 * 「收几个」由本组件按密度档计算——compact 2 / default 3 / loose 4。
 * 「放不放得下」永远不在规格期写死（那条路实测证伪过：声明 220 渲染 286）。
 *
 * 用法（actions 顺序 = 展示顺序；priority: overflow 恒收起）：
 *   <ActionGroup :actions="[
 *     { label: '编辑', priority: 'primary',  onClick: onEdit },
 *     { label: '详情', priority: 'secondary', onClick: onDetail },
 *     { label: '作废', priority: 'overflow',  onClick: onVoid },
 *   ]" density="compact" size="sm" />
 */
import { computed } from 'vue'

export interface ActionItem {
  label: string
  priority?: 'primary' | 'secondary' | 'overflow'
  disabled?: boolean
  onClick: () => void
}

const props = withDefaults(
  defineProps<{
    actions: ActionItem[]
    /** 密度档决定可见容量：compact 2 / default 3 / loose 4（与 PDL design.density 对应） */
    density?: 'compact' | 'default' | 'loose'
    /** 透传给按钮的尺寸；表格行内一律 sm（coding-standards 既有规范） */
    size?: 'sm' | 'md'
  }>(),
  { density: 'default', size: 'sm' },
)

const CAPACITY = { compact: 2, default: 3, loose: 4 } as const

const visible = computed(() => {
  const cap = CAPACITY[props.density]
  const inline = props.actions.filter((a) => a.priority !== 'overflow')
  return inline.slice(0, cap)
})

const folded = computed(() => {
  const cap = CAPACITY[props.density]
  const inline = props.actions.filter((a) => a.priority !== 'overflow')
  const overflowDeclared = props.actions.filter((a) => a.priority === 'overflow')
  // 声明 overflow 的恒收起；超出容量的按声明顺序顺延收起
  return [...inline.slice(cap), ...overflowDeclared]
})

function typeOf(a: ActionItem) {
  return a.priority === 'primary' ? 'primary' : 'default'
}
</script>

<template>
  <span class="action-group">
    <VButton
      v-for="a in visible"
      :key="a.label"
      :type="typeOf(a)"
      :size="size"
      :disabled="a.disabled"
      @click="a.onClick()"
    >
      {{ a.label }}
    </VButton>
    <VDropdown v-if="folded.length" placement="bottom-end">
      <VButton :size="size">更多</VButton>
      <template #content>
        <VDropdownMenu>
          <VDropdownMenuItem
            v-for="a in folded"
            :key="a.label"
            :disabled="a.disabled"
            @click="a.onClick()"
          >
            {{ a.label }}
          </VDropdownMenuItem>
        </VDropdownMenu>
      </template>
    </VDropdown>
  </span>
</template>

<style scoped>
.action-group {
  display: inline-flex;
  gap: var(--v-gap-sm);
  align-items: center;
}
</style>
