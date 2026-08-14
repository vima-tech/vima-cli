# vendor 本地改动清单

本目录是 `@vima-tech/ui-h5` 的 vendor 副本。与 `vendor/vima-ui-admin` 同款纪律：
**生成项目里不要改 `dist/` 下的任何文件**——需要覆盖就在自己的 css 里重定义令牌或
追加类，改 vendor 会在下次 `vima update` 拉新版时被静默盖掉。

特别注意：`dist/tokens.css`、`dist/ui.css`、`dist/themes/*.css` 与小程序端
`vima-ui-mp` 的同名 `.wxss` 是**同一份内容**（只把出现的 `wxss` 字样换成 `css`），
由 vima-cli 单测锁死。在这里单独改一行，下次跑测试就会红——这正是它该有的行为：
同一套企业 UI 不允许有两套定义。要改就改上游，两端一起走。

---

（暂无本地改动）
