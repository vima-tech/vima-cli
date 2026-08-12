import { type PropType, type VNode } from 'vue';
type RowData = Record<string, any>;
type TableColumn = Record<string, any>;
/** 展示、选择、排序和分页处理结构化数据。 @category data @event update:selectedKeys :: unknown[] :: 更新后的选中行键 @event change :: Record<string, unknown> :: 表格分页或查询状态变更 @event sortChange :: [string, 'asc' | 'desc' | ''] :: 排序字段和方向 @event columnOrderChange :: [TableColumn[], { fromIndex: number; toIndex: number }] :: 列顺序变更 */
export declare const VTable: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    /** 表格列定义。 */
    columns: {
        type: PropType<TableColumn[]>;
        default: () => never[];
    };
    /** 当前展示的数据行。 */
    dataSource: {
        type: PropType<RowData[]>;
        default: () => never[];
    };
    /** 分页配置；false 表示不展示内部分页。 */
    page: {
        type: PropType<Record<string, any> | false>;
        default: boolean;
    };
    /** 是否展示加载状态。 */
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 当前选中行的唯一键集合。 */
    selectedKeys: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    /** 是否展示行选择框。 */
    showCheckbox: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否展示默认工具栏。 */
    defaultToolbar: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 表格内容区高度。 */
    height: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    /** 行数据中的唯一键字段名。 */
    id: {
        type: StringConstructor;
        default: string;
    };
    /** 表格密度。 */
    size: {
        type: StringConstructor;
        default: string;
    };
    /** 行类名或行类名计算函数。 */
    rowClassName: {
        type: PropType<string | ((row: RowData, index: number) => string)>;
        default: string;
    };
    /** 树形数据的字段映射。 */
    treeProps: {
        type: PropType<Record<string, string>>;
        default: () => {};
    };
    /** 是否默认展开全部树节点。 */
    defaultExpandAll: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许拖动列边缘调整宽度。 */
    resize: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 启用表头列拖拽排序 */
    draggable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 全量数据，用于导出全部数据。如果提供此属性，导出时会使用此数据而非 dataSource */
    exportAllData: {
        type: PropType<RowData[]>;
        default: undefined;
    };
    /** 异步获取全量数据的函数，用于导出全部数据 */
    fetchAllData: {
        type: PropType<() => Promise<RowData[]>>;
        default: undefined;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:selectedKeys" | "sortChange" | "columnOrderChange")[], "change" | "update:selectedKeys" | "sortChange" | "columnOrderChange", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    /** 表格列定义。 */
    columns: {
        type: PropType<TableColumn[]>;
        default: () => never[];
    };
    /** 当前展示的数据行。 */
    dataSource: {
        type: PropType<RowData[]>;
        default: () => never[];
    };
    /** 分页配置；false 表示不展示内部分页。 */
    page: {
        type: PropType<Record<string, any> | false>;
        default: boolean;
    };
    /** 是否展示加载状态。 */
    loading: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 当前选中行的唯一键集合。 */
    selectedKeys: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    /** 是否展示行选择框。 */
    showCheckbox: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否展示默认工具栏。 */
    defaultToolbar: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 表格内容区高度。 */
    height: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
    /** 行数据中的唯一键字段名。 */
    id: {
        type: StringConstructor;
        default: string;
    };
    /** 表格密度。 */
    size: {
        type: StringConstructor;
        default: string;
    };
    /** 行类名或行类名计算函数。 */
    rowClassName: {
        type: PropType<string | ((row: RowData, index: number) => string)>;
        default: string;
    };
    /** 树形数据的字段映射。 */
    treeProps: {
        type: PropType<Record<string, string>>;
        default: () => {};
    };
    /** 是否默认展开全部树节点。 */
    defaultExpandAll: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 是否允许拖动列边缘调整宽度。 */
    resize: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 启用表头列拖拽排序 */
    draggable: {
        type: BooleanConstructor;
        default: boolean;
    };
    /** 全量数据，用于导出全部数据。如果提供此属性，导出时会使用此数据而非 dataSource */
    exportAllData: {
        type: PropType<RowData[]>;
        default: undefined;
    };
    /** 异步获取全量数据的函数，用于导出全部数据 */
    fetchAllData: {
        type: PropType<() => Promise<RowData[]>>;
        default: undefined;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:selectedKeys"?: ((...args: any[]) => any) | undefined;
    onSortChange?: ((...args: any[]) => any) | undefined;
    onColumnOrderChange?: ((...args: any[]) => any) | undefined;
}>, {
    columns: TableColumn[];
    size: string;
    resize: boolean;
    height: string | number;
    loading: boolean;
    id: string;
    dataSource: RowData[];
    page: false | Record<string, any>;
    selectedKeys: unknown[];
    showCheckbox: boolean;
    defaultToolbar: boolean;
    rowClassName: string | ((row: RowData, index: number) => string);
    treeProps: Record<string, string>;
    defaultExpandAll: boolean;
    draggable: boolean;
    exportAllData: RowData[];
    fetchAllData: () => Promise<RowData[]>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 按分组网格展示实体详情。 @category data @props title::详情区域标题;column::每行列数;border::是否显示边框;labelWidth::标签列宽度 */
export declare const VDescriptions: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    column: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    border: {
        type: BooleanConstructor;
        default: boolean;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    column: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    border: {
        type: BooleanConstructor;
        default: boolean;
    };
    labelWidth: {
        type: (StringConstructor | NumberConstructor)[];
        default: string;
    };
}>> & Readonly<{}>, {
    title: string;
    labelWidth: string | number;
    column: string | number;
    border: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 详情描述列表中的单个字段。 @category data @props label::字段标签;span::跨越的列数 @related VDescriptions */
export declare const VDescriptionsItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    label: {
        type: StringConstructor;
        default: string;
    };
    span: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    label: {
        type: StringConstructor;
        default: string;
    };
    span: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
}>> & Readonly<{}>, {
    label: string;
    span: string | number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示和选择层级数据。 @category data @props data::树节点数据;checkedKeys::当前勾选的节点键;selectedKey::当前选中的节点键;showCheckbox::是否显示复选框;showIcon::是否显示节点图标;draggable::是否允许拖拽节点;defaultExpandAll::是否默认展开全部节点;expandedKeys::受控的已展开节点键;replaceFields::自定义字段映射 @event update:checkedKeys :: unknown[] :: 更新后的勾选键 @event update:selectedKey :: PropertyKey | null :: 更新后的选中键 @event update:expandedKeys :: unknown[] :: 更新后的展开键 @event check :: [unknown[], Record<string, unknown>] :: 勾选状态变更 @event select :: RowData :: 节点选择 @event nodeClick :: [RowData, Record<string, unknown>, MouseEvent] :: 节点单击 @event nodeDblclick :: [RowData, Record<string, unknown>, MouseEvent] :: 节点双击 @event nodeContextmenu :: [RowData, Record<string, unknown>, MouseEvent] :: 节点上下文菜单 @event expand :: [boolean, RowData] :: 展开状态变更 @event dragstart :: [RowData, DragEvent] :: 开始拖拽 @event dragover :: [RowData, DragEvent] :: 拖拽经过节点 @event drop :: [RowData, RowData, string, DragEvent] :: 放置节点 @event dragend :: [RowData, DragEvent] :: 结束拖拽 */
export declare const VTree: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    data: {
        type: PropType<RowData[]>;
        default: () => never[];
    };
    checkedKeys: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    selectedKey: {
        type: null;
        default: string;
    };
    showCheckbox: {
        type: BooleanConstructor;
        default: boolean;
    };
    showIcon: {
        type: BooleanConstructor;
        default: boolean;
    };
    draggable: {
        type: BooleanConstructor;
        default: boolean;
    };
    defaultExpandAll: {
        type: BooleanConstructor;
        default: boolean;
    };
    expandedKeys: {
        type: PropType<unknown[]>;
        default: undefined;
    };
    replaceFields: {
        type: PropType<Record<string, string>>;
        default: () => {};
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("select" | "check" | "dragend" | "dragover" | "dragstart" | "drop" | "update:checkedKeys" | "update:selectedKey" | "update:expandedKeys" | "nodeClick" | "nodeDblclick" | "nodeContextmenu" | "expand")[], "select" | "check" | "dragend" | "dragover" | "dragstart" | "drop" | "update:checkedKeys" | "update:selectedKey" | "update:expandedKeys" | "nodeClick" | "nodeDblclick" | "nodeContextmenu" | "expand", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    data: {
        type: PropType<RowData[]>;
        default: () => never[];
    };
    checkedKeys: {
        type: PropType<unknown[]>;
        default: () => never[];
    };
    selectedKey: {
        type: null;
        default: string;
    };
    showCheckbox: {
        type: BooleanConstructor;
        default: boolean;
    };
    showIcon: {
        type: BooleanConstructor;
        default: boolean;
    };
    draggable: {
        type: BooleanConstructor;
        default: boolean;
    };
    defaultExpandAll: {
        type: BooleanConstructor;
        default: boolean;
    };
    expandedKeys: {
        type: PropType<unknown[]>;
        default: undefined;
    };
    replaceFields: {
        type: PropType<Record<string, string>>;
        default: () => {};
    };
}>> & Readonly<{
    onSelect?: ((...args: any[]) => any) | undefined;
    onDragend?: ((...args: any[]) => any) | undefined;
    onDragover?: ((...args: any[]) => any) | undefined;
    onDragstart?: ((...args: any[]) => any) | undefined;
    onDrop?: ((...args: any[]) => any) | undefined;
    onCheck?: ((...args: any[]) => any) | undefined;
    "onUpdate:checkedKeys"?: ((...args: any[]) => any) | undefined;
    "onUpdate:selectedKey"?: ((...args: any[]) => any) | undefined;
    "onUpdate:expandedKeys"?: ((...args: any[]) => any) | undefined;
    onNodeClick?: ((...args: any[]) => any) | undefined;
    onNodeDblclick?: ((...args: any[]) => any) | undefined;
    onNodeContextmenu?: ((...args: any[]) => any) | undefined;
    onExpand?: ((...args: any[]) => any) | undefined;
}>, {
    data: RowData[];
    showCheckbox: boolean;
    defaultExpandAll: boolean;
    draggable: boolean;
    checkedKeys: unknown[];
    selectedKey: any;
    showIcon: boolean;
    expandedKeys: unknown[];
    replaceFields: Record<string, string>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在同一区域切换多组内容。 @category navigation @props modelValue::当前激活的标签页键;type::标签页视觉类型;allowClose::是否允许关闭标签页 @event update:modelValue :: string | number :: 更新后的标签页键 @event change :: string | number :: 标签页变更 */
export declare const VTab: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: string;
    };
    type: {
        type: StringConstructor;
        default: string;
    };
    allowClose: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("close" | "change" | "update:modelValue")[], "close" | "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: string;
    };
    type: {
        type: StringConstructor;
        default: string;
    };
    allowClose: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    type: string;
    modelValue: any;
    allowClose: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 标签页中的单个内容面板。 @category navigation @props id::面板唯一键;title::标签标题;closable::该标签是否可关闭 @related VTab */
export declare const VTabItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    id: {
        type: null;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    id: {
        type: null;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    closable: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    title: string;
    closable: boolean;
    id: any;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 管理一组可折叠内容。 @category data @props modelValue::当前展开项键或键数组;accordion::是否手风琴单开 @event update:modelValue :: string | number :: 更新后的展开项键 @event change :: string | number :: 展开项变更 */
export declare const VCollapse: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: string;
    };
    accordion: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:modelValue")[], "change" | "update:modelValue", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    modelValue: {
        type: null;
        default: string;
    };
    accordion: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
}>, {
    modelValue: any;
    accordion: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 折叠面板中的单个内容项。 @category data @props id::内容项唯一键;title::内容项标题 @related VCollapse */
export declare const VCollapseItem: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    id: {
        type: null;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    id: {
        type: null;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    title: string;
    id: any;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 在分页数据集合之间导航。 @category navigation @props current::当前页码;total::数据总条数;pageSize::每页条数;pageSizes::可选每页条数;layout::分页子控件布局;pagerCount::最多显示的页码按钮数;disabled::是否禁用;hideOnSinglePage::单页时是否隐藏;background::页码按钮是否有背景 @event update:current :: number :: 更新后的页码 @event update:pageSize :: number :: 更新后的每页条数 @event change :: [number, number] :: 页码和每页条数变更 @event sizeChange :: number :: 每页条数变更 */
export declare const VPagination: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    current: {
        type: NumberConstructor;
        default: number;
    };
    total: {
        type: NumberConstructor;
        default: number;
    };
    pageSize: {
        type: NumberConstructor;
        default: number;
    };
    pageSizes: {
        type: PropType<number[]>;
        default: () => number[];
    };
    layout: {
        type: StringConstructor;
        default: string;
    };
    pagerCount: {
        type: NumberConstructor;
        default: number;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    hideOnSinglePage: {
        type: BooleanConstructor;
        default: boolean;
    };
    background: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, (() => null) | (() => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>), {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "update:current" | "update:pageSize" | "sizeChange")[], "change" | "update:current" | "update:pageSize" | "sizeChange", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    current: {
        type: NumberConstructor;
        default: number;
    };
    total: {
        type: NumberConstructor;
        default: number;
    };
    pageSize: {
        type: NumberConstructor;
        default: number;
    };
    pageSizes: {
        type: PropType<number[]>;
        default: () => number[];
    };
    layout: {
        type: StringConstructor;
        default: string;
    };
    pagerCount: {
        type: NumberConstructor;
        default: number;
    };
    disabled: {
        type: BooleanConstructor;
        default: boolean;
    };
    hideOnSinglePage: {
        type: BooleanConstructor;
        default: boolean;
    };
    background: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    "onUpdate:current"?: ((...args: any[]) => any) | undefined;
    "onUpdate:pageSize"?: ((...args: any[]) => any) | undefined;
    onSizeChange?: ((...args: any[]) => any) | undefined;
}>, {
    disabled: boolean;
    layout: string;
    total: number;
    current: number;
    pageSize: number;
    pageSizes: number[];
    pagerCount: number;
    hideOnSinglePage: boolean;
    background: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示多步骤流程的当前进度。 @category navigation @props active::当前步骤索引;direction::排列方向;processStatus::当前步骤状态;finishStatus::已完成步骤状态;alignCenter::是否居中对齐;simple::是否使用简洁模式 @event change :: number :: 点击的步骤索引 */
export declare const VSteps: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    active: {
        type: NumberConstructor;
        default: number;
    };
    direction: {
        type: PropType<"horizontal" | "vertical">;
        default: string;
    };
    processStatus: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
    finishStatus: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
    alignCenter: {
        type: BooleanConstructor;
        default: boolean;
    };
    simple: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "change"[], "change", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    active: {
        type: NumberConstructor;
        default: number;
    };
    direction: {
        type: PropType<"horizontal" | "vertical">;
        default: string;
    };
    processStatus: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
    finishStatus: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
    alignCenter: {
        type: BooleanConstructor;
        default: boolean;
    };
    simple: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
}>, {
    active: number;
    direction: "horizontal" | "vertical";
    processStatus: "error" | "success" | "wait" | "process" | "finish";
    finishStatus: "error" | "success" | "wait" | "process" | "finish";
    alignCenter: boolean;
    simple: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 步骤条中的单个步骤。 @category navigation @props title::步骤标题;description::步骤说明;icon::步骤 SVG 图标名;status::覆盖自动计算的状态 @related VSteps */
export declare const VStep: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    description: {
        type: StringConstructor;
        default: string;
    };
    icon: {
        type: StringConstructor;
        default: string;
    };
    status: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    title: {
        type: StringConstructor;
        default: string;
    };
    description: {
        type: StringConstructor;
        default: string;
    };
    icon: {
        type: StringConstructor;
        default: string;
    };
    status: {
        type: PropType<"wait" | "process" | "finish" | "error" | "success">;
        default: string;
    };
}>> & Readonly<{}>, {
    title: string;
    status: "error" | "success" | "wait" | "process" | "finish";
    icon: string;
    description: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 突出展示关键统计数值。 @category data @props value::统计值;title::指标标题;precision::小数位数;prefix::数值前缀;suffix::数值后缀;valueStyle::数值区域样式;groupSeparator::千位分隔符 */
export declare const VStatistic: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    value: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    precision: {
        type: NumberConstructor;
        default: undefined;
    };
    prefix: {
        type: StringConstructor;
        default: string;
    };
    suffix: {
        type: StringConstructor;
        default: string;
    };
    valueStyle: {
        type: ObjectConstructor;
        default: () => {};
    };
    groupSeparator: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    value: {
        type: (StringConstructor | NumberConstructor)[];
        default: number;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    precision: {
        type: NumberConstructor;
        default: undefined;
    };
    prefix: {
        type: StringConstructor;
        default: string;
    };
    suffix: {
        type: StringConstructor;
        default: string;
    };
    valueStyle: {
        type: ObjectConstructor;
        default: () => {};
    };
    groupSeparator: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{}>, {
    title: string;
    value: string | number;
    prefix: string;
    suffix: string;
    precision: number;
    valueStyle: Record<string, any>;
    groupSeparator: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 展示到目标时间的倒计时。 @category data @props value::目标时间戳或 Date;format::倒计时格式模板;title::指标标题;prefix::倒计时前缀;suffix::倒计时后缀 @event finish :: void :: 倒计时结束 @event change :: number :: 剩余毫秒数变更 */
export declare const VCountdown: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    value: {
        type: (DateConstructor | NumberConstructor)[];
        default: number;
    };
    format: {
        type: StringConstructor;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    prefix: {
        type: StringConstructor;
        default: string;
    };
    suffix: {
        type: StringConstructor;
        default: string;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("change" | "finish")[], "change" | "finish", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    value: {
        type: (DateConstructor | NumberConstructor)[];
        default: number;
    };
    format: {
        type: StringConstructor;
        default: string;
    };
    title: {
        type: StringConstructor;
        default: string;
    };
    prefix: {
        type: StringConstructor;
        default: string;
    };
    suffix: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{
    onChange?: ((...args: any[]) => any) | undefined;
    onFinish?: ((...args: any[]) => any) | undefined;
}>, {
    title: string;
    value: number | Date;
    prefix: string;
    suffix: string;
    format: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export {};
//# sourceMappingURL=data.d.ts.map