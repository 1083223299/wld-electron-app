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

/**
 * 实时通知 WS 通道运行参数（全环境一致；可在 environments 内按环境覆盖同名字段）
 * - reconnectBaseMs  断线重连指数退避基数（毫秒）
 * - reconnectMaxMs   断线重连最大间隔（毫秒）
 * - idleTimeoutMs    假死检测：超过该时长未收到任何服务端消息则主动断开触发重连（0 = 关闭检测）
 * - pollDelayMs      WS 断连后延迟多久开始低频角标轮询保底（毫秒）
 * - pollIntervalMs   断连兜底轮询间隔（毫秒）
 */
export const notifyConfig = {
  reconnectBaseMs: 3000,
  reconnectMaxMs: 30000,
  idleTimeoutMs: 45000,
  pollDelayMs: 30000,
  pollIntervalMs: 30000,
};

export const environments = {
  [ENV_NAMES.LOCAL]: {
    name: '本地',
    apibaseURL: 'http://192.168.5.15:7500',
    uplobaseURL: 'http://192.168.5.15:7500/common/file/upload',
    websocketURL: 'ws://localhost:3001',
    // 后台弹框通道（本地模拟环境不启用）
    adminWSURL: '',
    timeout: 8000,
    useMock: true,
  },

  [ENV_NAMES.DEV]: {
    name: '开发',
    apibaseURL: 'https://api.weilaidong.com/devapi',
    uplobaseURL: 'https://api.weilaidong.com/devapi/api/admin/files/upload',
    websocketURL: 'wss://dev-ws.myapp.com',
    // 后台弹框通道（/ws/admin：直连本机网关，无 /wld-dj 前缀）
    adminWSURL: 'ws://127.0.0.1:18080/ws/admin',
    timeout: 8000,
    useMock: false,
  },

  [ENV_NAMES.TEST]: {
    name: '测试',
    apibaseURL: 'http://sys.test.weilaidong.com/wld-dj',
    uplobaseURL: 'http://sys.test.weilaidong.com/wld-dj/common/file/upload',
    // 实时通知 WebSocket（后端 Apifox：/ws/notify，Query 传 token+client，见 notifySocket.js buildWsUrl）
    websocketURL: 'ws://sys.test.weilaidong.com/wld-dj/ws/notify',
    // 后台弹框通道（/ws/admin：同一套握手只换路径；收到纯文本「标题:内容」弹系统气泡/托盘）
    adminWSURL: 'ws://sys.test.weilaidong.com/wld-dj/ws/admin',
    timeout: 10000,
    useMock: false,
  },

  [ENV_NAMES.STAGING]: {
    name: '预发布',
    apibaseURL: 'https://api.weilaidong.com/uatapi',
    uplobaseURL: 'https://api.weilaidong.com/uatapi/common/file/upload',
    websocketURL: 'wss://stage-ws.myapp.com',
    // 后台弹框通道（当前与测试环境同网关，路径换 /ws/admin）
    adminWSURL: 'ws://sys.test.weilaidong.com/wld-dj/ws/admin',
    timeout: 10000,
    useMock: false,
  },

  [ENV_NAMES.PROD]: {
    name: '生产',
    apibaseURL: 'https://api.weilaidong.com/v2',
    uplobaseURL: 'https://api.weilaidong.com/v2/common/file/upload',
    websocketURL: 'wss://ws.myapp.com',
    // 后台弹框通道：生产尚未有可对外的 WebSocket 域名（后端明确先空着，勿用 api.weilaidong.com）
    adminWSURL: '',
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
