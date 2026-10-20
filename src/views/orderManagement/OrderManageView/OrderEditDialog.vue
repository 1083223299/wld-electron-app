<script setup>
import { computed, reactive, watch } from 'vue';
import { useToast } from '../../../composables/useToast';
import { useUserStore } from '../../../stores/user';
import {
  CURRENT_USER,
  GAME_OPTIONS,
  SPEC_OPTIONS,
  CLIENT_OPTIONS,
  TYPE_OPTIONS,
  getOrderLogs,
  STATUS_CLASS,
} from './mockData';

/**
 * 订单编辑弹窗内容
 * 依据原型「待派单编辑页 / 进行中编辑页」：
 * - 所属客服（仅管理员可改）
 * - 订单信息（游戏名称/游戏规格/客户端/订单类型/打手人数/角色名/组队码 可编辑；订单号/第三方订单号/角色名/组队码 支持复制）
 * - 企鹅群二维码（上传图片）
 * - 存单（进行中展示：保底目标/存单原因/第一把/第二把/剩余保底截图 上传最多5张；非三角洲展示存单备注）
 * - 打手信息 / 分成信息 / 订单日志 / 完成凭证 / 订单备注(0/200)
 */
const props = defineProps({
  row: { type: Object, required: true },
});
const emit = defineEmits(['save']);

const { show } = useToast();
const userStore = useUserStore();

const money = (value) => (Number(value) || 0).toFixed(2);

/** 管理员可全量编辑；客服仅可编辑存单（原型批注）。登录角色联动，fallback 到 mock 常量 */
const isAdmin = computed(() => (userStore.role || CURRENT_USER.role) === 'admin');
const isProgress = computed(() => props.row.status === '进行中');
const isDelta = computed(() => props.row.gameName === '三角洲行动');
const hasProof = computed(() => ['进行中', '已完成', '交易关闭'].includes(props.row.status));

