<script setup lang="ts">
/**
 * 顶部导航栏（H5 专属）。
 * 小程序端不需要它——原生导航栏由 `app.json` 的 navigationBarTitleText 提供。
 * H5 没有系统导航栏，所以这一条必须自带，否则用户在多级页面里会迷路。
 */
defineProps<{ title: string; showBack?: boolean }>()
const emit = defineEmits<{ (e: 'back'): void }>()

function onBack() {
  emit('back')
  if (window.history.length > 1) window.history.back()
}
</script>

<template>
  <header class="vm-navbar">
    <button v-if="showBack" class="vm-navbar-back" type="button" aria-label="返回" @click="onBack">‹</button>
    <span class="vm-navbar-title">{{ title }}</span>
    <span class="vm-navbar-extra"><slot name="extra" /></span>
  </header>
</template>

<style scoped>
.vm-navbar {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: var(--vm-gap-sm);
  height: 48px;
  flex: none;
  padding: 0 var(--vm-pad-body);
  background-color: var(--vm-surface);
  border-bottom: 1px solid var(--vm-border-soft);
}
.vm-navbar-back {
  width: 32px;
  height: 32px;
  flex: none;
  border: 1px solid var(--vm-border);
  border-radius: var(--vm-radius-ctl);
  background-color: var(--vm-surface);
  color: var(--vm-text-title);
  font-size: var(--vm-font-h1);
  line-height: 1;
}
.vm-navbar-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--vm-font-h2);
  font-weight: var(--vm-weight-title);
  color: var(--vm-text-title);
}
.vm-navbar-extra {
  flex: none;
}
</style>
