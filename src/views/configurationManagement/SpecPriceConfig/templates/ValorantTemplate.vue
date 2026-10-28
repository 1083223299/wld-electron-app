// Valorant 模板组件，用于配置排位、定位、通行证等级和英雄契约的价格
<script setup>
import { ref } from 'vue';
import RangeTable from '../blocks/RangeTable.vue';
import PriceGrid from '../blocks/PriceGrid.vue';

const emit = defineEmits(['save']);
const props = defineProps({
  data: { type: Object, required: true },
  rankOptions: { type: Array, default: () => [] },
});

const tabs = [
  { key: 'paiwei', label: '排位' },
  { key: 'dingwei', label: '定位' },
  { key: 'pass', label: '通行证等级' },
  { key: 'contract', label: '英雄契约' },
];
const active = ref('paiwei');
const passEditing = ref(false);
const contractEditing = ref(false);

function handleRangeMode(section, label, editing, toggle) {
  if (editing) {
    emit('save', { section, label, onSaved: toggle });
    return;
  }
  toggle();
}

function savePassPrice() {
  emit('save', {
    section: 'pass',
    label: '通行证等级',
    onSaved: () => {
      passEditing.value = false;
    },
  });
}

function saveContractPrice() {
  emit('save', {
    section: 'contract',
    label: '英雄契约',
    onSaved: () => {
      contractEditing.value = false;
    },
  });
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

    <section v-if="active === 'paiwei'" class="config-section">
      <RangeTable
        v-model:rows="data.paiweiRanges"
        v-model:fallback="data.paiweiFallback"
        title="段位"
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
          <button type="button" class="btn-primary" @click="handleRangeMode('paiwei', '排位段位', editing, toggle)">
            {{ editing ? '保存' : '编辑' }}
          </button>
        </template>
      </RangeTable>
    </section>

    <section v-else-if="active === 'dingwei'" class="config-section">
      <div class="section-heading">
        <h4>需打场次</h4>
        <button type="button" class="btn-primary" @click="emit('save', { section: 'dingwei', label: '定位' })">保存</button>
      </div>
      <PriceGrid
        :items="[{ key: 'perMatch', label: '单场次价格', unit: '元/场' }]"
        :value="data.placementPrice"
        @update:value="data.placementPrice = $event"
      />
    </section>

    <section v-else-if="active === 'pass'" class="config-section">
      <div class="section-heading pass-level-heading">
        <h4>等级</h4>
        <button type="button" class="btn-primary" @click="passEditing ? savePassPrice() : (passEditing = true)">
          {{ passEditing ? '完成' : '编辑' }}
        </button>
      </div>
      <div class="pass-level-table">
        <div class="pass-level-table-head"><span>起始等级</span><span>每等级差值单价</span></div>
        <div class="pass-level-row">
          <span>1–100</span>
          <label v-if="passEditing"><input v-model="data.passPrice.perLevel" type="number" min="0" step="0.01" /><span>元</span></label>
          <span v-else class="pass-level-price">{{ data.passPrice.perLevel === '' ? '—' : `${data.passPrice.perLevel}元` }}</span>
        </div>
        <div class="pass-level-row">
          <span>兜底</span>
          <label v-if="passEditing"><input v-model="data.passPrice.fallbackPerLevel" type="number" min="0" step="0.01" /><span>元</span></label>
          <span v-else class="pass-level-price">{{ data.passPrice.fallbackPerLevel === '' ? '—' : `${data.passPrice.fallbackPerLevel}元` }}</span>
        </div>
      </div>
    </section>

    <section v-else class="config-section contract-section">
      <div class="section-heading pass-level-heading">
        <h4>等级</h4>
        <button type="button" class="btn-primary" @click="contractEditing ? saveContractPrice() : (contractEditing = true)">
          {{ contractEditing ? '完成' : '编辑' }}
        </button>
      </div>
      <div class="pass-level-table">
        <div class="pass-level-table-head"><span>起始等级</span><span>每1等级差值单价</span></div>
        <div class="pass-level-row">
          <span>1–100</span>
          <label v-if="contractEditing"><input v-model="data.contractPrice.perLevel" type="number" min="0" step="0.01" /><span>元</span></label>
          <span v-else class="pass-level-price">{{ data.contractPrice.perLevel === '' ? '—' : `${data.contractPrice.perLevel}元` }}</span>
        </div>
        <div class="pass-level-row">
          <span>兜底</span>
          <label v-if="contractEditing"><input v-model="data.contractPrice.fallbackPerLevel" type="number" min="0" step="0.01" /><span>元</span></label>
          <span v-else class="pass-level-price">{{ data.contractPrice.fallbackPerLevel === '' ? '—' : `${data.contractPrice.fallbackPerLevel}元` }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
.tab { flex: 0 0 auto; border: 1px solid transparent; border-radius: 7px; background: transparent; padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-sub); white-space: nowrap; transition: color .16s ease, background .16s ease, border-color .16s ease; }
.tab:hover { color: var(--primary); background: var(--primary-soft); }
.tab.active { border-color: var(--primary-border); background: var(--primary-soft); color: var(--primary); font-weight: 600; box-shadow: inset 0 -2px 0 var(--primary); }
.config-section { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); box-shadow: var(--panel-shadow); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.section-heading h4 { margin: 0; color: var(--text-main); font-size: 14px; }
.pass-level-heading { margin-bottom: 10px; }
.pass-level-table { overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); }
.pass-level-table-head, .pass-level-row { display: grid; grid-template-columns: 1fr 1fr; align-items: center; text-align: center; }
.pass-level-table-head { min-height: 42px; padding: 0 14px; background: var(--bg-thead); color: var(--text-sub); font-size: 12px; font-weight: 600; }
.pass-level-row { min-height: 48px; padding: 7px 14px; border-top: 1px solid var(--border-faint); color: var(--text-main); font-size: 13px; }
.pass-level-row label { display: flex; align-items: center; justify-content: center; gap: 8px; }
.pass-level-row input { width: min(100%, 240px); border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 8px 10px; background: var(--input-bg, var(--bg-card)); color: var(--text-main); text-align: center; outline: none; }
.pass-level-row input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.pass-level-row label > span { color: var(--text-sub); }
.pass-level-price { font-weight: 500; }
.section-add { border: 1px solid var(--primary-border-strong); border-radius: 6px; padding: 7px 14px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.section-add:hover { background: var(--primary-faint); }
.btn-primary { border: 1px solid var(--primary); border-radius: 6px; padding: 7px 16px; background: var(--primary); color: var(--text-invert, #fff); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .16s ease, border-color .16s ease; }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.note { margin: 10px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.6; }
</style>
