# 发布流程

发布由 tag 触发。**打 tag 前必须先在仓库内把版本 bump 到目标版本**，
`release.yml` 里的 "Sync version from tag" 只是兜底校正，不能替代 bump——
`prepublishOnly` 会再跑一次 `npm test`，其中 `defaultLifecycle` 的 vimaVersion
被锁定必须等于 `package.json` 的 version（tests/unit/f.model.test.mjs）。
若两者不一致，publish 步骤必然失败。

需要一起改的两处（保持一致）：

- `package.json` 的 `version`
- `lib/model/lifecycle.mjs` 中 `defaultLifecycle()` 的 `vimaVersion`

## 前置（一次性）

配置 `NPM_TOKEN`（仓库 Settings → Secrets and variables → Actions，
或组织级 secret 并把本仓库纳入可见范围）：

- npm Granular Access Token，对 `@vima-tech/cli` 有 Read and write 权限
  （发布使用 `--provenance`，需要公开仓库 + npm Trusted Publishing 兼容的 token）。

## 发布一个版本

```bash
git checkout main && git pull
# 1) bump 两处版本 + 把 CHANGELOG 的 Unreleased 段落移入新版本号，提交并推送
# 2) 打 tag（格式必须是 v*.*.*，须与 package.json 版本一致）
git tag v2.0.1
git push origin v2.0.1
```

推送 tag 后 `release.yml` 自动执行：

1. 跑全部测试（`npm test`，publish 前 `prepublishOnly` 还会再跑一次）；
2. 把 package.json version 同步为 tag 版本（正常流程下应已一致，此步为兜底）；
3. 幂等检查：该版本已在 npm 上则跳过 publish（重跑 workflow 不会失败）；
4. `npm publish --provenance --access public` 发布 `@vima-tech/cli`；
5. 创建 GitHub Release，release notes 由 commit 历史自动生成。

## 验证发布结果

```bash
npm view @vima-tech/cli version
gh release view v2.0.1 -R vima-tech/vima-cli
```
