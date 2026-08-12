#!/usr/bin/env bash
# vima-cli 日常开发脚本：跑单测、起沙箱、拉起沙箱、体检、清理。
#
# 沙箱产物统一落在仓库根的 .sandbox/<模板 id>/<项目名>/（已 gitignore），
# 按模板 id 分目录互不干扰；模板列表在运行时从 templates/*/template.json 读取，
# 启动方式按沙箱里实际存在的产物识别（package.json / backend/pom.xml），
# 因此后续新增模板无需改本脚本。
#
# 零外部依赖：只用 node / npm / git 与模板自带的 mvnw。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="$ROOT/.sandbox"
VIMA=(node "$ROOT/bin/vima.mjs")

info() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: scripts/dev.sh <子命令> [参数]

  ls                        列出全部模板（id / 状态 / 名称）
  test [关键字]             跑本仓库单测；带关键字则只跑文件名匹配的用例
  new <模板> [项目名] [选项] 在 .sandbox/<模板>/<项目名> 起盘并执行 vima init
  up  <模板> [项目名] [选项] 拉起沙箱项目（自动识别后端 / 前端，Ctrl-C 一起停）
  sync <模板> [项目名] [选项] 把 templates/ 的改动增量同步进已存在的沙箱
  cli <模板> [项目名] -- ... 在沙箱目录里跑任意 vima 子命令
  check <模板> [项目名]      沙箱体检：vima doctor + vima validate
  clean [模板]              删除沙箱（不带参数删整个 .sandbox/）

new 的选项:
  --no-install   跳过 npm install（起盘更快，但 up 之前需要自己装依赖）
  --force        目标目录已存在时覆盖

sync 的选项:
  --watch        持续监听 templates/<模板>/，改一次同步一次（配合 vite HMR）
  --dry-run      只列出差异不写盘（也用来看沙箱里有哪些本地改动没回模板）
  --force        沙箱侧被手改过的文件也以模板为准覆盖

up 的选项:
  --no-sync      启动前不做同步、也不开监听（默认：先同步一次并后台监听）

默认项目名为 <模板>-demo。典型改模板闭环：
  scripts/dev.sh new admin        # 起盘一次
  scripts/dev.sh up admin         # 拉起服务 + 监听模板改动，改 templates/ 浏览器即刻可见
  scripts/dev.sh sync admin --dry-run   # 看看沙箱里有哪些改动还没回模板
  scripts/dev.sh test yaml
  scripts/dev.sh cli admin -- plan --dry-run
EOF
}

# ── 模板发现（运行时读 templates/*/template.json，不硬编码 id）───────────────
list_templates() {
  node -e '
const fs = require("node:fs"), path = require("node:path");
const dir = process.argv[1];
for (const id of fs.readdirSync(dir).sort()) {
  const f = path.join(dir, id, "template.json");
  if (!fs.existsSync(f)) continue;
  const t = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log([t.id ?? id, t.status ?? "?", t.name ?? "", t.description ?? ""].join("\t"));
}' "$ROOT/templates"
}

template_ids() { list_templates | cut -f1; }

require_template() {
  local tpl="${1:-}"
  [ -n "$tpl" ] || die "缺少模板 id（可选：$(template_ids | tr '\n' ' ')）"
  template_ids | grep -qx -- "$tpl" ||
    die "未知模板 \"$tpl\"（可选：$(template_ids | tr '\n' ' ')）"
}

# 解析 <模板> [项目名]，把 PROJ/TPL/NAME 三个变量填好
resolve_proj() {
  require_template "${1:-}"
  TPL="$1"
  NAME="${2:-$TPL-demo}"
  PROJ="$SANDBOX/$TPL/$NAME"
}

# ── 子命令 ──────────────────────────────────────────────────────────────────
cmd_ls() {
  printf '%-8s %-8s %s\n' "ID" "状态" "名称 / 说明"
  list_templates | while IFS=$'\t' read -r id status name desc; do
    printf '%-8s %-8s %s —— %s\n' "$id" "$status" "$name" "$desc"
  done
}

