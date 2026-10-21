import { config } from '../config/env';
import { getToken, removeToken } from '../utils/auth';
import { useToast } from '../composables/useToast';

// 接口基础地址与超时时间（来自环境配置，默认 8 秒）
const BASE_URL = config.apibaseURL;
const TIMEOUT = config.timeout || 8000;

// 请求/响应拦截器容器：before 为请求拦截器，after 为响应拦截器
const requestInterceptors = {
  before: [],
  after: [],
};

// 注册请求拦截器，fn 接收当前 requestConfig，可返回修改后的配置（或返回 null 保持不变）
export function addRequestInterceptor(fn) {
  requestInterceptors.before.push(fn);
}

// 注册响应拦截器，fn 接收 (result, res, payload)，可返回新结果覆盖默认值
export function addResponseInterceptor(fn) {
  requestInterceptors.after.push(fn);
}

// 统一弹出错误提示
function notifyError(message) {
  const { show } = useToast();
  show(message, 'error');
}

/**
 * 核心 HTTP 请求函数
 * @param {object} options - 请求配置 { url, method, data, headers }
 * @returns {Promise<any>} 解析后的业务数据
 * 流程：超时控制 -> 请求拦截 -> 附加 token -> fetch -> 解析响应
 *      -> 401/HTTP 错误/业务码错误处理 -> 响应拦截 -> 返回 data
 */
async function http({ url, method = 'GET', data, headers = {} }) {
  // 超时控制：超过 TIMEOUT 毫秒则中断请求
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  // 默认请求头，Accept 指定优先返回 JSON
  let requestConfig = { url, method, headers: { Accept: 'application/json', ...headers } };

  // 依次执行请求拦截器，允许每个拦截器修改配置
  for (const interceptor of requestInterceptors.before) {
    requestConfig = (await interceptor(requestConfig)) || requestConfig;
  }

  // 若存在 token 且调用方未手动设置 Authorization，则自动附加 Bearer token
  const authToken = getToken();
  if (authToken && !requestConfig.headers.Authorization) {
    requestConfig.headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    // 绝对地址直接使用，相对地址拼接 BASE_URL
    const targetUrl = /^https?:\/\//.test(requestConfig.url)
      ? requestConfig.url
      : `${BASE_URL}${requestConfig.url}`;

    // 发起请求：data 序列化为 JSON 字符串，无 data 则不传 body
    const res = await fetch(targetUrl, {
      method: requestConfig.method,
      headers: {
        'Content-Type': 'application/json',
        ...requestConfig.headers,
      },
      body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });

    // 按 Content-Type 解析响应体：JSON 解析为对象，其余按纯文本
    let payload = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }

    // 401：仅当请求携带了 Authorization（登录后会话失效）才清除 token 并跳转登录页；
    // 未带 token 的 401（如登录时账号密码错误）落到下方通用错误分支，直接展示后端返回的 message
    if (res.status === 401) {
      if (requestConfig.headers.Authorization) {
        removeToken();
        notifyError('登录已过期，请重新登录');
        window.location.hash = '#/login';
        throw new Error('登录已过期');
      }
    }

    // 非 2xx 状态码：抛出后端返回的 message 或 HTTP 状态码
    if (!res.ok) {
      const errorMessage = payload && payload.message ? payload.message : `HTTP ${res.status}`;
      throw new Error(errorMessage);
    }

    // 业务码校验：code 不为 0/200 视为业务失败（兼容两种成功码约定）
    if (payload && typeof payload === 'object' && 'code' in payload && payload.code !== 0 && payload.code !== 200) {
      throw new Error(payload.message || '业务处理失败');
    }

    // 提取 data 字段（无 data 包裹则直接返回 payload），再依次执行响应拦截器
    let result = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    for (const interceptor of requestInterceptors.after) {
      result = (await interceptor(result, res, payload)) ?? result;
    }

    return result;
  } catch (error) {
    // 统一错误提示；"登录已过期"已在上方提示过，这里不再重复弹出
    const message = error?.message || '请求失败';
    if (message !== '登录已过期') {
      notifyError(message);
    }
    throw error;
  } finally {
    // 无论成功失败都清除超时定时器
    clearTimeout(timer);
  }
}

/**
 * 模拟异步接口（本地 Mock 数据）
 * @param {any} payload - 要返回的数据
 * @param {number} delay - 模拟延迟毫秒数，默认 300ms
 * 返回深拷贝，避免外部直接修改内部数据
 */
function mock(payload, delay = 300) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(payload))), delay);
  });
}

// 对外导出的请求工具：真实 HTTP 请求 + Mock + 常用方法快捷方式
export const request = {
  http,
  mock,
  get: (url, headers) => http({ url, method: 'GET', headers }),
  post: (url, data, headers) => http({ url, method: 'POST', data, headers }),
  put: (url, data, headers) => http({ url, method: 'PUT', data, headers }),
  del: (url, headers) => http({ url, method: 'DELETE', headers }),
};
