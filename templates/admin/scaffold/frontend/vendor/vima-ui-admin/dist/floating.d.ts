/**
 * @vima-tech/ui-admin · 浮层视口定位
 *
 * 创建日期: 2026-08-10
 *
 * 手写文件，不在 scripts/extract-from-ui-v3.mjs 的生成清单里，重跑提取不会被覆盖。
 *
 * 菜单类浮层为什么必须离开文档流，两个原因：
 *  1. 裁剪——面板贴着触发器做 absolute 时，任何一个 overflow 不是 visible 的祖先
 *     都会把它切掉，而本库自己的 .vui-card 就是 overflow: hidden，卡片又是后台页面的
 *     默认容器（.vui-collapse / .vui-tabs / 可滚动的表格容器同理）。
 *  2. 层级——给触发器写 z-index 会让它成为层叠上下文，面板此后写多大的 z-index 都
 *     只在这个上下文内部排序，压不住对话框（.vui-layer-wrap 是 2200）。
 * 所以面板 teleport 到 body，用 position: fixed 加这里算出来的视口坐标。
 */
/** 面板与触发器之间的呼吸 */
export declare const FLOATING_GAP = 8;
/** 面板与视口边缘的最小留白 */
export declare const FLOATING_VIEWPORT_MARGIN = 12;
export interface FloatingMenuPosition {
    /** 面板落在触发器上方 */
    dropUp: boolean;
    style: Record<string, string>;
}
/**
 * 面板刚挂载、还没量出尺寸时的占位样式。
 * 先摆到视口外而不是 0,0，是为了万一定位没跑起来也不会在左上角闪一下。
 */
export declare const FLOATING_MENU_PENDING_STYLE: Record<string, string>;
/**
 * 算出菜单类浮层的视口坐标：下方放不下就向上翻，横向超出就往回夹，
 * 上下都放不下就给一个 max-height 让面板自己滚。
 *
 * 与 form.ts 里 select / 日期用的那套定位的区别：那两个把面板宽度锁成触发器宽度，
 * 菜单的宽度由内容决定，只能量——所以 panel 必须已经在文档里（挂载后再调）。
 */
export declare function floatingMenuPosition(anchor: HTMLElement, panel: HTMLElement, alignEnd?: boolean): FloatingMenuPosition;
//# sourceMappingURL=floating.d.ts.map