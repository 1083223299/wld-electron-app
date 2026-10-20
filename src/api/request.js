import { config } from '../config/env';
import { getToken, removeToken } from '../utils/auth';
import { useToast } from '../composables/useToast';

const BASE_URL = config.apibaseURL;
const TIMEOUT = config.timeout || 8000;

const requestInterceptors = {
  before: [],
  after: [],
};

export function addRequestInterceptor(fn) {
  requestInterceptors.before.push(fn);
}

export function addResponseInterceptor(fn) {
  requestInterceptors.after.push(fn);
}

function notifyError(message) {
  const { show } = useToast();
  show(message, 'error');
}

async function http({ url, method = 'GET', data, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  let requestConfig = { url, method, headers: { Accept: 'application/json', ...headers } };

  for (const interceptor of requestInterceptors.before) {
    requestConfig = (await interceptor(requestConfig)) || requestConfig;
  }

  const authToken = getToken();
  if (authToken && !requestConfig.headers.Authorization) {
    requestConfig.headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const targetUrl = /^https?:\/\//.test(requestConfig.url)
      ? requestConfig.url
      : `${BASE_URL}${requestConfig.url}`;

    const res = await fetch(targetUrl, {
      method: requestConfig.method,
      headers: {
        'Content-Type': 'application/json',
        ...requestConfig.headers,
      },
      body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });

    let payload = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }

    if (res.status === 401) {
      removeToken();
      notifyError('登录已过期，请重新登录');
      window.location.hash = '#/login';
      throw new Error('登录已过期');
    }

    if (!res.ok) {
      const errorMessage = payload && payload.message ? payload.message : `HTTP ${res.status}`;
      throw new Error(errorMessage);
    }

    if (payload && typeof payload === 'object' && 'code' in payload && payload.code !== 0 && payload.code !== 200) {
      throw new Error(payload.message || '业务处理失败');
    }

    let result = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    for (const interceptor of requestInterceptors.after) {
      result = (await interceptor(result, res, payload)) ?? result;
    }

    return result;
  } catch (error) {
    const message = error?.message || '请求失败';
    if (message !== '登录已过期') {
      notifyError(message);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function mock(payload, delay = 300) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(payload))), delay);
  });
}

export const request = {
  http,
  mock,
  get: (url, headers) => http({ url, method: 'GET', headers }),
  post: (url, data, headers) => http({ url, method: 'POST', data, headers }),
  put: (url, data, headers) => http({ url, method: 'PUT', data, headers }),
  del: (url, headers) => http({ url, method: 'DELETE', headers }),
};
