<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface BreadcrumbItem {
  title: string
  path?: string
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const matched = route.matched.filter((item) => item.meta?.title)
  const items: BreadcrumbItem[] = []

  matched.forEach((item) => {
    items.push({
      title: item.meta.title as string,
      path: item.redirect ? undefined : item.path,
    })
  })

  return items
})

const handleClick = (item: BreadcrumbItem) => {
  if (item.path) {
    router.push(item.path)
  }
}
</script>

<template>
  <nav class="breadcrumb">
    <span v-for="(item, index) in breadcrumbs" :key="index" class="breadcrumb-item">
      <span v-if="index > 0" class="separator">/</span>
      <span :class="{ link: item.path }" @click="handleClick(item)">
        {{ item.title }}
      </span>
    </span>
  </nav>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #666;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.separator {
  margin: 0 8px;
  color: #ddd;
}

.link {
  cursor: pointer;
  color: #333;
}

.link:hover {
  color: var(--v-primary);
}
</style>
