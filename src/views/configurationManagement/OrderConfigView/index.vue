// OrderConfigView 组件，用于管理订单配置，主要是卡单时长配置
<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from '../../../composables/useToast';
import { orderConfigApi } from '../../../api/modules/orderConfig';

const { show } = useToast();

// 配置行直接来自 GET 返回：name 为后端标签，minutes 为分钟数（存字符串便于输入拦截）
const rows = ref([]);
const loading = ref(false); // 加载中
const submitting = ref(false); // 提交中

// ============ 拉取配置 ============
async function fetchConfig() {
  loading.value = true;
  try {
    const list = await orderConfigApi.get();
    rows.value = (Array.isArray(list) ? list : []).map((it) => ({
      name: it.name,
      code: it.code,
      minutes: it.minutes != null ? String(it.minutes) : '',
    }));
  } finally {
    loading.value = false;
  }
}

// ============ 正整数校验 ============
// 输入时拦截：只能输入数字（首位不能为 0，避免 "010" 这种）
function onInput(row, e) {
  let v = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
  row.minutes = v;
}

// 提交前校验：返回错误信息，null 表示通过
function validate() {
  for (const row of rows.value) {
    const v = String(row.minutes ?? '').trim();
    if (v === '') return `请输入${row.name}时长`;
    if (!/^\d+$/.test(v)) return `${row.name}时长仅支持输入正整数`;
    if (Number(v) <= 0) return `${row.name}时长必须为大于 0 的正整数`;
    if (Number(v) > 9999) return `${row.name}时长不能超过 9999 分钟`;
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
    await orderConfigApi.save(rows.value);
    // 保存成功后重新拉取，回显服务端最新值
    await fetchConfig();
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
        <!-- <span class="subtitle">配置订单各节点的超时与卡单时长，超时未流转将触发对应提醒</span> -->
      </div>

      <div v-if="loading" class="loading-tip">加载中...</div>

      <template v-else>
        <!-- 配置项：标签与顺序均取 GET 返回的 name -->
        <div v-for="(row, idx) in rows" :key="row.code || row.name || idx" class="form-row">
          <label class="form-label">{{ row.name }}</label>
          <div class="field-wrap">
            <input
              :value="row.minutes"
              type="text"
              inputmode="numeric"
              placeholder="请输入正整数"
              @input="onInput(row, $event)"
            />
            <span class="unit">分钟</span>
          </div>
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
  /* color: #fdfdfd; */
}

.card-title .subtitle {
  font-size: 12px;
  color: #8a93a6;
}

.form-row {
  display: grid;
  grid-template-columns: 96px 1fr;
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

/* 暂未开放项：整体降透明度，输入框禁用 */
.form-row.is-locked {
  opacity: 0.55;
}

.form-row.is-locked .locked-input {
  background: #eef1f6;
  color: #9aa3b5;
  cursor: not-allowed;
}

.form-row.is-locked .locked-input:focus {
  border-color: #e3e7f0;
  box-shadow: none;
}

.lock-badge {
  font-size: 11px;
  color: #8a93a6;
  border: 1px solid #e3e7f0;
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
}

.footer {
  margin-top: 8px;
  padding-left: 112px;
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

/* .btn-primary {
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
} */
</style>
