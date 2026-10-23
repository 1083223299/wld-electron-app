<script setup>
/**
 * 通用金额网格：一组「名称 + 金额输入 + 单位」。
 * items: [{ key, label, unit }]；v-model:value 对象 { key: amount }
 */
const props = defineProps({
  items: { type: Array, default: () => [] },
  value: { type: Object, default: () => ({}) },
  cols: { type: Number, default: 3 },
});
const emit = defineEmits(['update:value']);

function set(key, ev) {
  emit('update:value', { ...props.value, [key]: ev.target.value });
}
</script>

<template>
  <div class="price-grid" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }">
    <div v-for="item in items" :key="item.key" class="cell">
      <label class="cell-label">{{ item.label }}</label>
      <div class="cell-input">
        <input
          :value="value[item.key] ?? ''"
          type="number"
          min="0"
          step="0.01"
          :placeholder="item.placeholder || '请输入价格'"
          @input="set(item.key, $event)"
        />
        <span v-if="item.unit" class="unit">{{ item.unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.price-grid { display: grid; gap: 14px; }
.cell { display: grid; gap: 6px; }
.cell-label { font-size: 12.5px; color: var(--text-sub); }
.cell-input { display: flex; align-items: center; gap: 6px; border: 1px solid #e3e7f0; border-radius: 12px; padding: 0 12px; background: #fbfcfe; }
.cell-input:focus-within { border-color: var(--primary); }
.cell-input input { flex: 1; border: none; outline: none; background: transparent; padding: 10px 0; font-size: 13.5px; }
.unit { color: var(--text-sub); font-size: 12.5px; }
</style>
