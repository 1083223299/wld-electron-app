// Delta 模板组件，用于配置哈夫币、护航、道具、称号、保险箱和趣味单的价格
<script setup>
import { computed, ref, watch } from 'vue';
import PriceGrid from '../blocks/PriceGrid.vue';

const props = defineProps({
  data: { type: Object, required: true },
  platformLoading: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'platform-change']);

const tabs = [
  { key: 'hafu', label: '哈夫币' },
  { key: 'escort', label: '护航' },
  { key: 'prop', label: '道具（撞车）' },
  { key: 'title', label: '称号（代肝）' },
  { key: 'safe3', label: '赛季3*3保险箱' },
  { key: 'fun', label: '趣味单' },
];
const escortOptions = [
  { key: 'material', label: '累计物资' },
  { key: 'duration', label: '时长' },
  { key: 'materialSingle', label: '单局物资' },
  { key: 'red', label: '出红' },
  { key: 'items', label: '指定物品' },
  { key: 'clear', label: '清图' },
];
const active = ref('hafu');
const activeEscortOption = ref('material');
const mapPlatform = ref('mobile');
const escortPeopleEditing = ref(false);
const hafuMode = ref('跑刀');
const activeHafuConfig = computed(() => props.data.hafuModes[hafuMode.value]);
const activeEscortConfig = computed(() => props.data.escortModes[mapPlatform.value === 'mobile' ? '手游' : '端游']);
const escortPeopleUsesLimitedItems = computed(() => ['red', 'items', 'clear'].includes(activeEscortOption.value));
const escortPeopleItems = computed(() => [
  { key: 'danhu', label: '单护', unit: '元' },
  { key: 'shuanghu', label: '双护', unit: '元' },
  ...(!escortPeopleUsesLimitedItems.value ? [{ key: 'yituoer', label: '一拖二', unit: '元' }] : []),
]);
const escortItems = [
  { key: 'fzzx', label: '非洲之星', unit: '元/个' },
  { key: 'wxg', label: '卫星锅', unit: '元/个' },
  { key: 'hjrl', label: '火箭燃料', unit: '元/个' },
  { key: 'flsb', label: '浮力设备', unit: '元/个' },
];

watch([activeEscortOption, mapPlatform], () => {
  escortPeopleEditing.value = false;
});

function saveBlock(section, label, onSaved) {
  emit('save', { section, label, onSaved });
}

function finishEscortPeopleEdit() {
  if (!escortPeopleEditing.value) {
    escortPeopleEditing.value = true;
    return;
  }
  saveBlock('escortPeople', '护航人数', () => {
    escortPeopleEditing.value = false;
  });
}

function selectEscortPlatform(platform) {
  if (props.platformLoading || mapPlatform.value === platform) return;
  mapPlatform.value = platform;
  emit('platform-change', platform === 'mobile' ? '手游' : '端游');
}
</script>

