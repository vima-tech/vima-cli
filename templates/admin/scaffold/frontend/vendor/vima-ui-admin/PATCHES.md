# vendor 本地改动清单

本目录是 `@vima-tech/ui-admin` 的 vendor 副本（只含 dist 构建产物）。
**下次从上游重新 vendor 时，下面的改动要重新打一遍**，否则会被覆盖回退。

没有本地改动时，本文件应该是空的——列在这里的每一条都是欠上游的债，
能推回上游就推回去，然后从这里删掉。

---

## P1 · 操作列算宽常数按 `.vui-button-sm` 重新标定

- **日期**：2026-08-12
- **改的文件**：`dist/index.js`、`dist/components/columnWidth.d.ts`
- **为什么**：`columnWidth` 那组常数是按 **md** 按钮标定的（min-width 72 / frame 34 / 字宽 14、8），
  但操作列的行内动作按钮一律 `size="sm"`——ui.css 自己那段尺寸等级注释也写着
  「sm（表格行内动作、弹层页脚）」。结果每个操作列都比按钮实际需要宽 20~25%
  （踢下线 112px、编辑|重置密码|删除 286px）。
  常数还与本包 ui.css 对不上：本包 `.vui-button` 是 `padding: 0 14px` / `min-width: 64px`，
  不是注释里写的 `0 16px` / 72px，说明这组常数停留在更早的 ui-v3。
- **改了什么**（`dist/index.js` 里被压缩成 `cl / dl / ml` 三处）：

  | 常量 | 原值 | 现值 | 依据（本包 ui.css） |
  |---|---|---|---|
  | `BUTTON_MIN_WIDTH` | 72 | **54** | `.vui-button-sm { min-width: 54px }` |
  | `BUTTON_FRAME_WIDTH` | 34 | **22** | `.vui-button-sm { padding-inline: 10px }` + 1px 边框 ×2 |
  | 全角字宽 | 14 | **12** | `.vui-button-sm { font-size: 12px }`，全角 = 1em |
  | 半角字宽 | 8 | **7** | ≈0.58em，与原口径同法（原为 8/14em） |

  `BUTTON_GAP`(8)、`CELL_PADDING_X`(28)、`OPERATION_COLUMN_MIN_WIDTH`(88) 未动。
- **效果**（SSR 实测操作列渲染宽度）：

  | 按钮 | 改前 | 改后 |
  |---|---|---|
  | 踢下线 | 112px | 94px |
  | 编辑 \| 重置密码 \| 删除 | 286px | 230px |
  | 数据 \| 编辑 \| 删除 | 268px | 214px |
  | 编辑 \| 删除 | 188px | 152px |

- **推回上游时**：本质是这组常数该跟着按钮 size 走。上游更好的解法是让
  `operationCellWidth` 收 size 参数（或从按钮 vnode 的 `size` prop 推），
  而不是把常数在 md / sm 之间二选一。
- **风险**：若某页操作列改用 md 按钮，算出的宽度会偏窄、按钮被挤。
  因此 `templates/admin/planning/coding-standards.md` 里把「行内动作按钮一律 `size="sm"`」
  写成了规范条目。
