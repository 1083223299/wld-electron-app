<script setup>
import { computed } from 'vue';
import { useToast } from '../../../composables/useToast';
import { STATUS_CLASS } from './mockData';
import { slotSourceText } from '../../../api/modules/order';

/**
 * 订单详情弹窗内容（查看视图，接口联调 + 原型 UI 恢复）
 * 数据来源：GET /api/admin/orders/{id}（订单详情）+ GET /api/admin/orders/{id}/logs（订单日志）
 * - 打手信息来自 slots（名额列表：slotNo/playerId/source）
 * - 平台/俱乐部加减价为净值（减价为负）；结算到期/账期天数来自详情
 * - 分润明细接口未提供，按原型比例（平台30%/工作室40%/打手30%）估算展示
 * - 组队码/角色名/企微群二维码/存单/完成凭证 等字段接口未返回，
 *   保留原型区块并展示兜底值（待后端补充字段后自动有数据）
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

/** 分润信息（接口未提供分润明细，按原型示例比例估算：平台30% / 工作室40% / 打手30%） */
const profit = computed(() => {
  const amount = Number(props.row.amount) || 0;
  return {
    platform: money(amount * 0.3),
    studio: money(amount * 0.4),
    player: money(amount * 0.3),
  };
});

const clientsText = computed(() =>
  props.row.clients ? String(props.row.clients).split(/[,，]/).filter(Boolean).join('、') : '—'
);

const players = computed(() =>
  (props.row.slots || []).map((s) => ({
    slotNo: s.slotNo,
    playerId: s.playerId,
    source: slotSourceText(s.source),
  }))
);

/** 存单：三角洲订单且进行中/已完成 展示（接口未返回字段，兜底展示） */
const isDelta = computed(() => props.row.gameName === '三角洲行动');
const showDeposit = computed(() => isDelta.value && ['进行中', '已完成'].includes(props.row.status));

/** 完成凭证：进行中/已完成/交易关闭 展示（接口未返回字段，兜底展示） */
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
        <div class="kv"><span>店铺ID</span><strong>{{ row.shopId || '—' }}</strong></div>
        <div class="kv"><span>游戏名称</span><strong>{{ row.gameName || '—' }}</strong></div>
        <div class="kv"><span>购买项目</span><strong>{{ row.product || '—' }}</strong></div>
        <div class="kv"><span>游戏规格</span><strong>{{ row.spec || '—' }}</strong></div>
        <div class="kv"><span>订单类型</span><strong>{{ row.orderType || '—' }}</strong></div>
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
        <div class="kv"><span>创建时间</span><strong>{{ row.createTime || '—' }}</strong></div>
        <div class="kv"><span>订单金额(元)</span><strong>{{ money(row.amount) }}</strong></div>
      </div>
      <div class="kv-line">
        <span>企微群二维码</span>
        <img v-if="row.qrImg" :src="row.qrImg" class="qr-img" alt="企微群二维码" />
        <strong v-else class="muted-text">暂无上传（字段接口待后端补充）</strong>
      </div>
    </section>

    <!-- 存单（三角洲订单展示；字段接口未提供，兜底展示） -->
    <section v-if="showDeposit" class="detail-section">
      <h4>存单</h4>
      <div class="kv-grid">
        <div class="kv"><span>保底目标(W)</span><strong>{{ row.depositTarget || '1000' }}</strong></div>
        <div class="kv"><span>存单原因</span><strong>{{ row.depositReason || '—' }}</strong></div>
        <div class="kv"><span>第一把(W)</span><strong>{{ row.depositFirst || '500' }}</strong></div>
        <div class="kv"><span>第二把(W)</span><strong>{{ row.depositSecond || '500' }}</strong></div>
      </div>
      <div class="kv-line">
        <span>剩余保底截图</span>
        <div v-if="row.depositImages && row.depositImages.length" class="deposit-imgs">
          <img v-for="(img, i) in row.depositImages" :key="i" :src="img" alt="剩余保底截图" />
        </div>
        <strong v-else class="muted-text">暂无上传（字段接口待后端补充）</strong>
      </div>
      <div v-if="row.depositRemark" class="kv-line"><span>存单备注</span><strong>{{ row.depositRemark }}</strong></div>
    </section>

    <!-- 打手信息（slots 名额列表；接单/转单时间字段接口未提供） -->
    <section v-if="players.length" class="detail-section">
      <h4>打手信息</h4>
      <div class="player-grid">
        <div v-for="p in players" :key="`${p.slotNo}-${p.playerId}`" class="player-card">
          <strong>打手ID：{{ p.playerId }}</strong>
          <span>名额序号：{{ p.slotNo }}</span>
          <span>来源：{{ p.source }}</span>
        </div>
      </div>
    </section>

    <!-- 分润信息 -->
    <section class="detail-section">
      <h4>分润信息</h4>
      <div class="kv-grid">
        <div class="kv"><span>平台加价/减价</span><strong>{{ adjustText(row.platformAdjust) }}</strong></div>
        <div class="kv"><span>俱乐部加价/减价</span><strong>{{ adjustText(row.clubAdjust) }}</strong></div>
        <div class="kv"><span>结算到期时间</span><strong>{{ row.settleDueAt || '—' }}</strong></div>
        <div class="kv"><span>账期天数</span><strong>{{ row.settleDaysSnapshot != null ? `${row.settleDaysSnapshot}天` : '—' }}</strong></div>
        <div class="kv"><span>平台分润(元)*</span><strong>{{ profit.platform }}</strong></div>
        <div class="kv"><span>工作室分润(元)*</span><strong>{{ profit.studio }}</strong></div>
        <div class="kv"><span>打手分润(元)*</span><strong>{{ profit.player }}</strong></div>
      </div>
      <p class="form-tip">* 分润明细接口未提供，按原型比例（平台30%/工作室40%/打手30%）估算</p>
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

    <!-- 完成凭证（字段接口未提供，兜底展示） -->
    <section class="detail-section">
      <h4>完成凭证</h4>
      <div v-if="hasProof" class="proof-grid">
        <div class="proof-box">
          <span>首图</span>
          <img v-if="row.proofFirst" :src="row.proofFirst" alt="首图" />
          <em v-else>未上传</em>
          <em v-if="row.proofFirst">{{ row.proofUploadTime }} 上传</em>
        </div>
        <div class="proof-box">
          <span>尾图</span>
          <img v-if="row.proofLast" :src="row.proofLast" alt="尾图" />
          <em v-else>未上传</em>
          <em v-if="row.proofLast">{{ row.proofUploadTime }} 上传</em>
        </div>
        <div class="proof-box">
          <span>进程图</span>
          <div v-if="row.proofProcess && row.proofProcess.length" class="proof-imgs">
            <img v-for="(img, i) in row.proofProcess" :key="i" :src="img" alt="进程图" />
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
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.deposit-imgs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.deposit-imgs img {
  width: 72px;
  height: 54px;
  object-fit: cover;
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

.proof-box img {
  max-width: 100%;
  max-height: 90px;
  object-fit: contain;
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

.proof-imgs img {
  width: 64px;
  height: 48px;
  object-fit: cover;
}
</style>
