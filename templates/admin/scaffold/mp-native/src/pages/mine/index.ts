/**
 * 骨架「我的」页 —— 演示键值区（vm-kv）、开关行（vm-switch-row）与底部操作条（vm-actionbar）。
 * 适老化开关是框架能力的实机演示：切一个根类，全站字阶与控件高一起变。
 */
Page({
  data: {
    aging: false,
    profile: [
      { label: '账号', value: '未登录' },
      { label: '版本', value: '0.1.0' },
    ],
  },

  onShow() {
    const app = getApp<{ globalData: { aging: boolean } }>();
    this.setData({ aging: !!(app && app.globalData.aging) });
  },

  onToggleAging(e: WechatMiniprogram.SwitchChange) {
    const aging = e.detail.value;
    const app = getApp<{ globalData: { aging: boolean } }>();
    if (app) app.globalData.aging = aging;
    wx.setStorageSync('vm_aging', aging);
    this.setData({ aging });
  },
});
