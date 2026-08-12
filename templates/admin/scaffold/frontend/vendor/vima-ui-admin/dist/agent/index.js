import { h as P, i as I, v as S } from "../icons-B1oeJ8GI.js";
const T = "https://json-schema.org/draft/2020-12/schema", E = "https://vima-tech.local/schemas/app-spec.v1.json", L = "Vima UI Admin AppSpec v1", w = "object", N = !1, O = [
  "version",
  "name",
  "shell",
  "pages",
  "routes"
], R = {
  version: {
    const: "1"
  },
  name: {
    type: "string",
    minLength: 1
  },
  shell: {
    $ref: "#/$defs/shell"
  },
  pages: {
    type: "array",
    minItems: 1,
    items: {
      $ref: "#/$defs/page"
    }
  },
  routes: {
    type: "array",
    minItems: 1,
    items: {
      $ref: "#/$defs/route"
    }
  }
}, j = {
  option: {
    type: "object",
    additionalProperties: !1,
    required: [
      "label",
      "value"
    ],
    properties: {
      label: {
        type: "string",
        minLength: 1
      },
      value: {
        type: [
          "string",
          "number",
          "boolean"
        ]
      },
      disabled: {
        type: "boolean"
      }
    }
  },
  input: {
    type: "object",
    additionalProperties: !1,
    properties: {
      component: {
        type: "string",
        minLength: 1
      },
      placeholder: {
        type: "string"
      },
      disabled: {
        type: "boolean"
      },
      readonly: {
        type: "boolean"
      }
    }
  },
  validation: {
    type: "object",
    additionalProperties: !1,
    required: [
      "kind",
      "message"
    ],
    properties: {
      kind: {
        enum: [
          "required",
          "min",
          "max",
          "pattern"
        ]
      },
      value: {
        type: [
          "number",
          "string"
        ]
      },
      message: {
        type: "string",
        minLength: 1
      }
    }
  },
  field: {
    type: "object",
    additionalProperties: !1,
    required: [
      "key",
      "label",
      "dataType"
    ],
    properties: {
      key: {
        type: "string",
        pattern: "^[A-Za-z_$][A-Za-z0-9_$.-]*$"
      },
      label: {
        type: "string",
        minLength: 1
      },
      dataType: {
        enum: [
          "string",
          "number",
          "boolean",
          "date",
          "object"
        ]
      },
      cardinality: {
        enum: [
          "single",
          "list",
          "tuple"
        ]
      },
      format: {
        type: "string",
        minLength: 1
      },
      required: {
        type: "boolean"
      },
      options: {
        type: "array",
        items: {
          $ref: "#/$defs/option"
        }
      },
      input: {
        $ref: "#/$defs/input"
      },
      validation: {
        type: "array",
        items: {
          $ref: "#/$defs/validation"
        }
      }
    }
  },
  action: {
    type: "object",
    additionalProperties: !1,
    required: [
      "key",
      "label"
    ],
    properties: {
      key: {
        type: "string",
        minLength: 1
      },
      label: {
        type: "string",
        minLength: 1
      },
      kind: {
        enum: [
          "default",
          "primary",
          "success",
          "warning",
          "danger"
        ]
      },
      icon: {
        type: "string",
        minLength: 1
      }
    }
  },
  formPage: {
    type: "object",
    additionalProperties: !1,
    required: [
      "id",
      "type",
      "title",
      "fields"
    ],
    properties: {
      id: {
        type: "string",
        pattern: "^[A-Za-z][A-Za-z0-9_-]*$"
      },
      type: {
        const: "form"
      },
      title: {
        type: "string",
        minLength: 1
      },
      fields: {
        type: "array",
        items: {
          $ref: "#/$defs/field"
        }
      },
      submitLabel: {
        type: "string",
        minLength: 1
      }
    }
  },
  crudPage: {
    type: "object",
    additionalProperties: !1,
    required: [
      "id",
      "type",
      "title",
      "fields",
      "rowKey"
    ],
    properties: {
      id: {
        type: "string",
        pattern: "^[A-Za-z][A-Za-z0-9_-]*$"
      },
      type: {
        const: "crud"
      },
      title: {
        type: "string",
        minLength: 1
      },
      fields: {
        type: "array",
        items: {
          $ref: "#/$defs/field"
        }
      },
      rowKey: {
        type: "string",
        minLength: 1
      },
      actions: {
        type: "array",
        items: {
          $ref: "#/$defs/action"
        }
      }
    }
  },
  detailPage: {
    type: "object",
    additionalProperties: !1,
    required: [
      "id",
      "type",
      "title",
      "fields"
    ],
    properties: {
      id: {
        type: "string",
        pattern: "^[A-Za-z][A-Za-z0-9_-]*$"
      },
      type: {
        const: "detail"
      },
      title: {
        type: "string",
        minLength: 1
      },
      fields: {
        type: "array",
        items: {
          $ref: "#/$defs/field"
        }
      }
    }
  },
  metric: {
    type: "object",
    additionalProperties: !1,
    required: [
      "key",
      "label"
    ],
    properties: {
      key: {
        type: "string",
        minLength: 1
      },
      label: {
        type: "string",
        minLength: 1
      },
      value: {
        type: [
          "string",
          "number"
        ]
      },
      prefix: {
        type: "string"
      },
      suffix: {
        type: "string"
      }
    }
  },
  dashboardPage: {
    type: "object",
    additionalProperties: !1,
    required: [
      "id",
      "type",
      "title",
      "metrics"
    ],
    properties: {
      id: {
        type: "string",
        pattern: "^[A-Za-z][A-Za-z0-9_-]*$"
      },
      type: {
        const: "dashboard"
      },
      title: {
        type: "string",
        minLength: 1
      },
      metrics: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/$defs/metric"
        }
      }
    }
  },
  page: {
    oneOf: [
      {
        $ref: "#/$defs/formPage"
      },
      {
        $ref: "#/$defs/crudPage"
      },
      {
        $ref: "#/$defs/detailPage"
      },
      {
        $ref: "#/$defs/dashboardPage"
      }
    ]
  },
  navigation: {
    type: "object",
    additionalProperties: !1,
    required: [
      "label",
      "route",
      "icon"
    ],
    properties: {
      label: {
        type: "string",
        minLength: 1
      },
      route: {
        type: "string",
        pattern: "^/"
      },
      icon: {
        type: "string",
        minLength: 1
      }
    }
  },
  shell: {
    type: "object",
    additionalProperties: !1,
    required: [
      "title",
      "navigation"
    ],
    properties: {
      title: {
        type: "string",
        minLength: 1
      },
      navigation: {
        type: "array",
        items: {
          $ref: "#/$defs/navigation"
        }
      }
    }
  },
  route: {
    type: "object",
    additionalProperties: !1,
    required: [
      "path",
      "pageId"
    ],
    properties: {
      path: {
        type: "string",
        pattern: "^/"
      },
      pageId: {
        type: "string",
        minLength: 1
      }
    }
  }
}, b = {
  $schema: T,
  $id: E,
  title: L,
  type: w,
  additionalProperties: N,
  required: O,
  properties: R,
  $defs: j
};
function d(e, t, i, r) {
  return { code: e, severity: "error", path: t, message: i, suggestion: r };
}
function C(e) {
  return Array.isArray(e) ? "array" : e === null ? "null" : typeof e;
}
function M(e, t) {
  if (!e.$ref) return e;
  const i = e.$ref.replace(/^#\//, "").split("/");
  let r = t;
  for (const o of i)
    r = r == null ? void 0 : r[o.replace(/~1/g, "/").replace(/~0/g, "~")];
  return r;
}
function f(e, t, i, r, o) {
  const n = M(t, i);
  if (n.oneOf) {
    const a = n.oneOf.map((l) => {
      const u = [];
      return f(e, l, i, r, u), u;
    }), s = a.filter((l) => l.length === 0);
    if (s.length === 1) return;
    if (s.length > 1) {
      o.push(d("APP_SPEC_VARIANT_AMBIGUOUS", r, "值同时符合多个互斥规格分支。", "提供明确的 type 字段。"));
      return;
    }
    const p = a.reduce((l, u) => u.length < l.length ? u : l, a[0]);
    o.push(...p);
    return;
  }
  if (n.const !== void 0 && e !== n.const) {
    o.push(d("APP_SPEC_CONST_MISMATCH", r, `必须为 ${JSON.stringify(n.const)}。`));
    return;
  }
  if (n.enum && !n.enum.includes(e)) {
    o.push(d("APP_SPEC_ENUM_MISMATCH", r, `可用值：${n.enum.join(", ")}。`));
    return;
  }
  if (n.type) {
    const a = Array.isArray(n.type) ? n.type : [n.type], s = C(e);
    if (!a.includes(s)) {
      o.push(d("APP_SPEC_TYPE_MISMATCH", r, `期望 ${a.join(" | ")}，实际为 ${s}。`));
      return;
    }
  }
  if (typeof e == "string" && (n.minLength !== void 0 && e.length < n.minLength && o.push(d("APP_SPEC_STRING_TOO_SHORT", r, "字符串不能为空。")), n.pattern && !new RegExp(n.pattern).test(e) && o.push(d("APP_SPEC_PATTERN_MISMATCH", r, `字符串不符合 ${n.pattern}。`))), Array.isArray(e) && (n.minItems !== void 0 && e.length < n.minItems && o.push(d("APP_SPEC_ARRAY_TOO_SHORT", r, `至少需要 ${n.minItems} 项。`)), n.items && e.forEach((a, s) => f(a, n.items, i, `${r}[${s}]`, o))), e && typeof e == "object" && !Array.isArray(e)) {
    const a = e;
    for (const s of n.required ?? [])
      s in a || o.push(d("APP_SPEC_REQUIRED", r ? `${r}.${s}` : s, `缺少必填字段 ${s}。`));
    if (n.additionalProperties === !1 && n.properties)
      for (const s of Object.keys(a))
        s in n.properties || o.push(d("APP_SPEC_UNKNOWN_PROPERTY", r ? `${r}.${s}` : s, `不允许字段 ${s}。`));
    for (const [s, p] of Object.entries(n.properties ?? {}))
      s in a && f(a[s], p, i, r ? `${r}.${s}` : s, o);
  }
}
function V(e) {
  const t = [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  e.pages.forEach((n, a) => {
    i.has(n.id) && t.push(d("DUPLICATE_PAGE_ID", `pages[${a}].id`, `页面 ID ${n.id} 重复。`)), i.add(n.id);
    const s = n.id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    r.has(s) && t.push(d("OUTPUT_PATH_COLLISION", `pages[${a}].id`, `页面 ${n.id} 会产生重复文件路径。`)), r.add(s), A(n).forEach((p) => t.push({
      ...p,
      path: p.path ? `pages[${a}].${p.path}` : `pages[${a}]`
    }));
  });
  const o = /* @__PURE__ */ new Set();
  return e.routes.forEach((n, a) => {
    o.has(n.path) && t.push(d("DUPLICATE_ROUTE_PATH", `routes[${a}].path`, `路由 ${n.path} 重复。`)), o.add(n.path), i.has(n.pageId) || t.push(d("UNKNOWN_ROUTE_PAGE", `routes[${a}].pageId`, `路由引用了不存在的页面 ${n.pageId}。`));
  }), e.shell.navigation.forEach((n, a) => {
    o.has(n.route) || t.push(d("UNKNOWN_NAVIGATION_ROUTE", `shell.navigation[${a}].route`, `导航引用了不存在的路由 ${n.route}。`)), P(n.icon) || t.push(d("UNKNOWN_ICON", `shell.navigation[${a}].icon`, `SVG 图标 ${n.icon} 未注册。`, "从 AI Manifest icons 中选择名称。"));
  }), t;
}
function A(e) {
  var i;
  const t = [];
  if ("fields" in e && e.fields.length === 0 && t.push(d("MISSING_PAGE_FIELDS", "fields", "页面至少需要一个字段。")), "fields" in e) {
    const r = /* @__PURE__ */ new Set();
    e.fields.forEach((o, n) => {
      var a, s;
      I(o.key) || t.push(d("UNSAFE_FIELD_KEY", `fields[${n}].key`, `字段 key "${o.key}" 是 JavaScript 保留名。`)), r.has(o.key) && t.push(d("DUPLICATE_FIELD_KEY", `fields[${n}].key`, `字段 key "${o.key}" 重复。`)), r.add(o.key), o.format === "enum" && !((a = o.options) != null && a.length) && t.push(d("MISSING_FIELD_OPTIONS", `fields[${n}].options`, "枚举字段必须提供 options。")), (s = o.validation) == null || s.forEach((p, l) => {
        if (p.kind !== "required" && p.value === void 0 && t.push(d("MISSING_VALIDATION_VALUE", `fields[${n}].validation[${l}].value`, `${p.kind} 校验必须提供 value。`)), p.kind === "pattern" && p.value !== void 0)
          try {
            if (typeof p.value != "string") throw new Error();
            new RegExp(p.value);
          } catch {
            t.push(d("INVALID_VALIDATION_PATTERN", `fields[${n}].validation[${l}].value`, "pattern 必须是有效的正则表达式字符串。"));
          }
        (p.kind === "min" || p.kind === "max") && (typeof p.value != "number" || !Number.isFinite(p.value)) && t.push(d("INVALID_VALIDATION_LIMIT", `fields[${n}].validation[${l}].value`, `${p.kind} 必须是有限数值。`));
      });
    });
  }
  return e.type === "crud" && ((i = e.actions) == null || i.forEach((r, o) => {
    r.icon && !P(r.icon) && t.push(d("UNKNOWN_ICON", `actions[${o}].icon`, `SVG 图标 ${r.icon} 未注册。`, "从 AI Manifest icons 中选择名称。"));
  })), t;
}
function q(e) {
  const t = [];
  return f(e, b, b, "", t), t.length ? { valid: !1, diagnostics: t } : (t.push(...V(e)), t.length ? { valid: !1, diagnostics: t } : { valid: !0, value: e, diagnostics: [] });
}
function _(e) {
  const t = b, i = [];
  return f(e, { $ref: "#/$defs/page" }, t, "", i), i.length || i.push(...A(e)), i.length ? { valid: !1, diagnostics: i } : { valid: !0, value: e, diagnostics: [] };
}
const D = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
function g(e, t) {
  const i = JSON.stringify(e, null, t);
  if (i === void 0) throw new TypeError("不能把 undefined 写入生成代码。");
  return i.replace(/[<>&\u2028\u2029]/g, (r) => D[r]);
}
function h(e, t) {
  const i = _(e);
  return i.valid ? i.value.type !== t ? {
    valid: !1,
    diagnostics: [{ code: "PAGE_TYPE_MISMATCH", severity: "error", path: "type", message: `需要 ${t} 页面。` }]
  } : { valid: !0, value: i.value } : { valid: !1, diagnostics: i.diagnostics };
}
function c(e) {
  return e.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function U(e) {
  var r, o, n, a;
  const t = {
    placeholder: (r = e.input) == null ? void 0 : r.placeholder,
    disabled: (o = e.input) == null ? void 0 : o.disabled,
    readonly: (n = e.input) == null ? void 0 : n.readonly
  }, i = Object.fromEntries(Object.entries(t).filter(([, s]) => s !== void 0));
  return (a = e.input) != null && a.component ? { type: e.input.component, props: i } : e.format === "file" ? { type: "upload", props: i } : e.cardinality === "list" ? { type: "tag-input", props: i } : e.format === "enum" ? { type: "select", props: { ...i, options: e.options ?? [] } } : e.dataType === "boolean" ? { type: "switch", props: i } : e.dataType === "number" ? { type: "input-number", props: i } : e.dataType === "date" ? { type: "datepicker", props: { ...i, range: e.cardinality === "tuple" || e.format === "date-range" } } : e.format === "textarea" || e.dataType === "object" ? { type: "textarea", props: i } : { type: "input", props: { ...i, type: e.format && e.format !== "text" ? e.format : "text" } };
}
function k(e, t) {
  const i = `${c(e)}--field-${c(t.key)}`, r = U(t);
  return {
    id: i,
    type: "form-item",
    props: { label: t.label, field: t.key, required: t.required === !0 },
    children: [{ id: `${i}--input`, type: r.type, props: r.props }]
  };
}
function $(e, t = []) {
  if (t.length) return { ok: !1, diagnostics: t };
  const i = S(e);
  return i.valid ? { ok: !0, template: e, diagnostics: [] } : { ok: !1, diagnostics: i.diagnostics };
}
function x(e) {
  const t = Object.fromEntries(e.fields.flatMap((i) => {
    var r;
    return (r = i.validation) != null && r.length ? [[i.key, i.validation.map(({ kind: o, value: n, message: a }) => ({
      [o]: o === "required" ? !0 : n,
      message: a
    }))]] : [];
  }));
  return Object.keys(t).length ? t : void 0;
}
function v(e, t) {
  const i = e.type === "form" ? x(e) : void 0;
  return {
    id: c(e.id),
    name: e.title,
    type: e.type === "form" ? "form" : "page",
    version: "1.0.0",
    root: t,
    ...i ? { formConfig: { rules: i } } : {}
  };
}
function z(e) {
  const t = h(e, "form");
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value, r = `${c(i.id)}--form`, o = i.fields.map((n) => k(i.id, n));
  return o.push({
    id: `${r}--actions`,
    type: "form-item",
    children: [{
      id: `${r}--submit`,
      type: "button",
      props: { type: "primary", nativeType: "submit", content: i.submitLabel || "保存" },
      events: { click: { type: "click", action: "submit" } }
    }]
  }), $(v(i, { id: r, type: "form", children: o }));
}
function H(e, t, i) {
  const r = `${c(e)}--action-${c(t.key)}-${i}`;
  return {
    id: r,
    type: "button",
    props: t.icon ? { type: t.kind || "default" } : { type: t.kind || "default", content: t.label },
    children: t.icon ? [
      { id: `${r}--icon`, type: "icon", props: { name: t.icon } },
      { id: `${r}--label`, type: "text", props: { content: t.label } }
    ] : void 0
  };
}
function F(e) {
  const t = h(e, "crud");
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value, r = c(i.id), o = i.fields.map((a) => ({ key: a.key, title: a.label })), n = {
    id: `${r}--root`,
    type: "container",
    children: [
      {
        id: `${r}--search-card`,
        type: "card",
        props: { title: "查询条件" },
        children: [{
          id: `${r}--search-form`,
          type: "form",
          children: i.fields.slice(0, 4).map((a) => k(`${r}-search`, { ...a, required: !1 }))
        }]
      },
      {
        id: `${r}--list-card`,
        type: "card",
        props: { title: i.title },
        children: [
          {
            id: `${r}--actions`,
            type: "button-group",
            children: (i.actions ?? []).map((a, s) => H(r, a, s))
          },
          {
            id: `${r}--error`,
            type: "alert",
            props: {
              type: "error",
              title: "加载失败",
              description: { __expression: !0, expr: "errorMessage" },
              closable: !1,
              showIcon: !0
            },
            condition: "error"
          },
          { id: `${r}--loading`, type: "loading", props: { loading: !0, text: "加载中" }, condition: "loading" },
          { id: `${r}--empty`, type: "empty", props: { description: "暂无数据" }, condition: "empty" },
          {
            id: `${r}--table`,
            type: "table",
            props: {
              columns: o,
              dataSource: { __expression: !0, expr: "rows" },
              id: i.rowKey,
              defaultToolbar: !0
            },
            condition: "hasRows"
          },
          {
            id: `${r}--pagination`,
            type: "pagination",
            props: {
              current: { __expression: !0, expr: "page" },
              pageSize: { __expression: !0, expr: "pageSize" },
              total: { __expression: !0, expr: "total" }
            }
          }
        ]
      }
    ]
  };
  return $(v(i, n));
}
function G(e) {
  const t = h(e, "detail");
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value, r = c(i.id), o = {
    id: `${r}--root`,
    type: "card",
    props: { title: i.title },
    children: [{
      id: `${r}--descriptions`,
      type: "descriptions",
      children: i.fields.map((n) => ({
        id: `${r}--detail-${c(n.key)}`,
        type: "descriptions-item",
        props: { label: n.label, content: { __expression: !0, expr: `record.${n.key}` } }
      }))
    }]
  };
  return $(v(i, o));
}
function K(e) {
  const t = h(e, "dashboard");
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value, r = c(i.id), o = {
    id: `${r}--root`,
    type: "row",
    children: i.metrics.map((n, a) => ({
      id: `${r}--metric-col-${a}`,
      type: "col",
      props: { span: Math.max(6, Math.floor(24 / Math.min(i.metrics.length, 4))) },
      children: [{
        id: `${r}--metric-${c(n.key)}`,
        type: "statistic",
        props: {
          title: n.label,
          value: n.value ?? { __expression: !0, expr: `metrics.${n.key}` },
          prefix: n.prefix || "",
          suffix: n.suffix || ""
        }
      }]
    }))
  };
  return $(v(i, o));
}
function Z(e) {
  const t = _(e);
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value;
  return i.type === "form" ? z(i) : i.type === "crud" ? F(i) : i.type === "detail" ? G(i) : K(i);
}
function y(e) {
  return c(e).split(/[-_]+/).filter(Boolean).map((t) => `${t[0].toUpperCase()}${t.slice(1)}`).join("");
}
function B(e, t) {
  const i = e.type === "crud" ? `const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = computed(() => rows.value.length)
const viewData = computed(() => ({ rows: rows.value, loading: loading.value, error: Boolean(errorMessage.value), errorMessage: errorMessage.value, empty: !loading.value && !errorMessage.value && rows.value.length === 0, hasRows: rows.value.length > 0, page: page.value, pageSize: pageSize.value, total: total.value }))` : e.type === "detail" ? `const record = ref<Record<string, unknown>>({})
const viewData = computed(() => ({ record: record.value }))` : e.type === "dashboard" ? `const metrics = ref<Record<string, string | number>>({})
const viewData = computed(() => ({ metrics: metrics.value }))` : `const model = ref<Record<string, unknown>>({})
const viewData = computed(() => ({}))`, r = e.type === "form" ? ' v-model="model"' : "";
  return `<script setup lang="ts">
import { computed, ref } from 'vue'
import { TemplateRenderer, type Template } from '@vima-tech/ui-admin'

const template: Template = ${g(t, 2)}
${i}
<\/script>

<template>
  <div class="vui-page">
    <TemplateRenderer :template="template" :global-data="viewData"${r} />
  </div>
</template>
`;
}
function W(e) {
  return `<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { VBody, VHeader, VIcon, VLayout, VSide } from '@vima-tech/ui-admin'

const shellTitle = ${g(e.shell.title)}
const navigation = ${g(e.shell.navigation, 2)}
<\/script>

<template>
  <VLayout class="vui-layout-fill">
    <VSide>
      <h1>{{ shellTitle }}</h1>
      <nav>
        <RouterLink v-for="item in navigation" :key="item.route" :to="item.route">
          <VIcon :name="item.icon" />{{ item.label }}
        </RouterLink>
      </nav>
    </VSide>
    <VBody>
      <VHeader>{{ shellTitle }}</VHeader>
      <RouterView />
    </VBody>
  </VLayout>
</template>
`;
}
function Y(e) {
  const t = e.pages.map((o) => `import ${y(o.id)}Page from './pages/${y(o.id)}Page.vue'`).join(`
`), i = new Map(e.pages.map((o) => [o.id, `${y(o.id)}Page`])), r = e.routes.map((o) => `  { path: ${g(o.path)}, component: ${i.get(o.pageId)} }`).join(`,
`);
  return `import { createRouter, createWebHistory } from 'vue-router'
${t}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
${r}
  ]
})
`;
}
function J() {
  return `import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import VimaUiAdmin from '@vima-tech/ui-admin'
import '@vima-tech/ui-admin/style.css'

createApp(App).use(router).use(VimaUiAdmin).mount('#app')
`;
}
function m(e, t, i) {
  return { path: e, type: t, operation: "create", overwrite: "deny", content: i };
}
function Q(e) {
  return e.pages.flatMap((t) => {
    var o;
    const i = [], r = (n, a, s) => {
      i.push({ id: `${t.id}.${n}`, pageId: t.id, kind: a, description: s, required: !0 });
    };
    return t.type === "crud" ? (r("data.list", "data", "连接查询、分页、排序、加载与错误状态的数据 Adapter。"), (o = t.actions) == null || o.forEach((n) => r(`action.${n.key}`, "action", `连接“${n.label}”动作并处理权限与结果。`))) : t.type === "form" ? r("action.submit", "action", "连接表单提交 Adapter，并处理成功与字段错误。") : t.type === "detail" ? r("data.record", "data", "连接详情数据 Adapter。") : t.metrics.some((n) => n.value === void 0) && r("data.metrics", "data", "连接动态指标数据 Adapter。"), i;
  });
}
function ee(e) {
  const t = q(e);
  if (!t.valid) return { ok: !1, diagnostics: t.diagnostics };
  const i = t.value, r = [], o = i.pages.map((a) => ({ page: a, result: Z(a) }));
  if (o.forEach(({ page: a, result: s }) => {
    s.ok || r.push(...s.diagnostics.map((p) => ({ ...p, path: `pages.${a.id}.${p.path}` })));
  }), r.length) return { ok: !1, diagnostics: r };
  const n = [
    m("src/App.vue", "vue-sfc", W(i)),
    m("src/main.ts", "ts", J()),
    ...o.map(({ page: a, result: s }) => m(
      `src/pages/${y(a.id)}Page.vue`,
      "vue-sfc",
      B(a, s.template)
    )),
    m("src/router.ts", "ts", Y(i))
  ].sort((a, s) => a.path.localeCompare(s.path));
  return {
    ok: !0,
    spec: i,
    diagnostics: [],
    plan: {
      version: "1",
      readiness: "scaffold",
      files: n,
      dependencies: [
        { name: "@vima-tech/ui-admin", version: "^0.1.0", kind: "dependency" },
        { name: "vue", version: "^3.4.0", kind: "dependency" },
        { name: "vue-router", version: "^4.0.0", kind: "dependency" }
      ],
      integrationRequirements: Q(i),
      verificationCommands: ["npm run typecheck", "npm run build", "npm test"],
      diagnostics: [],
      nextSteps: [
        "Review files whose overwrite policy is deny before writing them.",
        "Connect generated page state to the application data adapters.",
        "Run typecheck, build, browser smoke tests and accessibility checks."
      ]
    }
  };
}
export {
  F as buildCrudPage,
  K as buildDashboardPage,
  G as buildDetailPage,
  z as buildFormPage,
  Z as buildPage,
  ee as createArtifactPlan,
  q as validateAppSpec,
  _ as validatePageSpec
};
//# sourceMappingURL=index.js.map
