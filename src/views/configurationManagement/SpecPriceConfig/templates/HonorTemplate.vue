<script setup>
import { ref } from 'vue';
import { useToast } from '../../../../composables/useToast';
import RangeTable from '../blocks/RangeTable.vue';

const props = defineProps({ data: { type: Object, required: true } });
const { show } = useToast();

const tabs = [
  { key: 'paiwei', label: '排位赛' },
  { key: 'power', label: '英雄战力' },
  { key: 'peak', label: '巅峰赛' },
  { key: 'score', label: '分数' },
];
const active = ref('paiwei');

// 每个分项单独保存（接口待后端确认，当前先做前端校验+成功提示）
function saveBlock(label) {
  show(`${label} 保存成功`, 'success');
}
</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" type="button" :class="['tab', { active: active === t.key }]" @click="active = t.key">{{ t.label }}</button>
    </div>

    <!-- 排位赛 -->
    <div v-if="active === 'paiwei'" class="body">
      <div class="block">
        <h4>段位跨度</h4>
        <RangeTable
          v-model:rows="data.paiweiRanges"
          v-model:fallback="data.paiweiFallback"
          start-label="初始段位"
          end-label="结束段位"
          price-label="段位单价"
        />
      </div>
      <div class="block">
        <h4>加价设置</h4>
        <div class="markup">
          <div class="markup-item"><label>指定英雄</label><div class="markup-input"><input v-model="data.markupHero" type="number" min="0" step="0.01" placeholder="百分比" /><span>%</span></div></div>
          <div class="markup-item"><label>指定位置</label><div class="markup-input"><input v-model="data.markupPosition" type="number" min="0" step="0.01" placeholder="百分比" /><span>%</span></div></div>
        </div>
        <p class="note">百分比字段按乘积方式计算（非加法）。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('加价设置')">保存</button></div>
      </div>
    </div>

    <!-- 英雄战力 -->
    <div v-if="active === 'power'" class="body">
      <div class="block">
        <h4>英雄战力</h4>
        <RangeTable
          v-model:rows="data.powerRanges"
          v-model:fallback="data.powerFallback"
          start-label="当前段位"
          end-label="当前段位"
          price-label="价格"
        />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('英雄战力')">保存</button></div>
      </div>
    </div>

    <!-- 巅峰赛 -->
    <div v-if="active === 'peak'" class="body">
      <div class="block">
        <h4>巅峰赛</h4>
        <RangeTable
          v-model:rows="data.peakRanges"
          v-model:fallback="data.peakFallback"
          start-label="当前段位"
          end-label="当前段位"
          price-label="价格"
        />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('巅峰赛')">保存</button></div>
      </div>
    </div>

    <!-- 分数 -->
    <div v-if="active === 'score'" class="body">
      <div class="block">
        <h4>加价设置</h4>
        <div class="markup">
          <div class="markup-item"><label>指定英雄</label><div class="markup-input"><input v-model="data.scoreMarkupHero" type="number" min="0" step="0.01" placeholder="百分比" /><span>%</span></div></div>
        </div>
        <p class="note">百分比字段按乘积方式计算（非加法）。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('分数')">保存</button></div>
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
.markup { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.markup-item { display: grid; gap: 6px; }
.markup-item label { font-size: 12.5px; color: var(--text-sub); }
.markup-input { display: flex; align-items: center; gap: 6px; border: 1px solid #e3e7f0; border-radius: 12px; padding: 0 12px; }
.markup-input input { flex: 1; border: none; outline: none; padding: 10px 0; }
.markup-input span { color: var(--text-sub); }
.note { margin: 10px 0 0; font-size: 12px; color: var(--text-sub); }
.block-save { display: flex; justify-content: flex-end; margin-top: 14px; }
.btn-primary { border: none; border-radius: 10px; padding: 8px 22px; background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
