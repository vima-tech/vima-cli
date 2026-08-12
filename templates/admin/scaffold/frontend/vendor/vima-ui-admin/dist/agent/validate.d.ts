import type { UIDiagnostic } from '../template/types';
import type { AppSpec, PageSpec } from './types';
export interface SpecValidationResult<T> {
    valid: boolean;
    value?: T;
    diagnostics: UIDiagnostic[];
}
export declare function validateAppSpec(input: unknown): SpecValidationResult<AppSpec>;
export declare function validatePageSpec(input: unknown): SpecValidationResult<PageSpec>;
//# sourceMappingURL=validate.d.ts.map