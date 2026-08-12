/**
 * @vima-tech/ui-admin · 模板编辑器
 *
 * 可视化拖拽编辑器核心逻辑
 */
import type { Template, TemplateNode, ComponentType, PropConfigItem, TemplateType } from './types';
/** 组件面板分类 */
export declare const COMPONENT_CATEGORIES: {
    name: string;
    icon: string;
    components: {
        type: string;
        label: string;
        icon: string;
        description: string;
    }[];
}[];
/** 组件属性配置 */
export declare const COMPONENT_PROPS_CONFIG: Record<ComponentType, PropConfigItem[]>;
/**
 * 创建空模板
 */
export declare function createEmptyTemplate(type: TemplateType, name: string): Template;
/**
 * 创建节点
 */
export declare function createNode(type: ComponentType, props?: Record<string, any>): TemplateNode;
/**
 * 在树中查找节点
 */
export declare function findNode(root: TemplateNode, nodeId: string): TemplateNode | null;
/**
 * 在树中查找父节点
 */
export declare function findParentNode(root: TemplateNode, nodeId: string): TemplateNode | null;
/**
 * 深拷贝节点
 */
export declare function cloneNode(node: TemplateNode, regenerateIds?: boolean): TemplateNode;
/**
 * 导出模板为JSON
 */
export declare function exportTemplate(template: Template): string;
/**
 * 从JSON导入模板
 */
export declare function importTemplate(json: string): Template;
declare const _default: {
    COMPONENT_CATEGORIES: {
        name: string;
        icon: string;
        components: {
            type: string;
            label: string;
            icon: string;
            description: string;
        }[];
    }[];
    COMPONENT_PROPS_CONFIG: Record<ComponentType, PropConfigItem[]>;
    createEmptyTemplate: typeof createEmptyTemplate;
    createNode: typeof createNode;
    findNode: typeof findNode;
    findParentNode: typeof findParentNode;
    cloneNode: typeof cloneNode;
    exportTemplate: typeof exportTemplate;
    importTemplate: typeof importTemplate;
};
export default _default;
//# sourceMappingURL=editor.d.ts.map