<script setup>
/**
 * 通用金额网格：一组「名称 + 金额输入 + 单位」。
 * items: [{ key, label, unit }]；v-model:value 对象 { key: amount }
 */
const props = defineProps({
  items: { type: Array, default: () => [] },
  value: { type: Object, default: () => ({}) },
  cols: { type: Number, default: 3 },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:value']);

function set(key, ev) {
  emit('update:value', { ...props.value, [key]: ev.target.value });
}
</script>

<template>
  <div class="price-grid" :style="{ '--grid-cols': cols }">
    <div v-for="item in items" :key="item.key" class="cell">
      <label class="cell-label">{{ item.label }}</label>
      <div class="cell-input" :class="{ disabled }">
        <input
          :value="value[item.key] ?? ''"
          type="number"
          min="0"
          step="0.01"
          :disabled="disabled"
          :placeholder="item.placeholder || '请输入价格'"
          @input="set(item.key, $event)"
        />
        <span v-if="item.unit" class="unit">{{ item.unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.price-grid { display: grid; grid-template-columns: repeat(var(--grid-cols), minmax(0, 1fr)); gap: 16px; }
.cell { display: grid; gap: 7px; min-width: 0; }
.cell-label { font-size: 12.5px; color: var(--text-sub); font-weight: 500; }
.cell-input { display: flex; align-items: center; gap: 8px; min-width: 0; border: 1px solid var(--border, #e3e7f0); border-radius: 9px; padding: 0 11px; background: var(--bg-input, #fbfcfe); transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
.cell-input.disabled { border-color: var(--border-faint, #e1e5eb); background: var(--bg-disabled, #f1f3f5); }
.cell-input:focus-within { border-color: var(--primary); background: var(--bg-card, #fff); box-shadow: 0 0 0 3px var(--primary-ring); }
.cell-input input { flex: 1; width: 0; min-width: 0; border: none; outline: none; background: transparent; padding: 10px 0; color: var(--text-main); font-size: 13.5px; }
.cell-input input::placeholder { color: var(--text-muted, #a0a6b2); }
.cell-input input:disabled { cursor: not-allowed; color: var(--text-sub, #667085); }
.unit { flex: 0 0 auto; color: var(--text-sub); font-size: 12.5px; }
@media (max-width: 760px) {
  .price-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
}
</style>
