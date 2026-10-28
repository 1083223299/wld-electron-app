<script setup>
const props = defineProps({
  logs: { type: Array, default: () => [] },
});

function markerClass(log) {
  const content = `${log.action || ''} ${log.text || ''}`;
  if (/完成|通过|COMPLET|SUCCESS/i.test(content)) return 'is-success';
  if (/审核|凭证|驳回|拒绝|AUDIT|REJECT/i.test(content)) return 'is-warning';
  return 'is-default';
}
</script>

<template>
  <ul v-if="props.logs.length" class="order-log-timeline">
    <li
      v-for="(log, index) in props.logs"
      :key="log.id || `${log.time}-${index}`"
      class="timeline-item"
      :class="markerClass(log)"
    >
      <div class="timeline-content">
        <div class="timeline-head">
          <time class="timeline-time">{{ log.time || '—' }}</time>
          <span v-if="log.op" class="timeline-operator">操作人：{{ log.op }}</span>
        </div>
        <p v-if="log.text || log.action" class="timeline-text">{{ log.text || log.action }}</p>
      </div>
    </li>
  </ul>
  <p v-else class="muted-text">暂无日志</p>
</template>

<style scoped>
.order-log-timeline {
  list-style: none;
  margin: 0;
  padding: 2px 0 2px 11px;
}

.timeline-item {
  position: relative;
  padding: 0 0 14px 18px;
  color: var(--text-sub);
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-item::before {
  position: absolute;
  top: 4px;
  left: -3px;
  z-index: 1;
  width: 8px;
  height: 8px;
  border: 2px solid var(--bg-card);
  border-radius: 50%;
  background: var(--timeline-color, var(--primary));
  box-shadow: 0 0 0 1px var(--timeline-color, var(--primary));
  content: '';
}

.timeline-item::after {
  position: absolute;
  top: 13px;
  bottom: -1px;
  left: 0;
  width: 1px;
  background: var(--border);
  content: '';
}

.timeline-item:last-child::after {
  display: none;
}

.timeline-item.is-success {
  --timeline-color: var(--success, #22a06b);
}

.timeline-item.is-warning {
  --timeline-color: var(--warning, #d97706);
}

.timeline-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
}

.timeline-time {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.timeline-operator {
  overflow: hidden;
  color: var(--text-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-text {
  margin: 3px 0 0;
  color: var(--text-main);
  font-size: 12.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.muted-text {
  margin: 0;
  color: var(--text-faint);
  font-size: 12.5px;
}
</style>
