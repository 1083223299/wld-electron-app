<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from '../../../composables/useToast';
import { profitConfigApi } from '../../../api/modules/profitConfig';

const { show } = useToast();

const form = reactive({
  clubRate: '', // 俱乐部分润 %
  playerRate: '', // 打手分润 %
});

const loading = ref(false);
const submitting = ref(false);
const loadError = ref('');

/** 平台分润 = 100 - 俱乐部分润 - 打手分润（自动计算，只读展示） */
const platformRate = computed(() => {
  const club = Number(form.clubRate) || 0;
  const player = Number(form.playerRate) || 0;
  return Math.max(0, Math.round((100 - club - player) * 100) / 100);
});

async function fetchConfig() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await profitConfigApi.get();
    if (res) {
      form.clubRate = res.clubRate ?? res.club_rate ?? '';
      form.playerRate = res.playerRate ?? res.player_rate ?? '';
    }
  } catch (error) {
    loadError.value = error?.message || '分润配置加载失败，请重试。';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchConfig);

function validate() {
  const club = Number(form.clubRate);
  const player = Number(form.playerRate);
  if (form.clubRate === '' || Number.isNaN(club)) return '请填写俱乐部分润';
  if (form.playerRate === '' || Number.isNaN(player)) return '请填写打手分润';
  if (!Number.isInteger(club) || club < 0 || club > 100) return '俱乐部分润需为 0-100 的整数';
  if (!Number.isInteger(player) || player < 0 || player > 99) return '打手分润需为 0-99 的整数';
  if (club + player > 100) return '俱乐部分润与打手分润之和不得超过 100%';
  return null;
}

async function handleSubmit() {
  const err = validate();
  if (err) {
    show(err, 'warning');
    return;
  }
  submitting.value = true;
  try {
    await profitConfigApi.save({
      clubRate: Number(form.clubRate),
      playerRate: Number(form.playerRate),
    });
    show('保存成功', 'success');
  } catch (error) {
    show(error?.message || '分润配置保存失败', 'error');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="list-page profit-config">
    <div class="profit-card">
      <h3 class="profit-title">用户自选规格-分润配置</h3>
      <div v-if="loadError" class="profit-error" role="alert">
        <span>{{ loadError }}</span>
        <button type="button" @click="fetchConfig">重试</button>
      </div>

      <div class="rate-row">
        <label class="rate-label">俱乐部分润</label>
        <div class="rate-input-wrap">
          <input v-model="form.clubRate" type="number" min="0" max="100" step="1" placeholder="请输入比例" />
          <span class="rate-unit">%</span>
        </div>
      </div>

      <div class="rate-row">
        <label class="rate-label">打手分润</label>
        <div class="rate-input-wrap">
          <input v-model="form.playerRate" type="number" min="0" max="99" step="1" placeholder="请输入比例" />
          <span class="rate-unit">%</span>
        </div>
      </div>

      <div class="rate-row">
        <label class="rate-label">平台分润</label>
        <div class="rate-input-wrap readonly">
          <input :value="platformRate" type="number" disabled placeholder="自动计算" />
          <span class="rate-unit">%</span>
        </div>
      </div>

      <div class="profit-actions">
        <button class="btn btn-primary" :disabled="submitting || loading" @click="handleSubmit">
          {{ submitting ? '提交中…' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profit-config {
  padding: 4px;
}

.profit-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 28px 24px;
  max-width: 560px;
}

.profit-title {
  margin: 0 0 24px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
}

.profit-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 20px;
  padding: 10px 12px;
  border: 1px solid rgba(217, 45, 32, 0.2);
  border-radius: 8px;
  background: rgba(217, 45, 32, 0.05);
  color: var(--danger, #d92d20);
  font-size: 12.5px;
}

.profit-error button {
  border: 0;
  background: transparent;
  color: inherit;
  font-weight: 600;
  cursor: pointer;
}

.rate-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.rate-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
}

.rate-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 0 14px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.rate-input-wrap:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.rate-input-wrap.readonly {
  background: #f2f4f7;
}

.rate-input-wrap input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 11px 0;
  font-size: 14px;
  color: var(--text-main);
}

.rate-unit {
  color: var(--text-sub);
  font-size: 14px;
}

.profit-note {
  margin: 8px 0 20px;
  padding: 14px 16px;
  background: var(--primary-faint, #f5f2ff);
  border-radius: 12px;
  color: var(--text-sub);
  font-size: 12.5px;
  line-height: 1.8;
}

.profit-actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 26px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: filter 0.18s ease, box-shadow 0.18s ease;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 24px var(--primary-glow-strong);
}

.btn-primary:hover { filter: brightness(1.06); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
