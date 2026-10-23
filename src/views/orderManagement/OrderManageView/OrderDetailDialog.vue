<script setup>
import { computed, onMounted, reactive } from 'vue';
import { useToast } from '../../../composables/useToast';
import { STATUS_CLASS } from './mockData';
import { slotSourceText, orderApi } from '../../../api/modules/order';

/**
 * 订单详情弹窗内容（查看视图，接口联调 + 原型 UI 恢复）
 * 数据来源：GET /api/admin/orders/{id}（订单详情）+ GET /api/admin/orders/{id}/logs（订单日志）
 *   + POST /api/admin/orders/{id}/profit-details（订单分润明细）
 * - 打手信息来自 slots（后端已补齐 playerName/clubName/takenAt/transferredAt）；
 *   展示规则：transferredAt 空 → 接单时间，有值 → 转单时间，转出的打手排后面
 * - 平台/俱乐部加减价为净值（减价为负）；分润明细按原型展示加价分摊格式（如 40.12元=20.12元+20.00元）
 * - 分润明细：接口已提供（profit-details），分润未锁定（available=false）时不展示数值（—）
 * - 存单：详情 hold 对象（form/stored/warrantyTarget/reason/rounds/shots/doneAmount/remainAmount/remark）
 * - 完成凭证：coverUrl 首图 / endUrl 尾图 / progressUrls 进程图
 */
const props = defineProps({
  row: { type: Object, required: true },
  logs: { type: Array, default: () => [] },
});

const { show } = useToast();

const money = (value) => (Number(value) || 0).toFixed(2);

/** 加减价净值展示：减价为负 */
const adjustText = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '0.00元';
  return `${n > 0 ? '+' : '-'}${money(Math.abs(n))}元`;
};

/* ===== 分润明细（POST /api/admin/orders/{id}/profit-details） ===== */
const profitState = reactive({ loading: false, data: null, error: '' });

const profitDisplay = computed(() => {
  const d = profitState.data;
  if (!d || d.available === false) return null;
  const playerAmount = (d.shares || [])
    .filter((s) => s.ownerType === 'PLAYER')
    .reduce((sum, s) => sum + (Number(s.amount) || 0) + (Number(s.tailAmount) || 0), 0);
  // 原型格式：工作室分润 = 基础 + 平台加价分摊（如 40.12元=20.12元+20.00元）；打手分润同理含俱乐部加价
  const platformAdjust = Number(d.platformAdjust) || 0;
  const clubAdjust = Number(d.clubAdjust) || 0;
  return {
    platform: money(d.platformAmount),
    club: money(d.clubAmount),
    clubBase: money((Number(d.clubAmount) || 0) - platformAdjust),
    clubExtra: platformAdjust > 0 ? money(platformAdjust) : null,
    player: money(playerAmount),
    playerBase: money(playerAmount - clubAdjust),
    playerExtra: clubAdjust > 0 ? money(clubAdjust) : null,
  };
});

async function loadProfit() {
  if (!props.row.id) return;
  profitState.loading = true;
  try {
    profitState.data = await orderApi.profitDetail(props.row.id);
    if (profitState.data && profitState.data.available === false) {
      profitState.error = '分润未锁定，暂无可展示明细';
    }
  } catch (e) {
    profitState.error = e?.message || '分润明细加载失败';
  } finally {
    profitState.loading = false;
  }
}

onMounted(loadProfit);

const clientsText = computed(() =>
  props.row.clients ? String(props.row.clients).split(/[,，]/).filter(Boolean).join('、') : '—'
);

const players = computed(() => {
  const list = (props.row.slots || []).map((s) => ({
    slotNo: s.slotNo,
    playerId: s.playerId,
    playerName: s.playerName || '',
    clubName: s.clubName || '',
    clubId: s.clubId,
    source: slotSourceText(s.source),
    takenAt: s.takenAt || '',
    transferredAt: s.transferredAt || '',
  }));
  // 展示规则（后端口径）：当前在单的打手排前面（无转单时间），被转出的排后面并带转单时间
  return list
    .slice()
    .sort((a, b) => (a.transferredAt ? 1 : 0) - (b.transferredAt ? 1 : 0) || a.slotNo - b.slotNo);
});

/** 存单：三角洲订单且进行中 展示（原型：存单信息仅进行中订单下展示） */
const isDelta = computed(() => props.row.gameName === '三角洲行动');
/** 用户自定义下单：详情不展示游戏规格（原型：自定义下单时详情没有游戏规格字段） */
const isCustomOrder = computed(
  () => props.row.orderModeCode === 'CUSTOM' || props.row.orderMode === '用户自定义下单',
);
const showDeposit = computed(() => isDelta.value && props.row.status === '进行中');

