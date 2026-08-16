# 发布流程

> **v4 尚未发布。** `ci.yml` 与 `release.yml` 已随重写更新（见下方复核清单），
> 但整条链路还没在 v4 上真跑过一次。

发布由 tag 触发。版本落点在 v4 里**只有 `package.json` 的 `version` 一处**，
`release.yml` 的 "Sync version from tag" 会把它强制对齐到 tag。
所以 tag 与包版本不可能不一致，**v4 不需要「打 tag 前先 bump」这一步**。

v3 需要那一步，是因为当时有第二处落点（`lib/model/lifecycle.mjs` 的 `vimaVersion`），
`tests/unit/f.model.test.mjs` 锁定两者相等，不先 bump 就会在 `prepublishOnly` 挂掉。
v4 把 `lib/model/` 整个删了，第二处落点和那条锁一起消失——**不是丢了防护，
是不再需要防护**：一处真源没有对不上的可能。

反过来说：**tag 就是版本真源，打错 tag 就是发错版本，没有任何东西会拦你。**
所以本文里的命令示例一律用 `vX.Y.Z` 占位，不写具体版本号——
照抄一条带真版本号的命令会真的把那个版本发出去。

（CHANGELOG 仍要手动把 Unreleased 段移入新版本号，这一步没变。）

## 发布一个版本

```bash
git checkout main && git pull
# 1) 把 CHANGELOG 的 Unreleased 段落移入新版本号，提交并推送
# 2) 打 tag —— 格式 v*.*.*，它就是版本真源
git tag vX.Y.Z
git push origin vX.Y.Z
```

推送 tag 后 `release.yml` 自动执行：

1. 跑 `npm test` 与 `npm run smoke`（publish 前 `prepublishOnly` 还会各再跑一次）；
2. 把 `package.json` 的 version 同步为 tag 版本；
3. 幂等检查：该版本已在 npm 上则跳过 publish（重跑 workflow 不会失败）；
4. `npm publish --provenance --access public` 发布 `@vima-tech/cli`；
5. 创建 GitHub Release，release notes 由 commit 历史自动生成。

## 验证发布结果

```bash
npm view @vima-tech/cli version
gh release view vX.Y.Z -R vima-tech/vima-cli
```

## 前置（一次性）

配置 `NPM_TOKEN`（仓库 Settings → Secrets and variables → Actions，
或组织级 secret 并把本仓库纳入可见范围）：

- npm Granular Access Token，对 `@vima-tech/cli` 有 Read and write 权限
  （发布使用 `--provenance`，需要公开仓库 + `package.json` 里有 `repository` 字段）。

## v4 首发前的复核清单

### 已核（2026-08-16）

- [x] **`ci.yml` 已随 v4 更新。** 原先跑 `npm run test:scaffold`，v4 里**没有这个脚本**
      ——CI 是坏的。已换成 `npm test` + `npm run smoke`，语法扫描范围加上 `templates/`
      （里面的 hook 是会真跑的代码，且从不被单测 import，语法错只会在真实会话里
      表现为「这个 hook 怎么没反应」）。三步都在本地验过。
- [x] **`release.yml` 已随 v4 更新。** 删掉为「三端真实构建」装的 Java 21
      （那个 job 在 v4 里不存在），补上 smoke 步骤。
- [x] **`prepublishOnly` 已补回**（`npm test && npm run smoke`）。v3 有、v4 重写时漏了；
      没有它，publish 与验证之间没有任何强制关系。
- [x] **`package.json` 的发布元数据已补回。** 重写时**丢掉**了
      `repository` / `publishConfig` / `author` / `homepage` / `bugs` / `keywords` 六个字段，
      其中 `repository` 是 `npm publish --provenance` 的前提——release.yml 正是用它发布。
      这类丢失不会有任何测试报错，只会在真发布那一刻炸。
      **重写时「该带没带」和「不该带带进来」一样危险，而前者更难发现。**
- [x] **`npm test` 的 glob 必须由 shell 展开**，写作 `node --test tests/unit/*.test.mjs`
      （**不加引号**）。三种写法各支持一半，改动前先读完这三行：
      - `node --test tests/unit/`（目录）→ Node ≥24 把目录当模块入口，直接崩
      - `node --test "tests/unit/*.test.mjs"`（引号）→ glob 原样传给 node，
        Node ≥22 自己认，**Node 20 不认**，报 `Could not find`
      - 不加引号 → npm 用 sh 跑脚本，sh 展开成文件列表，**所有版本都成立**
      第二种写法在本地（Node 24）全绿而 CI 的 Node 20 job 当场红——
      **本地跑得过不代表 engines 声明的下限跑得过**，这条是 v4 首发实测撞出来的。
- [x] **打包产物实装可用**（实跑 tarball，不是 `--dry-run`）：解包后
      `init → compile → audit` 全通，`.claude/{agents,hooks,skills,rules}` 与 `.mcp.json`
      都随包落地。`--dry-run` 只查文件清单，查不出装出来能不能用。**首发前重跑这一遍**：

      ```bash
      TGZ=$(npm pack --pack-destination /tmp | tail -1)
      mkdir -p /tmp/pkg /tmp/proj && tar -xzf "/tmp/$TGZ" -C /tmp/pkg --strip-components=1
      cd /tmp/proj && node /tmp/pkg/bin/vima.mjs init && node /tmp/pkg/bin/vima.mjs compile
      ```

- [x] **dist-tag 已按版本号自动定。** `release.yml` 的判据：版本号里带 `-`（预发布）
      → `--tag next`，否则 `latest`。
      **npm 不看版本号里有没有 `-alpha`**，不显式给 `--tag` 就写 `latest`——
      而预发布版占了 `latest` 不可撤销：老用户 `npm i -g` 会被自动升到一个
      没有迁移路径的版本，且 npm 不允许重发同一版本号来补救。

### 稳定后怎么升 latest

alpha 验证够了之后，**不是**重发一个版本，而是把标签指过去：

```bash
npm dist-tag add @vima-tech/cli@<版本> latest
```

升之前先确认 v3 → v4 的迁移路径已经有了（P1-6），否则老用户升上来会发现
自己的 `docs/lifecycle.json`、任务文件、manifest 一个都读不了。
