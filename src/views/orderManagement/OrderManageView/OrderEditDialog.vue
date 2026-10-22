<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from '../../../composables/useToast';
import { TYPE_OPTIONS, slotSourceText } from '../../../api/modules/order';
import { fileApi } from '../../../api/modules/file';
import { CLIENT_OPTIONS, STATUS_CLASS } from './mockData';

/**
 * 订单编辑弹窗内容（接口联调 + 原型 UI 恢复，依据最新 OpenAPI 2026-10-21）
 * 保存接口：POST /api/admin/orders/{id}/maintain 维护订单信息
 * 支持字段：gameId / specId / clients / orderType / playerCount / roleName / teamCode / remark
 *          / amount（订单金额，单位元；不传保持原值；已退款订单不能改）
 *          / groupQrUrl（企业群二维码；先 fileApi.upload 拿 url 再提交；传空串清除，不传保持原值）
 * - 所属客服（领取人）：本弹窗只读展示，不在此修改；修改入口在列表「领取人」列行内铅笔，
 *   独立弹窗调 PUT /{id}/owner（仅管理员）
 * - 仍缺（保留原型 UI，本地展示/编辑、提交不携带）：存单（hold）、完成凭证、陪玩备注等
 *   后端详情已返回、可回显；但维护订单信息接口（POST /{id}/maintain）不携带这些字段，故编辑不提交
 * - 打手信息来自 slots（名额列表：slotNo/playerId/source），接单/转单时间字段接口未提供
 */
const props = defineProps({
  row: { type: Object, required: true },
  catalog: { type: Array, default: () => [] }, // [{ id, name, specs: [{ id, name }] }]
  logs: { type: Array, default: () => [] },
});
const emit = defineEmits(['save']);

const { show } = useToast();

const money = (value) => (Number(value) || 0).toFixed(2);

const gameOptions = computed(() => props.catalog.map((g) => ({ label: g.name, value: g.id })));

const specOptions = computed(() => {
  const game = props.catalog.find((g) => g.id === Number(form.gameId));
  return game ? game.specs.map((s) => ({ label: s.name, value: s.id })) : [];
});

const isProgress = computed(() => props.row.status === '进行中');
const isDelta = computed(() => props.row.gameName === '三角洲行动');
const hasProof = computed(() => ['进行中', '已完成', '交易关闭'].includes(props.row.status));
/* 已退款订单不允许修改金额（接口约束） */
const isRefunded = computed(() => !!props.row.refunded || Number(props.row.refundedAmount) > 0);

const players = computed(() =>
  (props.row.slots || []).map((s) => ({
    slotNo: s.slotNo,
    playerId: s.playerId,
    source: slotSourceText(s.source),
  }))
);

/** 加减价净值展示：减价为负 */
const adjustText = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '0.00元';
  return `${n > 0 ? '+' : '-'}${money(Math.abs(n))}元`;
};

const form = reactive({
  gameId: '',
  specId: '',
  clients: [],
  orderType: '',
  playerCount: 1,
  roleName: '',
  teamCode: '', // 组队码：maintain 已支持（新 OpenAPI），随保存提交
  remark: '',
  /* 订单金额（元）：maintain 支持 amount；不传保持原值，已退款不可改 */
  amount: '',
  /* 企业群二维码：maintain 支持 groupQrUrl；先 fileApi.upload 拿 url 再提交，传空串清除 */
  groupQrUrl: '',
  /* ---- 存单字段：后端详情已返回（hold.shots 等，经 mapOrderRow 映射）；maintain 不携带，提交不提交 ---- */
  depositTarget: '1000',
  depositReason: '',
  depositFirst: '500',
  depositSecond: '500',
  depositImages: [],
  depositRemark: '',
});

watch(
  () => props.row,
  (row) => {
    if (!row) return;
    Object.assign(form, {
      gameId: row.gameId ?? '',
      specId: row.specId ?? '',
      clients: row.clients ? String(row.clients).split(/[,，]/).filter(Boolean) : [],
      orderType: row.orderTypeCode || 'NORMAL',
      playerCount: row.playerCount != null ? Number(row.playerCount) : 1,
      roleName: row.roleName || '',
      teamCode: row.teamCode || row.groupCode || '',
      remark: row.remark || '',
      amount: row.amount ?? '',
      groupQrUrl: row.groupQrUrl || '',
      depositTarget: row.depositTarget || '1000',
      depositReason: row.depositReason || '',
      depositFirst: row.depositFirst || '500',
      depositSecond: row.depositSecond || '500',
      depositImages: [...(row.depositImages || [])],
      depositRemark: row.depositRemark || '',
    });
  },
  { immediate: true, deep: true }
);

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

