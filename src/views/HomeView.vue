<script setup>
const welcomeImage = new URL('../assets/images/welcomeImage_clean.png', import.meta.url).href;
</script>

<template>
  <div class="dashboard-container">
    <div class="dashboard-hero">
      <img :src="welcomeImage" alt="欢迎图片" class="dashboard-img" />
      <!-- 主题染色层：跟随换肤协调插画色调 -->
      <div class="hero-veil" aria-hidden="true"></div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  /* 铺满 .app-main 整个右侧内容区（含 20px 内边距区域），真正满屏 */
  position: absolute;
  inset: 0;
}

.dashboard-hero {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.dashboard-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 主题染色层：亮色主题轻染色，暗色主题压暗融入 */
.hero-veil {
  position: absolute;
  inset: 0;
  background: var(--hero-tint);
  transition: background 0.35s ease;
  pointer-events: none;
}
</style>
