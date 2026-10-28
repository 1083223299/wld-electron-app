// SpecPriceConfigView 组件，用于管理各游戏的规格价目配置
<script setup>
import { onMounted, reactive, ref } from 'vue';
import { specPriceApi } from '../../../api/modules/specPrice';
import { useToast } from '../../../composables/useToast';
import HonorTemplate from '../SpecPriceConfig/templates/HonorTemplate.vue';
import DeltaTemplate from '../SpecPriceConfig/templates/DeltaTemplate.vue';
import ValorantTemplate from '../SpecPriceConfig/templates/ValorantTemplate.vue';
import LeagueTemplate from '../SpecPriceConfig/templates/LeagueTemplate.vue';
import {
  buildPricePayload,
  getTypeCode,
  mapApiList,
  mapCatalogGames,
  mapGamePrices,
  migrateLegacyHonorPriceRows,
} from './priceAdapter';

/* ================= 游戏入口列表 ================= */
const view = ref('list'); // list | detail
const games = ref([]);
const loading = ref(false);
const loadError = ref('');
const detailLoading = ref(false);
const refreshingEscortPlatform = ref(false);
const detailError = ref('');
const savingTypeCodes = ref(new Set());
const { show } = useToast();

// 原型中的四款游戏；英雄联盟进入后显示“无需维护”。
function inferTypeKey(name = '') {
  const normalizedName = String(name).trim().toLowerCase();
  if (normalizedName.includes('王者荣耀')) return 'honor';
  if (normalizedName.includes('三角洲')) return 'delta';
  if (/无畏契约|瓦罗兰特|valorant/.test(normalizedName)) return 'valorant';
  if (normalizedName.includes('英雄联盟') || normalizedName === 'lol' || normalizedName === 'league of legends') return 'league';
  return '';
}

async function fetchGames() {
  loading.value = true;
  loadError.value = '';
  try {
    const all = mapCatalogGames(await specPriceApi.listGames());
    games.value = all
      .map((game) => ({
        ...game,
        id: game.gameId ?? game.id,
        name: game.gameName ?? game.name ?? '',
        typeKey: inferTypeKey(game.gameName ?? game.name),
      }))
      .filter((game) => ['honor', 'delta', 'valorant', 'league'].includes(game.typeKey))
      .sort((a, b) => Number(a.sortNo || 0) - Number(b.sortNo || 0));
  } catch (error) {
    games.value = [];
    loadError.value = error?.name === 'AbortError' || error?.message === 'Failed to fetch'
      ? '游戏列表加载失败，请检查后台服务连接后重试。'
      : error?.message || '游戏列表加载失败，请检查网络或服务状态。';
  } finally {
    loading.value = false;
  }
}
onMounted(fetchGames);

/* ================= 详情 ================= */
const currentGame = ref(null);
const cfg = reactive({});
const rawPricesByType = ref({});
const currentTypes = ref([]);
const currentRankOptions = ref([]);
const currentPlacementSeasons = ref([]);

async function fetchGameData(game) {
  const [typeResponse, rankCatalog] = await Promise.all([
    specPriceApi.listTypes(game.id),
    game.typeKey === 'delta' ? Promise.resolve(null) : specPriceApi.listRanks(game.id),
  ]);
  const types = mapApiList(typeResponse);
  const priceResults = await Promise.all(types.map(async (type) => {
    const rows = mapApiList(await specPriceApi.listPrices(game.id, type.typeCode));
    return [type.typeCode, rows];
  }));
  const rawPrices = Object.fromEntries(priceResults);
  return {
    types,
    ranks: rankCatalog?.ranks || [],
    placementSeasons: rankCatalog?.placementSeasons || [],
    rawPrices,
    data: {
      ...mapGamePrices(game.typeKey, types, rawPrices).data,
      ...(game.typeKey === 'league' ? { placementSeasons: rankCatalog?.placementSeasons || [] } : {}),
    },
  };
}

