/**
 * @vima-tech/ui-admin · 模板系统几何计算
 *
 * 创建日期: 2026-08-11
 *
 * 这里全是纯函数：输入矩形、输出矩形，不碰 DOM、不碰 Vue、不读全局状态。
 * 拖拽和缩放的手感好不好，九成取决于这些函数算得对不对，
 * 所以它们必须能被单测钉死（见 test/template-geometry.test.mjs）。
 *
 * 两套坐标系共用同一个 Geometry 结构，区别只在单位：
 *   grid     —— x/y/w/h 的单位是「格」与「行」，都是整数
 *   absolute —— 单位是 px，可以是小数（吸附后会取整）
 *
 * 关于「要不要自动压实」：不做。
 * 向上压实会把用户亲手放的 y 改掉，与「定位更精准」这个诉求直接冲突。
 * 落点重叠时只把被压住的节点下推，保证不重叠；想要紧凑排列由编辑器显式调
 * compactGrid()，那是一次用户主动的操作，不是拖拽的副作用。
 */
import type { BreakpointKey, CanvasConfig, Geometry, NodeLayout } from './types';
/** 画布默认值。列数取 24，与组件库栅格同源 */
export declare const DEFAULT_CANVAS: Required<CanvasConfig>;
/**
 * 断点下界（px）。与 styles/ui.css 里那条 1100px 栅格塌行断点同源，
 * 改这里就要同步改那边，否则编辑器预览与真实渲染会对不上。
 */
export declare const BREAKPOINT_MIN_WIDTH: Record<BreakpointKey, number>;
/** 断点从宽到窄，遍历时第一个满足的就是当前断点 */
export declare const BREAKPOINTS_DESC: BreakpointKey[];
/** 合并画布配置与默认值 */
export declare function resolveCanvas(canvas?: CanvasConfig): Required<CanvasConfig>;
/** 容器宽度落在哪个断点 */
export declare function pickBreakpoint(width: number): BreakpointKey;
/**
 * 取某个断点下的实际几何。
 *
 * 基准值（layout.grid）相当于 lg；断点覆盖只覆盖写了的字段，
 * 因此「窄屏只想把宽度改成 24 格、其余不动」写 `{ sm: { w: 24 } }` 就够。
 */
export declare function resolveGridGeometry(layout: NodeLayout | undefined, bp?: BreakpointKey): Geometry | undefined;
/** 把值夹在 [min, max] 内。min/max 缺省时该侧不设限 */
export declare function clamp(value: number, min?: number, max?: number): number;
/**
 * 把几何夹进约束与画布边界。
 *
 * 顺序有讲究：先夹尺寸再夹位置。反过来的话，一个贴着右边缘、
 * 又被 minW 撑大的组件会被推出画布——尺寸是硬约束，位置得让步。
 */
export declare function clampGeometry(geo: Geometry, bounds?: {
    maxX?: number;
    maxY?: number;
}): Geometry;
/** 带 id 的矩形，碰撞与压实都按这个结构算 */
export interface PlacedRect extends Geometry {
    id: string;
}
/**
 * 两个矩形是否相交。边挨边不算相交——
 * 栅格里 `x+w == other.x` 是「紧挨着」，判成碰撞的话相邻组件永远排不到一起。
 */
export declare function collides(a: PlacedRect, b: PlacedRect): boolean;
/** 列出与目标矩形相交的所有矩形 */
export declare function findCollisions(target: PlacedRect, items: PlacedRect[]): PlacedRect[];
/**
 * 把与 movedId 冲突的矩形往下推，直到全场无重叠。
 *
 * 被拖动的那个绝不移动——它是用户刚刚亲手放下的，一旦被别人挤走，
 * 手感就是「拖不过去」。static 的也不动，其余的让位。
 *
 * 算法是「一次定位一个，定了就不再动」：
 * 被拖的先落位，static 的跟上，其余按 y 序逐个下沉到不与**已落位者**冲突为止。
 *
 * 不要写成「每轮把所有冲突者一起下推」——那样多个矩形会互相追赶：
 * A 躲 B 的同时 B 也在躲 A，位置一轮比一轮深，永远收敛不了，
 * 轮数用完就带着重叠返回。逐个定位则每个矩形只单向下移一次，必然终止。
 */