<template>
  <div class="tpl">
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" type="button" :class="['tab', { active: active === t.key }]" @click="active = t.key">{{ t.label }}</button>
    </div>

    <!-- 哈夫币 -->
    <div v-if="active === 'hafu'" class="body">
      <div class="platform-switch">
        <button type="button" :class="['ps-item', { active: hafuMode === '跑刀' }]" @click="hafuMode = '跑刀'">跑刀</button>
        <button type="button" :class="['ps-item', { active: hafuMode === '撞车' }]" @click="hafuMode = '撞车'">撞车</button>
      </div>
      <section class="config-section">
        <div class="section-head">
          <h4>哈夫币 - {{ hafuMode }}</h4>
          <button type="button" class="btn-primary" @click="saveBlock('hafu', `哈夫币-${hafuMode}`)">保存</button>
        </div>
        <div class="block material-block">
          <div class="material-head"><span>最小值（万）</span><span>最大值（万）</span><span>起始价格</span><span>每100万加价</span></div>
          <div class="material-fields">
            <label><input v-model="activeHafuConfig.min" type="number" min="0" /><span>万</span></label>
            <label><input v-model="activeHafuConfig.max" type="number" min="0" /><span>万</span></label>
            <label><input v-model="activeHafuConfig.start" type="number" min="0" step="0.01" /><span>元</span></label>
            <label><input v-model="activeHafuConfig.per1m" type="number" min="0" step="0.01" /><span>元</span></label>
          </div>
        </div>
      </section>
      <section class="config-section">
        <div class="section-head">
          <h4>保险箱格数</h4>
          <button type="button" class="btn-primary" @click="saveBlock('safeBox', `保险箱格数-${hafuMode}`)">保存</button>
        </div>
        <div class="block">
          <PriceGrid :items="[
            { key: 'g2', label: '2格', unit: '元' },
            { key: 'g4', label: '4格', unit: '元' },
            { key: 'g6', label: '6格', unit: '元' },
            { key: 'g9', label: '9格', unit: '元' },
          ]" :cols="4" v-model:value="activeHafuConfig.safeBox" />
        </div>
      </section>
    </div>

    <!-- 护航 -->
    <div v-if="active === 'escort'" class="escort-page">
      <div class="platform-switch">
        <button type="button" :disabled="platformLoading" :class="['ps-item', { active: mapPlatform === 'mobile' }]" @click="selectEscortPlatform('mobile')">手游</button>
        <button type="button" :disabled="platformLoading" :class="['ps-item', { active: mapPlatform === 'pc' }]" @click="selectEscortPlatform('pc')">端游</button>
      </div>
      <p v-if="platformLoading" class="price-note platform-loading">正在刷新{{ mapPlatform === 'mobile' ? '手游' : '端游' }}价目…</p>
      <div class="escort-subtabs">
        <button
          v-for="option in escortOptions"
          :key="option.key"
          type="button"
          :class="['escort-subtab', { active: activeEscortOption === option.key }]"
          @click="activeEscortOption = option.key"
        >{{ option.label }}</button>
      </div>

      <div class="escort-sections">
        <section class="escort-section">
          <div class="section-head">
            <h4>护航人数</h4>
            <button type="button" class="btn-primary" @click="finishEscortPeopleEdit">
              {{ escortPeopleEditing ? '完成' : '编辑' }}
            </button>
          </div>
          <div class="block">
            <PriceGrid :items="escortPeopleItems" :disabled="!escortPeopleEditing" v-model:value="activeEscortConfig.escortPeople" />
          </div>
        </section>

        <section v-if="activeEscortOption !== 'clear'" class="escort-section">
          <div class="section-head">
            <h4>{{ activeEscortOption === 'red' ? '大红' : escortOptions.find((option) => option.key === activeEscortOption)?.label }}</h4>
            <button type="button" class="btn-primary" @click="saveBlock('escortOption', activeEscortOption === 'red' ? '大红' : escortOptions.find((option) => option.key === activeEscortOption)?.label)">保存</button>
          </div>
          <div v-if="activeEscortOption === 'material'" class="block material-block">
              <div class="material-head"><span>最小值</span><span>最大值</span><span>起始价格</span><span>每100万加价</span></div>
              <div class="material-fields">
              <label><input v-model="activeEscortConfig.matMin" type="number" min="0" /><span>万</span></label>
              <label><input v-model="activeEscortConfig.matMax" type="number" min="0" /><span>万</span></label>
              <label><input v-model="activeEscortConfig.matStart" type="number" min="0" step="0.01" /><span>元</span></label>
              <label><input v-model="activeEscortConfig.matPer1m" type="number" min="0" step="0.01" /><span>元</span></label>
              </div>
            </div>
          <div v-else-if="activeEscortOption === 'duration'" class="block">
            <PriceGrid :items="[{ key: 'hour1', label: '1小时', unit: '元' }]" v-model:value="activeEscortConfig.duration" />
          </div>
          <div v-else-if="activeEscortOption === 'materialSingle'" class="block material-block">
            <div class="material-head"><span>最小值</span><span>最大值</span><span>起始价格</span><span>每50万加价</span></div>
            <div class="material-fields">
              <label><input v-model="activeEscortConfig.smMin" type="number" min="0" /><span>万</span></label>
              <label><input v-model="activeEscortConfig.smMax" type="number" min="0" /><span>万</span></label>
              <label><input v-model="activeEscortConfig.smStart" type="number" min="0" step="0.01" /><span>元</span></label>
              <label><input v-model="activeEscortConfig.smPer" type="number" min="0" step="0.01" /><span>元</span></label>
            </div>
          </div>
          <div v-else-if="activeEscortOption === 'red'" class="block">
            <PriceGrid :items="[{ key: 'dahong', label: '大红', unit: '元' }]" v-model:value="activeEscortConfig.red" />
          </div>
          <div v-else-if="activeEscortOption === 'items'" class="block">
            <PriceGrid :items="escortItems" :cols="4" v-model:value="activeEscortConfig.itemsA" />
          </div>
        </section>

        <section v-if="!['red', 'items'].includes(activeEscortOption)" class="escort-section">
          <div class="section-head">
            <h4>护航地图-绝密</h4>
            <button type="button" class="btn-primary" @click="saveBlock('escortMaps', '护航地图-绝密')">保存</button>
          </div>
          <div class="block">
            <PriceGrid v-if="mapPlatform === 'mobile'" :items="[
              { key: 'all', label: '不限', unit: '元' },
              { key: 'bashike', label: '巴克什', unit: '元' },
              { key: 'hangtian', label: '航天基地', unit: '元' },
              { key: 'chaoxi', label: '潮汐监狱', unit: '元' },
            ]" :cols="4" v-model:value="activeEscortConfig.maps" />
            <PriceGrid v-else :items="[
              { key: 'all', label: '不限', unit: '元' },
              { key: 'bashike', label: '巴克什', unit: '元' },
              { key: 'hangtian', label: '航天基地', unit: '元' },
              { key: 'chaoxi', label: '潮汐监狱', unit: '元' },
            ]" :cols="4" v-model:value="activeEscortConfig.maps" />
          </div>
        </section>
      </div>
    </div>

    <!-- 道具（撞车） -->
    <div v-if="active === 'prop'" class="body">
      <section class="config-section">
        <div class="section-head">
          <h4>道具</h4>
          <button type="button" class="btn-primary" @click="saveBlock('prop', '道具')">保存</button>
        </div>
        <div class="block">
          <PriceGrid :items="[
            { key: 'wxtx', label: '卫星通讯天线', unit: '元/个' },
            { key: 'gjkf', label: '高级咖啡豆', unit: '元/个' },
            { key: 'hjrl2', label: '火箭燃料', unit: '元/个' },
            { key: 'tydf', label: '天圆地方', unit: '元/个' },
            { key: 'zh', label: '纵横', unit: '元/个' },
          ]" :cols="4" v-model:value="data.itemsB" />
        </div>
      </section>
    </div>

    <!-- 称号（代肝） -->
    <div v-if="active === 'title'" class="body">
      <section class="config-section">
        <div class="section-head">
          <h4>称号（代肝）</h4>
          <button type="button" class="btn-primary" @click="saveBlock('title', '称号（代肝）')">保存</button>
        </div>
        <PriceGrid :items="[{ key: 'tjsn', label: '天才少年', unit: '元' }]" v-model:value="data.title" />
      </section>
    </div>

    <!-- 赛季3*3保险箱 -->
    <div v-if="active === 'safe3'" class="body">
      <section class="config-section">
        <div class="section-head">
          <h4>任务打包</h4>
          <button type="button" class="btn-primary" @click="saveBlock('taskPack', '任务打包')">保存</button>
        </div>
        <div class="block">
          <PriceGrid :items="[{ key: 'perTask', label: '任务数量', unit: '元/个' }]" v-model:value="data.taskPack" />
        </div>
      </section>
      <section class="config-section">
        <div class="section-head">
          <h4>任务单做</h4>
          <button type="button" class="btn-primary" @click="saveBlock('taskList', '任务单做')">保存</button>
        </div>
        <div class="block">
          <PriceGrid :items="[
            { key: 'baosun', label: '9格保险包损耗', unit: '元' },
            { key: 'stage1', label: '第一阶段任务', unit: '元' },
            { key: 'stage2', label: '第二阶段任务', unit: '元' },
            { key: 'stage3', label: '第三阶段任务', unit: '元' },
            { key: 'stage4', label: '第四阶段任务', unit: '元' },
            { key: 'fgbf', label: '征服标杆', unit: '元' },
            { key: 'zjll', label: '终局联系', unit: '元' },
            { key: 'qjcj', label: '勤俭持家', unit: '元' },
          ]" :cols="5" v-model:value="data.taskList" />
        </div>
      </section>
    </div>
    <!-- 趣味单 -->
    <div v-if="active === 'fun'" class="body">
      <div class="no-maintain">无需维护</div>
    </div>

  </div>
