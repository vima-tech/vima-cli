// admin 脚手架权限码三边对账（确定性机检，替代人工 grep）：
// 前端 v-auth/hasPerm 用到的码 ⊆ 后端 @PreAuthorize 注解声明的码 ⊆ DataInitializer 种子的码，
// 且全部满足 模块:实体:动作 格式。三边任何一边手滑（拼错/漏种/漏注解）在这里直接红。
// 权限码是字符串字面量对暗号：错一个字母不报错、只静默失效，所以必须锁成测试。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAFFOLD = path.join(CLI_ROOT, 'templates', 'admin', 'scaffold');
const PERM_FORMAT = /^[a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*$/;

async function walk(dir, ext) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p, ext)));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out;
}

async function collect(files, regex) {
  const found = new Set();
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    for (const m of src.matchAll(regex)) found.add(m[1]);
  }
  return found;
}

// 后端：controller 目录下 @PreAuthorize("@perm.has('...')") 的字面量
async function backendPerms() {
  const dir = path.join(SCAFFOLD, 'backend', 'src', 'main', 'java', 'com', '{{projectPkg}}', 'controller');
  return collect(await walk(dir, '.java'), /@PreAuthorize\("@perm\.has\('([^']+)'\)"\)/g);
}

// 种子：DataInitializer 里出现的全部三段码（createPage/createButton/setPerms 的双引号字面量）
async function seedPerms() {
  const file = path.join(SCAFFOLD, 'backend', 'src', 'main', 'java', 'com', '{{projectPkg}}', 'config', 'DataInitializer.java');
  return collect([file], /"([a-z][a-zA-Z0-9]*:[a-zA-Z0-9]+:[a-zA-Z0-9]+)"/g);
}

// 前端：.vue 模板里的 v-auth="'...'" / v-auth="['...',...]" 与 hasPerm('...')（'*' 通配除外）
async function frontendPerms() {
  const files = await walk(path.join(SCAFFOLD, 'frontend', 'src'), '.vue');
  const found = new Set();
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    for (const m of src.matchAll(/v-auth="(?:'([^']+)'|\[([^\]]+)\])"/g)) {
      if (m[1]) found.add(m[1]);
      else for (const item of m[2].matchAll(/'([^']+)'/g)) found.add(item[1]);
    }
    for (const m of src.matchAll(/hasPerm\('([^']+)'\)/g)) {
      if (m[1] !== '*') found.add(m[1]);
    }
  }
  return found;
}

test('后端注解权限码全部满足 模块:实体:动作 格式', async () => {
  for (const perm of await backendPerms()) {
    assert.match(perm, PERM_FORMAT, `后端注解权限码格式非法：${perm}`);
  }
});

test('后端注解的每个权限码都已在 DataInitializer 种入（否则无法授给任何角色）', async () => {
  const seed = await seedPerms();
  for (const perm of await backendPerms()) {
    assert.ok(seed.has(perm), `后端 @perm.has('${perm}') 缺少对应种子菜单/按钮`);
  }
});

test('前端 v-auth/hasPerm 的每个权限码都有后端注解兜底（前端隐藏只是体验，403 才是边界）', async () => {
  const backend = await backendPerms();
  for (const perm of await frontendPerms()) {
    assert.ok(backend.has(perm), `前端权限码 '${perm}' 无后端 @PreAuthorize 对应`);
  }
});

test('种子权限码没有失去消费方的孤儿（防止改注解后种子漂移）', async () => {
  const backend = await backendPerms();
  for (const perm of await seedPerms()) {
    assert.ok(backend.has(perm), `种子权限码 '${perm}' 在后端注解中已不存在`);
  }
});