async function openGame(game) {
  currentGame.value = game;
  view.value = 'detail';
  detailLoading.value = true;
  detailError.value = '';
  rawPricesByType.value = {};
  currentTypes.value = [];
  currentRankOptions.value = [];
  currentPlacementSeasons.value = [];
  try {
    const result = await fetchGameData(game);
    currentTypes.value = result.types;
    currentRankOptions.value = result.ranks;
    currentPlacementSeasons.value = result.placementSeasons;
    rawPricesByType.value = result.rawPrices;
    cfg[game.id] = result.data;
  } catch (error) {
    detailError.value = error?.message || '规格价目加载失败，请检查接口或稍后重试。';
  } finally {
    detailLoading.value = false;
  }
}

async function refreshGameData(game) {
  try {
    const result = await fetchGameData(game);
    if (currentGame.value?.id !== game.id) return;
    currentTypes.value = result.types;
    currentRankOptions.value = result.ranks;
    currentPlacementSeasons.value = result.placementSeasons;
    rawPricesByType.value = result.rawPrices;
    cfg[game.id] = result.data;
  } catch (error) {
    detailError.value = error?.message || '规格价目刷新失败，请检查接口或稍后重试。';
  }
}

function backToList() {
  view.value = 'list';
  currentGame.value = null;
  detailError.value = '';
}

async function retryLoadGame() {
  if (currentGame.value) await openGame(currentGame.value);
}

async function refreshEscortPlatform(platform) {
  const game = currentGame.value;
  const typeCode = getTypeCode('delta', 'escort');
  if (!game || game.typeKey !== 'delta' || detailLoading.value || !cfg[game.id]) return;
  if (!currentTypes.value.some((type) => type.typeCode === typeCode)) {
    show(`接口类型列表中没有「${typeCode}」，无法刷新平台价目`, 'error');
    return;
  }

  refreshingEscortPlatform.value = true;
  try {
    const rows = mapApiList(await specPriceApi.listPrices(game.id, typeCode));
    if (currentGame.value?.id !== game.id || !cfg[game.id]) return;
    const nextRawPrices = { ...rawPricesByType.value, [typeCode]: rows };
    const mapped = mapGamePrices(game.typeKey, currentTypes.value, nextRawPrices);
    rawPricesByType.value = nextRawPrices;
    cfg[game.id].escortModes[platform] = mapped.data.escortModes[platform];
  } catch (error) {
    show(error?.message || `${platform}价目刷新失败，请检查网络或服务状态。`, 'error');
  } finally {
    refreshingEscortPlatform.value = false;
  }
}

async function savePrices({ section, onSaved }) {
  if (!currentGame.value || detailLoading.value || detailError.value) return;
  const game = currentGame.value;
  const typeCode = getTypeCode(game.typeKey, section);
  if (!typeCode || savingTypeCodes.value.has(typeCode)) return;
  const existingRows = rawPricesByType.value[typeCode] || [];
  const migration = game.typeKey === 'honor'
    ? migrateLegacyHonorPriceRows(typeCode, existingRows)
    : { rows: existingRows };
  const data = cfg[game.id];
  const payload = buildPricePayload(game.typeKey, game.id, typeCode, data, migration.rows);

  savingTypeCodes.value.add(typeCode);
  try {
    await specPriceApi.replacePrices(game.id, typeCode, payload);
    rawPricesByType.value[typeCode] = payload;
    onSaved?.();
    show('保存成功', 'success');
    await refreshGameData(game);
  } catch {
    // 请求错误由 request.js 统一提示；失败后仍回读接口，丢弃未保存的本地编辑值。
    await refreshGameData(game);
  } finally {
    savingTypeCodes.value.delete(typeCode);
  }
}
</script>

