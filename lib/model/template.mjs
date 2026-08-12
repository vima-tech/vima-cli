// 模板模型：templates/<id>/template.json 加载（internal-contracts §5 / §6.3）
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { VimaError, EXIT } from '../util/errors.mjs';
import { loadManifest } from './manifest.mjs';
import { loadLifecycle } from './lifecycle.mjs';

/** 模板根目录：<cliRoot>/templates。 */
export function templatesRoot(cliRoot) {
  return path.join(cliRoot, 'templates');
}

/**
 * 列出全部可用模板（含 template.json 的子目录），按 id 稳定排序。
 * @returns {Promise<Array<{id: string, name: string, status: string, description: string}>>}
 */
export async function listTemplates(cliRoot) {
  const root = templatesRoot(cliRoot);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let text;
    try {
      text = await readFile(path.join(root, entry.name, 'template.json'), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') continue; // 没有 template.json 的目录不是模板
      throw err;
    }
    const json = parseTemplateJson(text, entry.name);
    out.push({
      id: json.id ?? entry.name,
      name: json.name ?? entry.name,
      status: json.status ?? 'preview',
      description: json.description ?? '',
    });
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * 加载指定模板的 template.json，附带 dir（模板绝对目录）。
 * @throws VimaError('NO_TEMPLATE', exitCode 3) 未知模板 id
 */
export async function loadTemplate(cliRoot, id) {
  const dir = path.join(templatesRoot(cliRoot), id);
  let text;
  try {
    text = await readFile(path.join(dir, 'template.json'), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new VimaError('NO_TEMPLATE', `未知模板 "${id}"（用 vima create 查看可用模板）`, {
        path: `templates/${id}/template.json`,
        exitCode: EXIT.USAGE,
      });
    }
    throw err;
  }
  return { ...parseTemplateJson(text, id), dir };
}

function parseTemplateJson(text, id) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new VimaError('TEMPLATE_PARSE', `模板 "${id}" 的 template.json 解析失败: ${err.message}`, {
      path: `templates/${id}/template.json`,
    });
  }
}

/**
 * 读取项目使用的模板 id：manifest.templateId ?? lifecycle.templateId ?? null。
 * 两个文件都缺失时返回 null（不抛错）。
 */
export async function readProjectTemplateId(root) {
  const manifest = await loadManifest(root);
  if (manifest && typeof manifest.templateId === 'string') return manifest.templateId;
  try {
    const lifecycle = await loadLifecycle(root);
    return typeof lifecycle.templateId === 'string' ? lifecycle.templateId : null;
  } catch (err) {
    if (err instanceof VimaError && err.code === 'NO_LIFECYCLE') return null;
    throw err;
  }
}
