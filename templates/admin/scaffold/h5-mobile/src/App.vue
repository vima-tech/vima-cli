<script setup lang="ts">
/**
 * 应用根。只做三件事：路由出口、全局反馈组件挂载、适老化根类。
 * 业务不要写在这里——它是每个页面都会经过的地方，写什么都会变成全局副作用。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { aging } from '@/utils/prefs'

const route = useRoute()
const router = useRouter()

/** tab 页与 spec 该端的 vima:menus 一一对应（mobile 的「菜单」= tabbar，3–5 项） */
const tabs = [
  { key: 'home', text: '首页' },
  { key: 'mine', text: '我的' },
]
const showTabbar = computed(() => tabs.some((t) => t.key === route.name))
</script>

<template>
  <div class="vm-page" :class="{ 'vm-aging': aging }">
    <router-view />
    <VmTabbar v-if="showTabbar" :items="tabs" :active="String(route.name ?? '')"
              @change="(k: string) => router.replace({ name: k })" />
    <VmToast />
    <VmDialog />
  </div>
</template>
