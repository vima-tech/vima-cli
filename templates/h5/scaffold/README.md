# h5 模板（preview · 已被 h5-mobile kind 取代）

**别用这个模板。** 移动端 H5 的完整脚手架已经有了，但它不在这里——
它是 `admin` 模板的一个**端形态（kind）**，叫 `h5-mobile`（增补项 A25）。

原因：H5 端要和后端契约对账（`vima validate` 的 V-CODE-01、`consumers` 越权判定），
而独立 h5 模板没有后端也没有契约，这些机检全都无从谈起。
「一后端 × 多前端」是 A16 定下的模型，H5 天然是其中一个前端。

## 正确的建法

```bash
# 新项目：只要一个 H5 端（H5 落 apps/<id>/ + backend，A28）
vima create <name> -t admin --apps <id>:h5-mobile

# 新项目：多端并存
vima create <name> -t admin --apps admin:admin-web,h5:h5-mobile

# 存量项目：后补一个 H5 端（落 apps/<id>/，既有端零迁移）
vima app add <id> --kind h5-mobile
```

技术栈：Vue 3 + Vite + TypeScript + vendored `@vima-tech/ui-h5`
（与小程序端共用同一份 `.vm-*` 类契约与 `--vm-*` 令牌）。
