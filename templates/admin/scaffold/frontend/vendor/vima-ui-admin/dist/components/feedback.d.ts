/**
 * @vima-tech/ui-admin · 反馈组件
 *
 * 创建日期: 2026-08-10
 *
 * 注意：本文件组件**手写**，不由 scripts/extract-from-ui-v3.mjs 生成——
 *    上游 ui-v3 没有这些组件，写进 components/basic.ts 那类生成文件会被下次 extract 冲掉。
 *    样式同理，写在 styles/components.css（手写）而不是 styles/ui.css（生成）。
 *
 * 组件分工：
 *   VLoading    —— 内容**已经在**、正在刷新/提交。半透明遮罩盖住原内容，用户还能看见上下文。
 *   VSkeleton   —— 内容**还没有**（首屏）。按形状铺灰块占位，避免白屏和数据到达时的整页跳动。
 *   VAlert      —— 页面内警告提示
 *   VEmpty      —— 空状态占位
 *   message     —— 全局消息提示（函数式调用）
 *   messageBox  —— 确认对话框（函数式调用）
 */
import { type PropType, type VNode } from 'vue';
/** 展示局部或全屏加载状态。 @category feedback @props loading::是否显示加载遮罩 */
export declare const VLoading: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 遮罩上的文案，留空则只有转圈 */
    text: {
        type: StringConstructor;
        default: string;
    };
    /** 铺满视口而不是包裹的内容区。此时组件本身不需要有默认插槽 */
    fullscreen: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 遮罩上的文案，留空则只有转圈 */
    text: {
        type: StringConstructor;
        default: string;
    };
    /** 铺满视口而不是包裹的内容区。此时组件本身不需要有默认插槽 */
    fullscreen: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    text: string;
    fullscreen: boolean;
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 骨架形状。写成字面量联合而不是 `typeof 数组[number]`，文档站的 API 抽取才能直接展开它 */
type SkeletonType = 'text' | 'table' | 'card';
/** 在内容加载前展示结构占位。 @category feedback @props loading::是否显示骨架而非真实内容;type::骨架的内容形态 */
export declare const VSkeleton: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: () => SkeletonType;
        default: string;
    };
    /** 正文行数 / 表格行数 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 表格骨架的列数 */
    columns: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 关掉扫光动画（长列表里几十个骨架同时扫光会很吵） */
    animated: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>[] | undefined, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: () => SkeletonType;
        default: string;
    };
    /** 正文行数 / 表格行数 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 表格骨架的列数 */
    columns: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 关掉扫光动画（长列表里几十个骨架同时扫光会很吵） */
    animated: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    columns: string | number;
    type: SkeletonType;
    loading: boolean;
    rows: string | number;
    animated: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示需要持续可见的状态或警告信息。 @category feedback @props type::提示语义类型;title::提示标题;description::补充说明;closable::是否允许关闭;showIcon::是否显示语义 SVG 图标;center::内容是否居中;closeText::自定义关闭文案 */
export declare const VAlert: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    type: {
        type: PropType<"info" | "success" | "warning" | "error">;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    description: {
        type: StringConstructor;
        default: string;
    };
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
    showIcon: {
        type: BooleanConstructor;
        default: boolean;
    };
    center: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeText: {
        type: StringConstructor;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | null, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "close"[], "close", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    type: {
        type: PropType<"info" | "success" | "warning" | "error">;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    description: {
        type: StringConstructor;
        default: string;
    };
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
    showIcon: {
        type: BooleanConstructor;
        default: boolean;
    };
    center: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeText: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
}>, {
    type: "info" | "error" | "success" | "warning";
    title: string;
    center: boolean;
    closable: boolean;
    showIcon: boolean;
    description: string;
    closeText: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在集合或页面无数据时展示空状态。 @category feedback @props description::空状态说明;image::自定义图片地址;imageSize::图片尺寸 */
export declare const VEmpty: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    description: {
        type: StringConstructor;
        default: string;
    };
    image: {
        type: StringConstructor;
        default: string;
    };
    imageSize: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    description: {
        type: StringConstructor;
        default: string;
    };
    image: {
        type: StringConstructor;
        default: string;
    };
    imageSize: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>> & Readonly<{}>, {
    image: string;
    description: string;
    imageSize: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
type MessageType = 'info' | 'success' | 'warning' | 'error';
interface MessageOptions {
    type?: MessageType;
    content: string;
    duration?: number;
    closable?: boolean;
    icon?: string;
    onClose?: () => void;
}
export declare function showMessage(options: MessageOptions | string): {
    close: () => void;
};
export declare const message: {
    info: (content: string, duration?: number) => {
        close: () => void;
    };
    success: (content: string, duration?: number) => {
        close: () => void;
    };
    warning: (content: string, duration?: number) => {
        close: () => void;
    };
    error: (content: string, duration?: number) => {
        close: () => void;
    };
    open: (options: MessageOptions) => {
        close: () => void;
    };
    closeAll: () => void;
};
type MessageBoxAction = 'confirm' | 'cancel' | 'close';
interface MessageBoxOptions {
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error' | '';
    showCancelButton?: boolean;
    showConfirmButton?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
    confirmButtonClass?: string;
    cancelButtonClass?: string;
    closeOnClickModal?: boolean;
    closeOnPressEscape?: boolean;
    beforeClose?: (action: MessageBoxAction, instance: MessageBoxInstance, done: () => void) => void;
}
interface MessageBoxInstance {
    el: HTMLElement;
    close: (action?: MessageBoxAction) => void;
}
export declare function showMessageBox(options: MessageBoxOptions | string): Promise<MessageBoxAction>;
export declare const messageBox: {
    alert: (message: string, title?: string, options?: Partial<MessageBoxOptions>) => Promise<MessageBoxAction>;
    confirm: (message: string, title?: string, options?: Partial<MessageBoxOptions>) => Promise<MessageBoxAction>;
    prompt: (message: string, title?: string, options?: Partial<MessageBoxOptions>) => Promise<MessageBoxAction>;
};
export {};
//# sourceMappingURL=feedback.d.ts.map