/**
 * 多环境配置（精简版，只保留 API 相关配置）
 * ---------------------------------------------------------------
 * - CLIENT_VERSION：版本号统一从 package.json 的 version 读取
 *   （由 vite.config.js 的 define 在编译期注入 __APP_VERSION__）
 * - 每个环境：
 *   apibaseURL           接口 API 地址（request.js 的 BASE_URL）
 *   uplobaseURL          文件上传 API 地址
 *   websocketURL         WS 通知通道地址（notifySocket.js 用）
 *   timeout              请求超时（request.js 用）
 *   useMock              通知 mock 开关（notifySocket.js 用）
 * ---------------------------------------------------------------
 */

export const ENV_NAMES = {
  LOCAL: 'local',
  DEV: 'dev',
  TEST: 'test',
  STAGING: 'staging',
  PROD: 'prod',
};

/* ================= 公共配置（所有环境一致） ================= */
/** 客户端版本号：编译期从 package.json 注入 */
export const CLIENT_VERSION = __APP_VERSION__;
/** IM 客户端 ID */
export const CLIENT_ID = 'fe098735c5db7c5724d9ec077396c776';

export const environments = {
  [ENV_NAMES.LOCAL]: {
    name: '本地',
    apibaseURL: 'http://192.168.5.15:7500',
    uplobaseURL: 'http://192.168.5.15:7500/common/file/upload',
    websocketURL: 'ws://localhost:3001',
    timeout: 8000,
    useMock: true,
  },

  [ENV_NAMES.DEV]: {
    name: '开发',
    apibaseURL: 'https://api.weilaidong.com/devapi',
    uplobaseURL: 'https://api.weilaidong.com/devapi/common/file/upload',
    websocketURL: 'wss://dev-ws.myapp.com',
    timeout: 8000,
    useMock: false,
  },

  [ENV_NAMES.TEST]: {
    name: '测试',
    apibaseURL: 'https://api.weilaidong.com/testapi',
    uplobaseURL: 'https://api.weilaidong.com/testapi/common/file/upload',
    websocketURL: 'wss://test-ws.myapp.com',
    timeout: 10000,
    useMock: false,
  },

  [ENV_NAMES.STAGING]: {
    name: '预发布',
    apibaseURL: 'https://api.weilaidong.com/uatapi',
    uplobaseURL: 'https://api.weilaidong.com/uatapi/common/file/upload',
    websocketURL: 'wss://stage-ws.myapp.com',
    timeout: 10000,
    useMock: false,
  },

  [ENV_NAMES.PROD]: {
    name: '生产',
    apibaseURL: 'https://api.weilaidong.com/v2',
    uplobaseURL: 'https://api.weilaidong.com/v2/common/file/upload',
    websocketURL: 'wss://ws.myapp.com',
    timeout: 15000,
    useMock: false,
  },
};

function resolveEnv() {
  const fromVite = import.meta.env && import.meta.env.VITE_APP_ENV;
  if (fromVite && environments[fromVite]) return fromVite;
  if (import.meta.env && import.meta.env.DEV) return ENV_NAMES.LOCAL;
  return ENV_NAMES.PROD;
}

export const CURRENT_ENV = resolveEnv();
export const config = environments[CURRENT_ENV];

export default config;
