<script setup>
import { ref } from 'vue';
import { useToast } from '../../../../composables/useToast';
import PriceGrid from '../blocks/PriceGrid.vue';

const props = defineProps({ data: { type: Object, required: true } });
const { show } = useToast();

const tabs = [
  { key: 'hafu', label: '哈夫币' },
  { key: 'escort', label: '护航' },
  { key: 'safeBox', label: '保险箱格数' },
  { key: 'prop', label: '道具（撞车）' },
  { key: 'title', label: '称号（代肝）' },
  { key: 'safe3', label: '赛季3*3保险箱' },
  { key: 'fun', label: '趣味单' },
  { key: 'material', label: '累计物资' },
  { key: 'duration', label: '时长' },
  { key: 'materialSingle', label: '单局物资' },
  { key: 'red', label: '出红' },
  { key: 'items', label: '指定物品' },
  { key: 'clear', label: '清图' },
  { key: 'task', label: '任务打包' },
];
const active = ref('hafu');
// 手游/端游仅用于护航地图池切换
const mapPlatform = ref('mobile');

function saveBlock(label) {
  show(`${label} 保存成功`, 'success');
}
</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" type="button" :class="['tab', { active: active === t.key }]" @click="active = t.key">{{ t.label }}</button>
    </div>

    <!-- 哈夫币 -->
    <div v-if="active === 'hafu'" class="body">
      <div class="block">
        <h4>哈夫币</h4>
        <div class="pair-grid">
          <div class="p-item"><label>最小值（万）</label><input v-model="data.hafuMin" type="number" min="0" placeholder="500" /></div>
          <div class="p-item"><label>每100万加价</label><div class="unit-in"><input v-model="data.hafuPer1m" type="number" min="0" step="0.01" placeholder="5元" /><span>元</span></div></div>
          <div class="p-item"><label>最大值（万）</label><input v-model="data.hafuMax" type="number" min="0" placeholder="50000" /></div>
          <div class="p-item"><label>起始价格</label><div class="unit-in"><input v-model="data.hafuStart" type="number" min="0" step="0.01" placeholder="100元" /><span>元</span></div></div>
        </div>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('哈夫币')">保存</button></div>
      </div>
    </div>

    <!-- 护航 -->
    <div v-if="active === 'escort'" class="body">
      <div class="block">
        <h4>护航人数</h4>
        <PriceGrid :items="[
          { key: 'danhu', label: '单护', unit: '元' },
          { key: 'shuanghu', label: '双护', unit: '元' },
          { key: 'yituoer', label: '一拖二', unit: '元' },
        ]" v-model:value="data.escortPeople" />
      </div>
      <div class="block">
        <h4>护航地图-绝密</h4>
        <div class="platform-switch">
          <button type="button" :class="['ps-item', { active: mapPlatform === 'mobile' }]" @click="mapPlatform = 'mobile'">手游</button>
          <button type="button" :class="['ps-item', { active: mapPlatform === 'pc' }]" @click="mapPlatform = 'pc'">端游</button>
        </div>
        <PriceGrid v-if="mapPlatform === 'mobile'" :items="[
          { key: 'all', label: '不限', unit: '元' },
          { key: 'bashike', label: '巴克什', unit: '元' },
          { key: 'hangtian', label: '航天基地', unit: '元' },
          { key: 'chaoxi', label: '潮汐监狱', unit: '元' },
        ]" v-model:value="data.mapsMobile" />
        <PriceGrid v-else :items="[
          { key: 'all', label: '不限', unit: '元' },
          { key: 'bashike', label: '巴克什', unit: '元' },
          { key: 'hangtian', label: '航天基地', unit: '元' },
          { key: 'chaoxi', label: '潮汐监狱', unit: '元' },
        ]" v-model:value="data.mapsPc" />
      </div>
      <div class="block">
        <h4>时长</h4>
        <PriceGrid :items="[{ key: 'hour1', label: '1小时', unit: '元' }]" v-model:value="data.escortHours" />
        <p class="note">若选择2小时，则报价=2×（护航人数+1小时时长+护航地图）。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('护航')">保存</button></div>
      </div>
    </div>

    <!-- 保险箱格数 -->
    <div v-if="active === 'safeBox'" class="body">
      <div class="block">
        <h4>保险箱格数</h4>
        <PriceGrid :items="[
          { key: 'g2', label: '2格', unit: '元' },
          { key: 'g4', label: '4格', unit: '元' },
          { key: 'g6', label: '6格', unit: '元' },
          { key: 'g9', label: '9格', unit: '元' },
        ]" v-model:value="data.safeBox" />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('保险箱格数')">保存</button></div>
      </div>
    </div>

    <!-- 道具（撞车） -->
    <div v-if="active === 'prop'" class="body">
      <div class="block">
        <h4>跑刀 / 撞车</h4>
        <PriceGrid :items="[
          { key: 'paodao', label: '跑刀' },
          { key: 'zhuangche', label: '撞车' },
        ]" v-model:value="data.propType" />
      </div>
      <div class="block">
        <h4>大红</h4>
        <PriceGrid :items="[{ key: 'dahong', label: '大红', unit: '元' }]" v-model:value="data.dahong" />
        <p class="note">若选择2个大红，则报价=2×（护航人数+1个大红）。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('道具（撞车）')">保存</button></div>
      </div>
    </div>

    <!-- 称号（代肝） -->
    <div v-if="active === 'title'" class="body">
      <div class="block">
        <h4>称号（代肝）</h4>
        <PriceGrid :items="[{ key: 'tjsn', label: '天才少年', unit: '元' }]" v-model:value="data.title" />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('称号（代肝）')">保存</button></div>
      </div>
    </div>

    <!-- 赛季3*3保险箱（原型未铺字段） -->
    <div v-if="active === 'safe3'" class="body"><div class="placeholder">原型未配置该分项字段，待后端补充。</div></div>
    <!-- 趣味单（原型未铺字段） -->
    <div v-if="active === 'fun'" class="body"><div class="placeholder">原型未配置该分项字段，待后端补充。</div></div>

    <!-- 累计物资 -->
    <div v-if="active === 'material'" class="body">
      <div class="block">
        <h4>累计物资</h4>
        <div class="pair-grid">
          <div class="p-item"><label>最小值</label><input v-model="data.matMin" type="number" min="0" /></div>
          <div class="p-item"><label>每100万加价</label><div class="unit-in"><input v-model="data.matPer" type="number" min="0" step="0.01" /><span>元</span></div></div>
          <div class="p-item"><label>最大值</label><input v-model="data.matMax" type="number" min="0" /></div>
          <div class="p-item"><label>起始价格</label><div class="unit-in"><input v-model="data.matStart" type="number" min="0" step="0.01" /><span>元</span></div></div>
        </div>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('累计物资')">保存</button></div>
      </div>
    </div>

    <!-- 时长 -->
    <div v-if="active === 'duration'" class="body">
      <div class="block">
        <h4>时长</h4>
        <PriceGrid :items="[{ key: 'hour1', label: '1小时', unit: '元' }]" v-model:value="data.duration" />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('时长')">保存</button></div>
      </div>
    </div>

    <!-- 单局物资 / 单局保底物资 -->
    <div v-if="active === 'materialSingle'" class="body">
      <div class="block">
        <h4>单局保底物资</h4>
        <div class="pair-grid">
          <div class="p-item"><label>最小值</label><input v-model="data.smMin" type="number" min="0" /></div>
          <div class="p-item"><label>每50万加价</label><div class="unit-in"><input v-model="data.smPer" type="number" min="0" step="0.01" /><span>元</span></div></div>
          <div class="p-item"><label>最大值</label><input v-model="data.smMax" type="number" min="0" /></div>
          <div class="p-item"><label>起始价格</label><div class="unit-in"><input v-model="data.smStart" type="number" min="0" step="0.01" /><span>元</span></div></div>
        </div>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('单局物资')">保存</button></div>
      </div>
    </div>

    <!-- 出红 -->
    <div v-if="active === 'red'" class="body">
      <div class="block">
        <h4>出红</h4>
        <PriceGrid :items="[{ key: 'dahong', label: '大红', unit: '元' }]" v-model:value="data.red" />
        <p class="note">若选择2个大红，则报价=2×（护航人数+1个大红）。</p>
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('出红')">保存</button></div>
      </div>
    </div>

    <!-- 指定物品 -->
    <div v-if="active === 'items'" class="body">
      <div class="block">
        <h4>指定物品（一）</h4>
        <PriceGrid :items="[
          { key: 'fzzx', label: '非洲之星', unit: '元/个' },
          { key: 'wxg', label: '卫星锅', unit: '元/个' },
          { key: 'hjrl', label: '火箭燃料', unit: '元/个' },
          { key: 'flsb', label: '浮力设备', unit: '元/个' },
        ]" v-model:value="data.itemsA" />
      </div>
      <div class="block">
        <h4>指定物品（二）</h4>
        <PriceGrid :items="[
          { key: 'wxtx', label: '卫星通讯天线', unit: '元/个' },
          { key: 'gjkf', label: '高级咖啡豆', unit: '元/个' },
          { key: 'hjrl2', label: '火箭燃料', unit: '元/个' },
          { key: 'tydf', label: '天圆地方', unit: '元/个' },
          { key: 'zh', label: '纵横', unit: '元/个' },
        ]" v-model:value="data.itemsB" />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('指定物品')">保存</button></div>
      </div>
    </div>

    <!-- 清图（原型未铺字段） -->
    <div v-if="active === 'clear'" class="body"><div class="placeholder">原型未配置该分项字段，待后端补充。</div></div>

    <!-- 任务打包 / 任务单做 -->
    <div v-if="active === 'task'" class="body">
      <div class="block">
        <h4>任务打包</h4>
        <PriceGrid :items="[{ key: 'perTask', label: '任务数量', unit: '元/个' }]" v-model:value="data.taskPack" />
      </div>
      <div class="block">
        <h4>任务单做</h4>
        <PriceGrid :items="[
          { key: 'baosun', label: '9格保险包损耗', unit: '元' },
          { key: 'stage1', label: '第一阶段任务', unit: '元' },
          { key: 'stage2', label: '第二阶段任务', unit: '元' },
          { key: 'stage3', label: '第三阶段任务', unit: '元' },
          { key: 'stage4', label: '第四阶段任务', unit: '元' },
          { key: 'fgbf', label: '征服标杆', unit: '元' },
          { key: 'zjll', label: '终局联系', unit: '元' },
          { key: 'qjcj', label: '勤俭持家', unit: '元' },
        ]" v-model:value="data.taskList" />
        <div class="block-save"><button type="button" class="btn-primary" @click="saveBlock('任务打包')">保存</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--border-faint, #eef1f6); margin-bottom: 18px; }
