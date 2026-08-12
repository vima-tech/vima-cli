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
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>{{projectName}}</h1>
        <p>企业级后台管理系统</p>
      </div>
      <VForm ref="formRef" :model="form" :rules="rules" class="login-form">
        <VFormItem label="用户名" prop="username">
          <VInput v-model="form.username" placeholder="请输入用户名" size="large" prefix-icon="👤" />
        </VFormItem>
        <VFormItem label="密码" prop="password">
          <VInput v-model="form.password" type="password" placeholder="请输入密码" size="large" prefix-icon="🔒" @keyup.enter="handleLogin" />
        </VFormItem>
        <VButton type="primary" size="large" block :loading="loading" @click="handleLogin">
          登录
        </VButton>
      </VForm>
      <div class="login-footer">
        <p>默认账号: admin / admin123</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  color: #333;
  margin-bottom: 8px;
}

.login-header p {
  color: #999;
  font-size: 14px;
}

.login-form {
  margin-bottom: 24px;
}

.login-footer {
  text-align: center;
  color: #999;
  font-size: 12px;
}
</style>
