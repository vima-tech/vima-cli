/**
 * @vima-tech/ui-admin · 模板渲染器
 *
 * 将模板JSON渲染为Vue组件
 */
import { type PropType, type VNode, type Component } from 'vue';
import type { Template, RendererConfig } from './types';
/**
 * 注册组件
 */
export declare function registerComponent(name: string, component: Component): void;
/**
 * 批量注册组件
 */
export declare function registerComponents(components: Record<string, Component>): void;
/** 模板渲染器组件 */
export declare const TemplateRenderer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 模板定义 */
    template: {
        type: PropType<Template>;
        required: true;
    };
    /** 表单数据 */
    modelValue: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    /** 全局数据 */
    globalData: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    /** 渲染器配置 */
    config: {
        type: PropType<RendererConfig>;
        default: () => {};
    };
    /** 是否预览模式 */
    preview: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | null, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "reset" | "submit" | "update:modelValue" | "validate")[], "change" | "reset" | "submit" | "update:modelValue" | "validate", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 模板定义 */
    template: {
        type: PropType<Template>;
        required: true;
    };
    /** 表单数据 */
    modelValue: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    /** 全局数据 */
    globalData: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    /** 渲染器配置 */
    config: {
        type: PropType<RendererConfig>;
        default: () => {};
    };
    /** 是否预览模式 */
    preview: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    onReset?: ((...args: any[]) => any) | undefined;
    onSubmit?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onValidate?: ((...args: any[]) => any) | undefined;
}>, {
    modelValue: Record<string, any>;
    preview: boolean;
    globalData: Record<string, any>;
    config: RendererConfig;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 表单模板渲染器 */
export declare const FormTemplateRenderer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    template: {
        type: PropType<Template>;
        required: true;
    };
    modelValue: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("reset" | "submit" | "update:modelValue" | "validate")[], "reset" | "submit" | "update:modelValue" | "validate", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    template: {
        type: PropType<Template>;
        required: true;
    };
    modelValue: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onReset?: ((...args: any[]) => any) | undefined;
    onSubmit?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onValidate?: ((...args: any[]) => any) | undefined;
}>, {
    modelValue: Record<string, any>;
    readonly: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 卡片模板渲染器 */
export declare const CardTemplateRenderer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    template: {
        type: PropType<Template>;
        required: true;
    };
    data: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    template: {
        type: PropType<Template>;
        required: true;
    };
    data: {
        type: PropType<Record<string, any>>;
        default: () => {};
    };
}>> & Readonly<{}>, {
    data: Record<string, any>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export default TemplateRenderer;
//# sourceMappingURL=renderer.d.ts.map