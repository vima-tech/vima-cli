<script setup lang="ts">
/**
 * 骨架首页 —— 演示 vima-ui-h5 的页面骨架：hero（主视觉）+ sheet（上翻承载面）。
 * 业务页由任务生成，可以整页替换本页。
 */
const appName = '{{projectName}}'
const entries = [
  { key: 'plan', name: '我的方案', tone: '' },
  { key: 'report', name: '检查报告', tone: 'cyan' },
  { key: 'edu', name: '宣教资讯', tone: 'green' },
  { key: 'mine', name: '个人中心', tone: 'amber' },
]
</script>

<template>
  <div class="vm-hero">
    <div class="vm-hero-fx"></div>
    <div class="vm-hero-glow"></div>
    <div class="vm-hero-body">
      <span class="vm-badge"><i class="vm-badge-dot"></i>服务运行中</span>
      <div class="vm-hero-title">{{ appName }}</div>
      <div class="vm-hero-sub">
        <i class="vm-hero-rule-l"></i>PATIENT SERVICE<i class="vm-hero-rule-r"></i>
      </div>
    </div>
  </div>

  <div class="vm-sheet">
    <div class="vm-sec">
      <i class="vm-sec-dot"></i>
      <span class="vm-sec-title">常用服务</span>
      <span class="vm-sec-en">SERVICES</span>
    </div>

    <div class="vm-card">
      <div class="vm-grid4">
        <div v-for="it in entries" :key="it.key" class="vm-grid-item">
          <div class="vm-grid-icon" :class="it.tone"></div>
          <span class="vm-grid-name">{{ it.name }}</span>
        </div>
      </div>
    </div>

    <div class="vm-sec">
      <i class="vm-sec-dot green"></i>
      <span class="vm-sec-title">最近动态</span>
      <span class="vm-sec-en">RECENT</span>
    </div>

    <div class="vm-card">
      <div class="vm-empty slim">
        <div class="vm-empty-icon">📋</div>
        <div class="vm-empty-text">暂无动态</div>
        <div class="vm-empty-hint">开始使用后，这里会显示你的最新记录</div>
      </div>
    </div>

    <div class="vm-actionbar-safe"></div>
  </div>
</template>
