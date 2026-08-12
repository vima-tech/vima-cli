import { type PropType } from 'vue';
/**
 * SVG 图标统一注册表。
 *
 * 图标只使用描边路径并继承 currentColor，组件和文档站不再各自维护字符/emoji。
 * 业务侧可通过 registerIcon 注册同一 24×24 坐标系的自定义图标。
 */
export type IconDefinition = readonly string[];
export declare function normalizeIconName(type: string): string;
export declare function registerIcon(name: string, definition: IconDefinition): void;
export declare function hasIcon(name: string): boolean;
export declare function getIconNames(): string[];
export declare function iconSvgMarkup(name: string, className?: string): string;
/** 从统一 SVG 注册表渲染图标。 @category icon @props type::兼容旧调用的图标名或别名;name::注册表中的规范图标名;color::图标颜色，默认继承 currentColor;size::图标尺寸;title::无障碍标题，提供后图标不再隐藏 */
export declare const VIcon: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    type: {
        type: StringConstructor;
        default: string;
    };
    name: {
        type: StringConstructor;
        default: string;
    };
    color: {
        type: StringConstructor;
        default: string;
    };
    size: {
        type: PropType<number | string>;
        default: string;
    };
    title: {
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
    name: {
        type: StringConstructor;
        default: string;
    };
    color: {
        type: StringConstructor;
        default: string;
    };
    size: {
        type: PropType<number | string>;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    name: string;
    type: string;
    color: string;
    size: string | number;
    title: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
//# sourceMappingURL=icons.d.ts.map