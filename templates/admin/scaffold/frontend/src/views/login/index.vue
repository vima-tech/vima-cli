<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { toastError } from '@/utils/feedback'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const formRef = ref()
const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  try {
    loading.value = true
    await userStore.login(form.username, form.password)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error: any) {
    toastError(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <span class="login-glow login-glow--top" aria-hidden="true"></span>
    <span class="login-glow login-glow--bottom" aria-hidden="true"></span>

    <div class="login-shell">
      <!-- 左半区：品牌与主视觉。插图是纯 CSS 同心环，不引任何图片资源。 -->
      <section class="login-visual">
        <div class="login-brand">
          <span class="login-brand-mark" aria-hidden="true"><VIcon name="app" size="22" /></span>
          <span class="login-brand-copy">
            <strong>{{projectName}}</strong>
            <small>ADMIN CONSOLE</small>
          </span>
        </div>

        <div class="login-visual-copy">
          <p class="login-eyebrow"><span aria-hidden="true"></span>ENTERPRISE ADMIN</p>
          <h1>统一入口<br /><em>集中管控</em>后台业务</h1>
          <p>账号、角色、菜单、部门与运行监控在同一处维护，权限变更即时生效。</p>
        </div>

        <div class="login-orbits" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <VIcon name="shield-check" size="46" />
        </div>

        <p class="login-visual-note"><span class="login-visual-dot" aria-hidden="true"></span>服务运行正常</p>
      </section>

      <!-- 右半区：凭据表单 -->
      <section class="login-panel">
        <div class="login-panel-inner">
          <p class="login-status">
            <span class="login-status-icon" aria-hidden="true"><VIcon name="lock" size="13" /></span>
            安全登录
          </p>

          <div class="login-heading">
            <p>WELCOME BACK</p>
            <h2>登录管理后台</h2>
            <span>请使用管理员分配的账号登录，连续失败会触发登录审计。</span>
          </div>

          <VForm ref="formRef" :model="form" :rules="rules" layout="vertical" class="login-form">
            <!--
              前缀图标走 #prefix 插槽而不是 prefix-icon 属性：后者只会渲染成
              <span class="vui-input-prefix-icon 你填的名字">，是给图标字体准备的类名接口，
              而这套组件库不带图标字体——填什么都是个 0 宽的空 span，看不出写错了。
            -->
            <VFormItem label="用户名" prop="username">
              <VInput v-model="form.username" placeholder="请输入用户名">
                <template #prefix><VIcon name="user" size="16" /></template>
              </VInput>
            </VFormItem>
            <VFormItem label="密码" prop="password">
              <VInput
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                show-password
                @keyup.enter="handleLogin"
              >
                <template #prefix><VIcon name="lock" size="16" /></template>
              </VInput>
            </VFormItem>
            <!--
              VButton 没有 block / size="large"：size 只认 sm，其余值只会落成一个没有规则的
              class（vui-button-large），看着"写了"其实没生效。铺满与加高交给下面这个类。
            -->
            <VButton type="primary" class="login-submit" :loading="loading" @click="handleLogin">
              登 录
            </VButton>
          </VForm>

          <p class="login-hint">
            <VIcon name="info" size="13" />
            管理员初始密码由 VIMA_INITIAL_ADMIN_PASSWORD 注入；未配置时查看后端首次启动日志中的随机值。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
 * 本页只出现在登录屏的那批浅色调与光晕，定义在 styles/tokens.css 的「登录页专用」段
 * （`--v-login-*`），这里只引用、不定义：骨架自己写死颜色，builder 就会照着写死。
 * 要调登录页的色，改 tokens.css 那一段。
 */
.login-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(24px, 4vw, 52px);
  overflow: hidden;
  color: var(--v-text-body);
  /* 登录页不走全局的页底纹：这里要更亮、带网格，与进入后台后的深色顶栏形成落差 */
  background:
    linear-gradient(var(--v-login-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--v-login-grid-line) 1px, transparent 1px),
    radial-gradient(circle at 12% 12%, var(--v-login-glow-a), transparent 30%),
    radial-gradient(circle at 88% 88%, var(--v-login-glow-b), transparent 32%),
    var(--v-login-canvas);
  background-size: 32px 32px, 32px 32px, auto, auto, auto;
  place-items: center;
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, var(--v-login-sheen), transparent 32%),
    radial-gradient(circle at 50% 50%, transparent 48%, var(--v-login-vignette) 100%);
  pointer-events: none;
}