/** 完成凭证：进行中/已完成/交易关闭 展示（coverUrl 首图 / endUrl 尾图 / progressUrls 进程图，接口已返回） */
const hasProof = computed(() => ['进行中', '已完成', '交易关闭'].includes(props.row.status));

/* ===== 复制 ===== */
async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(String(text));
  } catch {
    const ta = document.createElement('textarea');
    ta.value = String(text);
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  show('已复制', 'success');
}
</script>

<template>
  <div class="order-detail">
    <div class="detail-owner">所属客服：{{ row.claimerName || '—' }} ({{ row.claimerCorp || '—' }})</div>

    <!-- 订单信息 -->
    <section class="detail-section">
      <h4>订单信息</h4>
      <div class="kv-grid">
        <div class="kv">
          <span>订单号</span>
          <strong class="copyable" @click="copyText(row.orderNo)">{{ row.orderNo }}<em>复制</em></strong>
        </div>
        <div class="kv">
          <span>第三方订单号</span>
          <strong class="copyable" @click="copyText(row.thirdOrderNo)">{{ row.thirdOrderNo }}<em>复制</em></strong>
        </div>
        <div class="kv"><span>渠道</span><strong>{{ row.channel || '—' }}</strong></div>
        <div class="kv"><span>游戏名称</span><strong>{{ row.gameName || '—' }}</strong></div>
        <div class="kv"><span>购买项目</span><strong>{{ row.product || '—' }}</strong></div>
        <!-- 原型：自定义下单时详情没有游戏规格字段 -->
        <div v-if="!isCustomOrder" class="kv"><span>游戏规格</span><strong>{{ row.spec || '—' }}</strong></div>
        <div class="kv"><span>订单类型</span><strong>{{ row.orderType || '—' }}</strong></div>
        <div class="kv"><span>下单方式</span><strong>{{ row.orderMode || '—' }}</strong></div>
        <div class="kv"><span>客户端</span><strong>{{ clientsText }}</strong></div>
        <div class="kv"><span>打手人数</span><strong>{{ row.playerCount != null ? row.playerCount : '—' }}</strong></div>
        <div class="kv">
          <span>订单状态</span>
          <strong><span class="status-badge" :class="STATUS_CLASS[row.status] || 'status-info'">{{ row.status }}</span></strong>
        </div>
        <div class="kv">
          <span>组队码</span>
          <strong v-if="row.groupCode" class="copyable" @click="copyText(row.groupCode)">{{ row.groupCode }}<em>复制</em></strong>
          <strong v-else>—</strong>
        </div>
        <div class="kv">
          <span>角色名</span>
          <strong v-if="row.roleName" class="copyable" @click="copyText(row.roleName)">{{ row.roleName }}<em>复制</em></strong>
          <strong v-else>—</strong>
        </div>
        <div class="kv"><span>创单时间</span><strong>{{ row.createTime || '—' }}</strong></div>
        <div class="kv"><span>订单金额(元)</span><strong>{{ money(row.amount) }}</strong></div>
      </div>
      <div class="kv-line">
        <span>企微群二维码</span>
        <el-image
          v-if="row.groupQrUrl"
          :src="row.groupQrUrl"
          class="qr-img"
          alt="企微群二维码"
          fit="cover"
          :preview-src-list="[row.groupQrUrl]"
          preview-teleported
        />
        <strong v-else class="muted-text">暂无上传</strong>
      </div>
    </section>

    <!-- 存单（三角洲订单展示；详情 hold 对象：form/stored/warrantyTarget/reason/rounds/shots/doneAmount/remainAmount/remark） -->
    <section v-if="showDeposit" class="detail-section">
      <h4>存单</h4>
      <template v-if="row.hold">
        <div class="kv-grid">
          <div class="kv"><span>存单表单</span><strong>{{ row.hold.form === 'REMARK' ? '存单备注' : '保底把数' }}</strong></div>
          <div class="kv"><span>是否存单</span><strong>{{ row.hold.stored ? '是' : '否' }}</strong></div>
          <div v-if="row.hold.form === 'WARRANTY' && row.hold.warrantyTarget != null" class="kv"><span>保底目标(W)</span><strong>{{ row.hold.warrantyTarget }}</strong></div>
          <div v-if="row.hold.reason" class="kv"><span>存单原因</span><strong>{{ row.hold.reason }}</strong></div>
          <div v-if="row.hold.form === 'WARRANTY' && row.hold.rounds && row.hold.rounds.length" class="kv"><span>各把金额(W)</span><strong>{{ row.hold.rounds.join('、') }}</strong></div>
          <div v-if="row.hold.doneAmount != null" class="kv"><span>完成量(W)</span><strong>{{ row.hold.doneAmount }}</strong></div>
          <div v-if="row.hold.remainAmount != null" class="kv"><span>剩余量(W)</span><strong>{{ row.hold.remainAmount }}</strong></div>
        </div>
        <div class="kv-line">
          <span>剩余保底截图</span>
          <div v-if="row.hold.shots && row.hold.shots.length" class="deposit-imgs">
            <el-image
              v-for="(img, i) in row.hold.shots"
              :key="i"
              :src="img"
              alt="剩余保底截图"
              fit="cover"
              :preview-src-list="row.hold.shots"
              :initial-index="i"
              preview-teleported
            />
          </div>
          <strong v-else class="muted-text">暂无上传</strong>
        </div>
        <div v-if="row.hold.remark" class="kv-line"><span>存单备注</span><strong>{{ row.hold.remark }}</strong></div>
      </template>
      <p v-else class="muted-text">暂无存单数据</p>
    </section>

    <!-- 打手信息（slots：playerName/clubName/takenAt/transferredAt 已由后端补齐；
         展示规则：transferredAt 空 → 接单时间，有值 → 转单时间，转出的排后面） -->
    <section v-if="players.length" class="detail-section">
      <h4>打手信息</h4>
      <div class="player-grid">
        <div v-for="p in players" :key="`${p.slotNo}-${p.playerId}`" class="player-card">
          <div class="player-line">
            <strong>{{ p.playerName || '未命名打手' }}（{{ p.playerId }}）</strong>
            <span>{{ p.clubName || '—' }}{{ p.clubId ? `（${p.clubId}）` : '' }}</span>
            <span class="player-time">{{ p.transferredAt ? `转单时间：${p.transferredAt}` : `接单时间：${p.takenAt || '—'}` }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 分润信息（POST /api/admin/orders/{id}/profit-details，未锁定分润时 available=false） -->
    <section class="detail-section">
      <h4>分润信息</h4>
      <div class="kv-grid">
        <div class="kv"><span>平台加价/减价</span><strong>{{ adjustText(row.platformAdjust) }}</strong></div>
        <div class="kv"><span>俱乐部加价/减价</span><strong>{{ adjustText(row.clubAdjust) }}</strong></div>
        <template v-if="profitState.loading">
          <div class="kv"><span>平台分润(元)</span><strong class="muted-text">—</strong></div>
        </template>
        <template v-else-if="profitDisplay">
          <div class="kv"><span>平台分润(元)</span><strong>{{ profitDisplay.platform }}</strong></div>
          <div class="kv"><span>工作室分润(元)</span><strong>{{ profitDisplay.clubExtra ? `${profitDisplay.club}元=${profitDisplay.clubBase}元+${profitDisplay.clubExtra}元` : profitDisplay.club }}</strong></div>
          <div class="kv"><span>打手分润(元)</span><strong>{{ profitDisplay.playerExtra ? `${profitDisplay.player}元=${profitDisplay.playerBase}元+${profitDisplay.playerExtra}元` : profitDisplay.player }}</strong></div>
        </template>
        <template v-else>
          <div class="kv"><span>平台分润(元)</span><strong class="muted-text">—</strong></div>
          <div class="kv"><span>工作室分润(元)</span><strong class="muted-text">—</strong></div>
          <div class="kv"><span>打手分润(元)</span><strong class="muted-text">—</strong></div>
        </template>
      </div>
    </section>

    <!-- 订单日志（接口：logs） -->
    <section class="detail-section">
      <h4>订单日志</h4>
      <ul v-if="logs.length" class="log-list">
        <li v-for="(log, i) in logs" :key="i">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-text">{{ log.text }}</span>
          <span class="log-op">操作人：{{ log.op }}</span>
        </li>
      </ul>
      <p v-else class="muted-text">暂无日志</p>
    </section>

    <!-- 完成凭证（coverUrl 首图 / endUrl 尾图 / progressUrls 进程图，接口已返回） -->
    <section class="detail-section">
      <h4>完成凭证</h4>
      <div v-if="hasProof" class="proof-grid">
        <div class="proof-box">
          <span>首图</span>
          <el-image
            v-if="row.proofFirst"
            :src="row.proofFirst"
            alt="首图"
            fit="contain"
            :preview-src-list="[row.proofFirst]"
            preview-teleported
          />
          <em v-else>未上传</em>
          <em v-if="row.proofFirst">{{ row.proofUploadTime }} 上传</em>
        </div>
        <div class="proof-box">
          <span>尾图</span>
          <el-image
            v-if="row.proofLast"
            :src="row.proofLast"
            alt="尾图"
            fit="contain"
            :preview-src-list="[row.proofLast]"
            preview-teleported
          />
          <em v-else>未上传</em>
          <em v-if="row.proofLast">{{ row.proofUploadTime }} 上传</em>
        </div>
        <div class="proof-box">
          <span>进程图</span>
          <div v-if="row.proofProcess && row.proofProcess.length" class="proof-imgs">
            <el-image
              v-for="(img, i) in row.proofProcess"
              :key="i"
              :src="img"
              alt="进程图"
              fit="cover"
              :preview-src-list="row.proofProcess"
              :initial-index="i"
              preview-teleported
            />
          </div>
          <em v-else>未上传</em>
          <em v-if="row.proofProcess && row.proofProcess.length">{{ row.proofUploadTime }} 上传</em>
        </div>
      </div>
      <div v-else class="muted-text">暂无数据</div>
      <div v-if="row.playerRemark" class="kv-line"><span>打手备注</span><strong>{{ row.playerRemark }}</strong></div>
      <div v-if="row.lastRejectReason" class="kv-line"><span>上次驳回原因</span><strong class="reject-text">{{ row.lastRejectReason }}</strong></div>
    </section>

    <!-- 订单备注（查看视图：只读回显） -->
    <section class="detail-section">
      <h4>订单备注</h4>
      <p class="muted-text">{{ row.remark || '暂无备注' }}</p>
    </section>
  </div>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: 18px;
  max-height: 62vh;
  overflow: auto;
  padding-right: 4px;
}

