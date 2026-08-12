import { type VNode, type PropType } from 'vue';
/** 管理表单模型、规则和字段校验。 @category form @props model::表单响应式数据模型;rules::按字段名组织的校验规则;required::是否将全部绑定字段标记为必填;pane::是否使用带分隔边框的面板样式;labelWidth::水平布局标签宽度;layout::表单字段排列方式 */
export declare const VForm: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    model: {
        type: PropType<Record<string, unknown>>;
        default: () => {};
    };
    rules: {
        type: PropType<Record<string, Array<Record<string, unknown>>>>;
        default: () => {};
    };
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    pane: {
        type: BooleanConstructor;
        default: boolean;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    layout: {
        type: PropType<"horizontal" | "vertical" | "inline">;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    model: {
        type: PropType<Record<string, unknown>>;
        default: () => {};
    };
    rules: {
        type: PropType<Record<string, Array<Record<string, unknown>>>>;
        default: () => {};
    };
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    pane: {
        type: BooleanConstructor;
        default: boolean;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    layout: {
        type: PropType<"horizontal" | "vertical" | "inline">;
        default: string;
    };
}>> & Readonly<{}>, {
    layout: "horizontal" | "vertical" | "inline";
    model: Record<string, unknown>;
    rules: Record<string, Record<string, unknown>[]>;
    required: boolean;
    pane: boolean;
    labelWidth: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 组合字段标签、控件和校验反馈。 @category form @props label::展示在控件旁的字段名称;labelWidth::覆盖当前字段的标签宽度;prop::字段在表单模型中的键;required::是否显式要求当前字段必填;mode::字段展示模式 */
export declare const VFormItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    label: {
        type: StringConstructor;
        default: string;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
    prop: {
        type: StringConstructor;
        default: string;
    };
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    mode: {
        type: StringConstructor;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    label: {
        type: StringConstructor;
        default: string;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
    prop: {
        type: StringConstructor;
        default: string;
    };
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    mode: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    mode: string;
    label: string;
    required: boolean;
    labelWidth: string | number;
    prop: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入单行文本。 @category form */
export declare const VInput: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前输入值。 */
    modelValue: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: string;
    };
    /** 原生输入类型。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 无值时显示的输入提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止输入和交互。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否仅允许读取。 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 前缀图标 */
    prefixIcon: {
        type: StringConstructor;
        default: string;
    };
    /** 后缀图标 */
    suffixIcon: {
        type: StringConstructor;
        default: string;
    };
    /** 前缀文字 */
    prefix: {
        type: StringConstructor;
        default: string;
    };
    /** 后缀文字 */
    suffix: {
        type: StringConstructor;
        default: string;
    };
    /** 是否可清空 */
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否显示密码切换（仅 type="password" 时有效） */
    showPassword: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 多行输入模式下的可见行数。 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("input" | "blur" | "change" | "focus" | "clear" | "update:modelValue")[], "input" | "blur" | "change" | "focus" | "clear" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前输入值。 */
    modelValue: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: string;
    };
    /** 原生输入类型。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 无值时显示的输入提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止输入和交互。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否仅允许读取。 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 前缀图标 */
    prefixIcon: {
        type: StringConstructor;
        default: string;
    };
    /** 后缀图标 */
    suffixIcon: {
        type: StringConstructor;
        default: string;
    };
    /** 前缀文字 */
    prefix: {
        type: StringConstructor;
        default: string;
    };
    /** 后缀文字 */
    suffix: {
        type: StringConstructor;
        default: string;
    };
    /** 是否可清空 */
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否显示密码切换（仅 type="password" 时有效） */
    showPassword: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 多行输入模式下的可见行数。 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: undefined;
    };
}>> & Readonly<{
    onInput?: ((...args: any[]) => any) | undefined;
    onBlur?: ((...args: any[]) => any) | undefined;
    onChange?: ((...args: any[]) => any) | undefined;
    onFocus?: ((...args: any[]) => any) | undefined;
    onClear?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    type: string;
    required: boolean;
    modelValue: string | number | boolean;
    placeholder: string;
    readonly: boolean;
    prefixIcon: string;
    suffixIcon: string;
    prefix: string;
    suffix: string;
    clearable: boolean;
    showPassword: boolean;
    rows: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入多行文本。 @category form */
export declare const VTextarea: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前多行文本值。 */
    modelValue: {
        type: StringConstructor;
        default: string;
    };
    /** 无值时显示的输入提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止输入。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否仅允许读取。 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 默认可见行数。 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 是否根据内容自动调整高度。 */
    autosize: {
        type: (ObjectConstructor | BooleanConstructor)[];
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前多行文本值。 */
    modelValue: {
        type: StringConstructor;
        default: string;
    };
    /** 无值时显示的输入提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止输入。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否仅允许读取。 */
    readonly: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 默认可见行数。 */
    rows: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    /** 是否根据内容自动调整高度。 */
    autosize: {
        type: (ObjectConstructor | BooleanConstructor)[];
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    modelValue: string;
    placeholder: string;
    readonly: boolean;
    rows: string | number;
    autosize: boolean | Record<string, any>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入带范围约束的数值。 @category form */
export declare const VInputNumber: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前数值。 */
    modelValue: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 允许输入的最小值。 */
    min: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 允许输入的最大值。 */
    max: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 是否禁止输入和步进操作。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前数值。 */
    modelValue: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 允许输入的最小值。 */
    min: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 允许输入的最大值。 */
    max: {
        type: NumberConstructor;
        default: undefined;
    };
    /** 是否禁止输入和步进操作。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    max: number;
    modelValue: number;
    min: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 从有限选项中选择单值或多值。 @category form @useWhen 选项集合已知 @avoidWhen 自由文本输入 @related VFormItem,VRadio,VCheckbox @event update:modelValue :: string | number | Array<string | number> | null :: 更新后的选择值 @event change :: string | number | Array<string | number> | null :: 选择变更 */
export declare const VSelect: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前选中值；多选模式使用数组。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 未选择时显示的提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止选择。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许选择多个值。 */
    multiple: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否提供清空入口。 */
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否强制显示选项检索框。 */
    showSearch: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 选项检索框的提示。 */
    searchPlaceholder: {
        type: StringConstructor;
        default: string;
    };
    /** 下拉面板最小宽度。 */
    dropdownMinWidth: {
        type: NumberConstructor;
        default: number;
    };
    /** 下拉面板最大宽度。 */
    dropdownMaxWidth: {
        type: NumberConstructor;
        default: number;
    };
    /** 是否将下拉面板右边缘与父元素对齐。 */
    dropdownAlignToParent: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 下拉宽度是否自动适应内容 */
    autoWidth: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 兼容旧接口的选项集合。 */
    items: {
        type: PropType<Array<Record<string, unknown>>>;
        default: () => never[];
    };
    /** 结构化选项集合。 */
    options: {
        type: PropType<Array<Record<string, unknown>>>;
        default: () => never[];
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前选中值；多选模式使用数组。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 未选择时显示的提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止选择。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许选择多个值。 */
    multiple: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否提供清空入口。 */
    clearable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否强制显示选项检索框。 */
    showSearch: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 选项检索框的提示。 */
    searchPlaceholder: {
        type: StringConstructor;
        default: string;
    };
    /** 下拉面板最小宽度。 */
    dropdownMinWidth: {
        type: NumberConstructor;
        default: number;
    };
    /** 下拉面板最大宽度。 */
    dropdownMaxWidth: {
        type: NumberConstructor;
        default: number;
    };
    /** 是否将下拉面板右边缘与父元素对齐。 */
    dropdownAlignToParent: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 下拉宽度是否自动适应内容 */
    autoWidth: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 兼容旧接口的选项集合。 */
    items: {
        type: PropType<Array<Record<string, unknown>>>;
        default: () => never[];
    };
    /** 结构化选项集合。 */
    options: {
        type: PropType<Array<Record<string, unknown>>>;
        default: () => never[];
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    multiple: boolean;
    required: boolean;
    modelValue: any;
    placeholder: string;
    clearable: boolean;
    showSearch: boolean;
    searchPlaceholder: string;
    dropdownMinWidth: number;
    dropdownMaxWidth: number;
    dropdownAlignToParent: boolean;
    autoWidth: boolean;
    items: Record<string, unknown>[];
    options: Record<string, unknown>[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 声明 VSelect 的插槽式选项。 @category form @props value::选项提交值;label::选项显示文字;disabled::是否禁用该选项 @related VSelect */
export declare const VSelectOption: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    value: {
        type: null;
        default: string;
    };
    label: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    value: {
        type: null;
        default: string;
    };
    label: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    disabled: boolean;
    label: string | number;
    value: any;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入单个日期、时间或日期范围。 @category form @event update:modelValue :: string | string[] :: 更新后的日期值 @event change :: string | string[] :: 日期变更 */
export declare const VDatePicker: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前日期、时间或范围值。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 日期选择精度。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 未选择时显示的提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止选择。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否选择起止范围。 */
    range: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许清空当前值。 */
    allowClear: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 可选择的最小日期。 */
    min: {
        type: StringConstructor;
        default: string;
    };
    /** 可选择的最大日期。 */
    max: {
        type: StringConstructor;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前日期、时间或范围值。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 日期选择精度。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 未选择时显示的提示。 */
    placeholder: {
        type: StringConstructor;
        default: string;
    };
    /** 是否禁止选择。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否向表单语义声明必填。 */
    required: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否选择起止范围。 */
    range: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许清空当前值。 */
    allowClear: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 可选择的最小日期。 */
    min: {
        type: StringConstructor;
        default: string;
    };
    /** 可选择的最大日期。 */
    max: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    type: string;
    max: string;
    required: boolean;
    modelValue: any;
    placeholder: string;
    min: string;
    range: boolean;
    allowClear: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在两个互斥状态之间切换。 @category form */
export declare const VSwitch: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前开关值。 */
    modelValue: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: boolean;
    };
    /** 是否禁止切换。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前开关值。 */
    modelValue: {
        type: (BooleanConstructor | StringConstructor | NumberConstructor)[];
        default: boolean;
    };
    /** 是否禁止切换。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    modelValue: string | number | boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 管理一组互斥单选项的值。 @category form @event update:modelValue :: string | number | boolean :: 更新后的单选值 @event change :: string | number | boolean :: 单选变更 */
export declare const VRadioGroup: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前选中值。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 是否禁止组内所有选项。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 无需插槽时使用的结构化选项。 */
    options: {
        type: PropType<Array<{
            label: string;
            value: unknown;
            disabled?: boolean;
        }>>;
        default: () => never[];
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前选中值。 */
    modelValue: {
        type: null;
        default: string;
    };
    /** 是否禁止组内所有选项。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 无需插槽时使用的结构化选项。 */
    options: {
        type: PropType<Array<{
            label: string;
            value: unknown;
            disabled?: boolean;
        }>>;
        default: () => never[];
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    modelValue: any;
    options: {
        label: string;
        value: unknown;
        disabled?: boolean;
    }[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在有限选项中选择一个值。 @category form */
export declare const VRadio: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前单选项代表的值。 */
    value: {
        type: null;
        default: string;
    };
    /** 是否禁止选择当前项。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前单选项代表的值。 */
    value: {
        type: null;
        default: string;
    };
    /** 是否禁止选择当前项。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    disabled: boolean;
    value: any;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示状态、分类或可移除关键词。 @category data */
export declare const VTag: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 标签的语义色类型。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 是否展示移除按钮。 */
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止移除操作。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "close"[], "close", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 标签的语义色类型。 */
    type: {
        type: StringConstructor;
        default: string;
    };
    /** 是否展示移除按钮。 */
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止移除操作。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    type: string;
    closable: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 输入和维护一组标签值。 @category form */
export declare const VTagInput: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 当前标签值集合。 */
    modelValue: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    /** 是否允许清空全部标签。 */
    allowClear: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止新增标签但允许查看现有值。 */
    disabledInput: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止全部交互。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 当前标签值集合。 */
    modelValue: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    /** 是否允许清空全部标签。 */
    allowClear: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止新增标签但允许查看现有值。 */
    disabledInput: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否禁止全部交互。 */
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    modelValue: unknown[];
    allowClear: boolean;
    disabledInput: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
//# sourceMappingURL=form.d.ts.map