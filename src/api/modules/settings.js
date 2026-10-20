import { request } from '../request';

const { mock } = request;

const store = {
  siteName: '未来电竞管理后台',
  siteUrl: 'https://example.com',
  adminEmail: 'admin@example.com',
  pageSize: 10,
  enableRegister: true,
  enableNotice: false,
  remark: '',
};

export const settingsApi = {
  get: () => mock(store, 200),
  save: (data) =>
    mock(null, 300).then(() => {
      Object.assign(store, data);
      return true;
    }),
};
