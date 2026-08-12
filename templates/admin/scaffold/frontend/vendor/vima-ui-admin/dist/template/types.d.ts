/**
 * @vima-tech/ui-admin · 模板系统类型定义
 *
 * 定义模板系统的数据结构和接口
 */
/** 组件类型枚举 */
export type ComponentType = 'container' | 'row' | 'col' | 'card' | 'divider' | 'form' | 'form-item' | 'input' | 'input-number' | 'select' | 'switch' | 'radio' | 'radio-group' | 'checkbox' | 'checkbox-group' | 'datepicker' | 'timepicker' | 'textarea' | 'tag-input' | 'upload' | 'icon' | 'text' | 'table' | 'pagination' | 'tag' | 'badge' | 'progress' | 'statistic' | 'descriptions' | 'descriptions-item' | 'tree' | 'alert' | 'empty' | 'loading' | 'message' | 'modal' | 'drawer' | 'tooltip' | 'popover' | 'button' | 'button-group' | 'link' | 'dropdown' | 'custom';
/** 组件属性值类型 */
export type PropValue = string | number | boolean | null | undefined | PropValue[] | Record<string, any>;
/** 组件属性定义 */
export interface ComponentProps {
    [key: string]: PropValue | Expression;
}
/** 表达式类型 */
export interface Expression {
    /** 表达式类型标识 */
    __expression: true;
    /** 表达式内容，如 "formData.name" 或 "formData.age > 18" */
    expr: string;
}
/** 事件处理定义 */
export interface EventHandler {
    /** 事件类型 */
    type: 'click' | 'change' | 'submit' | 'focus' | 'blur' | 'input' | 'custom';
    /** 动作类型 */
    action: 'setValue' | 'getData' | 'submit' | 'validate' | 'reset' | 'navigate' | 'showModal' | 'closeModal' | 'custom';
    /** 动作参数 */
    params?: Record<string, any>;
    /** 自定义函数体 */
    handler?: string;
}
/** 模板节点定义 */
export interface TemplateNode {
    /** 节点唯一ID */
    id: string;
    /** 组件类型 */
    type: ComponentType;
    /** 组件属性 */
    props?: ComponentProps;
    /** 子节点 */
    children?: TemplateNode[];
    /** 插槽内容 */
    slots?: Record<string, TemplateNode[]>;
    /** 事件处理 */
    events?: Record<string, EventHandler>;
    /** 条件渲染表达式 */
    condition?: string | Expression;
    /** 循环渲染配置 */
    loop?: {
        /** 循环数据源表达式 */
        data: string | Expression;
        /** 循环项变量名 */
        item: string;
        /** 循环索引变量名 */
        index?: string;
        /** 循环key */
        key?: string;
    };
    /** 样式定义 */
    style?: Record<string, string | number>;
    /** 类名定义 */
    className?: string | string[] | Record<string, boolean>;
    /** 标注信息（用于编辑器） */
    meta?: {
        /** 组件名称（中文） */
        label?: string;
        /** 组件图标 */
        icon?: string;
        /** 组件描述 */
        description?: string;
        /** 是否锁定（不可删除） */
        locked?: boolean;
        /** 是否隐藏（编辑器中） */
        hidden?: boolean;
    };
    /**
     * 几何信息。只有当**父节点是布局容器**（自身或模板声明了 grid / absolute）时才生效，
     * flow 模式下整个字段被忽略。旧模板没有这个字段，因此行为完全不变。
     */
    layout?: NodeLayout;
    /**
     * 把本节点变成一块布局容器，它的子节点按这个模式摆放。
     * 不写则继承父容器的模式；根节点不写则取 Template.layoutMode。
     * 有了它才能做出「卡片里嵌一块栅格画布」这种结构。
     */
    layoutMode?: LayoutMode;
}
/**
 * 布局模式。
 *
 * - `flow`     —— 节点按树形结构自然流式排列，不带任何几何信息。
 *                 **这是默认值**，旧模板不写 layoutMode 就走这条，渲染结果逐像素不变。
 * - `grid`     —— 24 栅格 × 固定行高。几何单位是「格」和「行」，能表达
 *                 「从第 7 列第 3 行开始，占 6 格宽 4 行高」，且天然响应式。
 * - `absolute` —— 像素画布。几何单位是 px，自由摆放、参考线吸附、方向键微调，
 *                 代价是不响应式（画布固定尺寸，靠 zoom 缩放）。
 */
export type LayoutMode = 'flow' | 'grid' | 'absolute';
/**
 * 响应式断点键，只有 grid 模式有效。
 * 阈值与组件库既有约定同源（见 styles/ui.css 的 1100px 断点）：
 * lg ≥ 1100 > md ≥ 768 > sm。
 */
