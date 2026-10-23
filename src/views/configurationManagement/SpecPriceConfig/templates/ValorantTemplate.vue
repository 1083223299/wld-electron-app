<script setup>
import { ref } from 'vue';
import { useToast } from '../../../../composables/useToast';
import RangeTable from '../blocks/RangeTable.vue';
import PriceGrid from '../blocks/PriceGrid.vue';

const props = defineProps({ data: { type: Object, required: true } });
const { show } = useToast();

const tabs = [
  { key: 'paiwei', label: '排位' },
  { key: 'dingwei', label: '定位' },
  { key: 'pass', label: '通行证等级' },
  { key: 'contract', label: '英雄契约' },
];
const active = ref('paiwei');

function saveBlock(label) {
  show(`${label} 保存成功`, 'success');
}
</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" type="button" :class="['tab', { active: active === t.key }]" @click="active = t.key">{{ t.label }}</button>
    </div>

    <!-- 排位 -->
    <div v-if="active === 'paiwei'" class="body">
      <div class="block">
        <h4>排位</h4>
        <RangeTable
          v-model:rows="data.paiweiRanges"
          v-model:fallback="data.paiweiFallback"
          start-label="初始段位"
          end-label="结束段位"
          price-label="段位单价"
        />
        <p class="note">最高段位只到神话3，没有无畏战神。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('排位')">保存</button></div>
      </div>
    </div>

    <!-- 定位 -->
    <div v-if="active === 'dingwei'" class="body">
      <div class="block">
        <h4>定位</h4>
        <RangeTable
          v-model:rows="data.dingweiRanges"
          v-model:fallback="data.dingweiFallback"
          start-label="上赛季段位"
          end-label="上赛季段位"
          price-label="段位单价"
        />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('定位')">保存</button></div>
      </div>
    </div>

    <!-- 通行证等级 -->
    <div v-if="active === 'pass'" class="body">
      <div class="block">
        <h4>需打场次</h4>
        <PriceGrid :items="[{ key: 'perMatch', label: '单场次价格', unit: '元/场' }]" v-model:value="data.passMatch" />
        <p class="note">需打场次数 × 上赛季段位即为报价。</p>
      </div>
      <div class="block">
        <h4>定价</h4>
        <div class="price-cols">
          <div class="p-item"><label>起始分数</label><input v-model="data.pStartScore" type="number" min="0" /><label>每1分差值单价</label><input v-model="data.pPerScore" type="number" min="0" step="0.01" /><label>兜底</label><input v-model="data.pFbScore" type="number" min="0" step="0.01" /></div>
          <div class="p-item"><label>起始战力</label><input v-model="data.pStartPower" type="number" min="0" /><label>每1战力差值单价</label><input v-model="data.pPerPower" type="number" min="0" step="0.01" /><label>兜底</label><input v-model="data.pFbPower" type="number" min="0" step="0.01" /></div>
          <div class="p-item"><label>起始等级</label><input v-model="data.pStartLevel" type="number" min="0" /><label>每1等级差值单价</label><input v-model="data.pPerLevel" type="number" min="0" step="0.01" /><label>兜底</label><input v-model="data.pFbLevel" type="number" min="0" step="0.01" /></div>
        </div>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('通行证等级')">保存</button></div>
      </div>
    </div>

    <!-- 英雄契约 -->
    <div v-if="active === 'contract'" class="body">
      <div class="block">
        <h4>英雄契约</h4>
        <div class="pair-grid">
          <div class="p-item"><label>起始等级</label><input v-model="data.ctStart" type="number" min="0" /></div>
          <div class="p-item"><label>每1等级差值单价</label><input v-model="data.ctPer" type="number" min="0" step="0.01" /></div>
          <div class="p-item"><label>兜底</label><input v-model="data.ctFallback" type="number" min="0" step="0.01" /></div>
        </div>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('英雄契约')">保存</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--border-faint, #eef1f6); margin-bottom: 18px; }
.tab { border: none; background: transparent; padding: 10px 16px; cursor: pointer; font-size: 13.5px; color: var(--text-sub); border-bottom: 2px solid transparent; }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.body { display: grid; gap: 16px; }
.block { padding: 18px; border: 1px solid var(--border-faint, #eef1f6); border-radius: 14px; }
.block h4 { margin: 0 0 12px; font-size: 14px; color: var(--text-main); }
.pair-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.price-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.p-item { display: grid; gap: 6px; }
.p-item label { font-size: 12.5px; color: var(--text-sub); }
.p-item input { border: 1px solid #e3e7f0; border-radius: 12px; padding: 10px 12px; outline: none; }
.note { margin: 10px 0 0; font-size: 12px; color: var(--text-sub); }
.block-save { display: flex; justify-content: flex-end; margin-top: 14px; }
.btn-primary { border: none; border-radius: 10px; padding: 8px 22px; background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
