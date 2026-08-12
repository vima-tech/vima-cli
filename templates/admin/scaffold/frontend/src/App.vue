<script setup lang="ts">
</script>

<template>
  <router-view />
</template>

<!--
  这里不要再写全局样式。reset 与 html/body/#app 的高度只有一份，在 src/style.css，
  由 main.ts 引入。两处都写的话，改了一处没改另一处就会出现「本地看着对、构建后不对」
  这类只能靠对比才能发现的问题。
-->
