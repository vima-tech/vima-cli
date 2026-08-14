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

---

## P2 · `.vui-page` 末个子元素的收缩下限按「有无内部滚动」区分

- **日期**：2026-08-14
- **改的文件**：`dist/styles/components.css`
- **为什么**：原规则 `.vui-page > :last-child { flex: 1 1 auto; min-height: 0 }` 允许末块
  一路压到 `clientHeight = 0`。而 `.vui-card` 自身 `overflow: hidden`（圆角裁切），
  于是「前面几块已占满页面」的页面上，末块内容**既看不见也滚不出来**——0 高的块
  不给页面贡献 `scrollHeight`，`.vui-page` 的 `overflow: auto` 连滚动条都不出现。
  逐页冒烟实测两例：

  | 页面 | 末块 | 内容高 | 实际可见高 |
  |---|---|---|---|
  | `/ai/advisor` | 「历史建议」表格卡（外包一层 `<section class="ai-block">`） | 401px | **0** |
  | `/inpatient-order/create` | 「长嘱信息」卡（直接就是 `.vui-card`） | 80px | **0** |

- **改了什么**：

  | 选择器 | 原 `min-height` | 现值 |
  |---|---|---|
  | `.vui-page > :last-child` | `0` | `min-content` |
  | `.vui-page > .vui-card:last-child` | （未声明，继承上条的 0） | `var(--vui-page-card-min-h, 120px)` |

  分两条的依据是**这一块有没有内部滚动**：`.vui-page > .vui-card:last-child` 那组规则
  会把高度传进卡身（`.vui-card-body { overflow: auto }`），卡片被压小仍能内部滚动，
  所以允许压——这正是「100 行表格不把页面顶出滚动条」赖以成立的前提，不能改成
  `min-content`，只需一个还看得见卡头的下限。而页面把卡片包了一层时（`ai-block`），
  那组规则匹配不上、内部滚动链断掉，被压小就等于内容丢失，必须保住 `min-content`，
  由 `.vui-page` 的 `overflow: auto` 兜住。

- **推回上游时**：上游更好的解法可能是让「高度传递」不再要求卡片是**直接**子元素
  （例如允许 `.vui-page > :last-child > .vui-card:only-child` 同样打通链路），
  那样非卡片包装层也能获得内部滚动，`min-content` 这条兜底就可以收窄。
- **风险**：末块取 `min-content` 后，内容确实很高的页面会出现页面级滚动条
  （原先是内容被悄悄裁掉）。这是有意的取舍——可滚动优于不可见。

---

## P3 · `VTab.type` 的说明只对 card/segment 声明了「纯切换器」，实际三种都是

- **日期**：2026-08-14
- **改的文件**：`dist/ai-manifest.json`
- **为什么**：原描述是「…segment 为胶囊分段（**card/segment** 作纯切换器用，内容放在 VTab 之后）」，
  读起来就是「留空（下划线）这一种可以把内容放进 VTabItem 插槽」。实际上
  components.css 自己的注释写明**三种变体共用同一套 DOM**
  （`.vui-tabs > .vui-tab-item > .vui-tab-title`），而 `.vui-tabs` 是
  `display:flex; overflow:auto` 的横向标题条、`.vui-tab-content` 全套样式表里
  **一条规则都没有**。
- **后果**（Sustain 实测两处，都是照着这句描述写的）：

  | 页面 | 激活项被撑到 | 标题条溢出 | 用户看到的 |
  |---|---|---|---|
  | 诊疗流程 PAGE-04 | 1025px | 445px | 九步只剩四步可见，其余要横向滚标题条 |
  | 患者档案 PAGE-03 | 702px | 204px | 「临床概况」与其余页签之间一道空档 |

  不报错、不留红字，很容易被当成设计如此——这正是它值得改文案的原因。
- **改了什么**：把约束改成对三种类型都成立，并写清机理与症状。
  同步在 `docs/ui-framework/VTab.md` / `VTabItem.md`（以及 vima-cli 的
  `templates/admin/ui-docs/` 同名文件）补了一节「用法约束（本地补充，非生成内容）」——
  那两份 md 头部写着「生成自 api.generated.json，勿手改」，**组件库升级重新生成时要把这节补回来**。
- **推回上游时**：更好的解法是组件干脆不渲染 `.vui-tab-content`（既然没有任何样式支撑），
  让误用在开发时就显形；或者补齐样式让插槽真正可用（`.vui-tabs` 换成两段式 DOM：
  标题条一行、面板另起一块）。二选一，别停在「文档说清楚」。
