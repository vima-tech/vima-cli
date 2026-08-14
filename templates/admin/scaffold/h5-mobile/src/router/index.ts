import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 路由表。
 * 业务页由任务生成并在这里登记；`name` 与 tabbar 的 key、spec 的菜单声明保持一致，
 * 否则底部导航高亮不了（三处不一致是移动端最常见的低级 bug）。
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home', component: () => import('@/views/Home.vue') },
  { path: '/mine', name: 'mine', component: () => import('@/views/Mine.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
