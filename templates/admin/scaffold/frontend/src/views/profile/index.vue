<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { changePassword } from '@/api/auth'
import { toastError, toastSuccess } from '@/utils/feedback'

const route = useRoute()
const userStore = useUserStore()
const activeTab = ref(route.query.tab === 'password' ? 'password' : 'info')

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

const handleChangePassword = async () => {
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    toastSuccess('密码修改成功，请重新登录')
    userStore.logout()
  } catch (error: any) {
    toastError(error.message || '密码修改失败')
  }
}

const handleResetPassword = () => {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}
</script>

<template>
  <div class="vui-page">
    <VCard title="个人中心">
      <VTab v-model="activeTab">
        <VTabItem id="info" title="基本信息"></VTabItem>
        <VTabItem id="password" title="修改密码"></VTabItem>
      </VTab>

      <div class="tab-content">
        <div v-if="activeTab === 'info'" class="info-section">
          <div class="info-item">
            <span class="label">用户名:</span>
            <span class="value">{{ userStore.username }}</span>
          </div>
          <div class="info-item">
            <span class="label">姓名:</span>
            <span class="value">{{ userStore.realName }}</span>
          </div>
          <div class="info-item">
            <span class="label">角色:</span>
            <span class="value">{{ userStore.roles.join(', ') }}</span>
          </div>
        </div>

        <div v-if="activeTab === 'password'" class="password-section">
          <VForm :model="passwordForm" :rules="passwordRules" label-width="100px" style="max-width: 500px">
            <VFormItem label="旧密码" prop="oldPassword">
              <VInput v-model="passwordForm.oldPassword" type="password" placeholder="请输入旧密码" />
            </VFormItem>
            <VFormItem label="新密码" prop="newPassword">
              <VInput v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" />
            </VFormItem>
            <VFormItem label="确认密码" prop="confirmPassword">
              <VInput v-model="passwordForm.confirmPassword" type="password" placeholder="请确认新密码" />
            </VFormItem>
            <VFormItem>
              <VButton type="primary" @click="handleChangePassword">修改密码</VButton>
              <VButton @click="handleResetPassword">重置</VButton>
            </VFormItem>
          </VForm>
        </div>
      </div>
    </VCard>
  </div>
</template>

<style scoped>
.tab-content {
  padding: 24px 0;
}

.info-section {
  max-width: 500px;
}

.info-item {
  display: flex;
  margin-bottom: 16px;
  font-size: 14px;
}

.info-item .label {
  width: 80px;
  color: #999;
}

.info-item .value {
  color: #333;
}

.password-section {
  padding-top: 16px;
}
</style>
