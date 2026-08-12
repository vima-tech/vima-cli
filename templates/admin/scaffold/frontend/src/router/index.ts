import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '仪表盘', icon: '📊' },
        },
        {
          path: 'system',
          name: 'System',
          redirect: '/system/user',
          meta: { title: '系统管理', icon: '⚙️' },
          children: [
            {
              path: 'user',
              name: 'User',
              component: () => import('@/views/system/user/index.vue'),
              meta: { title: '用户管理', icon: '👤' },
            },
            {
              path: 'role',
              name: 'Role',
              component: () => import('@/views/system/role/index.vue'),
              meta: { title: '角色管理', icon: '🔑' },
            },
            {
              path: 'menu',
              name: 'Menu',
              component: () => import('@/views/system/menu/index.vue'),
              meta: { title: '菜单管理', icon: '📋' },
            },
            {
              path: 'dept',
              name: 'Dept',
              component: () => import('@/views/system/dept/index.vue'),
              meta: { title: '部门管理', icon: '🏢' },
            },
            {
              path: 'dict',
              name: 'Dict',
              component: () => import('@/views/system/dict/index.vue'),
              meta: { title: '字典管理', icon: '📖' },
            },
            {
              path: 'config',
              name: 'Config',
              component: () => import('@/views/system/config/index.vue'),
              meta: { title: '系统配置', icon: '⚙️' },
            },
            {
              path: 'file',
              name: 'File',
              component: () => import('@/views/system/file/index.vue'),
              meta: { title: '文件管理', icon: '📁' },
            },
            {
              path: 'log/oper',
              name: 'OperLog',
              component: () => import('@/views/system/log/oper.vue'),
              meta: { title: '操作日志', icon: '📝' },
            },
            {
              path: 'log/login',
              name: 'LoginLog',
              component: () => import('@/views/system/log/login.vue'),
              meta: { title: '登录日志', icon: '📝' },
            },
          ],
        },
        {
          path: 'monitor',
          name: 'Monitor',
          redirect: '/monitor/online',
          meta: { title: '系统监控', icon: '📡' },
          children: [
            {
              path: 'online',
              name: 'OnlineUser',
              component: () => import('@/views/monitor/online/index.vue'),
              meta: { title: '在线用户', icon: '🟢' },
            },
            {
              path: 'job',
              name: 'Job',
              component: () => import('@/views/monitor/job/index.vue'),
              meta: { title: '定时任务', icon: '⏰' },
            },
          ],
        },
        {
          path: 'message',
          name: 'Message',
          component: () => import('@/views/message/index.vue'),
          meta: { title: '消息中心', icon: '🔔' },
        },
        {
          path: 'profile',
          name: 'Profile',
          component: () => import('@/views/profile/index.vue'),
          meta: { title: '个人中心', icon: '👤', hidden: true },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/error/404.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.public) {
    next()
    return
  }

  if (!userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (!userStore.userInfo) {
    try {
      await userStore.fetchUserInfo()
      next({ ...to, replace: true })
    } catch {
      userStore.resetState()
      next({ path: '/login', query: { redirect: to.fullPath } })
    }
    return
  }

  next()
})

export default router
