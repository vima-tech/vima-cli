import type { ArtifactBuildResult, AppSpec, CrudPageSpec, DashboardPageSpec, DetailPageSpec, FormPageSpec, PageBuildResult, PageSpec } from './types';
export declare function buildFormPage(spec: FormPageSpec): PageBuildResult;
export declare function buildFormPage(spec: unknown): PageBuildResult;
export declare function buildCrudPage(spec: CrudPageSpec): PageBuildResult;
export declare function buildCrudPage(spec: unknown): PageBuildResult;
export declare function buildDetailPage(spec: DetailPageSpec): PageBuildResult;
export declare function buildDetailPage(spec: unknown): PageBuildResult;
export declare function buildDashboardPage(spec: DashboardPageSpec): PageBuildResult;
export declare function buildDashboardPage(spec: unknown): PageBuildResult;
export declare function buildPage(spec: PageSpec): PageBuildResult;
export declare function buildPage(spec: unknown): PageBuildResult;
export declare function createArtifactPlan(spec: AppSpec): ArtifactBuildResult;
export declare function createArtifactPlan(spec: unknown): ArtifactBuildResult;
//# sourceMappingURL=builders.d.ts.map