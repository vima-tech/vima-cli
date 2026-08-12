/**
 * 菜单图标预设集
 *
 * 只允许从这里挑，不允许自由填写：图标是全站视觉的一部分，一旦放开成文本框，
 * 不同人会填 emoji、填别的图标库的类名、填拼错的名字——前两种破坏视觉一致性，
 * 后一种直接不显示，而且没有任何报错。收成一个受控集合之后，菜单管理页只需要
 * 渲染这些名字，侧边栏也能安全地直接用后端下发的值。
 *
 * 名字取自组件库内置的 SVG 图标注册表（<VIcon name="...">），统一 24×24 描边、
 * 继承 currentColor，因此放在侧栏的渐变色块上和放在表格里都能正确显示。
 * 要增删预设改这一个数组即可，不用动页面。
 */
export interface MenuIconOption {
  /** VIcon 的 name，同时是存进后端 sys_menu.icon 的值 */
  name: string
  /** 选择器里的中文说明 */
  label: string
}

export const MENU_ICON_PRESETS: MenuIconOption[] = [
  // 兜底项也必须在集合里：否则新建菜单时「已选」显示的那个图标在选择面板里找不到对应格子，
  // 看起来像是选中态丢了。
  { name: 'circle', label: '默认' },
  { name: 'chart-bar', label: '图表' },
  { name: 'home', label: '首页' },
  { name: 'layout', label: '布局' },
  { name: 'app', label: '应用' },
  { name: 'users', label: '用户组' },
  { name: 'user', label: '用户' },
  { name: 'building', label: '组织' },
  { name: 'shield-check', label: '权限' },
  { name: 'lock', label: '安全' },
  { name: 'list', label: '列表' },
  { name: 'menu', label: '菜单' },
  { name: 'table', label: '表格' },
  { name: 'form', label: '表单' },
  { name: 'columns', label: '分栏' },
  { name: 'file-text', label: '文档' },
  { name: 'folder', label: '文件夹' },
  { name: 'database', label: '数据' },
  { name: 'server', label: '服务' },
  { name: 'monitor', label: '监控' },
  { name: 'settings', label: '设置' },
  { name: 'clock', label: '定时' },
  { name: 'calendar', label: '日历' },
  { name: 'bell', label: '通知' },
  { name: 'mail', label: '邮件' },
  { name: 'search', label: '查询' },
  { name: 'star', label: '收藏' },
  { name: 'target', label: '目标' },
  { name: 'package', label: '包管理' },
  { name: 'upload', label: '上传' },
  { name: 'download', label: '下载' },
  { name: 'edit', label: '编辑' },
  { name: 'log-in', label: '登录' },
  { name: 'info', label: '说明' },
  { name: 'alert', label: '告警' },
]

/** 没设图标、或存的是历史遗留值（emoji、旧图标类名）时用它兜底 */
export const DEFAULT_MENU_ICON = 'circle'

const PRESET_NAMES = new Set(MENU_ICON_PRESETS.map((i) => i.name))

export function isPresetIcon(name: unknown): name is string {
  return typeof name === 'string' && PRESET_NAMES.has(name)
}

/**
 * 拿一个可安全交给 <VIcon> 的名字。
 * 传进来的值可能来自老数据库记录（早期种子里存的是 emoji），不校验会渲染成空白。
 */
export function resolveMenuIcon(name: unknown): string {
  return isPresetIcon(name) ? name : DEFAULT_MENU_ICON
}
