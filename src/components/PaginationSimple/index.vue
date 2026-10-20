<script setup>
import { computed, ref, watch } from 'vue';
import { ElButton, ElInput, ElPagination } from 'element-plus';

const props = defineProps({
  currentPage: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  selectedRows: { type: Array, default: () => [] },
  showBatchActions: { type: Boolean, default: true },
});

const emit = defineEmits(['current-change', 'page-size-change', 'batch-enable', 'batch-disable', 'clear-selection']);

const jumpPage = ref(props.currentPage);

watch(
  () => props.currentPage,
  (value) => {
    jumpPage.value = value;
  }
);

const maxPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

const handleCurrentChange = (val) => {
  emit('current-change', val);
  jumpPage.value = val;
};

const handleJump = () => {
  if (!jumpPage.value || Number.isNaN(Number(jumpPage.value))) {
    jumpPage.value = props.currentPage;
    return;
  }

  const pageNum = Number(jumpPage.value);
  if (pageNum < 1 || pageNum > maxPage.value) {
    jumpPage.value = props.currentPage;
    return;
  }

  emit('current-change', pageNum);
};

const handleJumpBlur = () => {
  if (!jumpPage.value || Number.isNaN(Number(jumpPage.value))) {
    jumpPage.value = props.currentPage;
    return;
  }

  const pageNum = Number(jumpPage.value);
  if (pageNum < 1) {
    jumpPage.value = 1;
    return;
  }

  if (pageNum > maxPage.value) {
    jumpPage.value = maxPage.value;
  }
};

const batchEnable = () => emit('batch-enable');
const batchDisable = () => emit('batch-disable');
const clearSelection = () => emit('clear-selection');
</script>

<template>
  <div class="pagination-container">
    <div v-if="showBatchActions && selectedRows.length > 0" class="batch-actions">
      <span class="selected-count">已选择 {{ selectedRows.length }} 项</span>
      <el-button type="text" size="small" @click="batchEnable">批量启用</el-button>
      <el-button type="text" size="small" @click="batchDisable">批量禁用</el-button>
      <el-button type="text" size="small" @click="clearSelection">清空</el-button>
    </div>

    <div class="pagination-wrapper">
      <div class="page-total">共 {{ total }} 条</div>

      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="sizes, prev, pager, next"
        @current-change="handleCurrentChange"
        @size-change="(size) => emit('page-size-change', size)"
        class="pagination"
      />

      <div class="page-jumper">
        <span>跳至</span>
        <el-input v-model.number="jumpPage" size="small" class="page-jump-input" @keyup.enter="handleJump" @blur="handleJumpBlur" />
        <span>页</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  position: relative;
  /* padding-top: 8px; */
}

.batch-actions {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--primary-tint);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid var(--primary);
}

.selected-count {
  font-size: 14px;
  color: var(--primary);
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  margin: 0 0 0 auto;
	align-items: baseline;
}

.pagination {
  display: inline-flex;
}

.page-total {
  font-size: 12px;
  color: var(--text-sub);
  white-space: nowrap;
}

.page-jumper {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-main);
}

.page-jump-input {
  width: 62px;
}

:deep(.el-pagination) {
  --el-pagination-hover-color: var(--primary-hover);
}

:deep(.el-pager li) {
  min-width: 28px;
  height: 28px;
  line-height: 28px;
  border-radius: 6px;
}

:deep(.el-pager li.is-active) {
  color: var(--text-main);
  font-weight: 600;
  border: 1px solid var(--text-main);
}

:deep(.el-pagination .btn-prev),
:deep(.el-pagination .btn-next) {
  color: var(--text-main);
}
:deep(.el-input__wrapper) {
  height: 28px !important;
  line-height: 28px !important;
}
@media (max-width: 992px) {
  .pagination-container {
    flex-direction: column;
    align-items: stretch;
  }

  .batch-actions {
    position: static;
    transform: none;
    margin-bottom: 10px;
    justify-content: center;
  }

  .pagination-wrapper {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-left: 0;
  }
}
</style>
