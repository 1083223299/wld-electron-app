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
const rows = ref([]);
const total = ref(0);
const { page, pageSize, onPageSizeChange, onPageChange } = useListMemory({});
const loading = ref(false);

const columns = [
  { key: 'id', title: '渠道ID' },
  { key: 'name', title: '渠道名称' },
  { key: 'op', title: '操作' },
];

async function fetchList() {
  loading.value = true;
  try {
    const res = await channelApi.list({
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
}

function pageChange(p) {
  onPageChange(p);
  fetchList();
}

// ============ 新增 / 编辑 ============
const editVisible = ref(false);
const editingId = ref(null); // null = 新增
const editForm = reactive({
  name: '',
});

function openCreate() {
  editingId.value = null;
  editForm.name = '';
  editVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  editForm.name = row.name;
  editVisible.value = true;
}

async function submitEdit() {
  const name = editForm.name.trim();
  if (!name) {
    show('请输入渠道名称', 'warning');
    return;
  }
  if (name.length > 15) {
    show('渠道名称上限15个字', 'warning');
    return;
  }

  try {
    if (editingId.value) {
      await channelApi.update(editingId.value, { name });
      show('编辑成功', 'success');
    } else {
      await channelApi.create({ name });
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
  if (row.builtin) {
    show('系统内置渠道不支持删除', 'warning');
    return;
  }
  const ok = await confirm({
    title: '删除确认',
    message: `确认删除渠道「${row.name}」吗？删除后该渠道下的历史订单仍可关联查询。`,
    okText: '确认删除',
  });
  if (!ok) return;
  try {
    await channelApi.remove(row.id);
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

      <template #cell-op="{ row }">
        <!-- 系统内置渠道（如抖音接入第三方 API）不支持人工编辑、删除 -->
        <span v-if="row.builtin" class="text-muted">-</span>
        <div v-else class="action-group">
          <button class="link-btn" @click="openEdit(row)">编辑</button>
          <button class="link-btn danger" @click="handleDelete(row)">删除</button>
        </div>
      </template>
    </DataTable>

    <!-- 新增 / 编辑 弹窗 -->
    <AppModal v-model="editVisible" :title="editingId ? '编辑' : '新增'" width="460px">
      <div class="channel-modal-content">
        <div class="form-row">
          <label class="required">渠道名称</label>
          <input
            v-model="editForm.name"
            maxlength="15"
            placeholder="上限15个字"
            @keyup.enter="submitEdit"
          />
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

.text-muted {
  color: #9aa3b5;
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
  /* background: linear-gradient(180deg, rgba(248, 250, 255, 0.7), rgba(243, 240, 255, 0.95)); */
  border-top: 1px solid var(--primary-faint);
}
</style>
