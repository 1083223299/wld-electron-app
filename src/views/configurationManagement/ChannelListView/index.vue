<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { channelApi } from '../../../api/modules/channel';

const { confirm } = useConfirm();
const { show } = useToast();

// ============ 列表 ============
// 后端接口全量返回（无分页参数），分页在本地完成，口径与游戏列表页一致
const rows = ref([]);
const total = ref(0);
const { page, pageSize, onPageSizeChange, onPageChange } = useListMemory({});
const loading = ref(false);

const columns = [
  { key: 'channelCode', title: '渠道编码' },
  { key: 'shopId', title: '店铺ID' },
  { key: 'shopName', title: '店铺名称' },
  { key: 'op', title: '操作' },
];

async function fetchList() {
  loading.value = true;
  try {
    const all = (await channelApi.list()) || [];
    total.value = all.length;
    rows.value = all.slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
  } finally {
    loading.value = false;
  }
}

function pageChange(p) {
  onPageChange(p);
  fetchList();
}

/** 编辑/删除依赖列表返回的 id；列表接口未返回 id 时阻止操作并给出明确提示 */
function rowId(row) {
  if (row.id == null || row.id === '') {
    show('该渠道缺少 ID，无法操作（列表接口未返回 id，请刷新后重试）', 'warning');
    return null;
  }
  return row.id;
}

// ============ 新增 / 编辑 ============
const editVisible = ref(false);
const editingId = ref(null); // null = 新增
const editForm = reactive({
  channelCode: '',
  shopId: '',
  shopName: '',
});

function openCreate() {
  editingId.value = null;
  editForm.channelCode = '';
  editForm.shopId = '';
  editForm.shopName = '';
  editVisible.value = true;
}

function openEdit(row) {
  const id = rowId(row);
  if (id == null) return;
  editingId.value = id;
  editForm.channelCode = row.channelCode || '';
  editForm.shopId = row.shopId || '';
  editForm.shopName = row.shopName || '';
  editVisible.value = true;
}

async function submitEdit() {
  const channelCode = editForm.channelCode.trim();
  const shopId = editForm.shopId.trim();
  const shopName = editForm.shopName.trim();
  if (!editingId.value && !channelCode) {
    show('请输入渠道编码', 'warning');
    return;
  }
  if (!shopId) {
    show('请输入店铺ID', 'warning');
    return;
  }
  if (!shopName) {
    show('请输入店铺名称', 'warning');
    return;
  }

  try {
    if (editingId.value) {
      await channelApi.update(editingId.value, { shopId, shopName });
      show('编辑成功', 'success');
    } else {
      await channelApi.create({ channelCode, shopId, shopName });
      show('新增成功', 'success');
    }
    editVisible.value = false;
    fetchList();
  } catch (e) {
    show(e?.message || '保存失败', 'error');
  }
}

// ============ 删除 ============
async function handleDelete(row) {
  const id = rowId(row);
  if (id == null) return;
  const ok = await confirm({
    title: '删除确认',
    message: `确认删除渠道「${row.shopName || row.channelCode}」吗？删除后该渠道下的历史订单仍可关联查询。`,
    okText: '确认删除',
  });
  if (!ok) return;
  try {
    await channelApi.remove(id);
    show('删除成功', 'success');
    fetchList();
  } catch (e) {
    show(e?.message || '删除失败', 'error');
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="channel-page">
    <DataTable
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #toolbar>
        <button class="btn btn-primary" @click="openCreate">新增</button>
      </template>

      <template #cell-channelCode="{ row }">
        {{ row.channelCode || '-' }}
      </template>

      <template #cell-shopId="{ row }">
        {{ row.shopId || '-' }}
      </template>

      <template #cell-shopName="{ row }">
        {{ row.shopName || '-' }}
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" @click="openEdit(row)">编辑</button>
          <button class="link-btn danger" @click="handleDelete(row)">删除</button>
        </div>
      </template>
    </DataTable>

    <!-- 新增 / 编辑 弹窗 -->
    <AppModal v-model="editVisible" :title="editingId ? '编辑' : '新增'" width="640px">
      <div class="channel-modal-content">
        <div class="form-row">
          <label class="required">渠道编码</label>
          <input
            v-model="editForm.channelCode"
            :disabled="!!editingId"
            maxlength="50"
            placeholder="如 DOUYIN / XHS，创建后不可修改"
            @keyup.enter="submitEdit"
          />
          <p v-if="editingId" class="field-hint">渠道编码创建后不可修改</p>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label class="required">店铺ID</label>
            <input
              v-model="editForm.shopId"
              maxlength="50"
              placeholder="请输入店铺ID"
              @keyup.enter="submitEdit"
            />
          </div>
          <div class="form-row">
            <label class="required">店铺名称</label>
            <input
              v-model="editForm.shopName"
              maxlength="50"
              placeholder="请输入店铺名称"
              @keyup.enter="submitEdit"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="editVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitEdit">确 定</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.channel-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 12px;
  min-width: max-content;
}

.link-btn {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  flex: 0 0 auto;
  transition: background 0.15s ease, color 0.15s ease;
}

.link-btn:hover {
  background: rgba(37, 99, 235, 0.08);
}

.link-btn.danger {
  color: #d92d20;
}

.link-btn.danger:hover {
  background: rgba(217, 45, 32, 0.08);
}

/* 弹窗 */
.channel-modal-content {
  display: grid;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.form-row label.required::before {
  content: '*';
  color: #f04438;
  margin-right: 4px;
}

.form-row input {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: #1f2937;
  box-sizing: border-box;
  background: #fbfcfe;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.form-row input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.form-row input:disabled {
  background: #eef0f5;
  color: #98a1b3;
  cursor: not-allowed;
}

.field-hint {
  margin: 0;
  color: #98a1b3;
  font-size: 12px;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: background 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, transform 0.18s ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn-plain {
  background: #f2f4f7;
  color: #475467;
}

.btn-plain:hover {
  background: #e8ecf3;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 24px var(--primary-glow-strong);
}

.btn-primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 16px 30px var(--primary-border-strong);
}
</style>

<!-- 弹窗外壳美化（与游戏管理弹窗风格统一） -->
<style>
.modal-overlay:has(.channel-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.channel-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
  box-shadow: 0 40px 90px rgba(46, 16, 101, 0.35);
}

.modal-box:has(.channel-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.channel-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
}

.modal-box:has(.channel-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.channel-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--primary-faint);
}
</style>
