/**
 * @vima-tech/ui-admin · 轻量弹层服务（消息 / 通知 / 确认 / 加载）
 *
 * 创建日期: 2026-08-10
 *
 * 手工移植自 juvenile-guard/apps/admin-web/src/ui/layer.ts（不由 extract-from-ui-v3.mjs 生成）。
 * 移植时删掉的东西：宿主里那层 `setLayerBackend` + Proxy——它的用途是把调用转发给 layui-vue，
 * 属于宿主渐进迁移期的脚手架，框架里没有 legacy 后端可转发。
 *
 * API 形状（icon / time / btn / closeAll(type)）刻意保持与 Layui layer 一致：
 * 存量工程从 layui-vue 迁过来时调用点一行都不用改。
 */
export type LayerIndex = number | string;
export type LayerCallback = (index: LayerIndex) => void;
export type LayerButton = {
    text?: string;
    callback?: LayerCallback;
};
export type LayerOptions = {
    /** 0=信息 1=成功 2=警告，与 Layui 取值一致 */
    icon?: number;
    /** 自动关闭毫秒数 */
    time?: number;
    title?: string;
    content?: unknown;
    btn?: LayerButton[];
};
export declare const layer: {
    msg(content: unknown, options?: LayerOptions, callback?: () => void): LayerIndex;
    notify(options?: LayerOptions): LayerIndex;
    confirm(content: unknown, options?: LayerOptions): LayerIndex;
    load(): LayerIndex;
    close(index: LayerIndex): void;
    closeAll(type?: unknown): void;
};
export default layer;
//# sourceMappingURL=layer.d.ts.map