cmd_test() {
  local pattern="${1:-}"
  cd "$ROOT"
  if [ -z "$pattern" ]; then
    info "node --test（全量单测 + 端到端黄金链路）"
    exec node --test
  fi
  local files=()
  while IFS= read -r f; do files+=("$f"); done < <(find tests -name "*${pattern}*.test.mjs" | sort)
  [ ${#files[@]} -gt 0 ] || die "没有匹配 \"$pattern\" 的测试文件"
  info "node --test ${files[*]}"
  exec node --test "${files[@]}"
}

cmd_new() {
  local args=() create_flags=()
  for a in "$@"; do
    case "$a" in
      --no-install|--force) create_flags+=("$a") ;;
      -*) die "未知选项 $a（见 scripts/dev.sh 帮助）" ;;
      *) args+=("$a") ;;
    esac
  done
  resolve_proj "${args[@]:-}"

  if [ -d "$PROJ" ] && [[ ! " ${create_flags[*]-} " =~ " --force " ]]; then
    die "沙箱已存在：${PROJ#"$ROOT"/}（覆盖请加 --force，或先 scripts/dev.sh clean $TPL）"
  fi

  mkdir -p "$SANDBOX/$TPL"
  info "起盘 $TPL → ${PROJ#"$ROOT"/}"
  # --no-git：沙箱不需要嵌套 git 仓库；.sandbox/ 整体已被根 .gitignore 忽略
  (cd "$SANDBOX/$TPL" && "${VIMA[@]}" create "$NAME" --template "$TPL" --no-git ${create_flags[@]+"${create_flags[@]}"})

  info "部署 Claude Code 工作环境：vima init"
  if (cd "$PROJ" && "${VIMA[@]}" init); then
    ok "沙箱就绪：${PROJ#"$ROOT"/}"
  else
    warn "vima init 未通过——preview 模板尚无 planning 资产时这是预期行为（A5 能力诚实分级）"
  fi
  echo
  echo "下一步：scripts/dev.sh up $TPL $NAME"
}

cmd_sync() {
  local args=() flags=()
  for a in "$@"; do
    case "$a" in
      --watch|--dry-run|--force) flags+=("$a") ;;
      -*) die "未知选项 $a（见 scripts/dev.sh 帮助）" ;;
      *) args+=("$a") ;;
    esac
  done
  resolve_proj "${args[@]:-}"
  [ -d "$PROJ" ] || die "沙箱不存在：${PROJ#"$ROOT"/}（先执行 scripts/dev.sh new $TPL）"
  info "同步 templates/$TPL → ${PROJ#"$ROOT"/}"
  node "$ROOT/scripts/sync.mjs" "$TPL" "$PROJ" ${flags[@]+"${flags[@]}"}
}