.login-glow {
  position: absolute;
  width: 34vw;
  aspect-ratio: 1;
  border-radius: 50%;
  opacity: 0.48;
  filter: blur(8px);
  pointer-events: none;
}

.login-glow--top {
  top: -24vw;
  right: -8vw;
  border: 1px solid var(--v-login-ring-border);
  box-shadow: 0 0 0 70px var(--v-login-ring-halo-1), 0 0 0 140px var(--v-login-ring-halo-2);
}

.login-glow--bottom {
  bottom: -28vw;
  left: -8vw;
  border: 1px solid var(--v-login-ring-border-soft);
  box-shadow: 0 0 0 70px var(--v-login-ring-halo-3), 0 0 0 140px var(--v-login-ring-halo-4);
}

.login-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(390px, 0.82fr);
  width: min(1240px, 100%);
  height: min(720px, calc(100dvh - clamp(48px, 8vw, 104px)));
  min-height: 600px;
  overflow: hidden;
  border: 1px solid var(--v-login-card-border);
  border-radius: var(--v-radius-xl);
  background: var(--v-login-card-bg);
  box-shadow:
    0 34px 80px -42px var(--v-login-card-shadow),
    0 2px 8px var(--v-login-card-shadow-soft),
    inset 0 1px 0 var(--v-login-highlight);
}

/* ---------- 左半区 ---------- */
.login-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: clamp(30px, 3.2vw, 48px);
  overflow: hidden;
  border-right: 1px solid var(--v-login-divider);
  background:
    radial-gradient(circle at 53% 62%, var(--v-login-highlight) 0 18%, transparent 52%),
    linear-gradient(145deg, var(--v-login-hero-wash), var(--v-login-hero-tint));
}

.login-brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 13px;
}

.login-brand-mark {
  width: 44px;
  height: 44px;
  display: inline-grid;
  flex: none;
  border-radius: var(--v-radius-ctl);
  color: var(--v-on-dark);
  background: var(--v-brand-grad);
  box-shadow: 0 12px 24px -14px var(--v-login-btn-shadow);
  place-items: center;
}

.login-brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.login-brand-copy strong {
  color: var(--v-text-title);
  font-size: 18px;
  font-weight: var(--v-weight-title);
  letter-spacing: 0.12em;
}

.login-brand-copy small {
  margin-top: 3px;
  color: var(--v-text-weak);
  font-size: 9px;
  font-weight: var(--v-weight-semibold);
  letter-spacing: 0.15em;
}

.login-visual-copy {
  position: relative;
  z-index: 2;
  margin-top: clamp(26px, 4vh, 46px);
}

.login-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--v-primary-strong);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.login-eyebrow span {
  width: 26px;
  height: 2px;
  border-radius: var(--v-radius-xs);
  background: var(--v-primary);
}

.login-visual-copy h1 {
  margin-top: 14px;
  color: var(--v-text-title);
  font-size: clamp(26px, 2.4vw, 36px);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.24;
}

.login-visual-copy h1 em {
  color: var(--v-primary-strong);
  font-style: normal;
}

.login-visual-copy > p:last-child {
  max-width: 30em;
  margin-top: 12px;
  color: var(--v-text-sub);
  font-size: 14px;
  line-height: 1.8;
  letter-spacing: 0.04em;
}

/*
 * 主视觉插图：三层同心环 + 一个图标。用 CSS 画而不是放图片，
 * 是因为脚手架不该带一张只在登录页用一次、换项目就得替换的位图。
 */
.login-orbits {
  position: absolute;
  right: clamp(-40px, -2vw, 0px);
  bottom: clamp(-60px, -4vw, -20px);
  width: min(66%, 460px);
  aspect-ratio: 1;
  display: grid;
  color: color-mix(in srgb, var(--v-primary) 45%, var(--v-surface));
  place-items: center;
  pointer-events: none;
}

.login-orbits span {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--v-primary) 14%, transparent);
  border-radius: 50%;
}

