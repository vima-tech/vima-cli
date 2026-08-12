// vima context —— 任务上下文确定性打包（A8，契约 §6.11/§14；设计依据：市场对标报告
// docs/design/ai-scaffold-benchmarks.md §2.2 的三重收敛——上游编译、下游不自由检索）。
// 把一个任务开工所需的规划上下文机械汇编为单文件：任务原文 + 契约原文 + spec 页面块 +
// 按受限词表映射的组件文档切片 + 编码规范；stdout 输出分节字节计量。
// 上下文预算首次成为机检项：--budget 超限 → 包仍写盘（便于排查）但 exit 2。
// 确定性：内容只取输入文件，无时间戳——同输入必得同字节。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { VimaError, EXIT, usageError, checkFailed, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, fileExists } from '../util/fs.mjs';
import { extractBlocks } from '../util/md.mjs';
import { loadTasks } from '../model/tasks.mjs';

// 受限词表 → 组件映射（契约 §6.11 唯一依据，与 spec 词表 V-SPEC-04 同步演进）
const BLOCK_COMPONENTS = {
  table: ['VTable'],
  pagination: ['VPagination'],
  search: ['VForm', 'VFormItem'],
  form: ['VForm', 'VFormItem'],
  tabs: ['VTab', 'VTabItem'],
  cards: ['VCard'],
  toolbar: ['VButton'],
};
const TYPE_COMPONENTS = {
  input: ['VInput'],
  select: ['VSelect'],
  textarea: ['VTextarea'],
  number: ['VInputNumber'],
  date: ['VDatePicker'],
  time: ['VTimePicker'],
  radio: ['VRadioGroup', 'VRadio'],
  checkbox: ['VCheckboxGroup', 'VCheckbox'],
  switch: ['VSwitch'],
  button: ['VButton'],
  upload: ['VUpload'],
  tree: ['VTree'],
};

/** 从 vima:page 数据块收集应打包的组件名（去重排序，未知词静默跳过）。 */
export function componentsOfPage(page) {
  const names = new Set();
  const addAll = (list) => (list ?? []).forEach((n) => names.add(n));
  for (const word of Array.isArray(page.layout) ? page.layout : []) addAll(BLOCK_COMPONENTS[word]);
  const components = Array.isArray(page.components) ? page.components : [];
  for (const comp of components) {
    if (comp && typeof comp === 'object') {
      addAll(BLOCK_COMPONENTS[comp.block]);
      for (const item of Array.isArray(comp.items) ? comp.items : []) {
        if (item && typeof item === 'object') addAll(TYPE_COMPONENTS[item.type]);
      }
    }
  }
  const modals = Array.isArray(page.modals) ? page.modals : [];
  if (modals.length > 0) names.add('VLayer');
  for (const mo of modals) {
    for (const f of Array.isArray(mo?.fields) ? mo.fields : []) {
      if (f && typeof f === 'object') addAll(TYPE_COMPONENTS[f.type]);
    }
  }
  return [...names].sort();
}

const bytesOf = (s) => Buffer.byteLength(s, 'utf8');

