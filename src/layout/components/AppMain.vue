<template>
  <main class="app-main">
    <router-view v-slot="{ Component, route }">
      <!-- 修复：快速连续切换菜单（异步组件加载中又点下一个）时，
           out-in 过渡会让 router-view 卡死在空状态，之后所有导航都空白；
           去掉 mode 后新旧组件并行过渡，不再出现永久空白。 -->
      <transition name="page-fade">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
  </main>
</template>

<style scoped>
.app-main {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: var(--bg-page);
  padding: 20px;
}

/* 页面切换过渡：淡入 + 从下方轻微上移 */
.page-fade-enter-active {
  transition: opacity 0.22s ease-out, transform 0.22s ease-out;
}
.page-fade-leave-active {
  transition: opacity 0.12s ease-in, transform 0.12s ease-in;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
