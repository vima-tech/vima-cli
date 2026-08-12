/**
 * @vima-tech/ui-admin · 模板编辑器状态机
 *
 * 创建日期: 2026-08-11
 *
 * types.ts 里的 EditorState 从一开始就声明了 history / 多选 / 拖拽状态，
 * 但一直没有任何实现——编辑器只能一步一步改，点错了没法回退。这里把它补上。
 *
 * 三个设计选择，都是为了「连续作业」这个目标：
 *
 * 1. 历史用**整树快照**而不是操作日志。模板通常几十个节点，一份快照几 KB，
 *    换来的是撤销永远不会「回放错」——操作日志的反向操作一旦有一处写反，
 *    就会在某个特定顺序下把树改坏，而且极难复现。
 *
 * 2. 拖拽必须能**合并成一次历史**。一次拖动会触发几十次几何更新，
 *    每次都记一笔的话，用户按一次撤销只退回一帧，等于撤销失效。
 *    办法是 transaction()：进事务后所有改动共用一个快照点。
 *
 * 3. 在非 lg 断点下编辑时，几何写进 layout.breakpoints[bp] 而不是基准值。
 *    否则「调窄屏布局」会把宽屏布局一起改掉，这是响应式编辑最容易踩的坑。
 */
import { type ComputedRef, type Ref } from 'vue';
import { type PlacedRect } from './geometry';
import type { BreakpointKey, ComponentProps, Geometry, LayoutMode, Template, TemplateNode } from './types';
/** 编辑器构造选项 */
export interface TemplateEditorOptions {
    /** 历史栈上限，默认 100 步。超出后丢最旧的 */
    historyLimit?: number;
}
/** 一次几何更新的选项 */
export interface GeometryUpdateOptions {
    /** 是否消解碰撞（grid 模式默认 true；拖拽预览时可关掉省算力） */
    resolveCollision?: boolean;
}
/**
 * 编辑器实例。所有会改模板的方法都自动记历史，
 * 除非包在 transaction() 里（那时整段合并成一步）。
 */
export interface TemplateEditor {
    template: Ref<Template>;
    /** 选中的节点 id，支持多选 */
    selection: Ref<string[]>;
    /** 当前正在编辑的断点。非 lg 时几何写进断点覆盖 */
    breakpoint: Ref<BreakpointKey>;
    canUndo: ComputedRef<boolean>;
    canRedo: ComputedRef<boolean>;
    /** 当前根容器的摆放模式 */
    layoutMode: ComputedRef<LayoutMode>;
    /** 剪贴板里有没有东西 */
    hasClipboard: ComputedRef<boolean>;
    select(id: string | null, options?: {
        additive?: boolean;
    }): void;
    selectAll(): void;
    clearSelection(): void;
    isSelected(id: string): boolean;
    addNode(node: TemplateNode, parentId?: string): void;
    removeNode(id: string): void;
    removeSelected(): void;
    updateNode(id: string, patch: Partial<TemplateNode>): void;
    updateProps(id: string, props: ComponentProps): void;
    updateGeometry(id: string, patch: Partial<Geometry>, options?: GeometryUpdateOptions): void;
    nudgeSelected(dx: number, dy: number): void;
    copy(): void;
    cut(): void;
    paste(): void;
    duplicate(): void;
    undo(): void;
    redo(): void;
    transaction(run: () => void): void;
    /**
     * 开始一个跨事件的批次（一次拖拽 / 一次 resize）。
     * transaction() 是同步的，包不住「按下—移动—抬起」这种跨越多个事件回调的过程，
     * 所以另给一对显式边界。必须与 endBatch 成对调用。
     */
    beginBatch(): void;
    endBatch(): void;
    compact(): void;
    setLayoutMode(mode: LayoutMode): void;
    /** 兄弟节点的矩形列表，编辑器画选中框、算碰撞都要用 */
    siblingRects(id: string): PlacedRect[];
}
export declare function createTemplateEditor(initial: Template, options?: TemplateEditorOptions): TemplateEditor;
//# sourceMappingURL=editor-state.d.ts.map