import { defineComponent as w, useAttrs as H, h as S } from "vue";
const y = {
  alert: "VAlert",
  badge: "VBadge",
  button: "VButton",
  "button-group": "VButtonGroup",
  card: "VCard",
  checkbox: "VCheckbox",
  "checkbox-group": "VCheckboxGroup",
  col: "VCol",
  container: "VContainer",
  custom: "$intrinsic",
  datepicker: "VDatePicker",
  descriptions: "VDescriptions",
  "descriptions-item": "VDescriptionsItem",
  divider: "VDivider",
  drawer: "VDrawer",
  dropdown: "VDropdown",
  empty: "VEmpty",
  form: "VForm",
  "form-item": "VFormItem",
  icon: "VIcon",
  input: "VInput",
  "input-number": "VInputNumber",
  link: "VLink",
  loading: "VLoading",
  message: "VAlert",
  modal: "VLayer",
  pagination: "VPagination",
  popover: "VPopover",
  progress: "VProgress",
  radio: "VRadio",
  "radio-group": "VRadioGroup",
  row: "VRow",
  select: "VSelect",
  statistic: "VStatistic",
  switch: "VSwitch",
  table: "VTable",
  tag: "VTag",
  "tag-input": "VTagInput",
  text: "$intrinsic",
  textarea: "VTextarea",
  timepicker: "VTimePicker",
  tooltip: "VTooltip",
  tree: "VTree",
  upload: "VUpload"
}, D = Object.freeze(
  Object.keys(y)
), C = {};
function k(t) {
  const e = t.emits;
  return Array.isArray(e) ? [...e] : e ? Object.keys(e) : [];
}
function z(t) {
  const e = {}, r = t.props ?? {};
  for (const [i, o] of Object.entries(r)) {
    const n = typeof o == "function" || Array.isArray(o) ? { type: o } : o, a = (Array.isArray(n.type) ? n.type : n.type ? [n.type] : []).map((h) => {
      var d;
      const m = ((d = h.name) == null ? void 0 : d.toLowerCase()) || "";
      return m === "object" ? "object" : m === "array" ? "array" : m === "date" ? "date" : m;
    }).filter(Boolean);
    e[i] = { types: a, required: n.required === !0 };
  }
  return e;
}
function Z() {
  return C;
}
function q(t) {
  const e = {};
  for (const [r, i] of Object.entries(y)) {
    if (i === "$intrinsic") continue;
    const o = t[i];
    if (!o) throw new Error(`模板组件 ${r} 缺少公开实现 ${i}`);
    e[r] = o;
    const n = Object.keys(o.props ?? {});
    r === "form-item" && n.push("field", "defaultValue");
    const f = r === "button" || r === "link" ? ["blur", "click", "focus"] : [];
    C[i] = {
      props: [...new Set(n)].sort(),
      propTypes: z(o),
      events: [.../* @__PURE__ */ new Set([...k(o), ...f])].sort()
    };
  }
  return e;
}
const U = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/, b = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function _(t) {
  const e = t.trim();
  return U.test(e) && e.split(".").every((r) => !b.has(r));
}
function Q(t, e) {
  if (!_(e)) return;
  let r = t;
  for (const i of e.trim().split(".")) {
    if (typeof r != "object" && typeof r != "function" || r === null || !Object.prototype.hasOwnProperty.call(r, i)) return;
    r = r[i];
  }
  return r;
}
function N(t) {
  return !!t && !b.has(t);
}
function j(t) {
  return /^[A-Za-z_$][\w$]*$/.test(t) && N(t);
}
function X(t, e) {
  for (const [r, i] of Object.entries(e))
    N(r) && (t[r] = i);
}
const R = new Set(D), I = ["click", "change", "submit", "focus", "blur", "input", "custom"], O = ["setValue", "getData", "submit", "validate", "reset", "navigate", "showModal", "closeModal", "custom"], x = ["GET", "POST", "PUT", "DELETE"], V = {
  "descriptions-item": ["descriptions"],
  col: ["row"],
  "form-item": ["form"]
};
function p(t) {
  return !!t && typeof t == "object" && !Array.isArray(t);
}
function L(t) {
  return p(t) && t.__expression === !0 && typeof t.expr == "string";
}
function F(t) {
  return Array.isArray(t) ? "array" : t instanceof Date ? "date" : t === null ? "null" : typeof t;
}
function s(t, e, r, i, o, n) {
  t.push({ code: e, severity: "error", path: r, component: n, message: i, suggestion: o });
}
function E(t, e, r, i) {
  if (L(t)) {
    r === "untrusted" && !_(t.expr) && s(
      i,
      "UNSAFE_EXPRESSION",
      `${e}.expr`,
      "不可信模板仅允许安全数据路径。",
      "先计算值，再从 context 读取。"
    );
    return;
  }
  if (typeof t == "string" && t.startsWith("{{") && t.endsWith("}}")) {
    const o = t.slice(2, -2).trim();
    r === "untrusted" && !_(o) && s(
      i,
      "UNSAFE_EXPRESSION",
      e,
      "不可信模板仅允许安全数据路径。",
      "使用 {{ formData.field }}。"
    );
    return;
  }
  if (Array.isArray(t)) {
    t.forEach((o, n) => E(o, `${e}[${n}]`, r, i));
    return;
  }
  p(t) && Object.entries(t).forEach(([o, n]) => E(n, `${e}.${o}`, r, i));
}
function W(t, e, r, i) {
  var o, n;
  if (I.includes(t.type) || s(i, "UNKNOWN_EVENT_TYPE", `${e}.type`, `未知事件类型 "${String(t.type)}"。`, `可用：${I.join(", ")}`), O.includes(t.action) || s(i, "UNKNOWN_EVENT_ACTION", `${e}.action`, `未知事件动作 "${String(t.action)}"。`, `可用：${O.join(", ")}`), t.params && E(t.params, `${e}.params`, r, i), ["setValue", "showModal", "closeModal"].includes(t.action) && typeof ((o = t.params) == null ? void 0 : o.field) == "string" && !N(t.params.field) && s(i, "UNSAFE_DATA_KEY", `${e}.params.field`, "事件字段名不安全。"), r === "untrusted" && (t.action === "custom" || t.handler) && s(
    i,
    "UNSAFE_CUSTOM_HANDLER",
    e,
    "不可信模板禁止自定义函数。",
    "改用白名单动作。"
  ), r === "untrusted" && t.action === "navigate") {
    const f = typeof ((n = t.params) == null ? void 0 : n.url) == "string" ? t.params.url : "";
    f && !f.startsWith("/") && !f.startsWith("#") && s(
      i,
      "UNSAFE_NAVIGATION",
      `${e}.params.url`,
      "仅允许站内路径或锚点。",
      "地址须以 / 或 # 开头。"
    );
  }
}
function T(t, e, r, i, o, n) {
  var h, m, d;
  if (!p(t)) {
    s(i, "INVALID_TEMPLATE_NODE", e, "节点须为对象。");
    return;
  }
  const f = t.id;
  typeof f != "string" || !f.trim() ? s(i, "MISSING_NODE_ID", `${e}.id`, "节点缺少 id。") : o.has(f) ? s(i, "DUPLICATE_NODE_ID", `${e}.id`, `节点 id "${f}" 重复。`) : o.add(f);
  const a = t.type;
  if ((typeof a != "string" || !R.has(a)) && s(
    i,
    "UNKNOWN_TEMPLATE_COMPONENT",
    `${e}.type`,
    `模板组件类型 "${String(a)}" 不存在。`,
    `可用类型：${D.join(", ")}`
  ), typeof a == "string" && V[a] && (!n || !V[a].includes(n)) && s(
    i,
    "INVALID_COMPONENT_PARENT",
    e,
    `${a} 的父级必须是 ${V[a].join(", ")}，当前为 ${n || "根节点"}。`,
    void 0,
    typeof a == "string" ? y[a] : void 0
  ), t.props !== void 0 && !p(t.props))
    s(i, "INVALID_NODE_PROPS", `${e}.props`, "props 须为对象。");
  else if (p(t.props)) {
    E(t.props, `${e}.props`, r.trustLevel, i);
    const c = typeof a == "string" ? y[a] : void 0, M = c && c !== "$intrinsic" ? (h = r.componentContracts) == null ? void 0 : h[c] : void 0;
    if (M != null && M.props) {
      for (const l of Object.keys(t.props))
        l === "content" || l === "text" || M.props.includes(l) || s(
          i,
          "UNKNOWN_PROP",
          `${e}.props.${l}`,
          `${c} 不公开属性 "${l}"。`,
          `可用属性：${M.props.join(", ")}`,
          c
        );
      for (const [l, u] of Object.entries(M.propTypes ?? {})) {
        if (u.required && !(l in t.props)) {
          s(i, "MISSING_REQUIRED_PROP", `${e}.props.${l}`, `${c} 缺少必填属性 "${l}"。`, void 0, c);
          continue;
        }
        const v = t.props[l];
        if (v == null || L(v) || typeof v == "string" && v.startsWith("{{") && v.endsWith("}}")) continue;
        const $ = F(v);
        u.types.length && !u.types.includes($) && s(i, "PROP_TYPE_MISMATCH", `${e}.props.${l}`, `${c}.${l} 期望 ${u.types.join(" | ")}，实际为 ${$}。`, void 0, c);
      }
    }
    a === "form-item" && typeof t.props.field == "string" && !N(t.props.field) && s(i, "UNSAFE_DATA_KEY", `${e}.props.field`, "表单字段名不安全。");
  }
  if (t.condition !== void 0 && E(t.condition, `${e}.condition`, r.trustLevel, i), p(t.loop) && E(t.loop.data, `${e}.loop.data`, r.trustLevel, i), t.events !== void 0 && !p(t.events))
    s(i, "INVALID_NODE_EVENTS", `${e}.events`, "events 须为对象。");
  else if (p(t.events)) {
    const c = typeof a == "string" ? y[a] : void 0, M = c && c !== "$intrinsic" ? (m = r.componentContracts) == null ? void 0 : m[c] : void 0;
    for (const [l, u] of Object.entries(t.events)) {
      if (M != null && M.events && !M.events.includes(l) && s(i, "UNKNOWN_EVENT", `${e}.events.${l}`, `${c} 不公开事件 "${l}"。`, `可用事件：${M.events.join(", ")}`, c), !p(u)) {
        s(i, "INVALID_EVENT_HANDLER", `${e}.events.${l}`, "事件定义须为对象。");
        continue;
      }
      W(u, `${e}.events.${l}`, r.trustLevel, i);
    }
  }
  if (Array.isArray(t.children) ? t.children.forEach((c, M) => T(c, `${e}.children[${M}]`, r, i, o, typeof a == "string" ? a : void 0)) : t.children !== void 0 && s(i, "INVALID_NODE_CHILDREN", `${e}.children`, "children 须为数组。"), t.slots !== void 0 && !p(t.slots))
    s(i, "INVALID_NODE_SLOTS", `${e}.slots`, "slots 须为对象。");
  else if (p(t.slots)) {
    const c = typeof a == "string" ? y[a] : void 0, M = c && c !== "$intrinsic" ? (d = r.componentContracts) == null ? void 0 : d[c] : void 0;
    for (const [l, u] of Object.entries(t.slots)) {
      if (M != null && M.slots && !M.slots.includes(l) && s(i, "UNKNOWN_SLOT", `${e}.slots.${l}`, `${c} 不公开插槽 "${l}"。`, `可用插槽：${M.slots.join(", ")}`, c), !Array.isArray(u)) {
        s(i, "INVALID_SLOT_CHILDREN", `${e}.slots.${l}`, "插槽内容须为数组。");
        continue;
      }
      u.forEach((v, $) => T(v, `${e}.slots.${l}[${$}]`, r, i, o, typeof a == "string" ? a : void 0));
    }
  }
}
function B(t, e = {}) {
  const r = [], i = {
    ...e,
    trustLevel: e.trustLevel ?? "untrusted",
    componentContracts: e.componentContracts ?? Z()
  };
  if (!p(t))
    return s(r, "INVALID_TEMPLATE", "", "模板须为对象。"), { valid: !1, diagnostics: r };
  for (const o of ["id", "name", "type", "version"])
    (typeof t[o] != "string" || !t[o].trim()) && s(r, "MISSING_TEMPLATE_FIELD", o, `模板缺少非空字段 ${o}。`);
  if (T(t.root, "root", i, r, /* @__PURE__ */ new Set()), i.trustLevel === "untrusted" && (Array.isArray(t.scripts) && t.scripts.length && s(r, "UNSAFE_TEMPLATE_SCRIPT", "scripts", "不可信模板禁止脚本。"), p(t.styleConfig) && typeof t.styleConfig.customCSS == "string" && t.styleConfig.customCSS.trim() && s(r, "UNSAFE_CUSTOM_CSS", "styleConfig.customCSS", "不可信模板禁止自定义 CSS。")), Array.isArray(t.dataSources)) {
    const o = /* @__PURE__ */ new Set();
    t.dataSources.forEach((n, f) => {
      var h;
      if (!p(n)) {
        s(r, "INVALID_DATA_SOURCE", `dataSources[${f}]`, "数据源须为对象。");
        return;
      }
      const a = `dataSources[${f}]`;
      if (typeof n.id != "string" || !j(n.id) ? s(r, "UNSAFE_DATA_SOURCE_ID", `${a}.id`, "数据源 ID 不安全。") : o.has(n.id) ? s(r, "DUPLICATE_DATA_SOURCE_ID", `${a}.id`, `数据源 ID "${n.id}" 重复。`) : o.add(n.id), (typeof n.name != "string" || !n.name.trim()) && s(r, "MISSING_DATA_SOURCE_NAME", `${a}.name`, "数据源名称为空。"), ["static", "api", "function"].includes(String(n.type)) || s(r, "UNKNOWN_DATA_SOURCE_TYPE", `${a}.type`, `未知数据源类型 ${String(n.type)}。`), n.type === "api" && (!p(n.api) || typeof n.api.url != "string" || !n.api.url.trim()) && s(r, "INVALID_API_DATA_SOURCE", `${a}.api`, "API 数据源缺少 url。"), n.type === "api" && p(n.api) && !x.includes(String(n.api.method ?? "GET")) && s(r, "UNKNOWN_API_METHOD", `${a}.api.method`, `不支持请求方法 ${String(n.api.method)}。`), i.trustLevel === "untrusted" && n.type === "function" && s(
        r,
        "UNSAFE_FUNCTION_DATA_SOURCE",
        a,
        "不可信模板禁止函数数据源。",
        "改用静态数据或宿主预取。"
      ), i.trustLevel === "untrusted" && n.type === "api") {
        const m = p(n.api) && typeof n.api.url == "string" ? n.api.url : "";
        let d = !1;
        try {
          const c = new URL(m, "https://template.local");
          d = c.origin === "https://template.local" || !!((h = e.allowedApiOrigins) != null && h.includes(c.origin));
        } catch {
          d = !1;
        }
        d || s(
          r,
          "UNSAFE_API_DATA_SOURCE",
          `dataSources[${f}].api.url`,
          "API 地址不在允许范围。",
          "使用相对地址或 allowedApiOrigins。"
        );
      }
    });
  }
  return { valid: r.every((o) => o.severity !== "error"), diagnostics: r };
}
function J(t, e) {
  const r = B(t, e);
  if (r.valid) return;
  const i = new Error(r.diagnostics.map((o) => `${o.code} ${o.path}: ${o.message}`).join(`
`));
  throw i.name = "TemplateValidationError", Object.assign(i, { diagnostics: r.diagnostics }), i;
}
function tt(t) {
  return y[t];
}
function P(...t) {
  return t.flatMap((e) => e ? typeof e == "string" ? [e] : Array.isArray(e) ? P(...e) : typeof e == "object" ? Object.entries(e).filter(([, r]) => !!r).map(([r]) => r) : [] : []);
}
function et(t) {
  if (t == null || t === "") return;
  if (typeof t == "number") return `${t}px`;
  const e = t.trim();
  return /^-?\d+(?:\.\d+)?$/.test(e) ? `${e}px` : e;
}
function rt(t) {
  return t == null || t === "" || Array.isArray(t) && t.length === 0;
}
function G(...t) {
  return t.filter(Boolean);
}
function it(t) {
  return t == null ? "" : Array.isArray(t) ? t.join("、") : typeof t == "object" ? JSON.stringify(t) : String(t);
}
const A = {
  alert: ["M12 3 2.5 20h19L12 3Z", "M12 9v4", "M12 17h.01"],
  app: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  "arrow-down": ["M12 5v14", "m19 12-7 7-7-7"],
  "arrow-left": ["M19 12H5", "m12 19-7-7 7-7"],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  "arrow-up": ["M12 19V5", "m5 12 7-7 7 7"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  building: ["M4 21V5l8-3v19M12 8h8v13M8 7h.01M8 11h.01M8 15h.01M16 11h.01M16 15h.01M2 21h20"],
  button: ["M5 7h14a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z", "M9 12h6"],
  calendar: ["M4 5h16v16H4z", "M8 3v4M16 3v4M4 10h16"],
  "chart-bar": ["M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20"],
  check: ["m5 12 4 4L19 6"],
  "check-circle": ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "m22 4-10 10-3-3"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chevron-up": ["m18 15-6-6-6 6"],
  circle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  close: ["M6 6l12 12M18 6 6 18"],
  cloud: ["M17.5 19H6a4 4 0 0 1-.6-8 6.5 6.5 0 0 1 12.4-2A5 5 0 0 1 17.5 19Z"],
  columns: ["M3 4h18v16H3z", "M12 4v16"],
  copy: ["M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8Z", "M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"],
  database: ["M20 5c0 1.7-3.6 3-8 3S4 6.7 4 5s3.6-3 8-3 8 1.3 8 3Z", "M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5", "M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"],
  divider: ["M3 12h18"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 21h16"],
  "drag-handle": ["M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"],
  edit: ["M13.5 6.5 17.5 10.5M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z"],
  eye: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  "eye-off": ["m3 3 18 18", "M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a14.7 14.7 0 0 1-2.1 2.8M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8"],
  "external-link": ["M14 4h6v6", "m20 4-9 9", "M18 13v7H4V6h7"],
  file: ["M6 2h8l4 4v16H6z", "M14 2v5h5"],
  "file-text": ["M6 2h8l4 4v16H6z", "M14 2v5h5M9 13h6M9 17h6"],
  flask: ["M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3", "M7.5 16h9"],
  filter: ["M3 5h18l-7 8v6l-4 2v-8L3 5Z"],
  folder: ["M3 5h7l2 3h9v12H3z"],
  form: ["M5 3h14v18H5z", "M8 8h8M8 12h8M8 16h5"],
  fullscreen: ["M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"],
  "fullscreen-exit": ["M9 3v6H3M15 3v6h6M21 15h-6v6M3 15h6v6"],
  home: ["m3 11 9-8 9 8v10h-6v-6H9v6H3z"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"],
  "help-circle": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"],
  image: ["M3 4h18v16H3z", "M8.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "m3 17 5-5 4 4 3-3 6 6"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v6M12 7h.01"],
  layout: ["M3 4h18v16H3z", "M3 9h18M9 9v11"],
  link: ["M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1", "M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"],
  list: ["M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
  "log-in": ["M15 3h5v18h-5", "M10 17l5-5-5-5M15 12H3"],
  "log-out": ["M9 3H4v18h5", "m14 17 5-5-5-5M19 12H7"],
  lock: ["M5 10h14v11H5z", "M8 10V7a4 4 0 0 1 8 0v3"],
  mail: ["M3 5h18v14H3z", "m3 6 9 7 9-7"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  minus: ["M5 12h14"],
  "minus-circle": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12h8"],
  monitor: ["M3 4h18v13H3zM8 21h8M12 17v4"],
  "more-vertical": ["M12 5h.01M12 12h.01M12 19h.01"],
  package: ["m12 2 9 5-9 5-9-5 9-5Z", "m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"],
  paperclip: ["m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6"],
  pause: ["M8 5v14M16 5v14"],
  phone: ["M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 5c0-1 1-2 2-2Z"],
  play: ["m8 5 11 7-11 7V5Z"],
  plus: ["M12 5v14M5 12h14"],
  printer: ["M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z"],
  refresh: ["M20 7v5h-5M4 17v-5h5", "M18.5 9A7 7 0 0 0 6 6l-2 3M5.5 15A7 7 0 0 0 18 18l2-3"],
  redo: ["M20 7h-7a7 7 0 0 0-7 7v3", "m16 3 4 4-4 4"],
  save: ["M4 3h14l2 2v16H4z", "M8 3v6h8V3M8 21v-7h8v7"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m17 17 4 4"],
  server: ["M4 4h16v6H4zM4 14h16v6H4z", "M8 7h.01M8 17h.01"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"],
  shield: ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"],
  "shield-check": ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z", "m8 12 3 3 5-6"],
  sort: ["M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"],
  star: ["m12 2 3 6 7 .9-5 4.8 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.8L9 8l3-6Z"],
  table: ["M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16"],
  target: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  text: ["M4 6V3h16v3M12 3v18M8 21h8"],
  trash: ["M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"],
  undo: ["M4 7h7a7 7 0 0 1 7 7v3", "m8 3-4 4 4 4"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M4 20h16"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"],
  "user-plus": ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"],
  users: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 6"],
  unlock: ["M5 10h14v11H5z", "M16 10V7a4 4 0 0 0-7.5-2"],
  "zoom-in": ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m17 17 4 4M8 11h6M11 8v6"],
  "zoom-out": ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m17 17 4 4M8 11h6"]
}, K = {
  addition: "plus",
  down: "chevron-down",
  left: "chevron-left",
  right: "chevron-right",
  "screen-full": "fullscreen",
  "screen-restore": "fullscreen-exit",
  "triangle-d": "chevron-down",
  username: "user"
};
function g(t) {
  const e = t.replace(/^layui-icon-/, "");
  return K[e] || e;
}
function nt(t, e) {
  if (!/^[a-z][a-z0-9-]*$/.test(t) || !e.length)
    throw new Error("图标名称必须是小写短横线格式，且路径不能为空");
  if (e.some((r) => !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(r)))
    throw new Error("图标路径包含无效字符");
  A[t] = [...e];
}
function ot(t) {
  return !!A[g(t)];
}
function st() {
  return Object.keys(A).sort();
}
function at(t, e = "vui-icon") {
  const r = g(t), i = A[r] || A.info, o = e.replace(/[^a-zA-Z0-9 _-]/g, ""), n = i.map((f) => `<path d="${f}"></path>`).join("");
  return `<svg class="${o}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${n}</svg>`;
}
const ct = w({
  name: "VIcon",
  inheritAttrs: !1,
  props: {
    type: { type: String, default: "" },
    name: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: [Number, String], default: "1em" },
    title: { type: String, default: "" }
  },
  setup(t) {
    const e = H();
    return () => {
      const r = g(t.name || t.type), i = A[r] || A.info, o = typeof t.size == "number" ? `${t.size}px` : t.size, { class: n, style: f, ...a } = e;
      return S(
        "svg",
        {
          ...a,
          class: P("vui-icon", r ? `vui-icon-${r}` : "", n),
          viewBox: "0 0 24 24",
          width: o,
          height: o,
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "aria-hidden": t.title ? void 0 : "true",
          role: t.title ? "img" : void 0,
          style: G(t.color ? { color: t.color } : void 0, f)
        },
        [t.title ? S("title", t.title) : null, ...i.map((h) => S("path", { d: h }))]
      );
    };
  }
});
export {
  y as T,
  ct as V,
  rt as a,
  at as b,
  P as c,
  it as d,
  X as e,
  _ as f,
  J as g,
  ot as h,
  N as i,
  q as j,
  D as k,
  st as l,
  G as m,
  g as n,
  nt as o,
  Q as r,
  et as s,
  tt as t,
  B as v
};
//# sourceMappingURL=icons-B1oeJ8GI.js.map
