import { BASE_URL } from '../config';
import { clearToken, getToken } from './auth';

/**
 * 统一请求门面 —— **本端唯一允许发起网络请求的地方**。
 *
 * 为什么必须是这个形状（不是风格问题，是机检契约）：
 * `vima validate` 的 V-CODE-01 用一条正则扫全部前端代码，把
 * `request.<method>('<字面量路径>')` 的调用逐条对到 `docs/contracts/` 的接口清单上，
 * 并检查该接口的 `consumers` 是否包含本端——**越权调用在规划期就被拦住**。
 * 一旦有人直接写 `wx.request({ url, method })`，这条对账立刻对它失明：
 * 接口不在契约里查不出来、调了别的端的接口也查不出来。
 *
 * 所以：
 *   ✅ request.get('/app/appointment/mine')          路径写字面量，机检看得见
 *   ❌ wx.request({ url: base + p, method: 'GET' })  绕过门面
 *   ❌ request.get(`/app/${kind}/list`)              路径拼变量，机检读不出常量部分
 *      （确需动态段时，把变量放进查询参数或路径占位 `/app/order/{id}`，
 *        契约侧同样用 `{id}` 声明，两边归一后才对得上）
 */

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** 后端统一响应包装（与 admin 端同形状）。 */
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/** 登录态失效的统一处置：清票据 + 提示。跳登录由业务页自行决定（本骨架不预设登录页）。 */
function handleUnauthorized(): void {
  clearToken();
  wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' });
}

function call<T>(method: Method, path: string, data?: unknown): Promise<T> {
  const token = getToken();
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data: data as WechatMiniprogram.RequestOption['data'],
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 15000,
      success(res) {
        const body = res.data as ApiEnvelope<T>;
        if (res.statusCode === 401 || (body && body.code === 401)) {
          handleUnauthorized();
          reject(new Error((body && body.message) || '登录已失效'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error((body && body.message) || `HTTP ${res.statusCode}`));
          return;
        }
        // 有 code 字段就按包装解，没有就把整个 body 当数据（兼容裸返回的端点）
        if (body && typeof body.code === 'number') {
          if (body.code !== 200) {
            reject(new Error(body.message || '请求失败'));
            return;
          }
          resolve(body.data);
          return;
        }
        resolve(res.data as T);
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络异常'));
      },
    });
  });
}

export const request = {
  get: <T = unknown>(path: string, data?: unknown) => call<T>('GET', path, data),
  post: <T = unknown>(path: string, data?: unknown) => call<T>('POST', path, data),
  put: <T = unknown>(path: string, data?: unknown) => call<T>('PUT', path, data),
  delete: <T = unknown>(path: string, data?: unknown) => call<T>('DELETE', path, data),
  patch: <T = unknown>(path: string, data?: unknown) => call<T>('PATCH', path, data),
};

export default request;
