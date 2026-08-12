/*
 * 用 type 而不是 interface：VSelect 的 options 声明成 Record<string, unknown>[]，
 * 而 interface 没有隐式索引签名，传进去会被 TS 拒掉；type 别名的对象字面量类型有。
 */
export type TreeSelectOption = {
  value: number
  label: string
}

/**
 * 把「平铺 + parentId」的列表接成真正的树。
 *
 * 后端 /system/menu/list、/system/dept/list 返回的是平铺数组，每条的 children 都是空数组
 * （实体上 children 是 @Transient，没人往里塞）。页面却按树在用：VTable 写了
 * :tree-props="{ children: 'children' }"、上级下拉要按层级缩进——两边对不上时不会报错，
 * 只是层级消失：菜单表里按钮和目录挤在同一层，「排除自身子树」也漏掉子孙。
 *
 * 已经是树（有任意节点带非空 children）就原样返回，避免重复接一次。
 */
export function toTree<T extends { id: number; parentId?: number | null; children?: T[] }>(
  flat: T[],
): T[] {
  if (!flat?.length) return []
  if (flat.some((n) => n.children?.length)) return flat

  const byId = new Map<number, T>()
  for (const node of flat) byId.set(node.id, { ...node, children: [] })

  const roots: T[] = []
  for (const node of flat) {
    const self = byId.get(node.id)!
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    // 父级不在本次结果里（被过滤掉了）时按根节点处理，否则整棵子树会凭空消失
    if (parent) parent.children!.push(self)
    else roots.push(self)
  }
  return roots
}

interface FlattenOptions {
  /** 顶级选项的文字，如「顶级菜单」「顶级部门」；对应 parentId = 0 */
  rootLabel: string
  /** 编辑时要排除的节点 id：自己和自己的子孙都不能当自己的上级，否则会成环 */
  excludeId?: number
  /** 只保留满足条件的节点（例如菜单页只让目录和菜单当上级，按钮不行） */
  filter?: (node: any) => boolean
}

/**
 * 把树形数据摊平成 VSelect 能用的选项。
 *
 * 为什么要有这个：VSelect 只接受扁平的 { value, label }，不认树。此前几个树形页面的
 * 「上级 xx」下拉里只硬写了一个「顶级」选项，于是从某一行发起新增时 parentId 被设成了
 * 那行的 id，下拉里却没有对应选项——控件只好把原始值直接显示出来，界面上就是个光秃秃的
 * 数字（截图里的「上级菜单：1」就是这么来的）。
 *
 * 层级用全角空格缩进表达，不额外引入树形选择组件。
 */
export function toTreeOptions(
  nodes: any[],
  { rootLabel, excludeId, filter }: FlattenOptions,
): TreeSelectOption[] {
  const out: TreeSelectOption[] = [{ value: 0, label: rootLabel }]

  const walk = (list: any[], depth: number) => {
    for (const node of list || []) {
      // 排除自身即排除整棵子树：子孙同样不能被选为上级
      if (excludeId != null && node.id === excludeId) continue
      if (!filter || filter(node)) {
        out.push({ value: node.id, label: '　'.repeat(depth) + node.name })
      }
      if (node.children?.length) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)

  return out
}
