<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import ReminderListTab from './ReminderListTab.vue';
import ClaimHallTab from './ClaimHallTab.vue';
import OrderListTab from './OrderListTab.vue';

/**
 * 订单管理 > 订单管理
 * 页面内含三个 Tab：催单列表 / 领单大厅 / 订单列表（依据《未来电竞需求_原型分析文档》）
 * 支持 ?tab=order|claim|reminder 定位初始 Tab（系统通知跳转卡单订单时使用）
 */
const route = useRoute();
const initTab = ['order', 'claim', 'reminder'].includes(route.query.tab) ? route.query.tab : 'reminder';
const activeTab = ref(initTab);
</script>

<template>
  <div class="order-manage-page">
    <el-tabs v-model="activeTab" class="order-tabs">
      <el-tab-pane label="催单列表" name="reminder">
        <ReminderListTab />
      </el-tab-pane>
      <el-tab-pane label="领单大厅" name="claim">
        <ClaimHallTab />
      </el-tab-pane>
      <el-tab-pane label="订单列表" name="order">
        <OrderListTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.order-manage-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.order-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.order-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.order-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: rgba(128, 141, 176, 0.16);
}

.order-tabs :deep(.el-tabs__item) {
  height: 44px;
  line-height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: #5b6478;
  padding: 0 22px;
}

.order-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary);
}

.order-tabs :deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  height: 3px;
  border-radius: 3px;
}

.order-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.order-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
