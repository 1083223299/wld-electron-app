<script setup>
import PaginationSimple from './PaginationSimple/index.vue';

defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  showPagination: { type: Boolean, default: true },
  emptyText: { type: String, default: '暂无数据' },
});
const emit = defineEmits(['page-change', 'page-size-change']);
</script>

<template>
  <div class="list-panel data-table">
    <div v-if="$slots.toolbar" class="list-page__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="list-page__body">
      <table>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key">{{ col.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="columns.length">
              <div class="empty">
                <img src="../assets/images/noTransactionHistory.png" alt="暂无数据" />
                <p>{{ emptyText }}</p>
              </div>
            </td>
          </tr>
          <tr v-for="(row, i) in data" :key="row.id ?? i">
            <td v-for="col in columns" :key="col.key">
              <slot :name="`cell-${col.key}`" :row="row">
                {{ row[col.key] ?? '-' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showPagination" class="list-page__footer">
      <PaginationSimple
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :show-batch-actions="false"
        @current-change="(p) => emit('page-change', p)"
        @page-size-change="(s) => emit('page-size-change', s)"
      />
    </div>
  </div>
</template>

<style scoped>
.data-table {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.list-page__body {
  position: relative;
  overflow: auto;
  background: var(--bg-card);
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-gutter: stable;
}

.list-page__body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.list-page__body::-webkit-scrollbar-track {
  background: transparent;
}

.list-page__body::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.list-page__body::-webkit-scrollbar-thumb:hover {
  background: var(--primary);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.data-table .list-page__body table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.data-table .list-page__body thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-thead);
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.data-table .list-page__body tbody td {
  color: var(--text-main);
  font-size: 13px;
  border-bottom: 1px solid var(--border-faint);
  padding: 12px 14px;
  vertical-align: middle;
}

.data-table .list-page__body tbody tr:hover td {
  background: var(--bg-hover);
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 180px;
  color: var(--text-sub);
}

.empty img {
  width: 72px;
  opacity: 0.8;
  margin-bottom: 8px;
}
</style>