/* ===== 图片上传：企业群二维码走 fileApi.upload（POST /api/admin/files/upload）；存单截图仍为本地展示 ===== */
const qrUploading = ref(false);

async function uploadSingle(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return show('请选择图片文件', 'warning');
  qrUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    form.groupQrUrl = res.url;
    show('图片已上传', 'success');
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  } finally {
    qrUploading.value = false;
  }
}

function removeQr() {
  form.groupQrUrl = '';
}

/* 存单截图：详情 hold.shots 已回显；新增图片走本地 FileReader → base64 展示（maintain 不携带） */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadDeposit(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const room = 5 - form.depositImages.length;
  if (room <= 0) return show('最多上传5张图片', 'warning');
  const list = files.slice(0, room);
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue;
    form.depositImages.push(await readAsDataUrl(file));
  }
  e.target.value = '';
  if (list.length) show(`已上传${list.length}张（仅本地展示）`, 'success');
}

function removeDeposit(index) {
  form.depositImages.splice(index, 1);
}

function submit() {
  if (!form.gameId) return show('请选择游戏名称', 'warning');
  if (!form.specId) return show('请选择游戏规格', 'warning');
  // 金额：不传保持原值；已退款订单不能改（前端禁用输入兜底）
  let amount;
  if (!isRefunded.value && String(form.amount).trim() !== '') {
    const n = Number(form.amount);
    if (!Number.isFinite(n) || n < 0) return show('请输入正确的订单金额', 'warning');
    amount = n;
  }
  // 提交维护接口支持的字段；存单（hold）/凭证等后端已返回、但 maintain 接口不携带，故不提交
  emit('save', {
    gameId: Number(form.gameId),
    specId: Number(form.specId),
    clients: form.clients.length ? form.clients.join(',') : '',
    orderType: form.orderType,
    playerCount: Number(form.playerCount) || 0,
    roleName: String(form.roleName || '').trim(),
    teamCode: String(form.teamCode || '').trim(),
    remark: String(form.remark || '').trim(),
    ...(amount !== undefined ? { amount } : {}),
    groupQrUrl: form.groupQrUrl || '',
  });
}

defineExpose({ submit });
</script>