</template>

<style scoped>
.tab-bar { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; scrollbar-width: thin; border-bottom: 1px solid var(--border); margin-bottom: 18px; padding-bottom: 10px; }
.tab-bar::-webkit-scrollbar { display: none; }
.tab { flex: 0 0 auto; white-space: nowrap; border: 1px solid transparent; border-radius: 7px; background: transparent; padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-sub); transition: color .16s ease, background .16s ease, border-color .16s ease; }
.tab:hover { color: var(--primary); background: var(--primary-soft); }
.tab.active { border-color: var(--primary-border); background: var(--primary-soft); color: var(--primary); font-weight: 600; box-shadow: inset 0 -2px 0 var(--primary); }
.body { display: grid; gap: 14px; }
.config-section, .escort-section { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); box-shadow: var(--panel-shadow); }
.body > .block { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); box-shadow: var(--panel-shadow); }
.body > .block h4 { margin: 0 0 14px; font-size: 14px; color: var(--text-main); }
.config-section > .block, .escort-section > .block { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.escort-page { color: var(--text-main); }
.platform-switch { display: inline-flex; gap: 2px; margin: 0 0 14px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-app); }
.ps-item { border: 1px solid transparent; border-radius: 6px; background: transparent; padding: 6px 13px; cursor: pointer; font-size: 12.5px; color: var(--text-sub); transition: background .16s ease, color .16s ease, box-shadow .16s ease; }
.ps-item:hover { color: var(--primary); }
.ps-item:disabled { cursor: wait; opacity: .65; }
.ps-item.active { border-color: var(--border); background: var(--bg-card); color: var(--primary); font-weight: 600; box-shadow: var(--shadow); }
.escort-subtabs { display: flex; gap: 18px; overflow-x: auto; white-space: nowrap; border-bottom: 1px solid var(--border); margin: 0 0 14px; scrollbar-width: none; }
.escort-subtabs::-webkit-scrollbar { display: none; }
.escort-subtab { flex: 0 0 auto; border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 7px 3px 9px; cursor: pointer; color: var(--text-sub); font-size: 12.5px; }
.escort-subtab:hover, .escort-subtab.active { color: var(--primary); }
.escort-subtab.active { border-bottom-color: var(--primary); font-weight: 600; }
.escort-sections { display: grid; gap: 14px; }
.section-head { display: flex; align-items: center; justify-content: space-between; min-height: 30px; margin-bottom: 12px; }
.section-head h4 { margin: 0; font-size: 14px; color: var(--text-main); font-weight: 600; }
.material-head, .material-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.material-head.three-fields, .material-fields.three-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.material-head { padding: 10px 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg-thead); color: var(--text-sub); text-align: center; font-size: 11.5px; font-weight: 600; }
.material-fields { padding: 12px 7%; }
.material-fields label { display: flex; align-items: center; gap: 4px; min-width: 0; }
.material-fields input { width: 100%; min-width: 0; border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 8px 10px; background: var(--input-bg, var(--bg-card)); color: var(--text-main); outline: none; transition: border-color .16s ease, box-shadow .16s ease; }
.material-fields input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.price-note { margin: 10px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.6; }
.material-fields span { font-size: 12px; }
.escort-page :deep(.price-grid) { gap: 14px; }
.escort-page :deep(.cell-label) { color: var(--text-sub); }
.escort-page :deep(.cell-input) { border-radius: 7px; background: var(--input-bg, var(--bg-card)); }
.escort-page :deep(.cell-input input) { padding: 8px 0; }
.pair-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.p-item { display: grid; gap: 7px; min-width: 0; }
.p-item label { font-size: 12.5px; color: var(--text-sub); }
.p-item input { width: 100%; min-width: 0; border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 9px 11px; outline: none; background: var(--input-bg, var(--bg-card)); color: var(--text-main); transition: border-color .16s ease, box-shadow .16s ease; }
.p-item input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.unit-in { display: flex; align-items: center; gap: 8px; min-width: 0; border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 0 11px; background: var(--input-bg, var(--bg-card)); }
.unit-in:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.unit-in input { flex: 1; width: 0; min-width: 0; border: none; outline: none; padding: 9px 0; background: transparent; color: var(--text-main); }
.unit-in span { color: var(--text-sub); font-size: 12px; }
.note { margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: var(--text-sub); }
.btn-primary { border: 1px solid var(--primary); border-radius: 6px; padding: 7px 16px; background: var(--primary); color: var(--text-invert, #fff); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .16s ease, border-color .16s ease; }
.btn-primary:hover { border-color: var(--primary-hover); background: var(--primary-hover); }
.placeholder { padding: 36px; text-align: center; color: var(--text-sub); font-size: 13px; border: 1px dashed var(--border); border-radius: 9px; background: var(--bg-app); }
.no-maintain { min-height: 220px; display: grid; place-items: center; color: var(--text-sub); font-size: 14px; font-weight: 600; border: 1px dashed var(--border); border-radius: 11px; background: var(--bg-card); }
@media (max-width: 760px) {
  .material-head, .material-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .material-fields { padding: 10px 0; }
  .config-section, .escort-section, .body > .block { padding: 14px; }
  .pair-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
