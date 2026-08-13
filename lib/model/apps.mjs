// 端册模型：resolveApps —— 端信息唯一入口（internal-contracts §5 / §6.3 / §6.4，A16）
// 「有哪些端、各在哪个目录、什么形态」只在 manifest 声明一次，全部消费方
// （validate/trace/context/render/doctor/create/init）经本模块读取，禁止旁路硬编码。
import { loadManifest } from './manifest.mjs';
import { loadLifecycle } from './lifecycle.mjs';
import { VimaError } from '../util/errors.mjs';
import { loadTemplate } from './template.mjs';

// 内置 kind 缺省（模板未声明 planning.kinds 时的回退；validate 与渲染器同源，契约 §6.3）。
// admin-web 词表 = V-SPEC-04 现行 7 词；componentMap 缺省由 context 内置表承担（契约 §14）。
export const BUILTIN_KINDS = {
  'admin-web': {
    layoutVocab: ['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination'],
    regions: true,
    shell: 'desktop-admin',
    status: 'stable',
  },
};

// v1 manifest（无 apps 键）的合成端册（admin 模板；与 guard-shared 的字面量回退同口径）
const LEGACY_ADMIN_APP = {
  id: 'admin',
  name: '管理后台',
  kind: 'admin-web',
  dir: '.',
  codeDir: 'src',
  sharedDirs: ['src/components', 'src/utils', 'vendor'],
};

/** app 条目归一化：dir 缺省 "."、codeDir 缺省 "src"、sharedDirs 缺省 []（宽松补齐，合法性归 doctor）。 */
function normalizeApp(entry) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    name: typeof entry.name === 'string' ? entry.name : entry.id ?? '',
    kind: typeof entry.kind === 'string' ? entry.kind : 'admin-web',
    dir: typeof entry.dir === 'string' && entry.dir !== '' ? entry.dir : '.',
    codeDir: typeof entry.codeDir === 'string' && entry.codeDir !== '' ? entry.codeDir : 'src',
    sharedDirs: Array.isArray(entry.sharedDirs) ? entry.sharedDirs.filter((d) => typeof d === 'string') : [],
  };
}

/** 项目模板 id：manifest.templateId ?? lifecycle.templateId ?? null（不抛错版本）。 */
async function templateIdOf(root, manifest) {
  if (manifest && typeof manifest.templateId === 'string') return manifest.templateId;
  try {
    const lifecycle = await loadLifecycle(root);
    return typeof lifecycle.templateId === 'string' ? lifecycle.templateId : null;
  } catch (err) {
    if (err instanceof VimaError && err.code === 'NO_LIFECYCLE') return null;
    throw err;
  }
}

/**
 * 解析项目端册（契约 §5）。解析顺序：manifest v2 apps/backend → v1 manifest/模板
 * 合成默认单端端册 → 无前端模板返回 apps: []。kinds = 内置缺省 + 模板 planning.kinds
 * 覆盖；模板加载失败（如 CLI 无该模板）时静默用内置（防误不防恶意，合法性归 doctor）。
 * @returns {Promise<{multi: boolean,
 *   apps: Array<{id, name, kind, dir, codeDir, sharedDirs}>,
 *   backend: {dir: string, sharedDirs: string[]}|null,
 *   kinds: Record<string, {layoutVocab: string[], regions: boolean, shell: string, status: string}>}>}
 */
export async function resolveApps(root, { cliRoot } = {}) {
  const manifest = await loadManifest(root);
  const templateId = await templateIdOf(root, manifest);

  // kinds：内置缺省 + 模板声明覆盖
  let template = null;
  if (templateId && cliRoot) {
    try {
      template = await loadTemplate(cliRoot, templateId);
    } catch (err) {
      if (!(err instanceof VimaError && err.code === 'NO_TEMPLATE')) throw err;
    }
  }
  const kinds = { ...BUILTIN_KINDS, ...(template?.planning?.kinds ?? {}) };

  // 1. manifest v2：端册原样归一返回
  if (manifest && Array.isArray(manifest.apps)) {
    const apps = manifest.apps.map(normalizeApp);
    const backend =
      manifest.backend && typeof manifest.backend === 'object'
        ? {
            dir: typeof manifest.backend.dir === 'string' ? manifest.backend.dir : 'backend',
            sharedDirs: Array.isArray(manifest.backend.sharedDirs)
              ? manifest.backend.sharedDirs.filter((d) => typeof d === 'string')
              : [],
          }
        : null;
    return { multi: apps.length > 1, apps, backend, kinds };
  }

  // 2. v1 manifest / 无 manifest：从模板合成默认端册
  if (template) {
    // 新形态模板：取 default 条目（缺标记则取首个）合成单端（dir 落项目根）
    if (Array.isArray(template.apps) && template.apps.length > 0) {
      const entry = template.apps.find((a) => a && a.default === true) ?? template.apps[0];
      const app = normalizeApp({ ...entry, dir: '.' });
      const backend =
        template.backend && typeof template.backend === 'object'
          ? { dir: typeof template.backend.dir === 'string' ? template.backend.dir : 'backend', sharedDirs: [] }
          : null;
      return { multi: false, apps: [app], backend, kinds };
    }
    // 旧三键形态：codeDirs 含 'src' 视为有前端（admin）；'backend/src' 视为有后端。
    // 旧 sharedDirs 的 backend 项含 {{projectPkg}} 无法渲染 → 合成 backend.sharedDirs 给 []
    // （W1 无消费方；guard-shared 的 v1 回退不经本函数，契约 §14）。
    const codeDirs = Array.isArray(template.codeDirs) ? template.codeDirs : [];
    if (codeDirs.includes('src')) {
      const sharedFe = (Array.isArray(template.sharedDirs) ? template.sharedDirs : []).filter(
        (d) => typeof d === 'string' && !d.startsWith('backend/'),
      );
      const app = { ...LEGACY_ADMIN_APP, sharedDirs: sharedFe.length > 0 ? sharedFe : LEGACY_ADMIN_APP.sharedDirs };
      const backend = codeDirs.includes('backend/src') ? { dir: 'backend', sharedDirs: [] } : null;
      return { multi: false, apps: [app], backend, kinds };
    }
  }

  // 3. 无前端语义（cli/lib/script 模板、非 vima 项目）：空端册
  return { multi: false, apps: [], backend: null, kinds };
}

/**
 * 条目归属端（契约 §5）：entry.app 声明优先（原样返回，∈ 端册的合法性归校验规则）；
 * 未声明时单端 = 唯一端 id，多端 = null（V-SPEC-13/V-TASK-10 据此报错）。
 */
export function appOf(entry, roster) {
  const declared = entry && typeof entry.app === 'string' && entry.app !== '' ? entry.app : null;
  if (declared !== null) return declared;
  return roster.apps.length === 1 ? roster.apps[0].id : null;
}

/**
 * 接口消费端（契约 §5）：api.consumers 声明优先（原样返回）；未声明时单端 = [唯一端]，
 * 多端 = null（V-CON-07 据此报错）。
 */
export function consumersOf(api, roster) {
  if (api && Array.isArray(api.consumers)) return api.consumers;
  return roster.apps.length === 1 ? [roster.apps[0].id] : null;
}
