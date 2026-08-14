import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sustain-a34/manifest.json'), 'utf8'));

test('D-A34-25：Sustain 四页发布硬门固定来源、运行条件与主任务，不是漂移的页号清单', () => {
  assert.equal(manifest.baseline.ref, 'd6f4382^');
  assert.equal(manifest.baseline.commit, '8c54687e781224b65992b72679be07798e7c28a9');
  assert.match(manifest.baseline.claudeDesignArtifact.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.viewport, { width: 1600, height: 900, deviceScaleFactor: 1 });
  assert.equal(manifest.mockProfile, 'sustain-dense-clinical-v1');
  assert.deepEqual(manifest.pages.map((p) => [p.pageId, p.fidelity]), [
    ['PAGE-01', 'D1'], ['PAGE-03', 'D2'], ['PAGE-20', 'D2'], ['PAGE-23', 'D2'],
  ]);
  for (const page of manifest.pages) {
    assert.match(page.baselineSourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(page.baselineRoute.startsWith('/') && page.targetRoute.startsWith('/'));
    assert.ok(page.scenarioId && page.primaryTask);
    assert.ok(page.steps.length >= 2, `${page.pageId} 必须有可执行 primaryTask 步骤`);
    assert.ok(page.requiredSelectorGroups.length >= 3, `${page.pageId} 必须固定非 CRUD 的结构判据`);
    assert.ok(page.forbiddenSelectors.length > 0, `${page.pageId} 必须有表达降级否定判据`);
  }
});

test('Sustain 浏览器硬门脚本保持在 acceptance 层，含确定等待、失败截图结果与 finally 清理', async () => {
  const source = await readFile(path.join(ROOT, 'tests/acceptance/sustain-a34.mjs'), 'utf8');
  assert.match(source, /waitFor\(\{ state: 'visible'/);
  assert.match(source, /page\.screenshot/);
  assert.match(source, /normalizedRmse/);
  assert.match(source, /finally[\s\S]*browser\.close/);
  assert.doesNotMatch(source, /waitForTimeout|setTimeout/);
});
