import { type PropType } from 'vue';
export { VIcon } from './icons';
/** 页面内容容器。 @category layout */
export declare const VContainer: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 24 栅格中的行容器。 @category layout @props gutter::列间距（像素）;justify::主轴对齐方式;align::交叉轴对齐方式 */
export declare const VRow: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    gutter: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    justify: {
        type: PropType<"start" | "center" | "end" | "space-between" | "space-around">;
        default: string;
    };
    align: {
        type: PropType<"top" | "middle" | "bottom">;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    gutter: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    justify: {
        type: PropType<"start" | "center" | "end" | "space-between" | "space-around">;
        default: string;
    };
    align: {
        type: PropType<"top" | "middle" | "bottom">;
        default: string;
    };
}>> & Readonly<{}>, {
    gutter: string | number;
    justify: "start" | "center" | "end" | "space-between" | "space-around";
    align: "top" | "bottom" | "middle";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 24 栅格中的列。 @category layout @props md::中等屏幕默认占用栅格数;span::占用的 24 栅格数;offset::左侧偏移栅格数 */
export declare const VCol: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    md: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    span: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
    offset: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    md: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    span: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
    offset: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>> & Readonly<{}>, {
    span: string | number;
    md: string | number;
    offset: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 承载后台页面信息区块的卡片。 @category layout @props title::卡片标题;shadow::阴影显示策略 */
export declare const VCard: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    shadow: {
        type: PropType<"always" | "hover" | "never">;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    shadow: {
        type: PropType<"always" | "hover" | "never">;
        default: string;
    };
}>> & Readonly<{}>, {
    title: string;
    shadow: "always" | "hover" | "never";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 触发操作或提交的按钮。 @category basic @props type::按钮语义与视觉类型;size::按钮尺寸;disabled::是否禁用;loading::是否显示加载态;nativeType::原生 button 类型;borderStyle::边框样式，none 为无边框 */
export declare const VButton: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    type: {
        type: StringConstructor;
        default: string;
    };
    size: {
        type: StringConstructor;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    nativeType: {
        type: PropType<"button" | "submit" | "reset">;
        default: string;
    };
    borderStyle: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    type: {
        type: StringConstructor;
        default: string;
    };
    size: {
        type: StringConstructor;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    nativeType: {
        type: PropType<"button" | "submit" | "reset">;
        default: string;
    };
    borderStyle: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    disabled: boolean;
    type: string;
    size: string;
    loading: boolean;
    nativeType: "button" | "reset" | "submit";
    borderStyle: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 将相关按钮组织成连续操作组。 @category basic */
export declare const VButtonGroup: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 分隔相邻内容区块。 @category layout @props content::分隔线文字;theme::分隔线颜色;direction::水平或垂直方向;contentPosition::文字对齐位置 */
export declare const VDivider: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    content: {
        type: StringConstructor;
        default: string;
    };
    theme: {
        type: StringConstructor;
        default: string;
    };
    direction: {
        type: PropType<"horizontal" | "vertical">;
        default: string;
    };
    contentPosition: {
        type: PropType<"left" | "center" | "right">;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    content: {
        type: StringConstructor;
        default: string;
    };
    theme: {
        type: StringConstructor;
        default: string;
    };
    direction: {
        type: PropType<"horizontal" | "vertical">;
        default: string;
    };
    contentPosition: {
        type: PropType<"left" | "center" | "right">;
        default: string;
    };
}>> & Readonly<{}>, {
    content: string;
    theme: string;
    direction: "horizontal" | "vertical";
    contentPosition: "left" | "right" | "center";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示任务或流程完成进度。 @category data @props percent::完成百分比，范围 0–100;status::进度状态样式 */
export declare const VProgress: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    percent: {
        type: NumberConstructor;
        default: number;
    };
    status: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    percent: {
        type: NumberConstructor;
        default: number;
    };
    status: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    percent: number;
    status: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 选择文件并交由业务逻辑上传。 @category form */
export declare const VUpload: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 业务上传端点；组件本身只负责文件选择。 */
    url: {
        type: StringConstructor;
        default: string;
    };
    /** 原生文件类型过滤表达式。 */
    accept: {
        type: StringConstructor;
        default: string;
    };
    /** accept 的历史拼写兼容属性。 */
    accpet: {
        type: StringConstructor;
        default: string;
    };
    /** 是否允许一次选择多个文件。 */
    multiple: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 文件选择后的业务处理函数。 */
    beforeUpload: {
        type: PropType<(files: FileList | File[]) => unknown>;
        default: undefined;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 业务上传端点；组件本身只负责文件选择。 */
    url: {
        type: StringConstructor;
        default: string;
    };
    /** 原生文件类型过滤表达式。 */
    accept: {
        type: StringConstructor;
        default: string;
    };
    /** accept 的历史拼写兼容属性。 */
    accpet: {
        type: StringConstructor;
        default: string;
    };
    /** 是否允许一次选择多个文件。 */
    multiple: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 文件选择后的业务处理函数。 */
    beforeUpload: {
        type: PropType<(files: FileList | File[]) => unknown>;
        default: undefined;
    };
}>> & Readonly<{}>, {
    url: string;
    accept: string;
    accpet: string;
    multiple: boolean;
    beforeUpload: (files: FileList | File[]) => unknown;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 为指定元素提供全屏切换能力。 @category utility */
export declare const VFullscreen: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>[] | undefined, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "fullscreenchange"[], "fullscreenchange", import("vue").PublicProps, Readonly<{}> & Readonly<{
    onFullscreenchange?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 后台系统页面骨架的根布局。 @category layout */
export declare const VLayout: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 后台布局的顶部区域。 @category layout */
export declare const VHeader: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 后台布局的主体区域。 @category layout */
export declare const VBody: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 后台布局的侧边区域。 @category layout */
export declare const VSide: import("vue").DefineComponent<{}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示用户或实体头像。 @category basic @props size::预设尺寸或像素值;shape::圆形或方形;src::头像图片地址;icon::无图片时的图标名;text::无图片时的文字;color::文字头像背景色;fit::图片 object-fit 方式 */
export declare const VAvatar: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    size: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    shape: {
        type: PropType<"circle" | "square">;
        default: string;
    };
    src: {
        type: StringConstructor;
        default: string;
    };
    icon: {
        type: StringConstructor;
        default: string;
    };
    text: {
        type: StringConstructor;
        default: string;
    };
    color: {
        type: StringConstructor;
        default: string;
    };
    fit: {
        type: PropType<"fill" | "contain" | "cover" | "none" | "scale-down">;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    size: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    shape: {
        type: PropType<"circle" | "square">;
        default: string;
    };
    src: {
        type: StringConstructor;
        default: string;
    };
    icon: {
        type: StringConstructor;
        default: string;
    };
    text: {
        type: StringConstructor;
        default: string;
    };
    color: {
        type: StringConstructor;
        default: string;
    };
    fit: {
        type: PropType<"fill" | "contain" | "cover" | "none" | "scale-down">;
        default: string;
    };
}>> & Readonly<{}>, {
    text: string;
    color: string;
    size: string | number;
    shape: "circle" | "square";
    src: string;
    icon: string;
    fit: "none" | "fill" | "contain" | "cover" | "scale-down";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 紧凑展示一组头像。 @category basic @props max::最多展示的头像数，0 表示不限 */
export declare const VAvatarGroup: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    max: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    max: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>> & Readonly<{}>, {
    max: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在内容旁展示数量或状态徽标。 @category data @props value::徽标数值或文字;max::数值上限，超出后显示加号;dot::是否仅显示圆点;type::徽标语义类型;showZero::值为零时是否显示;hidden::是否隐藏徽标 */
export declare const VBadge: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    value: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    max: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    dot: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: PropType<"primary" | "success" | "warning" | "danger" | "info">;
        default: string;
    };
    showZero: {
        type: BooleanConstructor;
        default: boolean;
    };
    hidden: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | null, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    value: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    max: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    dot: {
        type: BooleanConstructor;
        default: boolean;
    };
    type: {
        type: PropType<"primary" | "success" | "warning" | "danger" | "info">;
        default: string;
    };
    showZero: {
        type: BooleanConstructor;
        default: boolean;
    };
    hidden: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    type: "info" | "primary" | "success" | "warning" | "danger";
    value: string | number;
    max: string | number;
    dot: boolean;
    showZero: boolean;
    hidden: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示当前页面的层级导航路径。 @category navigation @props separator::层级分隔文字;separatorIcon::层级分隔 SVG 图标名 */
export declare const VBreadcrumb: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    separator: {
        type: StringConstructor;
        default: string;
    };
    separatorIcon: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    separator: {
        type: StringConstructor;
        default: string;
    };
    separatorIcon: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    separator: string;
    separatorIcon: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 面包屑导航中的单个层级。 @category navigation @props to::目标路由或地址;replace::导航时是否替换历史记录 */
export declare const VBreadcrumbItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    to: {
        type: (ObjectConstructor | StringConstructor)[];
        default: string;
    };
    replace: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    to: {
        type: (ObjectConstructor | StringConstructor)[];
        default: string;
    };
    replace: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    replace: boolean;
    to: string | Record<string, any>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
//# sourceMappingURL=basic.d.ts.map