.detail-owner {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.detail-section {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-card);
}

.detail-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  line-height: 1.2;
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
}

.kv,
.kv-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.kv span,
.kv-line span {
  flex: 0 0 auto;
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.6;
}

.kv strong,
.kv-line strong {
  min-width: 0;
  color: var(--text-main);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.6;
  word-break: break-all;
}

/* 可复制字段 */
.copyable {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.15s ease;
}

.copyable:hover {
  border-bottom-color: var(--primary);
}

.copyable em {
  font-style: normal;
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 4px;
  padding: 1px 6px;
  flex: 0 0 auto;
}

.reject-text {
  color: #d92d20 !important;
}

.status-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.08); }
.status-warning { color: #b45309; background: rgba(180, 83, 9, 0.08); }
.status-info { color: #1d4ed8; background: rgba(29, 78, 216, 0.08); }
.status-danger { color: #d92d20; background: rgba(217, 45, 32, 0.08); }
.status-muted { color: #475467; background: rgba(71, 84, 103, 0.08); }

.muted-text {
  color: var(--text-faint) !important;
  font-weight: 400 !important;
  margin: 0;
}

.qr-img {
  width: 96px;
  height: 72px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.deposit-imgs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.deposit-imgs .el-image {
  width: 72px;
  height: 54px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.player-card {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-sub);
}

.player-card strong {
  color: var(--text-main);
  font-size: 13px;
}

/* 打手卡片一行三段：姓名（ID）｜俱乐部（ID）｜接单/转单时间 */
.player-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.player-line strong::after {
  content: '｜';
  margin-left: 8px;
  color: var(--text-faint);
  font-weight: 400;
}

.player-time {
  color: var(--text-faint);
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.log-list li {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 12px;
  align-items: baseline;
  font-size: 12.5px;
  color: var(--text-sub);
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

.log-time {
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}

.log-op {
  color: var(--text-faint);
  font-size: 12px;
}

.form-tip {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.28);
  color: var(--warning-text);
  font-size: 12px;
  line-height: 1.8;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.proof-box {
  display: grid;
  gap: 6px;
  padding: 14px 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  text-align: center;
  background: var(--bg-card);
}

.proof-box span {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.proof-box .el-image {
  max-width: 100%;
  max-height: 90px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.proof-box em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-faint);
}

.proof-imgs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.proof-imgs .el-image {
  width: 64px;
  height: 48px;
}
</style>
