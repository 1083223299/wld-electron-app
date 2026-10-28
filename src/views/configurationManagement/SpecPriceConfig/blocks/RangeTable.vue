<script setup>
import { reactive, ref } from 'vue';
import { useToast } from '../../../../composables/useToast';

/**
 * 通用区间价目表：支持新增/编辑/删除区间及配置兜底价。
 * 校验：结束段位必须大于初始段位；多组区间不允许重叠；价格保留两位小数。
 */
const props = defineProps({
  title: { type: String, default: '段位跨度' },
  showTitle: { type: Boolean, default: true },
  startLabel: { type: String, default: '初始段位' },
  endLabel: { type: String, default: '结束段位' },
  priceLabel: { type: String, default: '段位单价' },
  rangeLabel: { type: String, default: '' },
  displayRange: { type: Boolean, default: false },
  inlineFallback: { type: Boolean, default: false },
  showFallback: { type: Boolean, default: true },
  singleKey: { type: Boolean, default: false },
  options: { type: Array, default: () => [] },
  equalRangeOptions: { type: Array, default: () => [] },
  numeric: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  fallback: { type: [String, Number], default: '' },
});
const emit = defineEmits(['update:rows', 'update:fallback']);
const { show } = useToast();

const dialogVisible = ref(false);
const editingIdx = ref(-1);
const isEditing = ref(false);
const form = reactive({ start: '', end: '', price: '' });

// 接口可能返回数字段位，统一转成字符串后再校验和回填表单。
function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function optionLabel(option) {
  return typeof option === 'string' ? option : option.label;
}

function optionValue(option) {
  return typeof option === 'string' ? option : option.value;
}

function openAdd() {
  editingIdx.value = -1;
  form.start = '';
  form.end = '';
  form.price = '';
  dialogVisible.value = true;
}

function openEdit(row, idx) {
  editingIdx.value = idx;
  form.start = normalizeText(row.start);
  form.end = props.singleKey ? normalizeText(row.start) : normalizeText(row.end);
  form.price = normalizeText(row.price);
  dialogVisible.value = true;
}

function validate() {
  const start = normalizeText(form.start);
  const end = normalizeText(form.end);
  if (!start) return `请选择或填写${props.startLabel}`;
  if (!props.singleKey && !end) return `请选择或填写${props.endLabel}`;
  if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) return `请填写有效的${props.priceLabel}`;

  const optionValues = props.options.map(optionValue);
  const startOrder = props.options.length ? optionValues.indexOf(start) : Number(start);
  const endOrder = props.options.length ? optionValues.indexOf(end) : Number(end);
  const hasOrderedValues = props.options.length > 0 || (Number.isFinite(startOrder) && Number.isFinite(endOrder));
  const allowsEqualRange = start === end && props.equalRangeOptions.includes(start);
  if (props.options.length && (startOrder < 0 || endOrder < 0)) return '请选择有效的段位';
  if (!props.singleKey && !allowsEqualRange && hasOrderedValues && endOrder <= startOrder) return `${props.endLabel}必须大于${props.startLabel}`;
  if (!props.singleKey && !allowsEqualRange && !hasOrderedValues && start === end) return `${props.endLabel}必须大于${props.startLabel}`;

  return null;
}

function save() {
  const err = validate();
  if (err) return show(err, 'warning');
  const next = [...props.rows];
  const item = {
    ...(editingIdx.value >= 0 ? props.rows[editingIdx.value] : {}),
    start: normalizeText(form.start),
    end: props.singleKey ? normalizeText(form.start) : normalizeText(form.end),
    price: Number(Number(form.price).toFixed(2)),
  };
  if (editingIdx.value >= 0) next[editingIdx.value] = item;
  else next.push(item);
  emit('update:rows', next);
  dialogVisible.value = false;
}

function remove(idx) {
  const next = props.rows.filter((_, i) => i !== idx);
  emit('update:rows', next);
}

function toggleEdit() {
  isEditing.value = !isEditing.value;
}
</script>

