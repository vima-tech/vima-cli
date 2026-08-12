import { type PropType } from 'vue';
/** 在模态浮层中承载需要用户处理的内容。 @category overlay @props modelValue::浮层是否可见;title::浮层标题;area::面板宽高;shadeClose::点击遮罩是否关闭;closeBtn::是否显示关闭按钮;loading::是否显示处理遮罩;type::兼容层类型 */
export declare const VLayer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: BooleanConstructor;
        default: boolean;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    area: {
        type: PropType<string | number | Array<string | number>>;
        default: string;
    };
    shadeClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeBtn: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: boolean;
    };
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | null, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("close" | "update:modelValue" | "open")[], "close" | "update:modelValue" | "open", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: BooleanConstructor;
        default: boolean;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    area: {
        type: PropType<string | number | Array<string | number>>;
        default: string;
    };
    shadeClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeBtn: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: boolean;
    };
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onOpen?: ((...args: any[]) => any) | undefined;
}>, {
    type: string | number;
    title: string;
    area: string | number | (string | number)[];
    loading: boolean;
    modelValue: boolean;
    shadeClose: boolean;
    closeBtn: string | number | boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/**
 * 与上游 ui-v3 已分歧：面板从「贴着触发器的 absolute」改成 teleport 到 body 的 fixed。
 * 重跑 scripts/extract-from-ui-v3.mjs 会把这段覆盖回去，理由见 src/floating.ts 的文件注释。
 * @category overlay
 * @props visible::受控的面板可见状态;placement::面板相对触发器的位置
 */
export declare const VDropdown: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    visible: {
        type: BooleanConstructor;
        default: undefined;
    };
    placement: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    visible: {
        type: BooleanConstructor;
        default: undefined;
    };
    placement: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    visible: boolean;
    placement: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 下拉操作中的菜单容器。 @category navigation @related VDropdown */
export declare const VDropdownMenu: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 下拉菜单中的单个操作项。 @category navigation @props disabled::是否禁用该菜单项 @related VDropdownMenu */
export declare const VDropdownMenuItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    disabled: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
type TooltipPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
/** 为目标内容展示简短文字提示。 @category overlay @props content::提示文字;placement::提示相对目标的位置;disabled::是否禁用提示;trigger::触发方式;showAfter::显示延迟毫秒数;hideAfter::隐藏延迟毫秒数;effect::深色或浅色主题;enterable::鼠标是否可进入提示层 */
export declare const VTooltip: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    content: {
        type: StringConstructor;
        default: string;
    };
    placement: {
        type: PropType<TooltipPlacement>;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    trigger: {
        type: PropType<"hover" | "click" | "focus">;
        default: string;
    };
    showAfter: {
        type: NumberConstructor;
        default: number;
    };
    hideAfter: {
        type: NumberConstructor;
        default: number;
    };
    effect: {
        type: PropType<"dark" | "light">;
        default: string;
    };
    enterable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    content: {
        type: StringConstructor;
        default: string;
    };
    placement: {
        type: PropType<TooltipPlacement>;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    trigger: {
        type: PropType<"hover" | "click" | "focus">;
        default: string;
    };
    showAfter: {
        type: NumberConstructor;
        default: number;
    };
    hideAfter: {
        type: NumberConstructor;
        default: number;
    };
    effect: {
        type: PropType<"dark" | "light">;
        default: string;
    };
    enterable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    disabled: boolean;
    content: string;
    placement: TooltipPlacement;
    trigger: "click" | "focus" | "hover";
    showAfter: number;
    hideAfter: number;
    effect: "dark" | "light";
    enterable: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在目标附近展示可交互的浮层内容。 @category overlay @props title::浮层标题;content::浮层正文;placement::浮层相对目标的位置;disabled::是否禁用;trigger::触发方式;width::浮层宽度;showAfter::显示延迟毫秒数;hideAfter::隐藏延迟毫秒数;enterable::鼠标是否可进入浮层;popperClass::浮层附加类名 */
export declare const VPopover: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    content: {
        type: StringConstructor;
        default: string;
    };
    placement: {
        type: PropType<TooltipPlacement>;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    trigger: {
        type: PropType<"hover" | "click" | "focus">;
        default: string;
    };
    width: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    showAfter: {
        type: NumberConstructor;
        default: number;
    };
    hideAfter: {
        type: NumberConstructor;
        default: number;
    };
    enterable: {
        type: BooleanConstructor;
        default: boolean;
    };
    popperClass: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("show" | "hide")[], "show" | "hide", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    content: {
        type: StringConstructor;
        default: string;
    };
    placement: {
        type: PropType<TooltipPlacement>;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    trigger: {
        type: PropType<"hover" | "click" | "focus">;
        default: string;
    };
    width: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    showAfter: {
        type: NumberConstructor;
        default: number;
    };
    hideAfter: {
        type: NumberConstructor;
        default: number;
    };
    enterable: {
        type: BooleanConstructor;
        default: boolean;
    };
    popperClass: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{
    onShow?: ((...args: any[]) => any) | undefined;
    onHide?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    title: string;
    width: string | number;
    content: string;
    placement: TooltipPlacement;
    trigger: "click" | "focus" | "hover";
    showAfter: number;
    hideAfter: number;
    enterable: boolean;
    popperClass: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 从视口边缘展开辅助任务面板。 @category overlay @props modelValue::抽屉是否可见;title::抽屉标题;direction::抽屉展开方向;size::抽屉宽度或高度;modal::是否显示遮罩;showClose::是否显示关闭按钮;closeOnClickModal::点击遮罩是否关闭;closeOnPressEscape::按 Escape 是否关闭;beforeClose::关闭前钩子;destroyOnClose::关闭后是否销毁内容;withHeader::是否渲染头部 */
export declare const VDrawer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: BooleanConstructor;
        default: boolean;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    direction: {
        type: PropType<"rtl" | "ltr" | "ttb" | "btt">;
        default: string;
    };
    size: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    modal: {
        type: BooleanConstructor;
        default: boolean;
    };
    showClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeOnClickModal: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeOnPressEscape: {
        type: BooleanConstructor;
        default: boolean;
    };
    beforeClose: {
        type: PropType<(done: () => void) => void>;
        default: undefined;
    };
    destroyOnClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    withHeader: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | null, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("close" | "update:modelValue" | "open" | "opened" | "closed")[], "close" | "update:modelValue" | "open" | "opened" | "closed", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: BooleanConstructor;
        default: boolean;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    direction: {
        type: PropType<"rtl" | "ltr" | "ttb" | "btt">;
        default: string;
    };
    size: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    modal: {
        type: BooleanConstructor;
        default: boolean;
    };
    showClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeOnClickModal: {
        type: BooleanConstructor;
        default: boolean;
    };
    closeOnPressEscape: {
        type: BooleanConstructor;
        default: boolean;
    };
    beforeClose: {
        type: PropType<(done: () => void) => void>;
        default: undefined;
    };
    destroyOnClose: {
        type: BooleanConstructor;
        default: boolean;
    };
    withHeader: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onOpen?: ((...args: any[]) => any) | undefined;
    onOpened?: ((...args: any[]) => any) | undefined;
    onClosed?: ((...args: any[]) => any) | undefined;
}>, {
    size: string | number;
    title: string;
    direction: "rtl" | "ltr" | "ttb" | "btt";
    modelValue: boolean;
    modal: boolean;
    showClose: boolean;
    closeOnClickModal: boolean;
    closeOnPressEscape: boolean;
    beforeClose: (done: () => void) => void;
    destroyOnClose: boolean;
    withHeader: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export {};
//# sourceMappingURL=overlay.d.ts.map