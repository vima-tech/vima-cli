/**
 * 端级配置。
 *
 * BASE_URL 指向后端网关的 /api 前缀——与契约里接口路径的写法配套：
 * 契约写 `/api/app/appointment`，代码里 `request.post('/app/appointment')`，
 * 机检（V-CODE-01 的 feApiKey）会自动补上 /api 前缀再对账，两边归一后一致。
 *
 * 真机与体验版必须是 https 且在小程序后台配置了 request 合法域名；
 * 开发者工具里勾「不校验合法域名」才能用 http://localhost。
 */
export const BASE_URL = 'http://localhost:8080/api';

/** 应用名（骨架页展示用；页面标题在 app.json 的 navigationBarTitleText） */
export const APP_NAME = '{{projectName}}';
