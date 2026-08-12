/**
 * @vima-tech/ui-admin · 可视化模板编辑器
 *
 * 创建日期: 2026-08-11
 *
 * 用 h() 手写而不是 .vue 单文件：scripts/build-lib.mjs 走的是 Vite lib 模式且没挂
 * @vitejs/plugin-vue，SFC 根本不会被编译。全库其余组件也是这个写法。
 *
 * 两条决定了整体结构的设计：
 *
 * 1. **画布用真渲染器，交互层浮在上面。**
 *    画布里那一份是 TemplateRenderer 的真实产物，所见即所得，不存在
 *    「编辑器里长这样、跑起来长那样」的偏差。交互（选中框、手柄、命中区）
 *    是一层 pointer-events:none 的浮层，只有每个节点的命中框是可点的。
 *    副作用正好是设计态想要的：点输入框是选中它，而不是真的去输入。
 *
 * 2. **浮层的坐标由几何算，不靠量 DOM。**
 *    只测一次容器宽度，其余全走 geometry.ts 的纯函数换算。
 *    逐节点 getBoundingClientRect 要处理布局时序、滚动、缩放，
 *    而且每帧都测会掉帧；算出来的坐标则是确定的，也已经被单测钉住。
 */
import { type PropType, type VNode } from 'vue';
import type { Template } from './types';
/** 可视化编辑并预览 Template DSL。 @category template @event save :: Template :: 保存当前模板 @event select :: string[] :: 选中节点 ID 集合 */
export declare const VTemplateEditor: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 被编辑的模板。编辑器内部持有副本，通过 update:modelValue 回吐 */
    modelValue: {
        type: PropType<Template>;
        required: true;
    };
    /** 只读模式：仍可浏览与选中，但不能改动 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 组件面板只显示这些分类名，不传则全部显示 */
    categories: {
        type: PropType<string[]>;
        default: undefined;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("select" | "save" | "update:modelValue")[], "select" | "save" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 被编辑的模板。编辑器内部持有副本，通过 update:modelValue 回吐 */
    modelValue: {
        type: PropType<Template>;
        required: true;
    };
    /** 只读模式：仍可浏览与选中，但不能改动 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 组件面板只显示这些分类名，不传则全部显示 */
    categories: {
        type: PropType<string[]>;
        default: undefined;
    };
}>> & Readonly<{
    onSelect?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onSave?: ((...args: any[]) => any) | undefined;
}>, {
    readonly: boolean;
    categories: string[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export default VTemplateEditor;
//# sourceMappingURL=VTemplateEditor.d.ts.map