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
            默认账号 admin / admin123，首次登录后请立即修改密码。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
 * 登录页有四个只在本页出现的浅色调（页底、输入框描边/底色/hover 描边）。
 * 它们不进 tokens.css：令牌是全站契约，只为一个页面加四个全局变量，
 * 下一个人就分不清哪些是真通用的。集中声明在这里，本页要调色只改这四行。
 */
.login-page {
  --login-canvas: #edf5fb;
  --login-field-border: #d3e1ec;
  --login-field-bg: #f9fbfd;
  --login-field-border-hover: #9cbcd3;
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(24px, 4vw, 52px);
  overflow: hidden;
  color: var(--v-text-body);
  /* 登录页不走全局的页底纹：这里要更亮、带网格，与进入后台后的深色顶栏形成落差 */
  background:
    linear-gradient(rgba(76, 135, 184, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(76, 135, 184, 0.045) 1px, transparent 1px),
    radial-gradient(circle at 12% 12%, rgba(124, 190, 223, 0.2), transparent 30%),
    radial-gradient(circle at 88% 88%, rgba(80, 139, 188, 0.14), transparent 32%),
    var(--login-canvas);
  background-size: 32px 32px, 32px 32px, auto, auto, auto;
  place-items: center;
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.7), transparent 32%),
    radial-gradient(circle at 50% 50%, transparent 48%, rgba(45, 100, 142, 0.05) 100%);
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
  border: 1px solid rgba(77, 143, 194, 0.18);
  box-shadow: 0 0 0 70px rgba(103, 169, 211, 0.035), 0 0 0 140px rgba(103, 169, 211, 0.025);
}

.login-glow--bottom {
  bottom: -28vw;
  left: -8vw;
  border: 1px solid rgba(77, 143, 194, 0.15);
  box-shadow: 0 0 0 70px rgba(103, 169, 211, 0.03), 0 0 0 140px rgba(103, 169, 211, 0.02);
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
  border: 1px solid rgba(179, 205, 225, 0.72);
  border-radius: 28px;
  background: rgba(250, 253, 255, 0.92);
  box-shadow:
    0 34px 80px -42px rgba(32, 78, 115, 0.45),
    0 2px 8px rgba(45, 91, 126, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

/* ---------- 左半区 ---------- */
.login-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: clamp(30px, 3.2vw, 48px);
  overflow: hidden;
  border-right: 1px solid rgba(184, 208, 226, 0.58);
  background:
    radial-gradient(circle at 53% 62%, rgba(255, 255, 255, 0.96) 0 18%, transparent 52%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(226, 240, 250, 0.86));
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
  border-radius: 14px;
  color: var(--v-on-dark);
  background: var(--v-brand-grad);
  box-shadow: 0 12px 24px -14px rgba(42, 105, 157, 0.72);
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
  border-radius: 2px;
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
  background: radial-gradient(circle, rgba(255, 255, 255, 0.72), transparent 70%);
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
  background: rgba(255, 255, 255, 0.9);
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
  border-radius: 8px;
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
  border-color: var(--login-field-border);
  border-radius: 12px;
  background: var(--login-field-bg);
  transition:
    border-color 0.2s var(--v-ease),
    background-color 0.2s var(--v-ease),
    box-shadow 0.2s var(--v-ease),
    transform 0.2s var(--v-ease);
}

.login-form :deep(.vui-input:hover) {
  border-color: var(--login-field-border-hover);
  background: var(--v-surface);
}

.login-form :deep(.vui-input:focus-within) {
  border-color: var(--v-primary);
  background: var(--v-surface);
  box-shadow: 0 0 0 4px rgba(67, 136, 199, 0.12);
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
  border-radius: 12px;
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
    border-bottom: 1px solid rgba(184, 208, 226, 0.58);
  }

  .login-orbits {
    display: none;
  }

  .login-visual-note {
    margin-top: 26px;
  }
}
</style>