const form = reactive({
  claimerName: '',
  gameName: '',
  spec: '',
  clientType: [],
  orderType: '',
  playerCount: 1,
  roleName: '',
  groupCode: '',
  remark: '',
  qrImg: '',
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
      claimerName: row.claimerName || '',
      gameName: row.gameName || '',
      spec: row.spec || '',
      clientType: [...(row.clientType || [])],
      orderType: row.orderType || '',
      playerCount: row.playerCount || 1,
      roleName: row.roleName || '',
      groupCode: row.groupCode || '',
      remark: row.remark || '',
      qrImg: row.qrImg || '',
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

/** 打手信息：打手接单后展示 */
const players = computed(() => {
  const row = props.row;
  if (row.status === '待派单') return [];
  return [
    { name: '张三 (1216516)', club: '李四俱乐部', time: '2026-10-10 11:12:22', type: '接单时间' },
    { name: '赵六 (1216516)', club: '李四俱乐部', time: '2026-10-10 11:12:22', type: '转单时间' },
  ];
});

const logs = computed(() => getOrderLogs(props.row));

const adjustText = computed(() => {
  const a = props.row.platformAdjust || props.row.priceAdjust;
  if (!a || !a.amount) return '—';
  return `${a.type === '加价' ? '+' : '-'}${money(a.amount)}元`;
});

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

/* ===== 图片上传（本地 mock：FileReader → base64 回显） ===== */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadSingle(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return show('请选择图片文件', 'warning');
  const dataUrl = await readAsDataUrl(file);
  form.qrImg = dataUrl;
  e.target.value = '';
  show('图片已上传', 'success');
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
  if (list.length) show(`已上传${list.length}张`, 'success');
}

function removeDeposit(index) {
  form.depositImages.splice(index, 1);
}

function submit() {
  emit('save', { ...form });
}

defineExpose({ submit });
</script>

<template>
  <div class="order-edit">
    <!-- <p class="perm-tip">所属客服仅管理员可改；进行中订单客服仅可编辑存单（管理员也可修改）。</p> -->

    <!-- 所属客服 -->
    <section class="edit-section">
      <h4>所属客服</h4>
      <div class="form-row">
        <label>所属客服</label>
        <!-- <el-select v-if="isAdmin" v-model="form.claimerName" style="width: 260px" placeholder="请选择客服">
          <el-option label="张三" value="张三" />
          <el-option label="李四" value="李四" />
          <el-option label="王五" value="王五" />
        </el-select> -->
        <strong>{{ row.claimerName }} ({{ row.claimerCorp }})</strong>
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
          <el-select v-model="form.gameName" placeholder="请选择游戏" style="width: 100%">
            <el-option v-for="item in GAME_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label>购买项目</label>
          <span class="readonly">{{ row.product }}</span>
        </div>
        <div class="form-row">
          <label>游戏规格</label>
          <el-select v-model="form.spec" placeholder="请选择规格" style="width: 100%">
            <el-option v-for="item in SPEC_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label>订单类型</label>
          <el-radio-group v-model="form.orderType">
            <el-radio v-for="item in TYPE_OPTIONS" :key="item" :value="item">{{ item }}</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label>客户端</label>
          <el-select v-model="form.clientType" multiple placeholder="支持多选" style="width: 100%">
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
          <div class="copy-field">
            <input v-model="form.groupCode" placeholder="无则不填" />
            <button type="button" class="copy-btn" @click="copyText(form.groupCode)">复制</button>
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
          <span class="readonly">{{ row.createTime }}</span>
        </div>
      </div>
      <div class="form-row">
        <label>企鹅群二维码</label>
        <div class="upload-box">
          <img v-if="form.qrImg" :src="form.qrImg" class="upload-thumb" alt="企鹅群二维码" />
          <span v-else class="upload-empty">未上传</span>
          <label class="upload-btn">
            上传图片
            <input type="file" accept="image/*" hidden @change="uploadSingle" />
          </label>
          <button v-if="form.qrImg" type="button" class="upload-remove" @click="form.qrImg = ''">删除</button>
        </div>
      </div>
      <div class="form-row">
        <label>订单金额(元)</label>
        <strong>{{ money(row.amount) }}</strong>
      </div>
    </section>

    <!-- 存单（仅进行中订单编辑时展示） -->
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
    </section>

    <!-- 打手信息 -->
    <section v-if="row.status === '待派单' || players.length" class="edit-section">
      <h4>打手信息</h4>
      <p v-if="row.status === '待派单'" class="muted-text">接单后价值</p>
      <div v-else class="player-grid">
        <div v-for="(p, i) in players" :key="i" class="player-card">
          <strong>{{ p.name }}</strong>
          <span>{{ p.club }}</span>
          <span>{{ p.type }}：{{ p.time }}</span>
        </div>
      </div>
    </section>

    <!-- 分成信息 -->
    <section class="edit-section">
      <h4>分成信息</h4>
      <div class="grid-2">
        <div class="kv"><span>平台加价/减价</span><strong>{{ adjustText }}</strong></div>
        <div class="kv"><span>工作室分成(元)</span><strong>接单后价值</strong></div>
        <div class="kv"><span>平台分成(元)</span><strong>接单后价值</strong></div>
        <div class="kv"><span>打手分成(元)</span><strong>接单后价值</strong></div>
      </div>
    </section>

    <!-- 订单日志 -->
    <section class="edit-section">
      <h4>订单日志</h4>
      <ul class="log-list">
        <li v-for="(log, i) in logs" :key="i">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-text">{{ log.text }}</span>
          <span class="log-op">操作人：{{ log.op }}</span>
        </li>
      </ul>
    </section>

    <!-- 完成凭证 -->
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

.perm-tip {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--primary-soft);
  border: 1px solid var(--primary-glow);
  color: var(--primary);
  font-size: 12.5px;
  line-height: 1.6;
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

/* el-select / el-radio-group 在双列与单行里撑满，高度与原生输入框(34px)对齐 */
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
.form-row input[type='text']:not(.copy-field input),
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
.form-row input[type='text']:not(.copy-field input):focus,
.form-row > input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--input-bg-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
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
