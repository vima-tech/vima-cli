import type { PropType } from 'vue';
type ColumnLike = Record<string, any>;
/** 配置表格列的显示、隐藏与顺序。 @category data @props label::触发按钮文案;disabled::是否禁止调整列 */
export declare const VColumnSetting: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 全量列定义，顺序即默认顺序 */
    source: {
        type: PropType<ColumnLike[]>;
        default: () => never[];
    };
    /** v-model：生效的列，直接喂给 VTable 的 columns */
    modelValue: {
        type: PropType<ColumnLike[]>;
        default: () => never[];
    };
    /** 记忆用的键，同一张表在不同页面要用不同的键。留空 = 不落盘 */
    storageKey: {
        type: StringConstructor;
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
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 全量列定义，顺序即默认顺序 */
    source: {
        type: PropType<ColumnLike[]>;
        default: () => never[];
    };
    /** v-model：生效的列，直接喂给 VTable 的 columns */
    modelValue: {
        type: PropType<ColumnLike[]>;
        default: () => never[];
    };
    /** 记忆用的键，同一张表在不同页面要用不同的键。留空 = 不落盘 */
    storageKey: {
        type: StringConstructor;
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
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    label: string;
    source: ColumnLike[];
    modelValue: ColumnLike[];
    storageKey: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export {};
//# sourceMappingURL=columnSetting.d.ts.map