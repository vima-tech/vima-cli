<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <span class="error-mark" aria-hidden="true">
        <span class="error-orbit"></span>
        <VIcon name="help-circle" size="34" />
      </span>
      <p class="error-code">404</p>
      <h1>页面不存在</h1>
      <p class="error-desc">链接可能已失效，或当前账号没有这个页面的访问权限。</p>
      <div class="error-actions">
        <VButton type="primary" @click="goHome">返回首页</VButton>
        <VButton @click="goBack">返回上一页</VButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 404 有两种落点：外壳内（工作区里打开了一个坏路由）和外壳外（直接访问 URL 未登录）。
 * 用 min-height:100% 而不是 100vh —— 在外壳内时 100vh 会比可用高度多出顶栏和标签条那两截，
 * 把内容顶出可视区。
 */
.error-page {
  display: grid;
  width: 100%;
  min-height: 100%;
  padding: clamp(24px, 5vw, 64px);
  place-items: center;
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(520px, 100%);
  padding: clamp(32px, 4vw, 52px);
  border: 1px solid color-mix(in srgb, var(--v-primary) 13%, var(--v-border));
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--v-cyan) 12%, var(--v-surface)), var(--v-surface) 52%);
  box-shadow: var(--v-shadow-card);
  text-align: center;
}

.error-mark {
  position: relative;
  width: 76px;
  height: 76px;
  display: grid;
  border: 1px solid color-mix(in srgb, var(--v-primary) 16%, var(--v-border));
  border-radius: 24px;
  color: var(--v-primary);
  background: color-mix(in srgb, var(--v-primary) 6%, var(--v-surface));
  place-items: center;
}

.error-orbit {
  position: absolute;
  width: 108px;
  height: 108px;
  border: 1px solid color-mix(in srgb, var(--v-primary) 12%, transparent);
  border-radius: 42%;
  transform: rotate(18deg);
}

.error-code {
  margin-top: 26px;
  background: var(--v-brand-grad);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  font-size: clamp(48px, 7vw, 72px);
  font-weight: var(--v-weight-title);
  letter-spacing: -0.05em;
  line-height: 1;
}

.error-card h1 {
  margin-top: 10px;
  color: var(--v-text-title);
  font-size: 18px;
  font-weight: var(--v-weight-title);
  letter-spacing: -0.02em;
}

.error-desc {
  margin-top: 10px;
  color: var(--v-text-sub);
  font-size: var(--v-font-small);
  line-height: 1.8;
}

.error-actions {
  display: flex;
  gap: var(--v-gap-md);
  margin-top: 26px;
}
</style>
