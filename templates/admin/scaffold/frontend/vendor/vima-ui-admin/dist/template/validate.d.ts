import type { Template, TemplateNode, UIDiagnostic } from './types';
export type TemplateTrustLevel = 'untrusted' | 'trusted';
export interface TemplateComponentContract {
    props?: readonly string[];
    propTypes?: Readonly<Record<string, {
        types: readonly string[];
        required?: boolean;
    }>>;
    events?: readonly string[];
    slots?: readonly string[];
}
export interface TemplateValidationOptions {
    trustLevel?: TemplateTrustLevel;
    componentContracts?: Partial<Record<string, TemplateComponentContract>>;
    allowedApiOrigins?: readonly string[];
}
export interface TemplateValidationResult {
    valid: boolean;
    diagnostics: UIDiagnostic[];
}
export declare function validateTemplate(template: unknown, options?: TemplateValidationOptions): TemplateValidationResult;
export declare function assertValidTemplate(template: unknown, options?: TemplateValidationOptions): asserts template is Template;
export declare function templateComponentName(type: string): string | undefined;
export type { Template, TemplateNode };
export type { UIDiagnostic } from './types';
//# sourceMappingURL=validate.d.ts.map