<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/store/app'

const HOME_PATH = '/dashboard'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
// 页签清单存在 store 里：切换 tabPlacement 会让本组件换位置重建，状态不能留在组件内（见 store/app.ts）
const { tabs, activeTab } = storeToRefs(appStore)

// 首页标签常驻且不可关，但 tabs 只靠访问累积——刷新后数组重建为空，
// 若当前路由不是首页就补不回来。故每次都从路由表兜底补一枚，且固定排在首位。
const ensureHomeTab = () => {
  if (tabs.value.some((t) => t.path === HOME_PATH)) return

  const home = router.resolve(HOME_PATH)
  const title = home.meta?.title as string
  if (!title) return

  tabs.value.unshift({ path: HOME_PATH, title, name: home.name as string })
}

const addTab = () => {
  ensureHomeTab()

  const path = route.path
  const title = route.meta?.title as string
  const name = route.name as string

  if (!title || route.meta?.hidden) return

  const exists = tabs.value.find((t) => t.path === path)
  if (!exists) {
    tabs.value.push({ path, title, name })
  }
  activeTab.value = path
}

const handleTabClick = (path: string) => {
  router.push(path)
}

const handleTabClose = (path: string) => {
  const index = tabs.value.findIndex((t) => t.path === path)
  if (index === -1) return

  tabs.value.splice(index, 1)

  if (path === activeTab.value) {
    const nextTab = tabs.value[index] || tabs.value[index - 1]
    if (nextTab) {
      router.push(nextTab.path)
    } else {
      router.push(HOME_PATH)
    }
  }
}

const handleCloseOther = () => {
  tabs.value = tabs.value.filter((t) => t.path === activeTab.value || t.path === HOME_PATH)
}

const handleCloseAll = () => {
  tabs.value = tabs.value.filter((t) => t.path === HOME_PATH)
  router.push(HOME_PATH)
}

// 首页标签不可关，因此「有没有可关的东西」= 除首页外还剩几个
const closableCount = computed(() => tabs.value.filter((t) => t.path !== HOME_PATH).length)
const canCloseCurrent = computed(() => activeTab.value !== HOME_PATH && closableCount.value > 0)
const canCloseOther = computed(
  () => tabs.value.filter((t) => t.path !== activeTab.value && t.path !== HOME_PATH).length > 0
)

const handleCloseCurrent = () => handleTabClose(activeTab.value)

watch(route, addTab, { immediate: true })

/*
 * 页签条可视宽度有限（内嵌顶栏时窄屏仅 500-600px），开多了激活页签会滚出视野。
 * 等 nextTick：新页签是本轮 watch 里刚 push 的，当帧还没渲染出来。
 * inline/block 都取 nearest：已可见时完全不动，也不会把整页竖向拽走。
 */
const stripEl = ref<HTMLElement | null>(null)
const scrollActiveTabIntoView = async (behavior: ScrollBehavior) => {
  await nextTick()
  stripEl.value
    ?.querySelector('.v-workspace-tab.is-active')
    ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior })
}
watch(activeTab, () => scrollActiveTabIntoView('smooth'))
onMounted(() => scrollActiveTabIntoView('auto'))

/*
 * 滚轮横向翻页签：页签条只有一行且不换行，鼠标（只有 deltaY）在这里本来什么都做不了。
 * 取 |deltaY| 与 |deltaX| 里大的那个，触控板横向滑动照常走原生路径。
 *
 * 只在真的能滚时才 preventDefault：页签没溢出、或已经贴到两端还继续往同方向滚时放行，
 * 让事件冒泡回页面，否则鼠标停在页签条上会把整页滚动也一起吞掉。
 * 绑定别加 .passive 修饰符——那会让 preventDefault 失效（元素级 wheel 监听器本来就不是
 * passive，浏览器只对 window/document/body 上的 wheel 默认 passive）。
 */
const handleWheel = (e: WheelEvent) => {
  const el = stripEl.value
  if (!el) return

  const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
  if (!delta) return

  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  // 到头了还往外滚 → 不拦截，交还给页面
  if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max - 1)) return

  e.preventDefault()
  el.scrollLeft += delta
}
</script>

<template>
  <!--
    工作区页签。两种摆放由「个人设置」切换（appStore.tabPlacement）：
      is-embedded —— 内嵌深蓝顶栏中段，全站单条横条，最省首屏高度（默认）
      is-standalone —— 顶栏下方独立一条，页签可用宽度更大
    根元素是 div 不是 header：内嵌时它在 VHeader 渲染的 <header> 里面。
    两套配色都在 src/styles/shell.css（内嵌走 --v-on-dark-*，独立条走浅底）。
  -->
  <div class="v-workspace-bar" :class="`is-${appStore.tabPlacement === 'bar' ? 'standalone' : 'embedded'}`">
    <div
      ref="stripEl"
      class="v-tab-strip"
      role="tablist"
      aria-label="已打开页面"
      @wheel="handleWheel"
    >
      <div v-if="tabs.length === 0" class="v-tab-placeholder">
        <span class="v-tab-placeholder-icon" aria-hidden="true"><VIcon name="home" size="15" /></span>
        <span>工作台</span>
      </div>
      <div
        v-for="tab in tabs"
        :key="tab.path"
        role="tab"
        tabindex="0"
        class="v-workspace-tab"
        :class="{ 'is-active': activeTab === tab.path }"
        :aria-selected="activeTab === tab.path"
        :title="tab.title"
        @click="handleTabClick(tab.path)"
        @keydown.enter="handleTabClick(tab.path)"
        @keydown.space.prevent="handleTabClick(tab.path)"
      >
        <span class="v-workspace-tab-mark" aria-hidden="true"></span>
        <span class="v-workspace-tab-title">{{ tab.title }}</span>
        <button
          v-if="tab.path !== HOME_PATH"
          type="button"
          class="v-workspace-tab-close"
          aria-label="关闭页面"
          @click.stop="handleTabClose(tab.path)"
        >
          ×
        </button>
      </div>
    </div>

    <div class="v-workspace-meta">
      <span class="v-workspace-meta-count">{{ tabs.length }}</span>
      <span>已打开</span>
    </div>

    <div class="v-workspace-batch">
      <VDropdown placement="bottom-end">
        <!-- 菜单必须放 #content 插槽：写成 #dropdown 不会报错，只是永远不显示 -->
        <button
          type="button"
          class="v-workspace-batch-trigger"
          :disabled="closableCount === 0"
          aria-label="批量关闭标签页"
        >
          <span>批量关闭</span>
          <VIcon name="chevron-down" size="12" />
        </button>
        <template #content>
          <VDropdownMenu>
            <VDropdownMenuItem :disabled="!canCloseCurrent" @click="handleCloseCurrent">
              关闭当前
            </VDropdownMenuItem>
            <VDropdownMenuItem :disabled="!canCloseOther" @click="handleCloseOther">
              关闭其他
            </VDropdownMenuItem>
            <VDropdownMenuItem :disabled="closableCount === 0" @click="handleCloseAll">
              关闭全部
            </VDropdownMenuItem>
          </VDropdownMenu>
        </template>
      </VDropdown>
    </div>
  </div>
</template>