/** 读文件，缺失返回 null（存在性问题归 validate/doctor，打包只标注跳过）。 */
async function readIfExists(abs) {
  try {
    return await readFile(abs, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * 汇编上下文包（纯函数式装配，契约 §6.11）。
 * @returns {Promise<{bundle: string, sections: Array<{label, bytes, note?}>, total: number}>}
 */
export async function buildContextBundle(root, task) {
  const sections = [];
  const parts = [];
  const pushSection = (label, heading, content, note) => {
    const text = `\n## ${heading}\n\n${content.trimEnd()}\n`;
    parts.push(text);
    sections.push({ label, bytes: bytesOf(text), ...(note ? { note } : {}) });
  };

  // 1) 任务文件原文（frontmatter + body）
  const taskText = await readFile(task.path, 'utf8');
  pushSection('任务文件', `任务文件（${task.file}）`, taskText);

  // 2) 契约原文
  if (typeof task.fm.contract === 'string' && task.fm.contract !== '') {
    const contractText = await readIfExists(path.join(root, task.fm.contract));
    if (contractText !== null) {
      pushSection('契约', `契约（${task.fm.contract}）`, contractText);
    } else {
      pushSection('契约', `契约（${task.fm.contract}）`, '（契约文件缺失——存在性由 vima validate V-TASK-03 把关，此处跳过。）', '缺失跳过');
    }
  }

  // 3) spec 页面块 + 4) 组件文档切片（带 page 字段的任务才有）
  if (typeof task.fm.page === 'string' && task.fm.page !== '') {
    const specText = await readIfExists(path.join(root, 'docs', 'spec.md'));
    const block = specText === null
      ? undefined
      : extractBlocks(specText, 'page').find((b) => b.data?.id === task.fm.page);
    if (block) {
      pushSection(
        'spec 页面块',
        `spec 页面块（${task.fm.page}）`,
        '页面结构唯一真源（A2）——layout/components/交互/apis 四要素以此为准：\n\n' +
          '```yaml vima:page\n' + block.raw.trimEnd() + '\n```',
      );

      const compNames = componentsOfPage(block.data);
      if (compNames.length > 0) {
        const chunks = [];
        const missing = [];
        for (const name of compNames) {
          const doc = await readIfExists(path.join(root, 'docs', 'ui-framework', `${name}.md`));
          if (doc === null) missing.push(name);
          else chunks.push(`### ${name}\n\n${doc.trim()}`);
        }
        const head = `按本页受限词表映射出的组件（契约 §6.11 映射表）：${compNames.join('、')}。` +
          (missing.length > 0 ? `\n（文档缺失跳过：${missing.join('、')}——docs/ui-framework/ 未安装或组件文档不全。）` : '');
        pushSection(
          '组件文档切片',
          '组件文档切片',
          `${head}${chunks.length > 0 ? `\n\n${chunks.join('\n\n')}` : ''}`,
          missing.length > 0 ? `缺失 ${missing.length}` : undefined,
        );
      }
    } else {
      pushSection(
        'spec 页面块',
        `spec 页面块（${task.fm.page}）`,
        '（spec 缺失或该页面块不存在——由 vima validate V-TASK-06 把关，此处跳过。）',
        '缺失跳过',
      );
    }
  }

  // 5) 编码规范
  const standards = await readIfExists(path.join(root, 'docs', 'coding-standards.md'));
  if (standards !== null) {
    pushSection('编码规范', '编码规范（docs/coding-standards.md）', standards);
  } else {
    pushSection('编码规范', '编码规范（docs/coding-standards.md）', '（未安装——vima init 后可用，此处跳过。）', '缺失跳过');
  }

  const title = typeof task.fm.title === 'string' ? task.fm.title : '';
  const header =
    '<!-- vima context 生成（A8 确定性上下文打包，契约 §6.11）：本包是任务开工所需规划\n' +
    '上下文的只读快照；真源（任务/契约/spec/规范）变更后重跑 `vima context <taskId>` 重建。\n' +
    'Builder 以本包为第一必读，不再自行翻找规划上下文（上游编译、下游不自由检索）。 -->\n\n' +
    `# 任务上下文包：${task.id} — ${title}\n`;
  const bundle = header + parts.join('');
  return { bundle, sections, total: bytesOf(bundle) };
}

/** vima context <taskId> [--budget <bytes>] [--stdout] */
export async function run(argv, ctx) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        budget: { type: 'string' },
        stdout: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  if (positionals.length !== 1) {
    throw usageError('用法：vima context <taskId>（缺少或多余的任务 ID 参数）');
  }
  const taskId = positionals[0];
  let budget;
  if (values.budget !== undefined) {
    budget = Number(values.budget);
    if (!Number.isInteger(budget) || budget <= 0) {
      throw usageError(`--budget 必须是正整数字节数（收到 "${values.budget}"）`);
    }
  }

  const root = ctx.cwd;
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition('NO_TASKS', '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务）', 'docs/tasks');
  }
  const tasks = await loadTasks(root);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    throw usageError(`未知任务 "${taskId}"（docs/tasks/ 中无此 taskId）`);
  }

  const { bundle, sections, total } = await buildContextBundle(root, task);

  if (values.stdout) {
    process.stdout.write(bundle);
  } else {
    const rel = `.vima/context/${taskId}.md`;
    await atomicWriteFile(path.join(root, rel), bundle);
    const lines = [`📦 上下文包：${rel}（共 ${total} 字节）`];
    for (const s of sections) {
      lines.push(`  · ${s.label} ${s.bytes} 字节${s.note ? `（${s.note}）` : ''}`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  // 预算是硬门（A8：上下文预算首次成为机检项）；包已写盘/已输出，便于排查超因
  if (budget !== undefined && total > budget) {
    throw checkFailed(
      'CONTEXT_BUDGET',
      `上下文包 ${total} 字节超出预算 ${budget}（超 ${total - budget}）——裁剪 spec 页面块/契约或拆分任务`,
      `.vima/context/${taskId}.md`,
    );
  }
  return EXIT.OK;
}
