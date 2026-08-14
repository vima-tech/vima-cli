import { reportRuntimeError } from './utils/report';
import { getToken } from './utils/auth';

/**
 * 小程序入口。
 *
 * 全局只放三样东西：登录态、适老化开关、运行时错误上报。
 * 业务状态别往 globalData 里塞——它没有响应式，页面之间靠它同步必然漏更新；
 * 需要跨页共享的用 storage + 页面 onShow 重读。
 */
interface GlobalData {
  /** 登录票据（从 storage 恢复，登录后由 utils/auth 写入） */
  token: string;
  /** 适老化模式：页面根节点据此拼 `vm-aging` 类（vima-ui-mp 只重定义字阶令牌，全站生效） */
  aging: boolean;
}

App<{ globalData: GlobalData }>({
  globalData: {
    token: '',
    aging: false,
  },

  onLaunch() {
    this.globalData.token = getToken();
    this.globalData.aging = wx.getStorageSync('vm_aging') === true;
  },

  /** A7 运行时证据：未捕获错误（契约 §6.10） */
  onError(err: string) {
    reportRuntimeError({ kind: 'error', message: err });
  },

  /** A7 运行时证据：未捕获的 Promise 拒绝 */
  onUnhandledRejection(res: WechatMiniprogram.OnUnhandledRejectionCallbackResult) {
    reportRuntimeError({
      kind: 'unhandledrejection',
      message: res && res.reason ? String(res.reason) : 'unhandled rejection',
    });
  },
});
