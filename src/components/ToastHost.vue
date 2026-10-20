<script setup>
import { toasts } from '../composables/useToast';
</script>

<template>
  <Teleport to="body">
    <div class="toast-host">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-${t.type}`"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.toast-item {
  padding: 9px 18px;
  border-radius: 6px;
  font-size: 13px;
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.toast-success { background: #22c55e; }
.toast-error { background: #ef4444; }
.toast-warning { background: #f59e0b; }
.toast-info { background: #4f8cff; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateY(-8px); }
.toast-enter-active,
.toast-leave-active { transition: all 0.2s; }
</style>
