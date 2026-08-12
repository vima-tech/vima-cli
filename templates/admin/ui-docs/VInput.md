<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VInput

输入单行文本。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `string \| number \| boolean` | — | 否 | 当前输入值。 |
| `type` | `string` | `text` | 否 | 原生输入类型。 |
| `placeholder` | `string` | — | 否 | 无值时显示的输入提示。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止输入和交互。 |
| `readonly` | `boolean` | `false` | 否 | 是否仅允许读取。 |
| `required` | `boolean` | `false` | 否 | 是否向表单语义声明必填。 |
| `prefixIcon` | `string` | — | 否 | 前缀图标 |
| `suffixIcon` | `string` | — | 否 | 后缀图标 |
| `prefix` | `string` | — | 否 | 前缀文字 |
| `suffix` | `string` | — | 否 | 后缀文字 |
| `clearable` | `boolean` | `false` | 否 | 是否可清空 |
| `showPassword` | `boolean` | `false` | 否 | 是否显示密码切换（仅 type="password" 时有效） |
| `rows` | `number \| string` | `undefined` | 否 | 多行输入模式下的可见行数。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number \| boolean` |  |
| `blur` | `FocusEvent` |  |
| `change` | `string \| number \| boolean` |  |
| `input` | `string` |  |
| `clear` | `void` |  |
| `focus` | `FocusEvent` |  |

## Slots

- `prefix`
- `suffix`

## 用法

```vue
<template>
  <VInput />
</template>

<script setup lang="ts">
import { VInput } from '@vima-tech/ui-admin';
</script>
```
