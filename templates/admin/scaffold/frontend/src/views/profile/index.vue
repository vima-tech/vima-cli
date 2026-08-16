<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
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

/*
 * 展示项取自登录时缓存的 user-info（见 store/user.ts）。这里只读不改：
 * 后端没有「用户自助改资料」的接口，改资料统一走用户管理，页面里说明这一点即可，
 * 不摆一个点了没反应的编辑按钮。
 */
const infoItems = computed(() => [
  { label: '用户名', value: userStore.username },
  { label: '姓名', value: userStore.realName },
  { label: '角色', value: (userStore.roles as string[]).join('、') },
  { label: '邮箱', value: userStore.userInfo?.email },
  { label: '手机', value: userStore.userInfo?.phone },
])

const initial = computed(() => (userStore.realName || userStore.username || '?').slice(0, 1))

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
          <div class="info-head">
            <span class="info-avatar" aria-hidden="true">{{ initial }}</span>
            <div class="info-head-copy">
              <strong>{{ userStore.realName || userStore.username }}</strong>
              <small>{{ userStore.username }}</small>
            </div>
          </div>

          <dl class="info-grid">
            <div v-for="item in infoItems" :key="item.label" class="info-item">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value || '-' }}</dd>
            </div>
          </dl>

          <p class="info-hint">
            <VIcon name="info" size="13" />
            资料由管理员在「用户管理」中维护；密码可在右侧「修改密码」页签自行更改。
          </p>
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
  max-width: 720px;
}

.info-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--v-border);
}

.info-avatar {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: var(--v-radius-card);
  color: var(--v-on-dark);
  background: var(--v-brand-grad);
  box-shadow: var(--v-shadow-btn);
  font-size: 18px;
  font-weight: var(--v-weight-bold);
}

.info-head-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-head-copy strong {
  color: var(--v-text-title);
  font-size: 17px;
}

.info-head-copy small {
  color: var(--v-text-weak);
  font-size: var(--v-font-small);
}

/* 两列描述列表：三行信息在一张 700px 的卡里排成一列时，右边和下边都是空的 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--v-gap-md) var(--v-gap-xl);
  margin-top: 20px;
}

.info-item {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: baseline;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-ctl);
  background: var(--v-bg-soft);
  font-size: var(--v-font-body);
}

.info-item dt {
  color: var(--v-text-weak);
}

.info-item dd {
  margin: 0;
  color: var(--v-text-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  color: var(--v-text-weak);
  font-size: var(--v-font-small);
}

.password-section {
  padding-top: 16px;
}
</style>
