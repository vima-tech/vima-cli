// Sustain 四页 A34 发布硬门。浏览器与像素比较属于 workspace/验收层，不进入 lib/。
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(HERE, '../fixtures/sustain-a34/manifest.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--') || i + 1 >= argv.length) throw new Error(`参数不完整：${key}`);
    out[key.slice(2)] = argv[++i];
  }
  if (!out['project-root'] || !out['base-url']) {
    throw new Error('用法：sustain-a34.mjs --project-root <Sustain> --base-url <url> [--storage-state <json>]');
  }
  return out;
}

function gitShow(root, commit, rel) {
  return spawnSync('git', ['show', `${commit}:${rel}`], { cwd: root, encoding: null });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizedRmse(baseline, actual) {
  const r = spawnSync('compare', ['-metric', 'RMSE', baseline, actual, 'null:'], { encoding: 'utf8' });
  const match = String(r.stderr).match(/\((\d+(?:\.\d+)?)\)/);
  if (!match) throw new Error(`ImageMagick compare 无法解析：${r.stderr || r.stdout}`);
  return Number(match[1]);
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  return require(process.env.VIMA_PLAYWRIGHT_PATH || 'playwright');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args['project-root']);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const findings = [];

  const resolved = spawnSync('git', ['rev-parse', manifest.baseline.ref], { cwd: projectRoot, encoding: 'utf8' });
  if (resolved.status !== 0 || resolved.stdout.trim() !== manifest.baseline.commit) {
    findings.push(`baseline ref 漂移：${manifest.baseline.ref} != ${manifest.baseline.commit}`);
  }
  for (const page of manifest.pages) {
    const source = gitShow(projectRoot, manifest.baseline.commit, page.baselineSource);
    if (source.status !== 0 || sha256(source.stdout) !== page.baselineSourceSha256) {
      findings.push(`${page.pageId} 旧版源码基线缺失或漂移：${page.baselineSource}`);
    }
  }
  const artifact = path.join(projectRoot, manifest.baseline.claudeDesignArtifact.path);
  const artifactData = await readFile(artifact).catch(() => null);
  if (!artifactData || sha256(artifactData) !== manifest.baseline.claudeDesignArtifact.sha256) {
    findings.push('Claude Design 原型冻结物缺失或哈希漂移');
  }
  if (findings.length > 0) throw new Error(findings.join('\n'));

  const { chromium } = loadPlaywright();
  const reportDir = path.join(projectRoot, '.vima/reports/sustain-a34');
  const shotDir = path.join(reportDir, 'shots');
  await mkdir(shotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  });
  try {
    const context = await browser.newContext({
      viewport: { width: manifest.viewport.width, height: manifest.viewport.height },
      deviceScaleFactor: manifest.viewport.deviceScaleFactor,
      ...(args['storage-state'] ? { storageState: path.resolve(args['storage-state']) } : {}),
    });
    const page = await context.newPage();
    for (const sample of manifest.pages) {
      const url = new URL(sample.targetRoute, args['base-url']).href;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator(`[data-page="${sample.pageId}"]`).waitFor({ state: 'visible', timeout: 15000 });

      for (const selectors of sample.requiredSelectorGroups) {
        let visible = false;
        for (const selector of selectors) {
          if (await page.locator(selector).first().isVisible().catch(() => false)) { visible = true; break; }
        }
        if (!visible) findings.push(`${sample.pageId} 缺标志性结构：${selectors.join(' OR ')}`);
      }
      for (const selector of sample.forbiddenSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          findings.push(`${sample.pageId} 命中 CRUD/表达降级结构：${selector}`);
        }
      }

      const actual = path.join(shotDir, `${sample.pageId}.impl.png`);
      const baseline = path.join(projectRoot, 'docs/review/design', sample.pageId, 'default.png');
      await page.screenshot({ path: actual, fullPage: false });
      try {
        const rmse = normalizedRmse(baseline, actual);
        if (rmse > manifest.maxNormalizedRmse) {
          findings.push(`${sample.pageId} 未达批准稿：normalized RMSE ${rmse} > ${manifest.maxNormalizedRmse}`);
        }
      } catch (err) {
        findings.push(`${sample.pageId} 无法完成视觉比较：${err.message}`);
      }

      const rememberedNodes = new Map();
      try {
        for (const step of sample.steps) {
          const locator = page.locator(step.selector).first();
          if (step.action === 'click') await locator.click({ timeout: 10000 });
          else if (step.action === 'fill') await locator.fill(step.value, { timeout: 10000 });
          else if (step.action === 'expect-visible') await locator.waitFor({ state: 'visible', timeout: 10000 });
          else if (step.action === 'expect-text') {
            await page.waitForFunction(
              ({ selector, value }) => document.querySelector(selector)?.textContent?.includes(value),
              { selector: step.selector, value: step.value },
              { timeout: 10000 },
            );
          } else if (step.action === 'remember-node') {
            rememberedNodes.set(step.key, await locator.elementHandle());
          } else if (step.action === 'expect-same-node') {
            const before = rememberedNodes.get(step.key);
            const same = before && await locator.evaluate((element, previous) => element === previous, before);
            if (!same) throw new Error(`${step.key} 在主任务中被重挂载`);
          } else {
            throw new Error(`未知场景动作 ${step.action}`);
          }
        }
      } catch (err) {
        await page.screenshot({ path: path.join(shotDir, `${sample.pageId}.failure.png`), fullPage: false }).catch(() => {});
        findings.push(`${sample.pageId} primaryTask 未完成（${sample.scenarioId}）：${err.message}`);
      }
    }
    await context.close();
  } catch (err) {
    findings.push(`浏览器链路失败：${err.message}`);
  } finally {
    await browser.close().catch(() => {});
  }

  const report = {
    schemaVersion: '1', baselineCommit: manifest.baseline.commit,
    viewport: manifest.viewport, mockProfile: manifest.mockProfile,
    pages: manifest.pages.map((p) => ({ pageId: p.pageId, scenarioId: p.scenarioId, primaryTask: p.primaryTask })),
    findings, pass: findings.length === 0,
  };
  await mkdir(reportDir, { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${report.pass ? '✅' : '❌'} Sustain A34：${manifest.pages.length} 页，缺口 ${findings.length} 项\n`);
  for (const finding of findings) process.stdout.write(`  - ${finding}\n`);
  process.exitCode = report.pass ? 0 : 2;
}

main().catch((err) => {
  process.stderr.write(`sustain-a34: ${err.message}\n`);
  process.exitCode = 2;
});
