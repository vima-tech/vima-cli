<script setup lang="ts">
/**
 * 确认对话框（H5 专属；小程序端用 wx.showModal）。
 * 全局只挂一次，放在 App.vue 根部；页面用 `confirmAsync()` 函数式 API，
 * 它返回 Promise<boolean>，避免回调地狱与「确认了没确认」的状态漂移。
 */
import { dialogState, resolveDialog } from '../feedback'
</script>

<template>
  <div v-if="dialogState.visible" class="vm-popup" role="dialog" aria-modal="true">
    <div class="vm-popup-mask" @click="resolveDialog(false)"></div>
    <div class="vm-dialog-panel">
      <div class="vm-dialog-title">{{ dialogState.title }}</div>
      <div class="vm-dialog-text">{{ dialogState.content }}</div>
      <div class="vm-dialog-ft">
        <button type="button" class="vm-btn vm-btn-ghost" @click="resolveDialog(false)">
          {{ dialogState.cancelText }}
        </button>
        <button type="button" class="vm-btn vm-btn-primary" @click="resolveDialog(true)">
          {{ dialogState.okText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确认框是少数该居中的弹层：它打断流程、需要立刻决策，不是「从底部补充内容」 */
.vm-dialog-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 78vw;
  max-width: 320px;
  padding: var(--vm-gap-xl) var(--vm-pad-body) var(--vm-gap-lg);
  border-radius: var(--vm-radius-card);
  background-color: var(--vm-surface);
  box-shadow: var(--vm-shadow-popup);
}
.vm-dialog-title {
  font-size: var(--vm-font-h2);
  font-weight: var(--vm-weight-title);
  color: var(--vm-text-title);
  text-align: center;
}
.vm-dialog-text {
  margin-top: var(--vm-gap-md);
  font-size: var(--vm-font-sub);
  line-height: 1.6;
  color: var(--vm-text-body);
  text-align: center;
}
.vm-dialog-ft {
  display: flex;
  gap: var(--vm-gap-md);
  margin-top: var(--vm-gap-xl);
}
.vm-dialog-ft .vm-btn {
  flex: 1;
}
</style>
