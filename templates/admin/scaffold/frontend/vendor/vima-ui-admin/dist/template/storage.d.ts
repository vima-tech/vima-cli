/**
 * @vima-tech/ui-admin · 模板存储层
 *
 * 提供模板的持久化存储和AI接口
 */
import type { Template, TemplateStorage, ListOptions, AIRequest, AIResponse } from './types';
import { type TemplateValidationOptions } from './validate';
/**
 * LocalStorage 存储实现
 */
export declare class LocalTemplateStorage implements TemplateStorage {
    private prefix;
    private validationOptions;
    constructor(prefix?: string, validationOptions?: TemplateValidationOptions);
    save(template: Template): Promise<void>;
    load(id: string): Promise<Template | null>;
    list(options?: ListOptions): Promise<Template[]>;
    delete(id: string): Promise<void>;
    export(id: string): Promise<string>;
    import(data: string): Promise<Template>;
    /**
     * 清空所有模板
     */
    clear(): Promise<void>;
    /**
     * 获取存储大小
     */
    getSize(): number;
}
interface ApiStorageConfig {
    baseUrl: string;
    headers?: Record<string, string>;
    validation?: TemplateValidationOptions;
}
/**
 * API 存储实现
 */
export declare class ApiTemplateStorage implements TemplateStorage {
    private config;
    constructor(config: ApiStorageConfig);
    private request;
    save(template: Template): Promise<void>;
    load(id: string): Promise<Template | null>;
    list(options?: ListOptions): Promise<Template[]>;
    delete(id: string): Promise<void>;
    export(id: string): Promise<string>;
    import(data: string): Promise<Template>;
}
/**
 * AI 模板服务
 */
export declare class AITemplateService {
    private storage;
    private aiEndpoint?;
    constructor(storage: TemplateStorage, aiEndpoint?: string);
    /**
     * 处理 AI 请求
     */
    handleRequest(request: AIRequest): Promise<AIResponse>;
    /**
     * 创建模板
     */
    private createTemplate;
    /**
     * 读取模板
     */
    private readTemplate;
    /**
     * 更新模板
     */
    private updateTemplate;
    /**
     * 删除模板
     */
    private deleteTemplate;
    /**
     * AI 生成模板
     */
    private generateTemplate;
    /**
     * 转换模板
     */
    private transformTemplate;
    /**
     * 列出所有模板
     */
    listTemplates(options?: ListOptions): Promise<Template[]>;
    /**
     * 导出模板
     */
    exportTemplate(id: string): Promise<string>;
    /**
     * 导入模板
     */
    importTemplate(data: string): Promise<Template>;
}
/** 默认本地存储实例 */
export declare const defaultStorage: LocalTemplateStorage;
/** 默认 AI 服务实例 */
export declare const defaultAIService: AITemplateService;
declare const _default: {
    LocalTemplateStorage: typeof LocalTemplateStorage;
    ApiTemplateStorage: typeof ApiTemplateStorage;
    AITemplateService: typeof AITemplateService;
    defaultStorage: LocalTemplateStorage;
    defaultAIService: AITemplateService;
};
export default _default;
//# sourceMappingURL=storage.d.ts.map