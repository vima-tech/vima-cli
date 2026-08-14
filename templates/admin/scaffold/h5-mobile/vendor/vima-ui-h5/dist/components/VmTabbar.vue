<script setup lang="ts">
/**
 * 底部主导航（H5 专属）。
 * 小程序端不需要它——原生 tabBar 由 `app.json` 声明，性能与手感都更好。
 *
 * items 与 spec 里该端的 `vima:menus`（mobile 端的「菜单」= tabbar，3–5 项）对应，
 * 不要在这里自由发挥项数：超过 5 项在手机上点不准。
 */
defineProps<{ items: Array<{ key: string; text: string }>; active: string }>()
defineEmits<{ (e: 'change', key: string): void }>()
</script>

<template>
  <nav class="vm-tabbar">
    <button
      v-for="it in items"
      :key="it.key"
      type="button"
      class="vm-tabbar-item"
      :class="{ active: it.key === active }"
      @click="$emit('change', it.key)"
    >
      {{ it.text }}
    </button>
  </nav>
</template>

<style scoped>
.vm-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  background-color: var(--vm-surface);
  border-top: 1px solid var(--vm-border-soft);
  padding-bottom: env(safe-area-inset-bottom);
}
.vm-tabbar-item {
  flex: 1;
  height: 52px;
  border: none;
  background: none;
  font-size: var(--vm-font-small);
  font-weight: var(--vm-weight-medium);
  color: var(--vm-text-weak);
}
.vm-tabbar-item.active {
  color: var(--vm-primary);
  font-weight: var(--vm-weight-title);
}
</style>