export type BreakpointKey = 'lg' | 'md' | 'sm';
/**
 * 一个矩形 + 它的尺寸约束。
 *
 * grid 模式下 x/y/w/h 的单位是格与行（整数）；absolute 模式下是 px。
 * min/max 是**约束**而不是当前值：编辑器 resize 时会把结果夹在区间内，
 * 渲染时也会写成 CSS 的 min-width/max-width，防止容器变窄后组件被压坏。
 */
export interface Geometry {
    /** 左上角横坐标：grid 是列序号（0 起），absolute 是 px */
    x: number;
    /** 左上角纵坐标：grid 是行序号（0 起），absolute 是 px */
    y: number;
    /** 宽：grid 是占几格，absolute 是 px */
    w: number;
    /** 高：grid 是占几行，absolute 是 px */
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    /** 锁定：不可拖动、不可缩放，其他节点压实时也要绕开它 */
    static?: boolean;
}
/** 一个节点在各布局模式下的几何 */
export interface NodeLayout {
    /** grid 模式几何（单位：格 / 行） */
    grid?: Geometry;
    /** absolute 模式几何（单位：px） */
    absolute?: Geometry;
    /**
     * 断点覆盖，仅 grid 模式生效。只覆盖写了的字段，没写的沿用 grid 基准值。
     * 基准值本身相当于 lg。
     */
    breakpoints?: Partial<Record<BreakpointKey, Partial<Geometry>>>;
}
/** 画布配置 */
export interface CanvasConfig {
    /** grid：列数，默认 24（与组件库栅格同源） */
    cols?: number;
    /** grid：行高 px，默认 32 */
    rowHeight?: number;
    /** 单元格间距 px，默认 12 */
    gap?: number;
    /** absolute：画布宽，默认 1440 */
    width?: number;
    /** absolute：画布高，默认 900 */
    height?: number;
    /** absolute：吸附阈值 px，默认 6。设 0 关闭吸附 */
    snapThreshold?: number;
}
/** 模板类型 */
export type TemplateType = 'form' | 'card' | 'list' | 'page' | 'custom';
/** 模板定义 */
export interface Template {
    /** 模板唯一ID */
    id: string;
    /** 模板名称 */
    name: string;
    /** 模板类型 */
    type: TemplateType;
    /** 模板版本 */
    version: string;
    /** 模板描述 */
    description?: string;
    /** 模板作者 */
    author?: string;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
    /** 模板标签 */
    tags?: string[];
    /** 模板根节点 */
    root: TemplateNode;
    /**
     * 根节点子元素的摆放模式。不写等同于 `flow`——旧模板因此完全不受影响。
     * 根节点自己写了 root.layoutMode 时以后者为准。
     */
    layoutMode?: LayoutMode;
    /** 画布配置（列数 / 行高 / 间距 / 吸附阈值） */
    canvas?: CanvasConfig;
    /** 数据源定义 */
    dataSources?: DataSourceDefinition[];
    /** 表单配置 */
    formConfig?: FormConfig;
    /** 样式配置 */
    styleConfig?: StyleConfig;
    /** 自定义脚本 */
    scripts?: ScriptDefinition[];
}
/** 数据源定义 */
export interface DataSourceDefinition {
    /** 数据源ID */
    id: string;
    /** 数据源名称 */
    name: string;
    /** 数据源类型 */
    type: 'static' | 'api' | 'function';
    /** 静态数据 */
    data?: any;
    /** API配置 */
    api?: {
        url: string;
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        headers?: Record<string, string>;
        params?: Record<string, any>;
    };
    /** 自定义函数 */
    handler?: string;
    /** 初始化时是否自动加载 */
    autoLoad?: boolean;
}
/** 表单配置 */
export interface FormConfig {
    /** 表单布局 */
    layout?: 'horizontal' | 'vertical' | 'inline';
    /** 标签宽度 */
    labelWidth?: number | string;
    /** 标签位置 */
    labelPosition?: 'left' | 'right' | 'top';
    /** 表单校验规则 */
    rules?: Record<string, any[]>;
    /** 表单初始值 */
    initialValues?: Record<string, any>;
}
/** 样式配置 */
export interface StyleConfig {
    /** 主题色 */
    primaryColor?: string;
    /** 字体 */
    fontFamily?: string;
    /** 圆角 */
    borderRadius?: number;
    /** 间距 */
    spacing?: 'compact' | 'normal' | 'loose';
    /** 自定义CSS */
    customCSS?: string;
}
/** 脚本定义 */
export interface ScriptDefinition {
    /** 脚本ID */
    id: string;
    /** 脚本名称 */
    name: string;
    /** 脚本内容 */
    content: string;
    /** 触发时机 */
    trigger: 'mounted' | 'created' | 'beforeSubmit' | 'afterSubmit' | 'custom';
}
/** 编辑器模式 */
export type EditorMode = 'design' | 'preview' | 'code';
/** 编辑器状态 */
export interface EditorState {
    /** 当前模式 */
    mode: EditorMode;
    /** 选中的节点ID */
    selectedNodeId?: string;
    /** 拖拽状态 */
    dragState?: {
        dragging: boolean;
        dragNode?: TemplateNode;
        dropTarget?: string;
        dropPosition?: 'before' | 'after' | 'inside';
    };
    /** 历史记录 */
    history: {
        past: Template[];
        future: Template[];
    };
    /** 画布缩放 */
    zoom: number;
    /** 画布偏移 */
    offset: {
        x: number;
        y: number;
    };
}
/** 组件面板项 */
export interface ComponentPanelItem {
    /** 组件类型 */
    type: ComponentType;
    /** 组件名称 */
    label: string;
    /** 组件图标 */
    icon: string;
    /** 组件分类 */
    category: string;
    /** 组件描述 */
    description?: string;
    /** 默认属性 */
    defaultProps?: ComponentProps;
    /** 默认子节点 */
    defaultChildren?: TemplateNode[];
}
/** 属性配置面板项 */
export interface PropConfigItem {
    /** 属性名 */
    name: string;
    /** 属性标签 */
    label: string;
    /** 属性类型 */
    type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'icon' | 'expression' | 'json';
    /** 属性默认值 */
    defaultValue?: any;
    /** 选项（select类型） */
    options?: Array<{
        label: string;
        value: any;
    }>;
    /** 是否必填 */
    required?: boolean;
    /** 属性描述 */
    description?: string;
    /** 属性分组 */
    group?: string;
}
/** 渲染上下文 */
export interface RenderContext {
    /** 表单数据 */
    formData: Record<string, any>;
    /** 全局数据 */
    globalData: Record<string, any>;
    /** 组件实例引用 */
    refs: Record<string, any>;
    /** 方法集合 */
    methods: Record<string, Function>;
    /** 计算属性 */
    computed: Record<string, any>;
    /** 生命周期钩子 */
    hooks: Record<string, Function>;
}
/** 渲染器配置 */
export interface RendererConfig {
    /** 是否调试模式 */
    debug?: boolean;
    /** 模板信任级别；默认 untrusted，只有项目内已审查模板才能设为 trusted */
    trustLevel?: 'untrusted' | 'trusted';
    /** untrusted 模板允许访问的远程数据源 origin */
    allowedApiOrigins?: string[];
    /** 组件映射 */
    componentMap?: Record<string, any>;
    /** 自定义渲染函数 */
    customRenderers?: Record<string, (node: TemplateNode, ctx: RenderContext) => any>;
    /** 错误处理 */
    onError?: (error: Error, node: TemplateNode) => void;
}
/** 可由 Agent 和开发工具消费的结构化诊断。 */
export interface UIDiagnostic {
    code: string;
    severity: 'error' | 'warning';
    path: string;
    component?: string;
    message: string;
    suggestion?: string;
    example?: unknown;
}
/** AI模板操作类型 */
export type AIOperationType = 'create' | 'read' | 'update' | 'delete' | 'generate' | 'transform';
/** AI请求 */
export interface AIRequest {
    /** 操作类型 */
    operation: AIOperationType;
    /** 自然语言描述 */
    prompt?: string;
    /** 模板ID（读取/更新/删除时） */
    templateId?: string;
    /** 模板数据（创建/更新时） */
    template?: Partial<Template>;
    /** 转换目标 */
    target?: string;
    /** 额外参数 */
    params?: Record<string, any>;
}
/** AI响应 */
export interface AIResponse {
    /** 是否成功 */
    success: boolean;
    /** 模板数据 */
    template?: Template;
    /** 错误信息 */
    error?: string;
    /** 稳定错误码 */
    code?: string;
    /** 模板契约与安全诊断 */
    diagnostics?: UIDiagnostic[];
    /** 额外数据 */
    data?: any;
}
/** 存储接口 */
export interface TemplateStorage {
    /** 保存模板 */
    save(template: Template): Promise<void>;
    /** 读取模板 */
    load(id: string): Promise<Template | null>;
    /** 列出模板 */
    list(options?: ListOptions): Promise<Template[]>;
    /** 删除模板 */
    delete(id: string): Promise<void>;
    /** 导出模板 */
    export(id: string): Promise<string>;
    /** 导入模板 */
    import(data: string): Promise<Template>;
}
/** 列表选项 */
export interface ListOptions {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词 */
    keyword?: string;
    /** 模板类型 */
    type?: TemplateType;
    /** 标签筛选 */
    tags?: string[];
    /** 排序字段 */
    sortBy?: string;
    /** 排序方向 */
    sortOrder?: 'asc' | 'desc';
}
//# sourceMappingURL=types.d.ts.map