<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from '../../../composables/useToast';
import { orderConfigApi } from '../../../api/modules/orderConfig';

const { show } = useToast();

// ============ 表单数据 ============
const form = reactive({
  pendingClaimMinutes: '', // 待领取
  pendingDispatchMinutes: '', // 待派单
  pendingAcceptMinutes: '', // 待接单
});

const loading = ref(false); // 加载中
const submitting = ref(false); // 提交中

// 表单项配置（label / 字段 key / 说明）
const fields = [
  { key: 'pendingClaimMinutes', label: '待领取', tip: '订单进入领取大厅后，超过该时长未被领取视为卡单' },
  { key: 'pendingDispatchMinutes', label: '待派单', tip: '客服派单后，超过该时长未派出给打手视为卡单' },
  { key: 'pendingAcceptMinutes', label: '待接单', tip: '派给打手后，超过该时长未被打手接单视为卡单' },
];

// ============ 拉取配置 ============
async function fetchConfig() {
  loading.value = true;
  try {
    const res = await orderConfigApi.get();
    form.pendingClaimMinutes = res.pendingClaimMinutes;
    form.pendingDispatchMinutes = res.pendingDispatchMinutes;
    form.pendingAcceptMinutes = res.pendingAcceptMinutes;
  } finally {
    loading.value = false;
  }
}

// ============ 正整数校验 ============
// 输入时拦截：只能输入数字（首位不能为 0，避免 "010" 这种）
function onInput(fieldKey, e) {
  let v = e.target.value;
  // 只保留数字
  v = v.replace(/\D/g, '');
  // 去掉前导 0
  v = v.replace(/^0+/, '');
  form[fieldKey] = v;
}

// 提交前校验：返回错误信息，null 表示通过
function validate() {
  for (const f of fields) {
    const v = String(form[f.key] ?? '').trim();
    if (v === '') return `请输入${f.label}时长`;
    if (!/^\d+$/.test(v)) return `${f.label}时长仅支持输入正整数`;
    if (Number(v) <= 0) return `${f.label}时长必须为大于 0 的正整数`;
    if (Number(v) > 9999) return `${f.label}时长不能超过 9999 分钟`;
  }
  return null;
}

// ============ 提交 ============
async function handleSubmit() {
  const err = validate();
  if (err) {
    show(err, 'warning');
    return;
  }
  submitting.value = true;
  try {
    await orderConfigApi.save({
      pendingClaimMinutes: Number(form.pendingClaimMinutes),
      pendingDispatchMinutes: Number(form.pendingDispatchMinutes),
      pendingAcceptMinutes: Number(form.pendingAcceptMinutes),
    });
    show('保存成功', 'success');
  } catch (e) {
    show(e?.message || '保存失败', 'error');
  } finally {
    submitting.value = false;
  }
}

onMounted(fetchConfig);
</script>

<template>
  <div class="order-config-page">
    <div class="config-card">
      <div class="card-title">
        <strong>卡单时长配置</strong>
        <span class="subtitle">配置订单各节点的卡单时长，超时未流转将触发卡单提醒</span>
      </div>

      <div v-if="loading" class="loading-tip">加载中...</div>

      <template v-else>
        <div v-for="f in fields" :key="f.key" class="form-row">
          <label class="form-label">{{ f.label }}</label>
          <div class="field-wrap">
            <input
              :value="form[f.key]"
              type="text"
              inputmode="numeric"
              placeholder="请输入正整数"
              @input="onInput(f.key, $event)"
            />
            <span class="unit">分钟</span>
          </div>
          <span class="field-tip">{{ f.tip }}</span>
        </div>

        <div class="footer">
          <button
            class="btn btn-primary"
            :disabled="submitting"
            @click="handleSubmit"
          >
            {{ submitting ? '提交中...' : '提交' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.order-config-page {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  /* background: #f5f7fb; */
  box-sizing: border-box;
}

.config-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(19, 25, 42, 0.04);
  max-width: 720px;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 20px;
  margin-bottom: 24px;
  border-bottom: 1px solid #eef1f6;
}

.card-title strong {
  font-size: 16px;
  color: #fdfdfd;
}

.card-title .subtitle {
  font-size: 12px;
  color: #8a93a6;
}

.form-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  grid-template-areas:
    'label field'
    'label tip';
  column-gap: 16px;
  row-gap: 6px;
  align-items: center;
  margin-bottom: 20px;
}

.form-label {
  grid-area: label;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  text-align: right;
}

.field-wrap {
  grid-area: field;
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-wrap input {
  width: 160px;
  border: 1px solid #e3e7f0;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: #1f2937;
  background: #fbfcfe;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.field-wrap input:focus {
  border-color: var(--primary);
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.field-wrap input::placeholder {
  color: #b6bdcb;
}

.field-wrap .unit {
  color: #5b6478;
  font-size: 13px;
}

.field-tip {
  grid-area: tip;
  font-size: 12px;
  color: #9aa3b5;
}

.footer {
  margin-top: 8px;
  padding-left: 96px;
}

.loading-tip {
  padding: 40px 0;
  text-align: center;
  color: #9aa3b5;
  font-size: 13px;
}

.btn {
  border: none;
  border-radius: 10px;
  padding: 9px 26px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: filter 0.18s ease, box-shadow 0.18s ease, transform 0.1s ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: var(--text-invert);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
