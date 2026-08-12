/**
 * 表格列宽计算（纯函数，供 data.ts 与 test/table-column-width.test.mjs 共用）。
 *
 * 只有操作列需要在运行时算宽度：各页操作列的按钮从 1 个到 3 个不等，文案从「编辑」
 * 到「重置密码」「查看详情」长短不一，还有一批按行状态 v-if。写死宽度必然要么大片
 * 留白（存量里有 15% / 250px / 300px），要么把按钮挤到换行或被裁掉。
 * 因此按**实际渲染出的按钮文案**逐行算，取最宽的一行做列宽。
 *
 * 下面的常数与 ui-v3/ui.css 的 `.vui-button`、`.vui-table-cell` 同源，改样式要一起改。
 */
/** `.vui-button` 的 min-width */
export declare const BUTTON_MIN_WIDTH = 72;
/** `.vui-button` 的 padding: 0 16px 与 1px 边框，共 34px 不参与文字排布 */
export declare const BUTTON_FRAME_WIDTH = 34;
/** `.vui-button` 的 margin: 0 8px 0 0；末个按钮也带，故每个按钮都计一份 */
export declare const BUTTON_GAP = 8;
/** `.vui-table-cell` 的 padding: 10px 14px */
export declare const CELL_PADDING_X = 28;
/** 兜底下限：按钮被 v-if 全部隐藏时，不让列塌到表头「操作」两个字的宽度 */
export declare const OPERATION_COLUMN_MIN_WIDTH = 88;
/**
 * 按钮文案宽度估算。半角按 8px 算（14px / 600 字重下偏保守），
 * 宁可略宽也不能算窄——算窄会直接挤掉按钮。
 */
export declare function buttonLabelWidth(label: string): number;
/** 单个按钮的占位宽度 */
export declare function buttonWidth(label: string): number;
/** 一行操作单元格里全部按钮所需的宽度；该行没有按钮时返回 0（不参与取最大值） */
export declare function operationCellWidth(labels: string[]): number;
/**
 * 操作列宽度：取各行中最宽的一行。
 * 不能只看第一行——「取消标注 / 标注」「接收 / 录入 / 查看」这类按钮按行状态 v-if，
 * 只看一行会让另一些行的按钮被挤掉。
 */
export declare function operationColumnWidth(rowLabels: string[][]): number;
/** 与 ui.css 的 `--vui-table-check-w` 同源，由 test/table-column-width.test.mjs 对拍 */
export declare const CHECK_COLUMN_WIDTH = 40;
/** 与 ui.css 的 `.vui-table-native { min-width }` 同源 */
export declare const TABLE_MIN_WIDTH = 720;
/** 吸收剩余宽度那一列的下限：不写 width 的列在窄容器里会被压到几个像素 */
export declare const FLEXIBLE_COLUMN_MIN_WIDTH = 160;
/**
 * 表格最小宽度 = 各列所需宽度之和。
 *
 * 少了这一步，列多的表格会出事：表格是 `width: 100%`，`table-layout: fixed` 下浏览器
 * 先满足写了宽度的列，把**剩下的宽度全给不写 width 的吸收列**——三色赋码页 12 个数据列
 * 声明宽度加起来已接近容器宽，吸收列「备注」实测只剩 13px。
 * 把总宽写成表格的 min-width，容器不够时改为横向滚动（已有冻结列兜住可读性），
 * 而不是把某一列压塌。
 */
export declare function tableMinWidth(columnWidths: number[], hasCheckColumn: boolean): number;
//# sourceMappingURL=columnWidth.d.ts.map