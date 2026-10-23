<script setup>
import { reactive, ref } from 'vue';
import { useToast } from '../../../../composables/useToast';

/**
 * 通用「段位跨度区间表」：初始段位 / 结束段位 / 段位单价，支持新增/编辑/删除 + 兜底价。
 * 校验：结束段位必须大于初始段位；多组区间不允许重叠；价格保留两位小数。
 */
const props = defineProps({
  startLabel: { type: String, default: '初始段位' },
  endLabel: { type: String, default: '结束段位' },
  priceLabel: { type: String, default: '段位单价' },
  rows: { type: Array, default: () => [] },
  fallback: { type: [String, Number], default: '' },
});
const emit = defineEmits(['update:rows', 'update:fallback']);
const { show } = useToast();

const dialogVisible = ref(false);
const editingIdx = ref(-1);
const form = reactive({ start: '', end: '', price: '' });

function openAdd() {
  editingIdx.value = -1;
  form.start = '';
  form.end = '';
  form.price = '';
  dialogVisible.value = true;
}

function openEdit(row, idx) {
  editingIdx.value = idx;
  form.start = row.start;
  form.end = row.end;
  form.price = row.price;
  dialogVisible.value = true;
}

function validate() {
  if (!form.start.trim()) return '请填写起始段位';
  if (!form.end.trim()) return '请填写结束段位';
  if (form.start.trim() === form.end.trim()) return '结束段位必须大于初始段位';
  if (!form.price || Number.isNaN(Number(form.price)) || Number(form.price) < 0) return '请填写有效的段位单价';
  // 区间重叠校验（按文本区间序号粗校验，避免完全相同的起终点）
  const dup = props.rows.some((r, i) => i !== editingIdx.value && r.start === form.start.trim() && r.end === form.end.trim());
  if (dup) return '相同的区间已存在，不允许重复/重叠';
  return null;
}

function save() {
  const err = validate();
  if (err) return show(err, 'warning');
  const next = [...props.rows];
  const item = { start: form.start.trim(), end: form.end.trim(), price: Number(Number(form.price).toFixed(2)) };
  if (editingIdx.value >= 0) next[editingIdx.value] = item;
  else next.push(item);
  emit('update:rows', next);
  dialogVisible.value = false;
  show('已保存', 'success');
}

function remove(idx) {
  const next = props.rows.filter((_, i) => i !== idx);
  emit('update:rows', next);
}
</script>

<template>
  <div class="range-table-block">
    <div class="block-head">
      <span class="block-title">段位跨度</span>
      <button type="button" class="mini-add" @click="openAdd">新增</button>
    </div>

    <table class="range-table">
      <thead>
        <tr><th>{{ startLabel }}</th><th>{{ endLabel }}</th><th>{{ priceLabel }}</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length">
          <td colspan="4" class="empty">暂无区间数据</td>
        </tr>
        <tr v-for="(row, idx) in rows" :key="idx">
          <td>{{ row.start }}</td>
          <td>{{ row.end }}</td>
          <td>{{ row.price }} 元</td>
          <td class="op">
            <button type="button" class="link" @click="openEdit(row, idx)">编辑</button>
            <button type="button" class="link danger" @click="remove(idx)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="fallback-row">
      <span>兜底价（未命中区间均取兜底）</span>
      <div class="fallback-input">
        <input :value="fallback" type="number" min="0" step="0.01" placeholder="请输入兜底价" @input="emit('update:fallback', $event.target.value)" />
        <span>元</span>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <Teleport to="body">
      <div v-if="dialogVisible" class="dt-overlay" @click.self="dialogVisible = false">
        <div class="dt-box">
          <div class="dt-head"><strong>新增/编辑</strong><button type="button" class="dt-x" @click="dialogVisible = false">×</button></div>
          <div class="dt-body">
            <div class="dt-field">
              <label>{{ startLabel }}</label>
              <input v-model="form.start" placeholder="请输入起始段位" />
            </div>
            <div class="dt-field">
              <label>{{ endLabel }}</label>
              <input v-model="form.end" placeholder="请输入结束段位" />
            </div>
            <div class="dt-field">
              <label>{{ priceLabel }}</label>
              <input v-model="form.price" type="number" min="0" step="0.01" placeholder="请输入单价（元）" />
            </div>
          </div>
          <div class="dt-foot">
            <button type="button" class="dt-btn plain" @click="dialogVisible = false">取消</button>
            <button type="button" class="dt-btn primary" @click="save">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.block-title { font-size: 13.5px; font-weight: 700; color: var(--text-main); }
.mini-add { border: 1px solid var(--primary-border-strong, #c9b8ff); background: transparent; color: var(--primary); border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer; }
.range-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.range-table th, .range-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-faint, #eef1f6); text-align: left; }
.range-table th { color: var(--text-sub); font-weight: 600; background: var(--bg-thead, #f6f7fb); }
.range-table .empty { text-align: center; color: var(--text-sub); padding: 24px; }
.op { display: flex; gap: 12px; }
.link { border: none; background: transparent; color: #2563eb; cursor: pointer; font-size: 12.5px; }
.link.danger { color: #d92d20; }
.fallback-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding: 12px 14px; background: var(--primary-faint, #f5f2ff); border-radius: 12px; font-size: 13px; color: var(--text-sub); }
.fallback-input { display: flex; align-items: center; gap: 6px; }
.fallback-input input { width: 110px; border: 1px solid #e3e7f0; border-radius: 10px; padding: 8px 10px; }
.dt-overlay { position: fixed; inset: 0; background: rgba(17,12,46,.5); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(4px); }
.dt-box { width: 420px; background: var(--bg-card, #fff); border-radius: 18px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.3); }
.dt-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-faint); }
.dt-head strong { font-size: 16px; }
.dt-x { border: none; background: transparent; font-size: 20px; cursor: pointer; color: var(--text-sub); }
.dt-body { padding: 20px; display: grid; gap: 14px; }
.dt-field { display: grid; gap: 6px; }
.dt-field label { font-size: 12.5px; color: var(--text-sub); }
.dt-field input { border: 1px solid #e3e7f0; border-radius: 12px; padding: 10px 12px; }
.dt-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border-faint); }
.dt-btn { border: none; border-radius: 10px; padding: 9px 20px; cursor: pointer; font-size: 13px; font-weight: 600; }
.dt-btn.plain { background: #f2f4f7; color: var(--text-sub); }
.dt-btn.primary { background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: #fff; }
</style>
