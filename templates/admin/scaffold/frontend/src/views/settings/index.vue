<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore, type TabPlacement } from '@/store/app'

const appStore = useAppStore()

/*
 * 每种摆放配一张线框缩略图：页签位置是纯视觉选项，只给文字描述用户得先切一次才知道差别。
 * 缩略图用 div 拼，不引图片资源。
 */
const placements: { value: TabPlacement; title: string; desc: string }[] = [
  { value: 'bar', title: '独立一条', desc: '页签横贯整个宽度，适合常年开十几个页签（默认）' },
  { value: 'header', title: '并入顶栏', desc: '全站只有一条横条，首屏留给内容的高度最多' },
]

const current = computed({
  get: () => appStore.tabPlacement,
  set: (value: TabPlacement) => appStore.setTabPlacement(value),
})
</script>

<template>
  <!-- 页面根必须是 .vui-page：内边距、高度链、滚动都由它给（框架契约） -->
  <div class="vui-page">
    <VCard title="界面设置">
      <template #extra>仅影响当前浏览器</template>

      <section class="set-block">
        <div class="set-block-head">
          <strong>页签位置</strong>
          <small>切换后立即生效，选择保存在本机，换设备或清缓存后回到默认值</small>
        </div>

        <div class="set-options" role="radiogroup" aria-label="页签位置">
          <button
            v-for="item in placements"
            :key="item.value"
            type="button"
            role="radio"
            class="set-option"
            :class="{ 'is-active': current === item.value }"
            :aria-checked="current === item.value"
            @click="current = item.value"
          >
            <!-- 线框缩略图：深色块=顶栏，蓝条=页签，浅块=内容区 -->
            <span class="set-thumb" :class="`is-${item.value}`" aria-hidden="true">
              <span class="set-thumb-header">
                <i class="set-thumb-brand"></i>
                <i v-if="item.value === 'header'" class="set-thumb-tab"></i>
                <i v-if="item.value === 'header'" class="set-thumb-tab is-dim"></i>
              </span>
              <span class="set-thumb-body">
                <span class="set-thumb-side"></span>
                <span class="set-thumb-main">
                  <span v-if="item.value === 'bar'" class="set-thumb-bar">
                    <i class="set-thumb-tab"></i>
                    <i class="set-thumb-tab is-dim"></i>
                  </span>
                  <span class="set-thumb-content"></span>
                </span>
              </span>
            </span>

            <span class="set-option-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>

            <span class="set-option-check" aria-hidden="true"><VIcon name="check" size="13" /></span>
          </button>
        </div>
      </section>
    </VCard>
  </div>
</template>

<style scoped>
.set-block-head {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.set-block-head strong {
  color: var(--v-text-title);
  font-size: 14px;
  font-weight: var(--v-weight-semibold);
}

.set-block-head small {
  color: var(--v-text-sub);
  font-size: 12px;
}

.set-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--v-gap-md);
}

.set-option {
  position: relative;
  width: 300px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--v-border);
  border-radius: 14px;
  background: var(--v-surface);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    border-color 180ms var(--v-ease),
    background 180ms var(--v-ease),
    box-shadow 180ms var(--v-ease);
}

.set-option:hover {
  border-color: color-mix(in srgb, var(--v-primary) 32%, var(--v-border));
}

.set-option.is-active {
  border-color: color-mix(in srgb, var(--v-primary) 42%, var(--v-border));
  background: color-mix(in srgb, var(--v-primary) 4%, var(--v-surface));
  box-shadow: 0 12px 26px -22px color-mix(in srgb, var(--v-primary-strong) 70%, transparent);
}

.set-option-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.set-option-copy strong {
  color: var(--v-text-title);
  font-size: 13px;
  font-weight: var(--v-weight-semibold);
}

.set-option-copy small {
  color: var(--v-text-sub);
  font-size: 11px;
  line-height: 1.5;
}

.set-option-check {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  align-self: flex-start;
  border: 1px solid var(--v-border);
  border-radius: 50%;
  color: transparent;
  background: var(--v-surface);
  transition:
    color 180ms var(--v-ease),
    border-color 180ms var(--v-ease),
    background 180ms var(--v-ease);
}

.set-option.is-active .set-option-check {
  border-color: transparent;
  color: var(--v-on-dark);
  background: var(--v-primary);
}

/* ---------- 布局缩略图 ---------- */
.set-thumb {
  width: 84px;
  height: 62px;
  display: flex;
  flex-direction: column;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--v-border);
  border-radius: 8px;
  background: var(--v-app-bg, var(--v-surface));
}

.set-thumb-header {
  height: 13px;
  display: flex;
  align-items: center;
  flex: none;
  gap: 3px;
  padding: 0 4px;
  background: var(--v-navy-700);
}

.set-thumb-brand {
  width: 12px;
  height: 5px;
  flex: none;
  border-radius: 2px;
  background: color-mix(in srgb, var(--v-on-dark) 62%, transparent);
}

.set-thumb-tab {
  width: 15px;
  height: 6px;
  flex: none;
  border-radius: 2px;
  background: var(--v-surface);
}

.set-thumb-tab.is-dim {
  background: color-mix(in srgb, var(--v-on-dark) 26%, transparent);
}

/* 独立条模式的页签在浅色横条上，非激活项换成浅色系才看得见 */
.set-thumb-bar .set-thumb-tab {
  background: color-mix(in srgb, var(--v-primary) 42%, var(--v-surface));
}

.set-thumb-bar .set-thumb-tab.is-dim {
  background: var(--v-border);
}

.set-thumb-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.set-thumb-side {
  width: 20px;
  flex: none;
  border-right: 1px solid var(--v-border);
  background: color-mix(in srgb, var(--v-primary) 6%, var(--v-surface));
}

.set-thumb-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.set-thumb-bar {
  height: 11px;
  display: flex;
  align-items: center;
  flex: none;
  gap: 3px;
  padding: 0 3px;
  border-bottom: 1px solid var(--v-border);
  background: var(--v-surface);
}

.set-thumb-content {
  flex: 1;
  margin: 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--v-primary) 7%, var(--v-surface));
}
</style>
