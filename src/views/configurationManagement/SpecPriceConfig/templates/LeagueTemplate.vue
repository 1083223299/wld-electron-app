// League 模板组件，用于配置排位和定位的价格
<script setup>
import { computed, ref } from 'vue';
import RangeTable from '../blocks/RangeTable.vue';

const props = defineProps({
  data: { type: Object, required: true },
  rankOptions: { type: Array, default: () => [] },
  placementSeasons: { type: Array, default: () => [] },
});
const emit = defineEmits(['save']);

const tabs = [
  { key: 'ranked', label: '排位' },
  { key: 'placement', label: '定位' },
];
const active = ref('ranked');
const rankedOptions = computed(() => [
  ...new Set([
    ...props.rankOptions,
    ...props.data.rankedRanges.flatMap((row) => [row.start, row.end]).filter(Boolean),
  ]),
]);
const placementOptions = computed(() => [
  ...new Set([
    ...props.rankOptions,
    ...props.placementSeasons,
    ...props.data.placementRanges.flatMap((row) => [row.start, row.end]).filter(Boolean),
  ]),
]);

function handleRangeMode(section, editing, toggle) {
  if (editing) {
    emit('save', {
      section,
      label: section === 'ranked' ? '排位' : '定位',
      onSaved: toggle,
    });
    return;
  }
  toggle();
}
</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="['tab', { active: active === tab.key }]"
        @click="active = tab.key"
      >{{ tab.label }}</button>
    </div>

    <section class="config-section">
      <RangeTable
        v-if="active === 'ranked'"
        v-model:rows="data.rankedRanges"
        v-model:fallback="data.rankedFallback"
        title="段位跨度"
        display-range
        inline-fallback
        :options="rankedOptions"
        range-label="起始段位"
        start-label="初始段位"
        end-label="结束段位"
        price-label="段位单价"
      >
        <template #actions="{ add, editing, toggle }">
          <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
          <button type="button" class="btn-primary" @click="handleRangeMode('ranked', editing, toggle)">
            {{ editing ? '保存' : '编辑' }}
          </button>
        </template>
      </RangeTable>
      <RangeTable
        v-else
        v-model:rows="data.placementRanges"
        v-model:fallback="data.placementFallback"
        title="段位"
        display-range
        :options="placementOptions"
        :equal-range-options="placementSeasons"
        range-label="上赛季段位"
        start-label="上赛季起始段位"
        end-label="上赛季结束段位"
        inline-fallback
        price-label="段位单价"
      >
        <template #actions="{ add, editing, toggle }">
          <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
          <button type="button" class="btn-primary" @click="handleRangeMode('placement', editing, toggle)">
            {{ editing ? '保存' : '编辑' }}
          </button>
        </template>
      </RangeTable>
    </section>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
.tab { flex: 0 0 auto; border: 1px solid transparent; border-radius: 7px; background: transparent; padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-sub); white-space: nowrap; transition: color .16s ease, background .16s ease, border-color .16s ease; }
.tab:hover { color: var(--primary); background: var(--primary-soft); }
.tab.active { border-color: var(--primary-border); background: var(--primary-soft); color: var(--primary); font-weight: 600; box-shadow: inset 0 -2px 0 var(--primary); }
.config-section { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); box-shadow: var(--panel-shadow); }
.section-heading { margin-bottom: 8px; }
.section-heading h4 { margin: 0; color: var(--text-main); font-size: 14px; }
.section-add { border: 1px solid var(--primary-border-strong); border-radius: 6px; padding: 7px 14px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.section-add:hover { background: var(--primary-faint); }
.btn-primary { border: 1px solid var(--primary); border-radius: 6px; padding: 7px 16px; background: var(--primary); color: var(--text-invert, #fff); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .16s ease, border-color .16s ease; }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.note { margin: 10px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.6; }
</style>