.login-orbits span:nth-child(1) {
  width: 100%;
  height: 100%;
}

.login-orbits span:nth-child(2) {
  width: 72%;
  height: 72%;
  border-color: color-mix(in srgb, var(--v-cyan) 22%, transparent);
  background: radial-gradient(circle, var(--v-login-spot), transparent 70%);
}

.login-orbits span:nth-child(3) {
  width: 44%;
  height: 44%;
  border-style: dashed;
  border-color: color-mix(in srgb, var(--v-primary) 20%, transparent);
}

.login-visual-note {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: auto;
  color: var(--v-text-weak);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.login-visual-dot {
  width: 7px;
  height: 7px;
  border: 2px solid var(--v-surface);
  border-radius: 50%;
  background: var(--v-accent-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--v-accent-green) 16%, transparent);
  animation: v-pulse 2.2s var(--v-ease) infinite;
}

/* ---------- 右半区 ---------- */
.login-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: auto;
  background: var(--v-login-chip-bg);
}

.login-panel-inner {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  width: min(100%, 430px);
  margin: 0 auto;
  padding: clamp(32px, 4.2vw, 64px);
}

.login-status {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 9px;
  color: var(--v-text-sub);
  font-size: 12px;
  font-weight: var(--v-weight-semibold);
}

.login-status-icon {
  width: 26px;
  height: 26px;
  display: grid;
  border: 1px solid color-mix(in srgb, var(--v-primary) 18%, var(--v-border));
  border-radius: var(--v-radius-sm);
  color: var(--v-primary-strong);
  background: color-mix(in srgb, var(--v-primary) 7%, var(--v-surface));
  place-items: center;
}

.login-heading {
  margin-top: 30px;
}

.login-heading p {
  margin-bottom: 9px;
  color: var(--v-text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.login-heading h2 {
  color: var(--v-text-title);
  font-size: 26px;
  font-weight: 760;
  letter-spacing: -0.04em;
  line-height: 1.2;
}

.login-heading > span {
  display: block;
  margin-top: 11px;
  color: var(--v-text-weak);
  font-size: 14px;
  line-height: 1.7;
}

.login-form {
  margin-top: 30px;
}

/* 登录页的输入框比后台内部更高更圆，是刻意的：这一屏只有两个字段，密度要低。 */
.login-form :deep(.vui-input) {
  min-height: 52px;
  border-color: var(--v-login-field-border);
  border-radius: var(--v-radius-ctl);
  background: var(--v-login-field-bg);
  transition:
    border-color 0.2s var(--v-ease),
    background-color 0.2s var(--v-ease),
    box-shadow 0.2s var(--v-ease),
    transform 0.2s var(--v-ease);
}

.login-form :deep(.vui-input:hover) {
  border-color: var(--v-login-field-border-hover);
  background: var(--v-surface);
}

.login-form :deep(.vui-input:focus-within) {
  border-color: var(--v-primary);
  background: var(--v-surface);
  box-shadow: 0 0 0 4px var(--v-login-focus-ring);
  transform: translateY(-1px);
}

.login-form :deep(.vui-input-native) {
  height: 50px;
  font-size: 14px;
}

.login-form :deep(.vui-input-prefix) {
  color: var(--v-text-weak);
}

.login-submit {
  width: 100%;
  height: 52px;
  margin-top: 6px;
  border-radius: var(--v-radius-ctl);
  font-size: 14px;
  font-weight: var(--v-weight-semibold);
  letter-spacing: 0.35em;
  text-indent: 0.35em;
  box-shadow: var(--v-shadow-btn);
}

.login-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 22px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--v-primary) 12%, var(--v-border));
  border-radius: var(--v-radius-sm);
  color: var(--v-text-sub);
  background: var(--v-info-soft);
  font-size: var(--v-font-xs);
  line-height: 1.6;
}

/* ---------- 窄屏：主视觉让位，只留表单 ---------- */
@media (max-width: 1040px) {
  .login-shell {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    min-height: 0;
  }

  .login-visual {
    border-right: 0;
    border-bottom: 1px solid var(--v-login-divider);
  }

  .login-orbits {
    display: none;
  }

  .login-visual-note {
    margin-top: 26px;
  }
}
</style>
