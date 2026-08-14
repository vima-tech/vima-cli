/**
 * 登录票据的存取（只管存储，不管怎么换来的）——与小程序端 `utils/auth.ts` 对称。
 *
 * 票据怎么来是业务：H5 常见是「短信验证码登录」或「微信网页授权回调」，
 * 那个换票接口属于**契约里的接口**，由任务实现，不预置在骨架里——
 * 骨架凭空写一个 `/app/auth/login` 会让 V-CODE-01 报「契约里没有这个接口」，
 * 也会让 Builder 误以为后端已经有了。
 */

const TOKEN_KEY = 'vm_token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
