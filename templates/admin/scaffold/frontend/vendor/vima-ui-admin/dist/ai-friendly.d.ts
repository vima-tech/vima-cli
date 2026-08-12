/**
 * @vima-tech/ui-admin · AI友好型工具函数
 *
 * 为AI Agent提供更友好的API和错误提示
 */
interface FieldInference {
    type?: string;
    required?: boolean;
    placeholder?: string;
    min?: number;
    max?: number;
    pattern?: string;
    rows?: number;
    options?: Array<{
        value: any;
        label: string;
    }>;
}
/**
 * 根据字段名智能推断配置
 */
export declare function inferFieldConfig(fieldName: string, label?: string): FieldInference;
export interface UIErrorOptions {
    code: string;
    component: string;
    prop?: string;
    received?: any;
    expected?: any;
    message: string;
    suggestion?: string;
    documentation?: string;
}
export declare class UIError extends Error {
    code: string;
    component: string;
    prop?: string;
    received?: any;
    expected?: any;
    suggestion?: string;
    documentation?: string;
    constructor(options: UIErrorOptions);
    toJSON(): {
        code: string;
        component: string;
        prop: string | undefined;
        received: any;
        expected: any;
        message: string;
        suggestion: string | undefined;
        documentation: string | undefined;
    };
}
/**
 * 验证属性值
 */
export declare function validateProp(component: string, prop: string, value: any, validValues?: any[], type?: string): void;
export interface StandardState<T> {
    value: T;
    valid: boolean;
    errors: ValidationError[];
    dirty: boolean;
    touched: boolean;
    pristine: boolean;
}
export interface ValidationError {
    code: string;
    message: string;
    field?: string;
    rule?: string;
}
/**
 * 创建标准化状态
 */
export declare function createStandardState<T>(initialValue: T): StandardState<T>;
export interface FieldConfig {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: Array<{
        value: any;
        label: string;
    }>;
    width?: number;
    slot?: string;
}
/**
 * 生成表单代码
 */
export declare function generateFormCode(fields: FieldConfig[]): string;
/**
 * 生成表格代码
 */
export declare function generateTableCode(columns: FieldConfig[]): string;
export interface DebugInfo {
    component: string;
    props: Record<string, any>;
    state: any;
    timestamp: number;
}
/**
 * 记录组件调试信息
 */
export declare function logComponentDebug(component: string, props: Record<string, any>, state: any): void;
/**
 * 获取调试历史
 */
export declare function getDebugHistory(): DebugInfo[];
/**
 * 清空调试历史
 */
export declare function clearDebugHistory(): void;
export interface PerformanceMetric {
    component: string;
    operation: 'render' | 'mount' | 'update';
    duration: number;
    timestamp: number;
}
/**
 * 测量组件性能
 */
export declare function measurePerformance(component: string, operation: 'render' | 'mount' | 'update', fn: () => void): number;
/**
 * 获取性能指标
 */
export declare function getPerformanceMetrics(): PerformanceMetric[];
/**
 * 获取平均性能
 */
export declare function getAveragePerformance(component?: string): Record<string, number>;
export {};
//# sourceMappingURL=ai-friendly.d.ts.map