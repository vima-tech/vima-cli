import type { Template, UIDiagnostic } from '../template/types';
export type FieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'object';
export type FieldCardinality = 'single' | 'list' | 'tuple';
export type FieldFormat = 'text' | 'textarea' | 'email' | 'tel' | 'password' | 'enum' | 'file' | 'date-range' | string;
export interface OptionSpec {
    label: string;
    value: string | number | boolean;
    disabled?: boolean;
}
export interface ValidationSpec {
    kind: 'required' | 'min' | 'max' | 'pattern';
    value?: number | string;
    message: string;
}
export interface InputSpec {
    component?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
}
export interface FieldSpec {
    key: string;
    label: string;
    dataType: FieldDataType;
    cardinality?: FieldCardinality;
    format?: FieldFormat;
    required?: boolean;
    options?: OptionSpec[];
    input?: InputSpec;
    validation?: ValidationSpec[];
}
export interface ActionSpec {
    key: string;
    label: string;
    kind?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    icon?: string;
}
interface PageBase {
    id: string;
    title: string;
}
export interface FormPageSpec extends PageBase {
    type: 'form';
    fields: FieldSpec[];
    submitLabel?: string;
}
export interface CrudPageSpec extends PageBase {
    type: 'crud';
    fields: FieldSpec[];
    rowKey: string;
    actions?: ActionSpec[];
}
export interface DetailPageSpec extends PageBase {
    type: 'detail';
    fields: FieldSpec[];
}
export interface DashboardMetricSpec {
    key: string;
    label: string;
    value?: string | number;
    prefix?: string;
    suffix?: string;
}
export interface DashboardPageSpec extends PageBase {
    type: 'dashboard';
    metrics: DashboardMetricSpec[];
}
export type PageSpec = FormPageSpec | CrudPageSpec | DetailPageSpec | DashboardPageSpec;
export interface NavigationSpec {
    label: string;
    route: string;
    icon: string;
}
export interface ShellSpec {
    title: string;
    navigation: NavigationSpec[];
}
export interface RouteSpec {
    path: string;
    pageId: string;
}
export interface AppSpec {
    version: '1';
    name: string;
    shell: ShellSpec;
    pages: PageSpec[];
    routes: RouteSpec[];
}
export interface ArtifactDependency {
    name: string;
    version: string;
    kind: 'dependency' | 'devDependency';
}
export interface ArtifactFile {
    path: string;
    type: 'vue-sfc' | 'ts' | 'json' | 'css' | 'test';
    operation: 'create' | 'update';
    overwrite: 'deny' | 'allow';
    content: string;
}
export interface ArtifactIntegrationRequirement {
    id: string;
    pageId: string;
    kind: 'data' | 'action';
    description: string;
    required: true;
}
export interface ArtifactPlan {
    version: '1';
    readiness: 'scaffold';
    files: ArtifactFile[];
    dependencies: ArtifactDependency[];
    integrationRequirements: ArtifactIntegrationRequirement[];
    verificationCommands: string[];
    diagnostics: UIDiagnostic[];
    nextSteps: string[];
}
export interface PageBuildSuccess {
    ok: true;
    template: Template;
    diagnostics: UIDiagnostic[];
}
export interface BuildFailure {
    ok: false;
    diagnostics: UIDiagnostic[];
}
export type PageBuildResult = PageBuildSuccess | BuildFailure;
export interface ArtifactBuildSuccess {
    ok: true;
    spec: AppSpec;
    plan: ArtifactPlan;
    diagnostics: UIDiagnostic[];
}
export type ArtifactBuildResult = ArtifactBuildSuccess | BuildFailure;
export {};
//# sourceMappingURL=types.d.ts.map