import { APP_NAME } from '../../config';

/**
 * 骨架首页 —— 演示 vima-ui-mp 的页面骨架：hero（主视觉）+ sheet（上翻承载面）。
 * 业务页由任务生成，可以整页替换本页；保留它是为了创建后立刻能跑起来看到样子。
 */
Page({
  data: {
    appName: APP_NAME,
    aging: false,
    entries: [
      { key: 'plan', name: '我的方案', tone: '' },
      { key: 'report', name: '检查报告', tone: 'cyan' },
      { key: 'edu', name: '宣教资讯', tone: 'green' },
      { key: 'mine', name: '个人中心', tone: 'amber' },
    ],
  },

  onShow() {
    const app = getApp<{ globalData: { aging: boolean } }>();
    this.setData({ aging: !!(app && app.globalData.aging) });
  },
});
