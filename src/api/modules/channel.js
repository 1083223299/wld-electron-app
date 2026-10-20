import { request } from '../request';

const { mock } = request;

// ===== 渠道表（内存 mock DB） =====
// builtin = true 表示系统内置（如抖音接入第三方 API），不支持人工编辑、删除
const CHANNEL_DB = [
  {
    id: 1525,
    name: '抖音',
    builtin: true,
    createTime: '2026-09-01 10:00:00',
    deleted: false,
  },
  {
    id: 1526,
    name: '小红书',
    builtin: false,
    createTime: '2026-09-05 14:30:00',
    deleted: false,
  },
];

let channelSeq = 1527;

const now = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const channelApi = {
  /**
   * 渠道列表
   * @param {{page?:number,pageSize?:number}} params
   */
  list: (params = {}) =>
    mock(null, 200).then(() => {
      const { page = 1, pageSize = 10 } = params;
      let list = CHANNEL_DB.filter((c) => !c.deleted);
      list = [...list].sort((a, b) => a.id - b.id);
      return {
        total: list.length,
        list: list.slice((page - 1) * pageSize, page * pageSize),
      };
    }),

  /** 全部渠道（供其他模块下拉选择） */
  all: () =>
    mock(null, 100).then(() =>
      CHANNEL_DB.filter((c) => !c.deleted).map((c) => ({
        id: c.id,
        name: c.name,
        builtin: c.builtin,
      }))
    ),

  create: (data) =>
    mock(null, 200).then(() => {
      const name = String(data.name || '').trim();
      if (!name) throw new Error('请输入渠道名称');
      if (name.length > 15) throw new Error('渠道名称上限15个字');
      // 唯一性校验
      const dup = CHANNEL_DB.find((c) => !c.deleted && c.name === name);
      if (dup) throw new Error('渠道名称已存在');
      const item = {
        id: channelSeq++,
        name,
        builtin: false,
        createTime: now(),
        deleted: false,
      };
      CHANNEL_DB.push(item);
      return item;
    }),

  update: (id, data) =>
    mock(null, 200).then(() => {
      const item = CHANNEL_DB.find((c) => c.id === Number(id));
      if (!item) throw new Error('渠道不存在');
      if (item.builtin) throw new Error('系统内置渠道不支持编辑');
      const name = String(data.name || '').trim();
      if (!name) throw new Error('请输入渠道名称');
      if (name.length > 15) throw new Error('渠道名称上限15个字');
      const dup = CHANNEL_DB.find(
        (c) => !c.deleted && c.id !== Number(id) && c.name === name
      );
      if (dup) throw new Error('渠道名称已存在');
      item.name = name;
      return item;
    }),

  /** 软删除 */
  remove: (id) =>
    mock(null, 200).then(() => {
      const item = CHANNEL_DB.find((c) => c.id === Number(id));
      if (!item) throw new Error('渠道不存在');
      if (item.builtin) throw new Error('系统内置渠道不支持删除');
      item.deleted = true;
      return true;
    }),
};
