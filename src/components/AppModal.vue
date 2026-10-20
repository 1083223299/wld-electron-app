<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '460px' },
});
const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal-box" :style="{ width }">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-title-dot"></span>
            <strong>{{ title }}</strong>
          </div>
          <button class="btn btn-link" @click="close" aria-label="关闭">✕</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--el-mask-color, rgba(15, 23, 42, 0.52));
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  background: var(--bg-panel);
  border-radius: 18px;
  max-width: 90vw;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-toolbar);
}
.modal-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.modal-title-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-hover), var(--primary));
  box-shadow: 0 0 0 4px var(--primary-ring);
}
.modal-header strong {
  font-size: 18px;
  color: var(--text-main);
}
.btn-link {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s ease;
}
.btn-link:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}
.modal-body {
  padding: 20px 20px 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg-toolbar);
}
</style>