<template>
  <div class="spec-price-page">
    <!-- ============ 入口列表 ============ -->
    <div v-if="view === 'list'" class="list-panel">
      <div class="panel-head">
        <h3>自定义规格价格配置</h3>
      </div>
      <div class="game-entry-table">
        <div class="g-row g-head">
          <span>游戏名称</span>
          <span>操作</span>
        </div>
        <div v-if="loading" class="g-empty">
          <span class="loading-indicator" aria-hidden="true"></span>
          正在加载游戏…
        </div>
        <div v-else-if="loadError" class="g-empty load-error">
          <span>{{ loadError }}</span>
          <button type="button" class="retry-btn" @click="fetchGames">重试</button>
        </div>
        <div v-else-if="!games.length" class="g-empty">暂无游戏</div>
        <div v-for="g in games" :key="g.id" class="g-row">
          <span>{{ g.name }}</span>
          <button type="button" class="link-btn" @click="openGame(g)">编辑</button>
        </div>
      </div>
    </div>

    <!-- ============ 详情 ============ -->
    <div v-else class="detail-panel">
      <div class="detail-top">
        <button type="button" class="back-btn" @click="backToList">&lt; 返回</button>
        <h3>{{ currentGame?.name }}</h3>
      </div>

      <div v-if="detailLoading" class="g-empty">
        <span class="loading-indicator" aria-hidden="true"></span>
        正在加载类型和价目…
      </div>
      <div v-else-if="detailError" class="g-empty load-error">
        <span>{{ detailError }}</span>
        <button type="button" class="retry-btn" @click="retryLoadGame">重试</button>
      </div>
      <template v-else-if="cfg[currentGame?.id]">
        <HonorTemplate
          v-if="currentGame?.typeKey === 'honor'"
          :data="cfg[currentGame.id]"
          :rank-options="currentRankOptions"
          @save="savePrices"
        />
        <DeltaTemplate
          v-else-if="currentGame?.typeKey === 'delta'"
          :data="cfg[currentGame.id]"
          :platform-loading="refreshingEscortPlatform"
          @save="savePrices"
          @platform-change="refreshEscortPlatform"
        />
        <ValorantTemplate
          v-else-if="currentGame?.typeKey === 'valorant'"
          :data="cfg[currentGame.id]"
          :rank-options="currentRankOptions"
          @save="savePrices"
        />
        <LeagueTemplate
          v-else-if="currentGame?.typeKey === 'league'"
          :data="cfg[currentGame.id]"
          :rank-options="currentRankOptions"
          :placement-seasons="currentPlacementSeasons"
          @save="savePrices"
        />
        <div v-else class="empty-tip">该游戏暂无特殊规格配置模板</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.spec-price-page { height: 100%; }
.list-panel, .detail-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--panel-shadow);
}
.panel-head { margin-bottom: 16px; }
.panel-head h3 { margin: 0; font-size: 18px; color: var(--text-main); letter-spacing: -.01em; }

.game-entry-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--bg-card); }
.g-row { display: grid; grid-template-columns: 1fr 120px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border-faint); font-size: 13.5px; transition: background .16s ease; }
.g-row:last-child { border-bottom: none; }
.g-row:not(.g-head):hover { background: var(--bg-hover); }
.g-head { background: var(--bg-thead); color: var(--text-sub); font-weight: 600; }
.g-empty { padding: 40px; text-align: center; color: var(--text-sub); }
.g-empty.load-error { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; color: var(--danger, #d92d20); }
.loading-indicator { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border, #e3e7f0); border-top-color: var(--primary); border-radius: 50%; vertical-align: -2px; animation: loading-spin .7s linear infinite; }
.retry-btn { border: 1px solid var(--primary-border-strong); border-radius: 6px; padding: 7px 14px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.retry-btn:hover { border-color: var(--primary); }
@keyframes loading-spin { to { transform: rotate(360deg); } }
.link-btn { justify-self: end; border: 1px solid var(--primary-border); border-radius: 6px; padding: 6px 14px; background: var(--primary-soft); color: var(--primary); cursor: pointer; font-size: 12.5px; font-weight: 600; transition: border-color .16s ease, background .16s ease; }
.link-btn:hover { border-color: var(--primary-border-strong); background: var(--primary-faint); }

.detail-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.detail-top h3 { margin: 0; font-size: 18px; color: var(--text-main); letter-spacing: -.01em; flex: 1; }
.back-btn { border: 1px solid var(--border); border-radius: 6px; padding: 6px 11px; background: var(--bg-card); color: var(--text-sub); cursor: pointer; font-size: 12.5px; transition: color .16s ease, border-color .16s ease, background .16s ease; }
.back-btn:hover { color: var(--primary); border-color: var(--primary-border-strong); background: var(--primary-soft); }
.empty-tip { padding: 40px; text-align: center; color: var(--text-sub); font-size: 13px; }
</style>
