// CLAUDE.md 是下沉纪律的最后一格：常驻但只是劝导。
//
// 上限是这个文件存在的理由。约束能下沉成资产（写不出非法的东西）就不做机检，
// 能做机检（写出来了会被指出来）就不写 skill，能写 skill 就不进 CLAUDE.md。
// 没有上限，这里会在半年内长成一份没人读的百条清单——上一代就是这么死的。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(REPO, 'templates', 'project', '.claude', 'CLAUDE.md');

const MAX_LINES = 40;
const MAX_RULES = 5;

test('CLAUDE.md 存在且不超过行数上限', async () => {
  const text = await readFile(FILE, 'utf8');
  const lines = text.split('\n');
  assert.ok(lines.length <= MAX_LINES,
    `CLAUDE.md ${lines.length} 行，上限 ${MAX_LINES}。超了先做下沉判断，别改上限。`);
});

test('元规则不超过五条 —— 超过就是下沉判断没做', async () => {
  const text = await readFile(FILE, 'utf8');
  const rules = text.split('\n').filter((l) => /^\d+\.\s+\*\*/.test(l));
  assert.ok(rules.length >= 2, '至少得有两条，否则这个文件没有存在意义');
  assert.ok(rules.length <= MAX_RULES,
    `${rules.length} 条元规则，上限 ${MAX_RULES}。能做成词表/机检/skill 的一律不留在这里。`);
});

test('留在这里的每条都得是「下沉不掉」的那类', async () => {
  const text = await readFile(FILE, 'utf8');
  // 判据写在文件自己的注释里，注释在 = 判据在，注释被删掉说明有人在绕过这道门
  assert.match(text, /资产.*机检.*skill.*CLAUDE\.md/s, '缺下沉阶梯说明');
  assert.match(text, /超过五条/, '缺条数上限的自陈');
});
