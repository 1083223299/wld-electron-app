<script setup>
import AppModal from './AppModal.vue';
import { confirmState } from '../composables/useConfirm';

function done(val) {
  confirmState.visible = false;
  confirmState._resolve?.(val);
  confirmState._resolve = null;
}
</script>

<template>
  <AppModal
    :model-value="confirmState.visible"
    :title="confirmState.title"
    width="380px"
    @update:model-value="done(false)"
  >
    <p>{{ confirmState.message }}</p>
    <template #footer>
      <button class="btn btn-plain" @click="done(false)">取消</button>
      <button class="btn btn-primary" @click="done(true)">{{ confirmState.okText }}</button>
    </template>
  </AppModal>
</template>
