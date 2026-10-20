import { request } from '../request';

const { mock } = request;

const DB = Array.from({ length: 57 }, (_, i) => ({
  id: 1001 + i,
  name: ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九'][i % 7] + (i > 6 ? i : ''),
  email: `user${1001 + i}@example.com`,
  role: ['管理员', '运营', '客服', '访客'][i % 4],
  status: i % 5 === 0 ? 0 : 1,
  createTime: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
}));

export const userApi = {
  list: ({ page = 1, pageSize = 10, keyword = '' } = {}) =>
    mock(null, 200).then(() => {
      let list = DB;
      if (keyword) {
        const kw = keyword.trim();
        list = list.filter((u) => u.name.includes(kw) || u.email.includes(kw));
      }
      return {
        total: list.length,
        list: list.slice((page - 1) * pageSize, page * pageSize),
      };
    }),

  create: (data) =>
    mock(null, 200).then(() => {
      DB.unshift({
        id: 1001 + DB.length + Math.floor(Math.random() * 900),
        status: 1,
        createTime: new Date().toISOString().slice(0, 10),
        ...data,
      });
      return true;
    }),

  update: (id, data) =>
    mock(null, 200).then(() => {
      const item = DB.find((u) => u.id === id);
      if (item) Object.assign(item, data);
      return true;
    }),

  remove: (id) =>
    mock(null, 200).then(() => {
      const idx = DB.findIndex((u) => u.id === id);
      if (idx > -1) DB.splice(idx, 1);
      return true;
    }),
};
