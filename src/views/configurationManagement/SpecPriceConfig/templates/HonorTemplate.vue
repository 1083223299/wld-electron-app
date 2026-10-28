// Honor 模板组件，用于配置排位赛、英雄战力和巅峰赛的价格
<script setup>
import { ref } from 'vue';
import RangeTable from '../blocks/RangeTable.vue';

defineProps({
  data: { type: Object, required: true },
  rankOptions: { type: Array, default: () => [] },
});
const emit = defineEmits(['save']);

const tabs = [
  { key: 'paiwei', label: '排位赛' },
  { key: 'power', label: '战力' },
  { key: 'peak', label: '巅峰赛' },
];
const active = ref('paiwei');

function saveBlock(section, label) {
  emit('save', { section, label });
}

function handleRangeMode(section, label, editing, toggle) {
  if (editing) saveBlock(section, label);
  toggle();
}

</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" type="button" :class="['tab', { active: active === t.key }]" @click="active = t.key">{{ t.label }}</button>
    </div>

    <!-- 排位赛 -->
    <div v-if="active === 'paiwei'" class="body">
      <section class="config-section">
        <RangeTable
          v-model:rows="data.paiweiRanges"
          v-model:fallback="data.paiweiFallback"
          title="段位跨度"
          display-range
          inline-fallback
          :options="rankOptions"
          range-label="起始段位"
          start-label="初始段位"
          end-label="结束段位"
          price-label="段位单价"
        >
          <template #actions="{ add, editing, toggle }">
            <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
            <button type="button" class="btn-primary" @click="handleRangeMode('paiwei', '段位跨度', editing, toggle)">{{ editing ? '保存' : '编辑' }}</button>
          </template>
        </RangeTable>
      </section>
      <section class="config-section">
        <div class="section-heading"><h4>加价设置</h4><button type="button" class="btn-primary" @click="saveBlock('paiwei', '加价设置')">保存</button></div>
        <div class="block">
          <div class="markup">
            <div class="markup-item"><label>指定英雄</label><div class="markup-input"><input v-model="data.markupHero" type="number" min="0" step="1" placeholder="请输入百分比" /><span>%</span></div></div>
            <div class="markup-item"><label>指定位置</label><div class="markup-input"><input v-model="data.markupPosition" type="number" min="0" step="1" placeholder="请输入百分比" /><span>%</span></div></div>
          </div>
        </div>
      </section>
    </div>

    <!-- 英雄战力 -->
    <div v-if="active === 'power'" class="body">
      <section class="config-section">
        <RangeTable
          v-model:rows="data.powerRankRanges"
          v-model:fallback="data.powerRankFallback"
          title="当前段位"
          display-range
          inline-fallback
          :options="rankOptions"
          range-label="起始段位"
          start-label="初始段位"
          end-label="结束段位"
          price-label="段位单价"
        >
          <template #actions="{ add, editing, toggle }">
            <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
            <button type="button" class="btn-primary" @click="handleRangeMode('power', '当前段位', editing, toggle)">{{ editing ? '保存' : '编辑' }}</button>
          </template>
        </RangeTable>
      </section>
      <section class="config-section">
        <RangeTable
          v-model:rows="data.powerRanges"
          v-model:fallback="data.powerFallback"
          title="英雄战力区间"
          display-range
          inline-fallback
          numeric
          range-label="起始战力"
          start-label="起始战力"
          end-label="结束战力"
          price-label="每1战力差值单价"
        >
          <template #actions="{ add, editing, toggle }">
            <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
            <button type="button" class="btn-primary" @click="handleRangeMode('power', '英雄战力区间', editing, toggle)">{{ editing ? '保存' : '编辑' }}</button>
          </template>
        </RangeTable>
      </section>
    </div>

    <!-- 巅峰赛 -->
    <div v-if="active === 'peak'" class="body">
      <section class="config-section">
        <RangeTable
          v-model:rows="data.peakRanges"
          v-model:fallback="data.peakFallback"
          title="分数"
          display-range
          inline-fallback
          numeric
          range-label="起始分数"
          start-label="起始分数"
          end-label="结束分数"
          price-label="每1分差值单价"
        >
          <template #actions="{ add, editing, toggle }">
            <button v-if="editing" type="button" class="section-add" @click="add">新增</button>
            <button type="button" class="btn-primary" @click="handleRangeMode('peak', '巅峰赛', editing, toggle)">{{ editing ? '保存' : '编辑' }}</button>
          </template>
        </RangeTable>
      </section>
      <section class="config-section">
        <div class="section-heading"><h4>加价设置</h4><button type="button" class="btn-primary" @click="saveBlock('peak', '巅峰赛加价设置')">保存</button></div>
        <div class="block">
          <div class="markup">
            <div class="markup-item"><label>指定英雄</label><div class="markup-input"><input v-model="data.scoreMarkupHero" type="number" min="0" step="1" placeholder="请输入百分比" /><span>%</span></div></div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
.tab { flex: 0 0 auto; border: 1px solid transparent; border-radius: 7px; background: transparent; padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-sub); white-space: nowrap; transition: color .16s ease, background .16s ease, border-color .16s ease; }
.tab:hover { color: var(--primary); background: var(--primary-soft); }
.tab.active { border-color: var(--primary-border); background: var(--primary-soft); color: var(--primary); font-weight: 600; box-shadow: inset 0 -2px 0 var(--primary); }
.body { display: grid; gap: 14px; }
.config-section { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); box-shadow: var(--panel-shadow); }
.config-section > h4, .section-heading h4 { margin: 0; font-size: 14px; color: var(--text-main); }
.config-section > h4 { margin-bottom: 8px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-heading + .range-table-block { margin-top: 6px; }
.price-note { margin: 10px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.6; }
.section-add { border: 1px solid var(--primary-border-strong); border-radius: 6px; padding: 7px 14px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.section-add:hover { background: var(--primary-faint); }
.block { min-width: 0; padding: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-app); }
.block h4 { margin: 0 0 14px; font-size: 14px; color: var(--text-main); }
.markup { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.markup-item { display: grid; gap: 7px; min-width: 0; }
.markup-item label { font-size: 12.5px; color: var(--text-sub); }
.markup-input { display: flex; align-items: center; gap: 8px; min-width: 0; border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 0 11px; background: var(--input-bg, var(--bg-card)); transition: border-color .16s ease, box-shadow .16s ease; }
.markup-input:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.markup-input input { flex: 1; width: 0; min-width: 0; border: none; outline: none; padding: 10px 0; background: transparent; color: var(--text-main); }
.markup-input span { color: var(--text-sub); }
.note { margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: var(--text-sub); }
.block-save { display: flex; justify-content: flex-end; margin-top: 16px; }
.btn-primary { border: 1px solid var(--primary); border-radius: 6px; padding: 7px 16px; background: var(--primary); color: var(--text-invert, #fff); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .16s ease, border-color .16s ease; }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
@media (max-width: 640px) {
  .block { padding: 14px; }
  .config-section { padding: 14px; }
  .markup { grid-template-columns: minmax(0, 1fr); }
}
</style>
