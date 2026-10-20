import { request } from '../request';

const { mock } = request;

export const dashboardApi = {
  getStats: () =>
    mock([
      { label: '今日营收', value: '¥28,430', trend: '+12.4%', up: true },
      { label: '新增用户', value: '356', trend: '+8.1%', up: true },
      { label: '订单量', value: '1,204', trend: '-2.3%', up: false },
      { label: '活跃度', value: '87%', trend: '+1.6%', up: true },
    ]),

  getTrend: () =>
    mock([
      { label: '10-04', value: 42 },
      { label: '10-05', value: 58 },
      { label: '10-06', value: 51 },
      { label: '10-07', value: 76 },
      { label: '10-08', value: 63 },
      { label: '10-09', value: 88 },
      { label: '10-10', value: 95 },
    ]),

  getFeed: () =>
    mock([
      { time: '10:24', text: '用户 张三 完成支付订单 SO2026101001' },
      { time: '09:58', text: '管理员 更新了系统配置' },
      { time: '09:31', text: '用户 李四 注册成功' },
      { time: '08:47', text: '订单 SO2026100998 已发货' },
      { time: '08:12', text: '用户 王五 申请退款' },
    ]),
};
