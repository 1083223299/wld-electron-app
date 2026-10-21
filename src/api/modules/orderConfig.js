import { request } from '../request';

/**
 * 订单超时配置（GET /api/admin/timeouts 查询 / PUT /api/admin/timeouts 保存）
 * 现网配置项（与订单状态枚举不是同一套，勿混用）：
 * - 待接单抢单时长     code=WAIT_TAKE      mode=MINUTES
 *   读取：有 WAIT_TAKE 则用，无则回退 GRAB；保存只写 WAIT_TAKE，不单写 GRAB
 * - 接单后未提交验收   code=TAKE_TIMEOUT  mode=NOT_SUBMITTED
 * - 待接单卡单         code=STUCK          mode=MINUTES
 * 待领取 / 待派单现网无超时 code，页面不做可配项。
 */
export const TIMEOUT_ITEMS = [
  {
    key: 'grabMinutes',
    label: '待接单抢单时长',
    code: 'WAIT_TAKE',
    fallbackCode: 'GRAB',
    mode: 'MINUTES',
  },
  {
    key: 'takeTimeoutMinutes',
    label: '接单后未提交验收',
    code: 'TAKE_TIMEOUT',
    mode: 'NOT_SUBMITTED',
  },
  {
    key: 'stuckMinutes',
    label: '待接单卡单',
    code: 'STUCK',
    mode: 'MINUTES',
  },
];

export const orderConfigApi = {
  /** 获取超时配置（GET /api/admin/timeouts，返回 [{ code, mode, minutes }]） */
  get: async () => {
    const list = (await request.get('/api/admin/timeouts')) || [];
    const result = {};
    for (const item of TIMEOUT_ITEMS) {
      // 抢单时长读取优先 WAIT_TAKE，缺失回退 GRAB；其余按 code 精确匹配
      const matched =
        list.find((it) => it && it.code === item.code) ||
        (item.fallbackCode ? list.find((it) => it && it.code === item.fallbackCode) : null);
      result[item.key] = matched && matched.minutes != null ? Number(matched.minutes) : '';
    }
    return result;
  },

  /** 保存超时配置（PUT /api/admin/timeouts，请求体 [{ code, mode, minutes }]） */
  save: async (data = {}) => {
    const list = TIMEOUT_ITEMS.map((item) => ({
      code: item.code,
      mode: item.mode,
      minutes: Number(data[item.key]),
    }));
    return request.put('/api/admin/timeouts', list);
  },
};
