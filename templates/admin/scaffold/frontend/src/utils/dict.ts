import { ref } from 'vue'
import type { Ref } from 'vue'
import { getDictDataByCode } from '@/api/system'

export interface DictOption {
  label: string
  value: string
  /** 字典项备注，DictTag 用它指定标签颜色（success/danger 等） */
  remark?: string
}

/**
 * 模块级缓存：同一字典类型只发一次请求。
 * 缓存的是 Promise 而不是结果，这样并发调用天然去重；失败时删掉缓存，下次可重试。
 */
const dictCache = new Map<string, Promise<DictOption[]>>()

function loadDict(type: string): Promise<DictOption[]> {
  let pending = dictCache.get(type)
  if (!pending) {
    pending = getDictDataByCode(type)
      .then((res: any) =>
        ((res.data || []) as any[]).map((item) => ({
          label: String(item.dictLabel ?? ''),
          value: String(item.dictValue ?? ''),
          remark: item.remark ?? undefined,
        }))
      )
      .catch((error) => {
        dictCache.delete(type)
        throw error
      })
    dictCache.set(type, pending)
  }
  return pending
}

/**
 * 按字典类型（dictCode，如 sys_user_status）拉取字典数据的组合式函数。
 *
 *   const { options, labelOf } = useDict('sys_user_status')
 *
 * options 是响应式数组（异步填充）；labelOf(value) 找不到时原样返回 value。
 */
export function useDict(type: string): {
  options: Ref<DictOption[]>
  labelOf: (value: string | number) => string
} {
  const options = ref<DictOption[]>([])

  loadDict(type)
    .then((list) => {
      options.value = list
    })
    .catch((error) => {
      console.error(`[dict] 加载字典 ${type} 失败`, error)
    })

  const labelOf = (value: string | number) => {
    const v = String(value)
    return options.value.find((item) => item.value === v)?.label ?? v
  }

  return { options, labelOf }
}