cmd_up() {
  local args=() do_sync=1
  for a in "$@"; do
    case "$a" in
      --no-sync) do_sync=0 ;;
      -*) die "未知选项 $a（见 scripts/dev.sh 帮助）" ;;
      *) args+=("$a") ;;
    esac
  done
  resolve_proj "${args[@]:-}"
  [ -d "$PROJ" ] || die "沙箱不存在：${PROJ#"$ROOT"/}（先执行 scripts/dev.sh new $TPL）"

  # 启动前先把 templates/ 的改动搬进沙箱，避免跑的是上次起盘时的旧骨架
  if [ $do_sync -eq 1 ]; then
    info "同步 templates/$TPL → 沙箱"
    node "$ROOT/scripts/sync.mjs" "$TPL" "$PROJ"
  fi

  # 打开 job control：每个后台任务自成进程组，退出时可以按进程组整棵杀掉，
  # 否则 npm run dev 被杀而它 fork 的 vite 会残留、继续占着 5173。
  set -m
  local pids=() started=0
  cleanup() {
    trap - INT TERM EXIT
    local p
    for p in ${pids[@]+"${pids[@]}"}; do
      kill -TERM -"$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  }
  trap cleanup INT TERM EXIT

  mkdir -p "$PROJ/.devlog"

  # 后端：模板自带 mvnw + pom.xml 才拉起（admin 默认 H2 内存库，无需外部数据库）。
  # 注意 admin 模板的 mvnw 只是转发到系统 mvn 的壳，不会自举下载 Maven，故两者都要在。
  if [ -f "$PROJ/backend/pom.xml" ] && [ -x "$PROJ/backend/mvnw" ]; then
    if ! command -v java >/dev/null 2>&1; then
      warn "未装 java，跳过后端（前端调接口会 502）"
    elif ! command -v mvn >/dev/null 2>&1; then
      warn "未装 maven，跳过后端（模板的 mvnw 只转发系统 mvn，不会自举下载）"
    else
      info "后端 :8080 → ${PROJ#"$ROOT"/}/.devlog/backend.log"
      (cd "$PROJ/backend" && ./mvnw -q spring-boot:run) >"$PROJ/.devlog/backend.log" 2>&1 &
      pids+=($!)
      started=1
    fi
  fi

  # 前端：根 package.json 有 dev 脚本才拉起
  if [ -f "$PROJ/package.json" ] && node -e 'process.exit(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).scripts?.dev?0:1)' "$PROJ/package.json"; then
    if [ ! -d "$PROJ/node_modules" ]; then
      info "首次运行，安装前端依赖（npm install）…"
      (cd "$PROJ" && npm install)
    fi
    info "前端 :5173"
    (cd "$PROJ" && npm run dev) &
    pids+=($!)
    started=1
  fi

  # 模板监听：改 templates/<模板>/ → 增量写进沙箱 → vite HMR 直接刷新。
  # 变更清单直接打在终端，与 vite 的 hmr update 行交叉出现，改哪看哪。
  if [ $do_sync -eq 1 ] && [ $started -eq 1 ]; then
    node "$ROOT/scripts/sync.mjs" "$TPL" "$PROJ" --watch &
    pids+=($!)
  fi

  if [ $started -eq 0 ]; then
    warn "沙箱里没有可启动的服务（preview 模板只有 README 骨架）"
  else
    info "Ctrl-C 停止全部"
    wait || true
  fi
  cleanup
}

cmd_cli() {
  local args=() rest=() seen_sep=0
  for a in "$@"; do
    if [ $seen_sep -eq 0 ] && [ "$a" = "--" ]; then seen_sep=1; continue; fi
    if [ $seen_sep -eq 1 ]; then rest+=("$a"); else args+=("$a"); fi
  done
  resolve_proj "${args[@]:-}"
  [ -d "$PROJ" ] || die "沙箱不存在：${PROJ#"$ROOT"/}"
  [ ${#rest[@]} -gt 0 ] || die "用法：scripts/dev.sh cli $TPL [项目名] -- <vima 子命令> [参数]"
  info "在 ${PROJ#"$ROOT"/} 执行：vima ${rest[*]}"
  (cd "$PROJ" && "${VIMA[@]}" "${rest[@]}")
}

cmd_check() {
  resolve_proj "$@"
  [ -d "$PROJ" ] || die "沙箱不存在：${PROJ#"$ROOT"/}（先执行 scripts/dev.sh new $TPL）"
  local rc=0
  info "vima doctor"
  (cd "$PROJ" && "${VIMA[@]}" doctor) || rc=$?
  echo
  info "vima validate"
  (cd "$PROJ" && "${VIMA[@]}" validate) || rc=$?
  echo
  if [ $rc -eq 0 ]; then
    ok "沙箱体检通过"
  else
    warn "体检有未通过项（退出码 $rc）——刚起盘的项目 spec 只是骨架，validate 未过属预期"
  fi
  return 0
}

cmd_clean() {
  local target="$SANDBOX"
  if [ -n "${1:-}" ]; then
    require_template "$1"
    target="$SANDBOX/$1"
  fi
  [ -d "$target" ] || { ok "没有可清理的沙箱：${target#"$ROOT"/}"; return 0; }
  info "删除 ${target#"$ROOT"/}"
  rm -rf "$target"
  ok "已清理"
}

# ── 入口 ────────────────────────────────────────────────────────────────────
sub="${1:-help}"
shift || true
case "$sub" in
  ls)            cmd_ls "$@" ;;
  test)          cmd_test "$@" ;;
  new)           cmd_new "$@" ;;
  up)            cmd_up "$@" ;;
  sync)          cmd_sync "$@" ;;
  cli)           cmd_cli "$@" ;;
  check)         cmd_check "$@" ;;
  clean)         cmd_clean "$@" ;;
  help|-h|--help) usage ;;
  *)             usage; die "未知子命令 \"$sub\"" ;;
esac
