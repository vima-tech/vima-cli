/**
 * @vima-tech/ui-admin · 模板系统
 *
 * 自定义模板功能，支持可视化编辑和JSON存储
 */
export type { ComponentType, PropValue, ComponentProps, Expression, EventHandler, TemplateNode, Template, TemplateType, DataSourceDefinition, FormConfig, StyleConfig, ScriptDefinition, LayoutMode, BreakpointKey, Geometry, NodeLayout, CanvasConfig, EditorMode, EditorState, ComponentPanelItem, PropConfigItem, RenderContext, RendererConfig, AIOperationType, AIRequest, AIResponse, UIDiagnostic, TemplateStorage, ListOptions } from './types';
export { TemplateRenderer, FormTemplateRenderer, CardTemplateRenderer, registerComponent, registerComponents } from './renderer';
export { DEFAULT_CANVAS, BREAKPOINT_MIN_WIDTH, BREAKPOINTS_DESC, RESIZE_HANDLES, resolveCanvas, pickBreakpoint, resolveGridGeometry, clamp, clampGeometry, collides, findCollisions, resolveGridCollisions, compactGrid, gridHeight, colWidth, gridToPixel, pixelToGrid, pixelToGridDelta, snapPosition, snapResize, applyResizeDelta } from './geometry';
export type { PlacedRect, SnapGuide, ResizeHandle } from './geometry';
export { VTemplateEditor } from './VTemplateEditor';
export { createTemplateEditor } from './editor-state';
export type { TemplateEditor, TemplateEditorOptions, GeometryUpdateOptions } from './editor-state';
export { COMPONENT_CATEGORIES, COMPONENT_PROPS_CONFIG, createEmptyTemplate, createNode, findNode, findParentNode, cloneNode, exportTemplate, importTemplate } from './editor';
export { LocalTemplateStorage, ApiTemplateStorage, AITemplateService, defaultStorage, defaultAIService } from './storage';
export { TEMPLATE_COMPONENT_NAMES, TEMPLATE_COMPONENT_TYPES, createTemplateComponentMap } from './contracts';
export { assertValidTemplate, templateComponentName, validateTemplate } from './validate';
export type { TemplateComponentContract, TemplateTrustLevel, TemplateValidationOptions, TemplateValidationResult } from './validate';
//# sourceMappingURL=index.d.ts.map