<template>
  <div class="range-table-block">
    <div class="block-head">
      <span v-if="showTitle" class="block-title">{{ title }}</span>
      <div class="block-actions">
        <slot name="actions" :add="openAdd" :editing="isEditing" :toggle="toggleEdit">
          <button type="button" class="mini-add" @click="openAdd">新增</button>
        </slot>
      </div>
    </div>

    <div class="table-wrap">
      <table class="range-table">
        <thead>
          <tr>
            <th>{{ displayRange ? (rangeLabel || startLabel) : startLabel }}</th>
            <th v-if="!displayRange">{{ endLabel }}</th>
            <th>{{ priceLabel }}</th>
            <th v-if="!inlineFallback || isEditing">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="displayRange ? (inlineFallback && !isEditing ? 2 : 3) : 4" class="empty">暂无区间数据</td>
          </tr>
          <tr v-for="(row, idx) in rows" :key="idx">
            <td v-if="displayRange">{{ row.start === row.end ? row.start : `${row.start}–${row.end}` }}</td>
            <td v-else>{{ row.start }}</td>
            <td v-if="!displayRange">{{ row.end }}</td>
            <td>{{ row.price }} 元</td>
            <td v-if="!inlineFallback || isEditing" class="op">
              <button type="button" class="link" @click="openEdit(row, idx)">编辑</button>
              <button type="button" class="link danger" @click="remove(idx)">删除</button>
            </td>
          </tr>
          <tr v-if="inlineFallback" class="fallback-table-row">
            <td>兜底</td>
            <td>
              <div v-if="isEditing" class="fallback-input">
                <input :value="fallback" type="number" min="0" step="0.01" placeholder="请输入兜底价" @input="emit('update:fallback', $event.target.value)" />
                <span>元</span>
              </div>
              <span v-else>{{ fallback === '' ? '—' : `${fallback}元` }}</span>
            </td>
            <td v-if="isEditing"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showFallback && !inlineFallback" class="fallback-row">
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
              <select v-if="options.length" v-model="form.start">
                <option disabled value="">请选择{{ startLabel }}</option>
                <option v-for="option in options" :key="optionValue(option)" :value="optionValue(option)">{{ optionLabel(option) }}</option>
              </select>
              <input v-else v-model="form.start" :type="numeric ? 'number' : 'text'" :min="numeric ? 0 : undefined" :placeholder="`请输入${startLabel}`" />
            </div>
            <div class="dt-field">
              <label v-if="!singleKey">{{ endLabel }}</label>
              <select v-if="options.length && !singleKey" v-model="form.end">
                <option disabled value="">请选择{{ endLabel }}</option>
                <option v-for="option in options" :key="optionValue(option)" :value="optionValue(option)">{{ optionLabel(option) }}</option>
              </select>
              <template v-else-if="!singleKey">
                <input v-model="form.end" :type="numeric ? 'number' : 'text'" :min="numeric ? 0 : undefined" :placeholder="`请输入${endLabel}`" />
              </template>
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
.block-head { display: flex; align-items: center; justify-content: space-between; min-height: 28px; margin-bottom: 10px; }
.block-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; }
.block-title { font-size: 13.5px; font-weight: 700; color: var(--text-main); }
.mini-add { border: 1px solid var(--primary-border-strong); background: var(--primary-soft); color: var(--primary); border-radius: 6px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
.mini-add:hover { background: var(--primary-faint); }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); }
.range-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 13px; }
.range-table th, .range-table td { padding: 12px 14px; border-bottom: 1px solid var(--border-faint); text-align: center; }
.range-table th { color: var(--text-sub); font-weight: 600; background: var(--bg-thead); white-space: nowrap; }
.range-table td { background: var(--bg-card); color: var(--text-main); }
.range-table tbody tr:last-child td { border-bottom: 0; }
.range-table tbody tr:not(:first-child):hover td { background: var(--bg-hover); }
.range-table .empty { text-align: center; color: var(--text-sub); padding: 24px; }
.fallback-table-row { font-weight: 600; }
.fallback-table-row td { border-bottom: 0; }
.fallback-table-row .fallback-input { max-width: 150px; }
.fallback-table-row .fallback-input input { width: 100%; }
.op { white-space: nowrap; }
.op .link + .link { margin-left: 12px; }
.link { border: none; background: transparent; color: var(--primary); cursor: pointer; font-size: 12.5px; font-weight: 500; }
.link:hover { text-decoration: underline; }
.link.danger { color: #d92d20; }
.fallback-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 14px; padding: 12px 14px; background: var(--bg-app); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--text-sub); }
.fallback-input { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.fallback-input input { width: 120px; border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 8px 10px; background: var(--input-bg, var(--bg-card)); color: var(--text-main); outline: none; }
.fallback-input input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.dt-overlay { position: fixed; inset: 0; background: rgba(17,12,46,.46); display: flex; align-items: center; justify-content: center; z-index: 200; }
.dt-box { width: min(420px, calc(100vw - 32px)); background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-lg); }
.dt-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-faint); }
.dt-head strong { font-size: 16px; }
.dt-x { border: none; background: transparent; font-size: 20px; cursor: pointer; color: var(--text-sub); }
.dt-body { padding: 20px; display: grid; gap: 14px; }
.dt-field { display: grid; gap: 6px; }
.dt-field label { font-size: 12.5px; color: var(--text-sub); }
.dt-field input, .dt-field select { border: 1px solid var(--input-border, var(--border)); border-radius: 7px; padding: 10px 12px; background: var(--input-bg, var(--bg-card)); color: var(--text-main); outline: none; }
.dt-field input:focus, .dt-field select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.dt-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border-faint); }
.dt-btn { border: 1px solid var(--border); border-radius: 7px; padding: 8px 18px; cursor: pointer; font-size: 13px; font-weight: 600; }
.dt-btn.plain { background: var(--bg-card); color: var(--text-sub); }
.dt-btn.primary { border-color: var(--primary); background: var(--primary); color: var(--text-invert, #fff); }
@media (max-width: 520px) {
  .fallback-row { align-items: stretch; flex-direction: column; }
  .fallback-input input { flex: 1; }
}
</style>
