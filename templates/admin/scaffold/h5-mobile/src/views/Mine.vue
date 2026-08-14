<script setup lang="ts">
/**
 * 骨架「我的」页 —— 演示键值区（vm-kv）、开关行（vm-switch-row）与函数式反馈。
 * 适老化开关是框架能力的实机演示：切一个根类，全站字阶与控件高一起变。
 */
import { confirmAsync, toast } from '@ui'
import { aging } from '@/utils/prefs'
import { clearToken } from '@/utils/auth'

const profile = [
  { label: '账号', value: '未登录' },
  { label: '版本', value: '0.1.0' },
]

async function onLogout() {
  const ok = await confirmAsync('退出后需要重新登录，确认退出？', { title: '退出登录', okText: '退出' })
  if (!ok) return
  clearToken()
  toast('已退出')
}
</script>

<template>
  <VmNavbar title="我的" />

  <div class="vm-body">
    <div class="vm-sec">
      <i class="vm-sec-dot"></i>
      <span class="vm-sec-title">我的信息</span>
    </div>

    <div class="vm-card">
      <div v-for="it in profile" :key="it.label" class="vm-kv">
        <span class="vm-kv-label">{{ it.label }}</span>
        <span class="vm-kv-value">{{ it.value }}</span>
      </div>
    </div>

    <div class="vm-sec">
      <i class="vm-sec-dot amber"></i>
      <span class="vm-sec-title">辅助功能</span>
    </div>

    <div class="vm-card">
      <div class="vm-kv">
        <div class="vm-switch-row" style="flex: 1">
          <span>适老化模式（放大字号）</span>
          <input v-model="aging" type="checkbox" role="switch" />
        </div>
      </div>
    </div>

    <div class="vm-card" style="margin-top: 16px; border: none; box-shadow: none; background: none">
      <button type="button" class="vm-btn vm-btn-ghost" style="width: 100%" @click="onLogout">退出登录</button>
    </div>

    <div class="vm-actionbar-safe"></div>
  </div>
</template>
