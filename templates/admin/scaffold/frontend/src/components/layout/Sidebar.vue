<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { isPresetIcon } from '@/utils/menuIcons'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()

interface MenuItem {
  path: string
  title: string
  /**
   * 兜底图标名。真正显示哪个由 iconOf() 决定：后端「菜单管理」里配了就用配的，
   * 没配（或配了个不在预设集里的历史值）才回落到这里。
   * 取值范围见 utils/menuIcons.ts，都是组件库内置注册表里的 24×24 描边图标。
   */
  icon: string
  /** 菜单项副标题。侧栏是两行式的，只有标题会显得空且分不清同名功能 */
  desc?: string
  /** 后端菜单 path：渲染时按 store.menuPaths 过滤的依据；不填 = 登录即可见（非 RBAC 管控页） */
  requiredMenuPath?: string
  children?: MenuItem[]
}

const menuList: MenuItem[] = [
  { path: '/dashboard', title: '仪表盘', icon: 'chart-bar', desc: '总览与快捷入口' },
  {
    path: '/system',
    title: '系统管理',
    icon: 'settings',
    requiredMenuPath: '/system',
    children: [
      { path: '/system/user', title: '用户管理', icon: 'users', desc: '账号与授权', requiredMenuPath: '/system/user' },
      { path: '/system/role', title: '角色管理', icon: 'shield-check', desc: '权限集合', requiredMenuPath: '/system/role' },
      { path: '/system/menu', title: '菜单管理', icon: 'list', desc: '导航与按钮权限', requiredMenuPath: '/system/menu' },
      { path: '/system/dept', title: '部门管理', icon: 'building', desc: '组织架构', requiredMenuPath: '/system/dept' },
      { path: '/system/dict', title: '字典管理', icon: 'file-text', desc: '枚举值维护', requiredMenuPath: '/system/dict' },
      { path: '/system/config', title: '系统配置', icon: 'settings', desc: '运行参数', requiredMenuPath: '/system/config' },
      { path: '/system/file', title: '文件管理', icon: 'folder', desc: '上传件归档', requiredMenuPath: '/system/file' },
      { path: '/system/log/oper', title: '操作日志', icon: 'edit', desc: '变更留痕', requiredMenuPath: '/system/log/oper' },
      { path: '/system/log/login', title: '登录日志', icon: 'log-in', desc: '登录审计', requiredMenuPath: '/system/log/login' },
    ],
  },
  {
    path: '/monitor',
    title: '系统监控',
    icon: 'monitor',
    requiredMenuPath: '/monitor',
    children: [
      { path: '/monitor/online', title: '在线用户', icon: 'user', desc: '会话与强退', requiredMenuPath: '/monitor/online' },
      { path: '/monitor/job', title: '定时任务', icon: 'clock', desc: '调度与执行记录', requiredMenuPath: '/monitor/job' },
    ],
  },
  { path: '/message', title: '消息中心', icon: 'bell', desc: '站内通知' },
]

// admin（perms 含 "*"）全显；未声明 requiredMenuPath 的基础页登录即可见；其余按后端下发的 menuPaths 过滤
const canShow = (item: MenuItem) =>
  !item.requiredMenuPath || userStore.hasPerm('*') || userStore.menuPaths.includes(item.requiredMenuPath)

const visibleMenus = computed<MenuItem[]>(() =>
  menuList
    .map((item) => {
      if (!item.children) return canShow(item) ? item : null
      const children = item.children.filter(canShow)
      // 分组按「有无可见子项」决定显隐，避免出现空分组标题
      return children.length ? { ...item, children } : null
    })
    .filter((item): item is MenuItem => item !== null)
)

const singles = computed(() => visibleMenus.value.filter((item) => !item.children))
const groups = computed(() => visibleMenus.value.filter((item) => item.children))
/** 抬头右侧的计数是「可访问的页面数」，不是分组数——分组本身不可点 */
const leafCount = computed(
  () => singles.value.length + groups.value.reduce((n, g) => n + (g.children?.length ?? 0), 0)
)

const openGroups = ref<string[]>([])
const isOpen = (path: string) => openGroups.value.includes(path)
const toggleGroup = (path: string) => {
  const i = openGroups.value.indexOf(path)
  if (i === -1) openGroups.value.push(path)
  else openGroups.value.splice(i, 1)
}

/*
 * 默认全部收起，只展开「当前路由所在的分组」。
 * 只在分组集合变化（登录后菜单下发、切换账号）时重置，用户手动开合的分组不会被路由跳转弹回来。
 */
watch(
  groups,
  (list) => {
    const owner = list.find((g) => g.children?.some((c) => c.path === route.path))
    openGroups.value = owner ? [owner.path] : []
  },
  { immediate: true }
)

watch(
  () => route.path,
  (path) => {
    const owner = groups.value.find((g) => g.children?.some((c) => c.path === path))
    if (owner && !isOpen(owner.path)) openGroups.value.push(owner.path)
  },
  { immediate: true }
)

const activeMenu = computed(() => route.path)

/*
 * 点顶部标签条切页时菜单只换了高亮，激活项可能停留在滚动区外。
 * 必须等 nextTick：所在分组是本轮 watch 里刚展开的（v-show），当帧里 .is-active 还没渲染出来。
 * block:'nearest' 保证已在可视区内时完全不动，不会每次切页都把菜单顶到边上。
 */