<template>
  <div class="order-edit">
    <!-- 所属客服（只读；修改入口在列表领取人列铅笔 → 独立弹窗 PUT /{id}/owner） -->
    <section class="edit-section">
      <h4>所属客服</h4>
      <div class="form-row">
        <label>所属客服</label>
        <strong>{{ row.claimerName || '—' }} ({{ row.claimerCorp || '—' }})</strong>
      </div>
    </section>

    <!-- 订单信息 -->
    <section class="edit-section">
      <h4>订单信息</h4>
      <div class="grid-2">
        <div class="form-row">
          <label>订单号</label>
          <div class="copy-field">
            <span class="readonly">{{ row.orderNo }}</span>
            <button type="button" class="copy-btn" @click="copyText(row.orderNo)">复制</button>
          </div>
        </div>
        <div class="form-row">
          <label>第三方订单号</label>
          <div class="copy-field">
            <span class="readonly">{{ row.thirdOrderNo }}</span>
            <button type="button" class="copy-btn" @click="copyText(row.thirdOrderNo)">复制</button>
          </div>
        </div>
        <div class="form-row">
          <label>游戏名称</label>
          <el-select v-model="form.gameId" placeholder="请选择游戏" style="width: 100%" @change="form.specId = ''">
            <el-option v-for="item in gameOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-row">
          <label>购买项目</label>
          <span class="readonly">{{ row.product || '—' }}</span>
        </div>
        <div class="form-row">
          <label>游戏规格</label>
          <el-select v-model="form.specId" placeholder="请选择规格" style="width: 100%">
            <el-option v-for="item in specOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-row">
          <label>订单类型</label>
          <el-radio-group v-model="form.orderType">
            <el-radio v-for="item in TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label>客户端</label>
          <el-select v-model="form.clients" multiple placeholder="支持多选" style="width: 100%">
            <el-option v-for="item in CLIENT_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label>打手人数</label>
          <input v-model.number="form.playerCount" type="number" min="0" step="1" placeholder="仅支持输入整数" />
        </div>
        <div class="form-row">
          <label>订单状态</label>
          <span class="status-badge" :class="STATUS_CLASS[row.status] || 'status-info'">{{ row.status }}</span>
        </div>
        <div class="form-row">
          <label>组队码</label>
          <!-- 组队码 teamCode：maintain 已支持（新 OpenAPI），随保存提交 -->
          <div class="copy-field">
            <input v-model="form.teamCode" placeholder="无则不填" />
            <button type="button" class="copy-btn" @click="copyText(form.teamCode)">复制</button>
          </div>
        </div>
        <div class="form-row">
          <label>角色名</label>
          <div class="copy-field">
            <input v-model="form.roleName" placeholder="请输入角色名" />
            <button type="button" class="copy-btn" @click="copyText(form.roleName)">复制</button>
          </div>
        </div>
        <div class="form-row">
          <label>创建时间</label>
          <span class="readonly">{{ row.createTime || '—' }}</span>
        </div>
        <div class="form-row">
          <label>订单金额(元)</label>
          <!-- maintain.amount：不传保持原值；已退款订单不能改（禁用） -->
          <input
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0"
            :disabled="isRefunded"
            placeholder="仅支持正数，最多两位小数"
          />
        </div>
      </div>
      <div class="form-row">
        <label>企业群二维码</label>
        <!-- groupQrUrl：先 fileApi.upload 拿 url，随 maintain 提交；传空串清除 -->
        <div class="upload-box">
          <img v-if="form.groupQrUrl" :src="form.groupQrUrl" class="upload-thumb" alt="企业群二维码" />
          <span v-else class="upload-empty">未上传</span>
          <label class="upload-btn" :class="{ disabled: qrUploading }">
            {{ qrUploading ? '上传中…' : '上传图片' }}
            <input type="file" accept="image/*" hidden :disabled="qrUploading" @change="uploadSingle" />
          </label>
          <button v-if="form.groupQrUrl" type="button" class="upload-remove" @click="removeQr">删除</button>
        </div>
      </div>
    </section>

    <!-- 存单（仅进行中订单编辑时展示；后端详情已返回 hold 可回显，maintain 不携带、编辑不提交） -->
    <section v-if="isProgress" class="edit-section">
      <h4>存单</h4>
      <template v-if="isDelta">
        <div class="grid-2">
          <div class="form-row">
            <label>保底目标(W)</label>
            <input v-model="form.depositTarget" type="number" min="0" placeholder="仅正数" />
          </div>
          <div class="form-row">
            <label>存单原因</label>
            <input v-model="form.depositReason" maxlength="200" placeholder="上限200字" />
          </div>
          <div class="form-row">
            <label>第一把(W)</label>
            <input v-model="form.depositFirst" type="number" min="0" placeholder="仅正数" />
          </div>
          <div class="form-row">
            <label>第二把(W)</label>
            <input v-model="form.depositSecond" type="number" min="0" placeholder="仅正数" />
          </div>
        </div>
        <div class="form-row">
          <label>剩余保底截图</label>
          <div class="upload-box">
            <div class="upload-list">
              <div v-for="(img, i) in form.depositImages" :key="i" class="upload-item">
                <img :src="img" alt="剩余保底截图" />
                <button type="button" class="upload-item-remove" @click="removeDeposit(i)">✕</button>
              </div>
            </div>
            <label v-if="form.depositImages.length < 5" class="upload-btn">
              上传图片（最多5张）
              <input type="file" accept="image/*" multiple hidden @change="uploadDeposit" />
            </label>
          </div>
        </div>
      </template>
      <div v-else class="form-row">
        <label>存单备注</label>
        <textarea v-model="form.depositRemark" class="remark-area" rows="3" maxlength="200" placeholder="非三角洲订单展示，上限200字"></textarea>
      </div>
      <p class="form-tip">存单字段（hold：保底目标/各把金额/截图等）后端详情已返回可回显；维护订单信息接口不携带，编辑保存不提交。</p>
    </section>

    <!-- 打手信息（slots 名额列表；接单/转单时间字段接口未提供） -->
    <section v-if="row.status === '待派单' || players.length" class="edit-section">
      <h4>打手信息</h4>
      <p v-if="row.status === '待派单'" class="muted-text">接单后价值</p>
      <div v-else class="player-grid">
        <div v-for="p in players" :key="`${p.slotNo}-${p.playerId}`" class="player-card">
          <strong>打手ID：{{ p.playerId }}</strong>
          <span>名额序号：{{ p.slotNo }}</span>
          <span>来源：{{ p.source }}</span>
        </div>
      </div>
    </section>

    <!-- 分成信息 -->
    <section class="edit-section">
      <h4>分成信息</h4>
      <div class="grid-2">
        <div class="kv"><span>平台加价/减价</span><strong>{{ adjustText(row.platformAdjust) }}</strong></div>
        <div class="kv"><span>俱乐部加价/减价</span><strong>{{ adjustText(row.clubAdjust) }}</strong></div>
        <div class="kv"><span>工作室分成(元)</span><strong>接单后价值（分润明细接口待补充）</strong></div>
        <div class="kv"><span>平台分成(元)</span><strong>接单后价值（分润明细接口待补充）</strong></div>
        <div class="kv"><span>打手分成(元)</span><strong>接单后价值（分润明细接口待补充）</strong></div>
      </div>
    </section>

    <!-- 订单日志（接口：logs） -->
    <section class="edit-section">
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
    <section class="edit-section">
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
      <p v-else class="muted-text">暂无数据</p>
    </section>

    <!-- 订单备注 -->
    <section class="edit-section">
      <h4>订单备注</h4>
      <textarea v-model="form.remark" class="remark-area" rows="3" maxlength="200" placeholder="请输入订单备注"></textarea>
      <div class="char-count">{{ form.remark.length }}/200</div>
    </section>
  </div>
