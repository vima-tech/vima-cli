<script setup lang="ts">
/**
 * 轻提示（H5 专属；小程序端用 wx.showToast）。
 * 全局只挂一次，放在 App.vue 根部；页面不直接用它，用 `toast()` 函数式 API。
 */
import { toastState } from '../feedback'
</script>

<template>
  <transition name="vm-toast">
    <div v-if="toastState.visible" class="vm-toast" role="status" aria-live="polite">
      {{ toastState.text }}
    </div>
  </transition>
</template>

<style scoped>
.vm-toast {
  position: fixed;
  left: 50%;
  bottom: 88px;
  transform: translateX(-50%);
  z-index: 60;
  max-width: 76vw;
  padding: 10px 16px;
  border-radius: var(--vm-radius-ctl);
  background: rgba(8, 22, 45, 0.86);
  color: var(--vm-on-dark);
  font-size: var(--vm-font-sub);
  line-height: 1.5;
  text-align: center;
}
.vm-toast-enter-active,
.vm-toast-leave-active {
  transition: opacity 0.2s var(--vm-ease);
}
.vm-toast-enter-from,
.vm-toast-leave-to {
  opacity: 0;
}
</style>