const menuScrollEl = ref<HTMLElement | null>(null)
const scrollActiveIntoView = async (behavior: ScrollBehavior) => {
  await nextTick()
  menuScrollEl.value
    ?.querySelector('.v-nav-item.is-active')
    ?.scrollIntoView({ block: 'nearest', behavior })
}
watch(
  () => route.path,
  () => scrollActiveIntoView('smooth')
)
onMounted(() => scrollActiveIntoView('auto'))

/*
 * 图标取值优先级：后端菜单配置 > 本文件的兜底值。
 * 必须过 isPresetIcon：数据库里可能留着老数据（早期种子存的是 emoji），
 * 直接丢给 VIcon 查不到图形，渲染出来是个空的彩色方块——没有报错，只是"图标没了"。
 */
const iconOf = (item: MenuItem) => {
  const configured = userStore.menuIcons[item.path]
  return isPresetIcon(configured) ? configured : item.icon
}
const handleMenuClick = (item: MenuItem) => {
  router.push(item.path)
}
</script>

<template>
  <!--
    宽度走 class 而不是 props：VSide 只是个语义标签，没有 collapsed / width 属性，
    传进去只会原样落成 <aside collapsed width> 这样的无效 HTML 属性，不产生任何效果。
    样式在 src/styles/shell.css，与顶栏、标签条同一份，不在这里写 <style>。
  -->
  <VSide class="v-side" :class="{ 'is-collapsed': appStore.sidebarCollapsed }">
    <div class="v-side-heading">
      <!-- 图标不放项目缩写：英文缩写对使用者无语义，且顶栏品牌区已有完整项目名 -->
      <span class="v-side-heading-mark" aria-hidden="true"><VIcon name="layout" size="18" /></span>
      <span class="v-side-heading-copy">
        <strong>业务导航</strong>
        <small>WORKSPACE</small>
      </span>
      <span class="v-side-heading-count">{{ leafCount }}</span>
    </div>

    <nav ref="menuScrollEl" class="v-menu-scroll" aria-label="系统业务导航">
      <!-- 无子项的顶层入口：不套分组外壳，直接就是一个导航项 -->
      <button
        v-for="item in singles"
        :key="item.path"
        type="button"
        class="v-nav-item"
        :class="{ 'is-active': activeMenu === item.path }"
        :title="item.title"
        :aria-current="activeMenu === item.path ? 'page' : undefined"
        @click="handleMenuClick(item)"
      >
        <span class="v-nav-icon" aria-hidden="true"><VIcon :name="iconOf(item)" size="18" /></span>
        <span class="v-nav-copy">
          <strong>{{ item.title }}</strong>
          <small>{{ item.desc }}</small>
        </span>
        <span class="v-nav-arrow" aria-hidden="true"><VIcon name="chevron-right" size="12" /></span>
      </button>

      <section
        v-for="group in groups"
        :key="group.path"
        class="v-menu-group"
        :class="{ 'is-open': isOpen(group.path) }"
      >
        <button
          type="button"
          class="v-menu-group-trigger"
          :aria-expanded="isOpen(group.path)"
          @click="toggleGroup(group.path)"
        >
          <span class="v-menu-group-icon" aria-hidden="true"><VIcon :name="iconOf(group)" size="18" /></span>
          <span class="v-menu-group-name">{{ group.title }}</span>
          <span class="v-menu-group-meta">{{ group.children?.length }}</span>
          <span class="v-menu-chevron" aria-hidden="true"><VIcon name="chevron-down" size="12" /></span>
        </button>
        <!--
          开合不用 v-show：display 跳变做不了高度动画。子项常驻 DOM，
          显隐由 shell.css 按 .v-menu-group.is-open / .v-side.is-collapsed 用
          grid-template-rows 0fr→1fr 过渡（内层 .v-menu-items-inner 负责裁切，
          收起时 visibility 让子项退出键盘焦点与无障碍树）。
          折叠侧栏时分组标题压成分隔线，无视开合状态、始终亮出图标列。
        -->
        <div class="v-menu-items">
          <div class="v-menu-items-inner">
            <button
              v-for="child in group.children"
              :key="child.path"
              type="button"
              class="v-nav-item"
              :class="{ 'is-active': activeMenu === child.path }"
              :title="child.title"
              :aria-current="activeMenu === child.path ? 'page' : undefined"
              @click="handleMenuClick(child)"
            >
              <span class="v-nav-icon" aria-hidden="true"><VIcon :name="iconOf(child)" size="18" /></span>
              <span class="v-nav-copy">
                <strong>{{ child.title }}</strong>
                <small>{{ child.desc }}</small>
              </span>
              <span class="v-nav-arrow" aria-hidden="true"><VIcon name="chevron-right" size="12" /></span>
            </button>
          </div>
        </div>
      </section>
    </nav>

    <!--
      折叠开关放页脚而不是顶栏：它操作的是侧栏自己，就近原则；顶栏空间留给页签。
      折叠态下运行状态（绿点+文字）整体淡出并收零宽，开关剩成页脚唯一内容、落在侧栏中线。
    -->
    <div class="v-side-footer">
      <span><i></i><span>系统运行正常</span></span>
      <button
        type="button"
        class="v-side-collapse"
        :aria-label="appStore.sidebarCollapsed ? '展开侧边导航' : '收起侧边导航'"
        :title="appStore.sidebarCollapsed ? '展开侧边导航' : '收起侧边导航'"
        @click="appStore.toggleSidebar"
      >
        <VIcon :name="appStore.sidebarCollapsed ? 'chevron-right' : 'chevron-left'" size="14" />
      </button>
    </div>
  </VSide>
</template>
