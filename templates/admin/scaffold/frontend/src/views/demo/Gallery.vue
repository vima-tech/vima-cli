<script setup lang="ts">
/**
 * 页面画廊（A27，仅 demo 态注册）：全部业务页 × 三视口 × 四数据档一屏看全。
 *
 * 「业务页」判据：路由名不在骨架内置集合里——业务路由由任务生成并登记进 router，
 * 天然落在集合之外；与版面冒烟探针共用同一判据（排除脚手架自带页面，省 token 也省眼力）。
 * 本页同时把业务路由清单暴露为 window.__vimaRoutes，Kimi WebBridge 默认通道与
 * layout-smoke.mjs 回退通道都从这里取路由。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

/** 骨架内置路由（壳层页）：画廊与探针都不看它们 */
const BUILTIN = new Set([
  'Login', 'NotFound', 'Dashboard', 'System', 'User', 'Role', 'Menu', 'Dept', 'Dict',
  'Config', 'File', 'OperLog', 'LoginLog', 'Monitor', 'OnlineUser', 'Job', 'Message',
  'Profile', 'Settings', 'Gallery',
])

const router = useRouter()

const bizRoutes = computed(() =>
  router
    .getRoutes()
    .filter((r) => typeof r.name === 'string' && !BUILTIN.has(r.name) && !r.path.includes(':'))
    .map((r) => ({ name: String(r.name), path: r.path }))
    .sort((a, b) => (a.path < b.path ? -1 : 1)),
)

// 探针的路由来源（Kimi / Playwright 共读；与画廊同一份判据，不做两份）
;(window as unknown as { __vimaRoutes?: unknown }).__vimaRoutes = bizRoutes.value
  .map((r) => r.path)

const VIEWPORTS = [
  { key: 'mobile', width: 375, label: '375' },
  { key: 'laptop', width: 1280, label: '1280' },
  { key: 'desktop', width: 1920, label: '1920' },
] as const

const DATASETS = [
  { key: 'default', label: '常规' },
  { key: 'empty', label: '空' },
  { key: 'many', label: '多' },
  { key: 'long', label: '超长' },
] as const

const viewport = ref<(typeof VIEWPORTS)[number]>(VIEWPORTS[1])
const dataset = ref<(typeof DATASETS)[number]['key']>('default')
const current = ref<string>('')

function srcOf(path: string) {
  return dataset.value === 'default' ? path : `${path}?__mock=${dataset.value}`
}
</script>

<template>
  <div class="gallery">
    <header class="gallery-bar">
      <strong>页面画廊</strong>
      <span class="gallery-count">{{ bizRoutes.length }} 个业务页</span>
      <span class="gallery-group">
        <button
          v-for="v in VIEWPORTS"
          :key="v.key"
          type="button"
          :class="{ on: viewport.key === v.key }"
          @click="viewport = v"
        >
          {{ v.label }}
        </button>
      </span>
      <span class="gallery-group">
        <button
          v-for="d in DATASETS"
          :key="d.key"
          type="button"
          :class="{ on: dataset === d.key }"
          @click="dataset = d.key"
        >
          {{ d.label }}
        </button>
      </span>
      <span class="gallery-hint">空与超长两档最能暴露版面缺陷；探针共用本页的业务页判据</span>
    </header>

    <p v-if="bizRoutes.length === 0" class="gallery-empty">
      还没有业务页面（带路由名且不属骨架内置集）。任务实现页面并登记路由后，这里会自动出现。
    </p>

    <nav class="gallery-nav">
      <button
        v-for="r in bizRoutes"
        :key="r.path"
        type="button"
        :class="{ on: current === r.path }"
        @click="current = r.path"
      >
        {{ r.name }} <i>{{ r.path }}</i>
      </button>
    </nav>

    <div v-if="current" class="gallery-stage">
      <iframe :src="srcOf(current)" :style="{ width: `${viewport.width}px` }" :key="srcOf(current) + viewport.key" />
    </div>
  </div>
</template>

<style scoped>
.gallery {
  min-height: 100vh;
  padding: var(--v-gap-lg);
  background: var(--v-bg);
  display: flex;
  flex-direction: column;
  gap: var(--v-gap-md);
}
.gallery-bar {
  display: flex;
  align-items: center;
  gap: var(--v-gap-md);
  flex-wrap: wrap;
  color: var(--v-text-body);
}
.gallery-count {
  color: var(--v-text-weak);
  font-size: var(--v-font-small);
}
.gallery-hint {
  color: var(--v-text-faint);
  font-size: var(--v-font-xs);
}
.gallery-group {
  display: inline-flex;
  gap: var(--v-gap-xs);
}
.gallery-group button,
.gallery-nav button {
  border: 1px solid var(--v-border-strong);
  background: var(--v-surface);
  color: var(--v-text-sub);
  border-radius: var(--v-radius-sm);
  padding: 4px 10px;
  font-size: var(--v-font-small);
}
.gallery-group button.on,
.gallery-nav button.on {
  background: var(--v-primary);
  border-color: var(--v-primary);
  color: var(--v-on-dark);
}
.gallery-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--v-gap-sm);
}
.gallery-nav i {
  font-style: normal;
  opacity: 0.65;
  margin-left: 4px;
}
.gallery-empty {
  color: var(--v-text-weak);
}
.gallery-stage {
  flex: 1;
  overflow: auto;
  border: 1px dashed var(--v-border-strong);
  border-radius: var(--v-radius-sm);
  padding: var(--v-gap-md);
  background: var(--v-surface);
}
.gallery-stage iframe {
  display: block;
  height: 900px;
  max-width: 100%;
  border: 0;
  margin: 0 auto;
  background: var(--v-bg);
}
</style>
