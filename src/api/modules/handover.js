import { request } from '../request';

const { mock } = request;

/**
 * 交接中心 > 交接日志
 * 本地 mock 实现（同 order.js 风格）：
 * - 每条日志记录：内容、提交人、提交时间、关联订单、关注人
 * - 关注人全部处理完后，卡片状态变为「已处理」
 * - watchAll = true 表示 @所有人，此时 logs 固定为全员
 */

// 员工列表（关注人候选）
export const STAFF_LIST = ['张三', '李四', '王五', '赵六', '孙七'];

// 日志状态：0 待处理 / 1 已处理
export const LOG_STATUS = {
  PENDING: 0,
  DONE: 1,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(d = new Date()) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// 生成一条关注人处理明细
function makeLogRow(user, done = false) {
  return {
    user,
    status: done ? LOG_STATUS.DONE : LOG_STATUS.PENDING,
    time: done ? formatTime() : '',
  };
}

let seq = 100;
const DB = [
  {
    id: 1,
    content: '凌晨单量低，早班关注永劫无匹配 SKU 单（246789641846），今早同步抖音侧。',
    creator: '张三',
    createTime: '2026-10-09 11:22:33',
    orderNos: ['246789641846'],
    watchAll: false,
    logs: [makeLogRow('李四', true), makeLogRow('王五', false)],
  },
  {
    id: 2,
    content: '凌晨单量低，早班关注永劫无匹配 SKU 单（246789641846），今早同步抖音侧。',
    creator: '张三',
    createTime: '2026-10-09 11:22:33',
    orderNos: ['246789641846'],
    watchAll: false,
    logs: [makeLogRow('李四', true), makeLogRow('王五', true)],
  },
  {
    id: 3,
    content: '凌晨单量低，早班关注永劫无匹配 SKU 单（246789641846），今早同步抖音侧。',
    creator: '张三',
    createTime: '2026-10-09 11:22:33',
    orderNos: ['246789641846'],
    watchAll: true,
    logs: STAFF_LIST.map((u) => makeLogRow(u, true)),
  },
];

// 计算单条日志的展示状态
function decorate(item) {
  const total = item.logs.length;
  const doneCount = item.logs.filter((l) => l.status === LOG_STATUS.DONE).length;
  const done = total > 0 && doneCount === total;
  return {
    ...item,
    totalWatchers: total,
    doneCount,
    status: done ? LOG_STATUS.DONE : LOG_STATUS.PENDING,
    watcherNames: item.watchAll ? ['所有人'] : item.logs.map((l) => l.user),
  };
}

function sameDay(dayStr, timeStr) {
  return typeof dayStr === 'string' && dayStr && timeStr.startsWith(dayStr);
}

export const handoverApi = {
  /**
   * 交接日志列表
   * @param {Object} opts
   * @param {string} opts.startDate 开始日期 YYYY-MM-DD
   * @param {string} opts.endDate   结束日期 YYYY-MM-DD
   * @param {''|0|1} opts.status   状态筛选：'' 全部 / 0 待处理 / 1 已处理
   * @param {boolean} opts.relatedToMe 与我相关
   * @param {string} opts.currentUser  当前登录人
   */
  list: ({ startDate = '', endDate = '', status = '', relatedToMe = false, currentUser = '' } = {}) =>
    mock(null, 200).then(() => {
      let list = DB.slice();

      if (startDate) list = list.filter((i) => i.createTime >= `${startDate} 00:00:00`);
      if (endDate) list = list.filter((i) => i.createTime <= `${endDate} 23:59:59`);

      if (relatedToMe && currentUser) {
        list = list.filter(
          (i) => i.watchAll || i.logs.some((l) => l.user === currentUser) || i.creator === currentUser
        );
      }

      let decorated = list.map(decorate);
      if (status === 0 || status === 1) {
        decorated = decorated.filter((i) => i.status === Number(status));
      }

      // 最新提交在前
      decorated.sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
      return { list: decorated };
    }),

  /**
   * 新增交接日志
   * @param {Object} payload { content, orderNos, watchers, watchAll, currentUser }
   */
  create: ({ content = '', orderNos = [], watchers = [], watchAll = false, currentUser = '' } = {}) =>
    mock(null, 200).then(() => {
      const users = watchAll ? STAFF_LIST.slice() : watchers.slice();
      const item = {
        id: ++seq,
        content,
        creator: currentUser || '未登录',
        createTime: formatTime(),
        orderNos: orderNos.slice(),
        watchAll,
        logs: users.map((u) => makeLogRow(u, false)),
      };
      DB.unshift(item);
      return decorate(item);
    }),

  /**
   * 标记当前人为「已处理」
   */
  markProcessed: (id, currentUser = '') =>
    mock(null, 200).then(() => {
      const item = DB.find((x) => x.id === id);
      if (!item) throw new Error('日志不存在');
      const row = item.logs.find((l) => l.user === currentUser);
      if (row) {
        row.status = LOG_STATUS.DONE;
        row.time = formatTime();
      }
      return decorate(item);
    }),

  /**
   * 处理日志明细
   */
  logs: (id) =>
    mock(null, 150).then(() => {
      const item = DB.find((x) => x.id === id);
      if (!item) throw new Error('日志不存在');
      return item.logs.map((l) => ({ ...l }));
    }),
};
