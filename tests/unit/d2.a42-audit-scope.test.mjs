// A42 接缝对账的模板侧防漂移（D-A42-04 / D-A42-05）：
// 两处纪律都只活在模板文字里，没有机检就会在下一次改模板时被顺手抹掉。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN = path.join(ROOT, 'templates', 'admin');
const read = (...parts) => readFile(path.join(ADMIN, ...parts), 'utf8');

test('D-A42-05：code-audit 模板把扫描面收敛到带 @vima 标注的文件，且逐项写明作用域', async () => {
  const audit = await read('planning', '_template-code-audit.md');
  assert.match(audit, /扫描面\s*=\s*带\s*`@vima <taskId>`\s*标注的文件/, 'code-audit 须显式声明扫描面');
  assert.match(audit, /同一口径/, '须写明与 V-CODE 规则族同口径');
  assert.match(audit, /traceability\.mjs/, '须给出作用域纪律的出处');
  assert.match(audit, /骨架/, '须点名 vima create 骨架不在扫描面内');
  // 「每条受影响的验收项都要写清作用域」——只在开头写一句总的不算数。
  const checklist = audit.split('## 验收清单')[1].split('## ')[0];
  const scoped = checklist.split('\n').filter((l) => l.startsWith('- [ ]') && l.includes('标注文件内'));
  assert.equal(scoped.length, 4, '共享层/编码规范/non-goals/残留四项验收都须标注作用域');
});

test('D-A42-04：verifier 模板给出 contractGaps 通道，并讲清与 contractViolations 的分界', async () => {
  const verifier = await read('workspace', 'agents', 'vima-verifier.md');
  assert.match(verifier, /contractGaps/, 'verifier 报告须有 contractGaps 通道');
  assert.match(verifier, /可选.*缺省\s*`\[\]`/, 'contractGaps 须声明可选、缺省 []');
  assert.match(verifier, /不计 fail/, 'contractGaps 不计 fail');
  assert.match(verifier, /真越界/, 'contractViolations 保持「真越界」原义');
  assert.match(verifier, /不确定填哪个就填\s*`contractViolations`/, '不确定时必须落在计 fail 的一侧');
  assert.match(verifier, /attachmentId/, '须带 page-68-fe 实证范例，避免抽象定义被各自解读');
});