.tab { border: none; background: transparent; padding: 10px 14px; cursor: pointer; font-size: 13.5px; color: var(--text-sub); border-bottom: 2px solid transparent; }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.body { display: grid; gap: 16px; }
.block { padding: 18px; border: 1px solid var(--border-faint, #eef1f6); border-radius: 14px; }
.block h4 { margin: 0 0 12px; font-size: 14px; color: var(--text-main); }
.platform-switch { display: inline-flex; gap: 4px; padding: 4px; background: var(--bg-thead, #f2f3f8); border-radius: 12px; margin-bottom: 14px; }
.ps-item { border: none; background: transparent; padding: 6px 18px; border-radius: 9px; cursor: pointer; font-size: 13px; color: var(--text-sub); }
.ps-item.active { background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: #fff; font-weight: 600; }
.pair-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.p-item { display: grid; gap: 6px; }
.p-item label { font-size: 12.5px; color: var(--text-sub); }
.p-item input { border: 1px solid #e3e7f0; border-radius: 12px; padding: 10px 12px; outline: none; }
.unit-in { display: flex; align-items: center; gap: 6px; border: 1px solid #e3e7f0; border-radius: 12px; padding: 0 12px; }
.unit-in input { flex: 1; border: none; outline: none; padding: 10px 0; }
.unit-in span { color: var(--text-sub); font-size: 12px; }
.note { margin: 10px 0 0; font-size: 12px; color: var(--text-sub); }
.block-save { display: flex; justify-content: flex-end; margin-top: 14px; }
.btn-primary { border: none; border-radius: 10px; padding: 8px 22px; background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.placeholder { padding: 40px; text-align: center; color: var(--text-sub); font-size: 13px; border: 1px dashed var(--border-faint, #e3e7f0); border-radius: 14px; }
</style>
