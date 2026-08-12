# 发布流程

发布由 tag 驱动，全自动。版本真源是 **git tag**（`release.yml` 会把 package.json 的
version 自动同步为 tag 版本，无需手动 bump）。

## 前置（一次性）

在仓库 Settings → Secrets and variables → Actions 中配置：

- `NPM_TOKEN`：npm Granular Access Token，对 `@vima-tech/cli` 有 Read and write 权限
  （发布使用 `--provenance`，需要公开仓库 + npm Trusted Publishing 兼容的 token）。

## 发布一个版本

```bash
git checkout main && git pull
git tag v2.0.1          # 格式必须是 v*.*.*
git push origin v2.0.1
```

推送 tag 后 `release.yml` 自动执行：

1. 跑全部测试（`npm test`，publish 前 `prepublishOnly` 还会再跑一次）；
2. 把 package.json version 同步为 tag 版本；
3. 幂等检查：该版本已在 npm 上则跳过 publish（重跑 workflow 不会失败）；
4. `npm publish --provenance --access public` 发布 `@vima-tech/cli`；
5. 创建 GitHub Release，release notes 由 commit 历史自动生成。

## 验证发布结果

```bash
npm view @vima-tech/cli version
gh release view v2.0.1 -R vima-tech/vima-cli
```
