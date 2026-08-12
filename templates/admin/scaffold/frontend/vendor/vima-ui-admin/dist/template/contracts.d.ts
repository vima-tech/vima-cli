import type { Component } from 'vue';
import type { ComponentType } from './types';
import type { TemplateComponentContract } from './validate';
/**
 * Template DSL 类型到公开组件名的唯一映射。
 * `$intrinsic` 表示由渲染器直接使用原生容器承载，不需要注册 Vue 组件。
 */
export declare const TEMPLATE_COMPONENT_NAMES: {
    readonly alert: "VAlert";
    readonly badge: "VBadge";
    readonly button: "VButton";
    readonly 'button-group': "VButtonGroup";
    readonly card: "VCard";
    readonly checkbox: "VCheckbox";
    readonly 'checkbox-group': "VCheckboxGroup";
    readonly col: "VCol";
    readonly container: "VContainer";
    readonly custom: "$intrinsic";
    readonly datepicker: "VDatePicker";
    readonly descriptions: "VDescriptions";
    readonly 'descriptions-item': "VDescriptionsItem";
    readonly divider: "VDivider";
    readonly drawer: "VDrawer";
    readonly dropdown: "VDropdown";
    readonly empty: "VEmpty";
    readonly form: "VForm";
    readonly 'form-item': "VFormItem";
    readonly icon: "VIcon";
    readonly input: "VInput";
    readonly 'input-number': "VInputNumber";
    readonly link: "VLink";
    readonly loading: "VLoading";
    readonly message: "VAlert";
    readonly modal: "VLayer";
    readonly pagination: "VPagination";
    readonly popover: "VPopover";
    readonly progress: "VProgress";
    readonly radio: "VRadio";
    readonly 'radio-group': "VRadioGroup";
    readonly row: "VRow";
    readonly select: "VSelect";
    readonly statistic: "VStatistic";
    readonly switch: "VSwitch";
    readonly table: "VTable";
    readonly tag: "VTag";
    readonly 'tag-input': "VTagInput";
    readonly text: "$intrinsic";
    readonly textarea: "VTextarea";
    readonly timepicker: "VTimePicker";
    readonly tooltip: "VTooltip";
    readonly tree: "VTree";
    readonly upload: "VUpload";
};
export declare const TEMPLATE_COMPONENT_TYPES: readonly ComponentType[];
/** 返回由已注册 Vue 组件定义派生的当前契约。 */
export declare function getTemplateComponentContracts(): Partial<Record<string, TemplateComponentContract>>;
/** 将公开组件名表转换为渲染器使用的 DSL 注册表。 */
export declare function createTemplateComponentMap(implementations: Record<string, Component>): Record<string, Component>;
//# sourceMappingURL=contracts.d.ts.map