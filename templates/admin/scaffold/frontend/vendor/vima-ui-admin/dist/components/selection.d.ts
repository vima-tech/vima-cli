/**
 * @vima-tech/ui-admin · 补充型表单与操作组件
 *
 * 这些组件是模板 DSL 已声明、但原始提取层没有实现的基础能力。
 * 独立成手写文件，避免 npm run extract 覆盖。
 */
import { type PropType } from 'vue';
type CheckboxValue = string | number | boolean;
interface CheckboxOption {
    label: string;
    value: CheckboxValue;
    disabled?: boolean;
}
/** 管理一组多选项的值。 @category form @props modelValue::当前选中的值数组;disabled::是否禁用整组;options::可选项列表 */
export declare const VCheckboxGroup: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: PropType<CheckboxValue[]>;
        default: () => never[];
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    options: {
        type: PropType<CheckboxOption[]>;
        default: () => never[];
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: PropType<CheckboxValue[]>;
        default: () => never[];
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    options: {
        type: PropType<CheckboxOption[]>;
        default: () => never[];
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    modelValue: CheckboxValue[];
    options: CheckboxOption[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在有限选项中切换单个多选状态。 @category form @props modelValue::独立使用时的当前值;value::在复选框组中的选项值;label::选项显示文字;disabled::是否禁用;indeterminate::是否显示半选态;trueValue::选中时写入的值;falseValue::未选中时写入的值 @event update:modelValue :: PropValue :: 更新后的独立复选值 @event change :: PropValue :: 值变更 */
export declare const VCheckbox: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: boolean;
    };
    value: {
        type: PropType<CheckboxValue>;
        default: string;
    };
    label: {
        type: StringConstructor;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    indeterminate: {
        type: BooleanConstructor;
        default: boolean;
    };
    trueValue: {
        type: null;
        default: boolean;
    };
    falseValue: {
        type: null;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: boolean;
    };
    value: {
        type: PropType<CheckboxValue>;
        default: string;
    };
    label: {
        type: StringConstructor;
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    indeterminate: {
        type: BooleanConstructor;
        default: boolean;
    };
    trueValue: {
        type: null;
        default: boolean;
    };
    falseValue: {
        type: null;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    label: string;
    value: CheckboxValue;
    modelValue: any;
    indeterminate: boolean;
    trueValue: any;
    falseValue: any;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入或选择一天中的时间。 @category form @props modelValue::HH:mm 格式的当前时间;min::允许选择的最早时间;max::允许选择的最晚时间;step::分钟步长;disabled::是否禁用;readonly::是否只读;clearable::是否允许清空 */
export declare const VTimePicker: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: StringConstructor;
        default: string;
    };
    min: {
        type: StringConstructor;
        default: string;
    };
    max: {
        type: StringConstructor;
        default: string;
    };
    step: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("blur" | "change" | "focus" | "clear" | "update:modelValue")[], "blur" | "change" | "focus" | "clear" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: StringConstructor;
        default: string;
    };
    min: {
        type: StringConstructor;
        default: string;
    };
    max: {
        type: StringConstructor;
        default: string;
    };
    step: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onBlur?: ((...args: any[]) => any) | undefined;
    onChange?: ((...args: any[]) => any) | undefined;
    onFocus?: ((...args: any[]) => any) | undefined;
    onClear?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    max: string;
    modelValue: string;
    readonly: boolean;
    clearable: boolean;
    min: string;
    step: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 页面导航或低强调文字操作。 @category navigation @props href::目标地址;target::链接打开方式;type::链接语义类型;underline::悬停时是否显示下划线;disabled::是否禁用;download::是否作为下载链接 */
export declare const VLink: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    href: {
        type: StringConstructor;
        default: string;
    };
    target: {
        type: PropType<"_self" | "_blank" | "_parent" | "_top">;
        default: string;
    };
    type: {
        type: StringConstructor;
        default: string;
    };
    underline: {
        type: BooleanConstructor;
        default: boolean;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    download: {
        type: (BooleanConstructor | StringConstructor)[];
        default: boolean;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "click"[], "click", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    href: {
        type: StringConstructor;
        default: string;
    };
    target: {
        type: PropType<"_self" | "_blank" | "_parent" | "_top">;
        default: string;
    };
    type: {
        type: StringConstructor;
        default: string;
    };
    underline: {
        type: BooleanConstructor;
        default: boolean;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    download: {
        type: (BooleanConstructor | StringConstructor)[];
        default: boolean;
    };
}>> & Readonly<{
    onClick?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    download: string | boolean;
    target: "_self" | "_blank" | "_parent" | "_top";
    type: string;
    href: string;
    underline: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export {};
//# sourceMappingURL=selection.d.ts.map