export declare function resolveGridCollisions(items: PlacedRect[], movedId: string): PlacedRect[];
/**
 * 向上压实：把每个矩形尽量上移，填掉中间的空行。
 *
 * 这是**显式操作**（编辑器上的「紧凑排列」按钮），不在拖拽里自动触发——
 * 自动压实会改掉用户放的 y，和「精准定位」互相打架。
 */
export declare function compactGrid(items: PlacedRect[]): PlacedRect[];
/** 一组矩形占了多少行（画布至少要这么高） */
export declare function gridHeight(items: PlacedRect[]): number;
/**
 * 一格的宽度（px）。
 *
 * 栅格是「cols 格 + (cols-1) 条 gap」平分容器宽，所以单格宽要先扣掉全部间距。
 * 用容器宽直接除以 cols 是常见错误，列数越多误差越大，右边缘会飘出去。
 */
export declare function colWidth(containerWidth: number, cols: number, gap: number): number;
/** 栅格坐标 → 像素矩形（供编辑器画选中框、手柄用） */
export declare function gridToPixel(geo: Geometry, containerWidth: number, canvas: Required<CanvasConfig>): {
    left: number;
    top: number;
    width: number;
    height: number;
};
/**
 * 像素矩形 → 栅格坐标，gridToPixel 的逆运算。
 *
 * 宽度那一步别写成 `w / (cw + gap)`：n 格的宽是 `n*cw + (n-1)*gap`，
 * 少算了一条间距，格子一多就会少一格。补上一个 gap 再除才对得上。
 */
export declare function pixelToGrid(rect: {
    x: number;
    y: number;
    w: number;
    h: number;
}, containerWidth: number, canvas: Required<CanvasConfig>): Geometry;
/** 像素位移 → 栅格步数（四舍五入到最近一格） */
export declare function pixelToGridDelta(dx: number, dy: number, containerWidth: number, canvas: Required<CanvasConfig>): {
    dx: number;
    dy: number;
};
/** 一条对齐参考线。编辑器据此画出那根虚线 */
export interface SnapGuide {
    axis: 'x' | 'y';
    /** 参考线在画布上的坐标（px） */
    position: number;
    /** 触发这条线的来源，用于调试与高亮 */
    source: 'canvas' | 'node';
}
/**
 * 绝对定位下的吸附。
 *
 * 拿被拖动矩形的三个锚点（起边 / 中线 / 终边）去比其他矩形与画布的同类锚点，
 * 差值小于阈值就贴上去，并返回那条参考线让编辑器画出来。
 *
 * 只吸附位置不吸附尺寸：拖动时改 x/y，缩放时另有 snapResize 处理，
 * 混在一起会出现「一拖就变形」的怪手感。
 */
export declare function snapPosition(moving: PlacedRect, others: PlacedRect[], canvas: Required<CanvasConfig>, threshold?: number): {
    x: number;
    y: number;
    guides: SnapGuide[];
};
/**
 * 缩放时的吸附：只动被拖的那条边，另一条边钉住不许跑。
 *
 * 从左/上边缩放时 x/y 要跟着变，且 minW/maxW 夹取之后必须回头修正 x——
 * 否则拖到最小宽度以后继续往右拖，左边界会越过右边界，矩形整个翻过来。
 */
export declare function snapResize(rect: PlacedRect, handle: ResizeHandle, others: PlacedRect[], canvas: Required<CanvasConfig>, threshold?: number): Geometry;
/** 八个缩放手柄的方位 */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** 手柄顺时针排列，编辑器按这个顺序渲染 */
export declare const RESIZE_HANDLES: ResizeHandle[];
/**
 * 按手柄方位把像素位移换算成新的矩形（未吸附、未夹取）。
 * 与 snapResize 分开是为了让「无吸附」场景（按住 Alt）走同一条计算路径。
 */
export declare function applyResizeDelta(rect: Geometry, handle: ResizeHandle, dx: number, dy: number): Geometry;
//# sourceMappingURL=geometry.d.ts.map