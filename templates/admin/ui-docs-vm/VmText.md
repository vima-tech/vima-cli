# VmText · 文本层级

> 类：`vm-t1` `vm-t2` `vm-t3` `vm-en` `vm-note` `vm-meta` `vm-ellipsis`

## 用途

统一字号与颜色层级，页面里**不要自己写 font-size / color**。

| 类 | 用在哪 |
|---|---|
| `vm-t1` | 卡片主标题（15px / 800） |
| `vm-t2` | 列表项标题（13px / 700） |
| `vm-t3` | 正文（14px / 600） |
| `vm-note` | 补充说明（11px 弱色） |
| `vm-meta` | 时间、编号等元信息（11px 最弱色） |
| `vm-en` | 英文缀标（9.5px 大字距） |
| `vm-ellipsis` | 单行截断（配合定宽容器） |

## 结构

```html
<text class="vm-t2 vm-ellipsis">{{item.title}}</text>
<text class="vm-meta">{{item.updatedAt}}</text>
```

## 不要这样用

- **不要用颜色表达状态**（把文字改红表示「异常」）：状态用 `VmChip`，
  颜色在小屏 + 强光下辨识度差，且色盲用户读不到。
- `vm-ellipsis` 要生效，父容器必须有确定宽度（`flex: 1` + `min-width: 0`）。
