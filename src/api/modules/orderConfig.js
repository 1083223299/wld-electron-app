import { request } from '../request';

const { mock } = request;

/**
 * 订单相关配置（卡单时长）
 * - pendingClaimMinutes   待领取时长（分钟）：订单进入大厅后多久未被领取算卡单
 * - pendingDispatchMinutes 待派单时长（分钟）：客服派单后多久未派出算卡单
 * - pendingAcceptMinutes  待接单时长（分钟）：派给打手后多久未接单算卡单
 */
const store = {
  pendingClaimMinutes: 10,
  pendingDispatchMinutes: 10,
  pendingAcceptMinutes: 10,
};

export const orderConfigApi = {
  /** 获取订单相关配置 */
  get: () => mock({ ...store }, 200),

  /** 保存订单相关配置 */
  save: (data = {}) =>
    mock(null, 300).then(() => {
      store.pendingClaimMinutes = Number(data.pendingClaimMinutes);
      store.pendingDispatchMinutes = Number(data.pendingDispatchMinutes);
      store.pendingAcceptMinutes = Number(data.pendingAcceptMinutes);
      return { ...store };
    }),
};
