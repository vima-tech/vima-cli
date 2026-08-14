/**
 * 登录票据的存取（只管存储，不管怎么换来的）。
 *
 * 票据怎么来是业务：微信小程序的标准链路是
 *   wx.login() 拿 code → POST 到后端换票据 → setToken(票据)。
 * 那个换票接口属于**契约里的接口**，由任务实现，不预置在骨架里——
 * 骨架凭空写一个 `/app/auth/login` 会让 V-CODE-01 报「契约里没有这个接口」，
 * 也会让 Builder 误以为后端已经有了。
 */

const TOKEN_KEY = 'vm_token';

export function getToken(): string {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token);
  const app = getApp<{ globalData: { token: string } }>();
  if (app) app.globalData.token = token;
}

export function clearToken(): void {
  wx.removeStorageSync(TOKEN_KEY);
  const app = getApp<{ globalData: { token: string } }>();
  if (app) app.globalData.token = '';
}
