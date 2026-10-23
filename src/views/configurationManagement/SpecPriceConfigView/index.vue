<script setup>
import { onMounted, reactive, ref } from 'vue';
import { gameApi } from '../../../api/modules/game';
import HonorTemplate from '../SpecPriceConfig/templates/HonorTemplate.vue';
import DeltaTemplate from '../SpecPriceConfig/templates/DeltaTemplate.vue';
import ValorantTemplate from '../SpecPriceConfig/templates/ValorantTemplate.vue';
import LeagueTemplate from '../SpecPriceConfig/templates/LeagueTemplate.vue';

/* ================= 游戏入口列表 ================= */
const view = ref('list'); // list | detail
const games = ref([]);
const loading = ref(false);

async function fetchGames() {
  loading.value = true;
  try {
    const all = await gameApi.listAll();
    games.value = Array.isArray(all) ? all : [];
  } catch {
    games.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(fetchGames);

/* ================= 详情 ================= */
const currentGame = ref(null);
const cfg = reactive({});

// 按游戏名匹配原型模板（后端未返回分类，先按名称匹配；仅原型出现的四个游戏）
function inferTypeKey(name = '') {
  if (/王者荣耀/.test(name)) return 'honor';
  if (/三角洲/.test(name)) return 'delta';
  if (/无畏契约|瓦罗兰特|valorant/i.test(name)) return 'valorant';
  if (/英雄联盟|lol/i.test(name)) return 'league';
  return '';
}

function openGame(game) {
  currentGame.value = { ...game, typeKey: inferTypeKey(game.name) };
  if (!cfg[game.id]) cfg[game.id] = {};
  view.value = 'detail';
}

function backToList() {
  view.value = 'list';
  currentGame.value = null;
}
</script>

<template>
  <div class="spec-price-page">
    <!-- ============ 入口列表 ============ -->
    <div v-if="view === 'list'" class="list-panel">
      <div class="panel-head">
        <h3>自定义规格价格配置</h3>
        <p class="head-note">注：在游戏管理中维护的游戏并不全在此处展示，此处展示的游戏都需要开发配置游戏特殊规格。</p>
      </div>
      <div class="game-entry-table">
        <div class="g-row g-head">
          <span>游戏名称</span>
          <span>操作</span>
        </div>
        <div v-if="!games.length && !loading" class="g-empty">暂无游戏</div>
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

      <HonorTemplate v-if="currentGame?.typeKey === 'honor'" :data="cfg[currentGame.id]" />
      <DeltaTemplate v-else-if="currentGame?.typeKey === 'delta'" :data="cfg[currentGame.id]" />
      <ValorantTemplate v-else-if="currentGame?.typeKey === 'valorant'" :data="cfg[currentGame.id]" />
      <LeagueTemplate v-else-if="currentGame?.typeKey === 'league'" />
      <div v-else class="empty-tip">该游戏暂无特殊规格配置模板</div>
    </div>
  </div>
</template>

<style scoped>
.spec-price-page { height: 100%; }
.list-panel, .detail-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
}
.panel-head h3 { margin: 0 0 6px; font-size: 17px; color: var(--text-main); }
.head-note { margin: 0 0 16px; font-size: 12.5px; color: var(--text-sub); }

.game-entry-table { border: 1px solid var(--border-faint, #eef1f6); border-radius: 12px; overflow: hidden; }
.g-row { display: grid; grid-template-columns: 1fr 120px; padding: 14px 18px; border-bottom: 1px solid var(--border-faint, #eef1f6); font-size: 13.5px; }
.g-row:last-child { border-bottom: none; }
.g-head { background: var(--bg-thead, #f6f7fb); color: var(--text-sub); font-weight: 600; }
.g-empty { padding: 40px; text-align: center; color: var(--text-sub); }
.link-btn { border: none; background: transparent; color: #2563eb; cursor: pointer; font-size: 13px; }

.detail-top { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.detail-top h3 { margin: 0; font-size: 17px; flex: 1; }
.back-btn { border: none; background: transparent; color: var(--text-sub); cursor: pointer; font-size: 13px; }
.empty-tip { padding: 40px; text-align: center; color: var(--text-sub); font-size: 13px; }
</style>
