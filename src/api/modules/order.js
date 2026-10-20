import { request } from '../request';

const { mock } = request;

const STATUS = ['待付款', '待发货', '已发货', '已完成', '已取消'];
const STATUS_TYPE = ['warning', 'info', 'info', 'success', 'danger'];

const DB = Array.from({ length: 43 }, (_, i) => ({
  orderNo: `SO202610${String(1000 + i)}`,
  customer: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
  amount: (59 + i * 13.7).toFixed(2),
  status: i % 5,
  createTime: `2026-10-${String((i % 10) + 1).padStart(2, '0')} ${String(9 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
  address: '北京市朝阳区建国路 88 号',
  product: ['无线耳机', '机械键盘', '显示器', '鼠标垫', '充电器'][i % 5],
}));

export const orderApi = {
  list: ({ page = 1, pageSize = 10, status = -1, keyword = '' } = {}) =>
    mock(null, 200).then(() => {
      let filtered = status === -1 ? DB : DB.filter((o) => o.status === status);
      const kw = keyword.trim();
      if (kw) {
        filtered = filtered.filter(
          (o) => o.orderNo.includes(kw) || o.customer.includes(kw) || o.product.includes(kw)
        );
      }
      return {
        total: filtered.length,
        list: filtered.slice((page - 1) * pageSize, page * pageSize).map((o) => ({
          ...o,
          statusText: STATUS[o.status],
          statusType: STATUS_TYPE[o.status],
        })),
      };
    }),

  detail: (orderNo) =>
    mock(null, 150).then(() => {
      const o = DB.find((x) => x.orderNo === orderNo);
      if (!o) throw new Error('订单不存在');
      return { ...o, statusText: STATUS[o.status], statusType: STATUS_TYPE[o.status] };
    }),

  cancel: (orderNo) =>
    mock(null, 200).then(() => {
      const o = DB.find((x) => x.orderNo === orderNo);
      if (o) o.status = 4;
      return true;
    }),
};

export { STATUS };