</template>

<style scoped>
.order-edit {
  display: grid;
  gap: 16px;
  max-height: 62vh;
  overflow: auto;
  padding-right: 4px;
}

.edit-section {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-card);
}

.edit-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  line-height: 1.2;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.form-row > label {
  flex: 0 0 84px;
  color: var(--text-sub);
  font-size: 12px;
}

.grid-2 :deep(.el-select),
.form-row :deep(.el-select) {
  width: 100%;
  min-width: 0;
}

.grid-2 :deep(.el-select__wrapper),
.form-row :deep(.el-select__wrapper) {
  height: 34px !important;
  min-height: 34px;
  border-radius: 8px !important;
  padding: 2px 12px;
}

.grid-2 :deep(.el-select.is-multiple .el-select__wrapper),
.form-row :deep(.el-select.is-multiple .el-select__wrapper) {
  height: auto !important;
  min-height: 34px;
}

.grid-2 :deep(.el-radio-group),
.form-row :deep(.el-radio-group) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.form-row input[type='number'],
.form-row > input {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-main);
  box-sizing: border-box;
  background: var(--input-bg);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.form-row input[type='number']:focus,
.form-row > input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--input-bg-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}

.form-row input[type='number']:disabled,
.form-row > input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--input-bg);
}

.form-row textarea,
.remark-area {
  flex: 1;
  width: 100%;
  min-height: 88px;
  border: 1px solid var(--input-border);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main);
  box-sizing: border-box;
  background: var(--input-bg);
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.form-row textarea:focus,
.remark-area:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--input-bg-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}

.form-row textarea::placeholder,
.remark-area::placeholder {
  color: var(--input-placeholder);
}

.readonly {
  font-size: 13px;
  color: var(--text-main);
  word-break: break-all;
}

.copy-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.copy-field input {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-main);
  box-sizing: border-box;
  background: var(--input-bg);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.copy-field input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--input-bg-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}

.copy-btn {
  flex: 0 0 auto;
  border: 1px solid var(--primary-border-strong);
  border-radius: 6px;
  padding: 3px 10px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background: var(--primary);
  color: var(--text-invert);
}

.kv {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.kv span {
  color: var(--text-sub);
  font-size: 12px;
}

.kv strong {
  color: var(--text-main);
  font-size: 12.5px;
  font-weight: 500;
}

.upload-box {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-empty {
  font-size: 12.5px;
  color: var(--text-faint);
}

.upload-thumb {
  width: 96px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  border: 1px dashed var(--primary-border-strong);
  border-radius: 8px;
  padding: 6px 14px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12.5px;
  cursor: pointer;
}

.upload-btn:hover {
  background: var(--primary-faint);
}

.upload-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-remove {
  border: none;
  background: transparent;
  color: #d92d20;
  font-size: 12px;
  cursor: pointer;
}

.upload-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.upload-item {
  position: relative;
  width: 72px;
  height: 54px;
}

.upload-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.upload-item-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: #d92d20;
  color: var(--text-invert);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}

.muted-text {
  color: var(--text-faint);
  font-size: 12.5px;
  margin: 0;
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

.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
  padding: 12px 10px;
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

.char-count {
  text-align: right;
  color: var(--text-faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
