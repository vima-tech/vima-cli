import { defineComponent as W, useAttrs as G, computed as F, h as n, ref as P, onMounted as re, onBeforeUnmount as ue, inject as Se, watch as de, Teleport as xe, provide as Oe, nextTick as me, onUpdated as Ba, createVNode as La, reactive as wt, onUnmounted as Ia } from "vue";
import { V as le, m as De, c as L, d as Ce, a as Ne, s as we, h as Pa, b as $e, v as Ye, e as xt, f as _a, r as Fa, i as Ot, g as ke, j as Ra } from "./icons-B1oeJ8GI.js";
import { T as Kn, k as Hn, l as zn, n as Wn, o as Un, t as Gn } from "./icons-B1oeJ8GI.js";
function fe(e, t, a) {
  const { class: l, style: i, ...r } = e;
  return {
    ...r,
    class: L(t, l),
    style: De(a, i)
  };
}
const Bt = W({
  name: "VContainer",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("main", fe(a, ["vui-container"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Lt = W({
  name: "VRow",
  inheritAttrs: !1,
  props: {
    gutter: { type: [Number, String], default: 12 },
    justify: {
      type: String,
      default: "start"
    },
    align: { type: String, default: "top" }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => ({
      start: "flex-start",
      center: "center",
      end: "flex-end",
      "space-between": "space-between",
      "space-around": "space-around"
    })[e.justify]), i = F(() => ({ top: "flex-start", middle: "center", bottom: "flex-end" })[e.align]);
    return () => {
      var r;
      return n(
        "div",
        fe(a, ["vui-row"], {
          "--vui-row-gutter": `${Math.max(0, Number(e.gutter) || 0)}px`,
          justifyContent: l.value,
          alignItems: i.value
        }),
        (r = t.default) == null ? void 0 : r.call(t)
      );
    };
  }
}), It = W({
  name: "VCol",
  inheritAttrs: !1,
  props: {
    md: { type: [Number, String], default: 24 },
    span: { type: [Number, String], default: void 0 },
    offset: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => Math.min(24, Math.max(1, Number(e.span ?? e.md) || 24))), i = F(() => Math.min(23, Math.max(0, Number(e.offset) || 0)));
    return () => {
      var r;
      return n(
        "div",
        fe(
          a,
          ["vui-col"],
          {
            "--vui-col-span": l.value,
            marginLeft: i.value ? `${i.value / 24 * 100}%` : void 0
          }
        ),
        (r = t.default) == null ? void 0 : r.call(t)
      );
    };
  }
}), Pt = W({
  name: "VCard",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    shadow: { type: String, default: "always" }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l, i;
      return n("section", fe(a, ["vui-card", `is-shadow-${e.shadow}`]), [
        e.title || t.title || t.extra ? n("header", { class: ["vui-card-header"] }, [
          n("div", { class: "vui-card-title" }, ((l = t.title) == null ? void 0 : l.call(t)) || e.title),
          t.extra ? n("div", { class: "vui-card-extra" }, t.extra()) : null
        ]) : null,
        n("div", { class: ["vui-card-body"] }, (i = t.default) == null ? void 0 : i.call(t))
      ]);
    };
  }
}), vt = W({
  name: "VButton",
  inheritAttrs: !1,
  props: {
    type: { type: String, default: "default" },
    size: { type: String, default: "md" },
    disabled: { type: Boolean, default: !1 },
    loading: { type: Boolean, default: !1 },
    nativeType: { type: String, default: "button" },
    borderStyle: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n(
        "button",
        {
          ...fe(a, [
            "vui-button",
            `vui-button-${e.size}`,
            `vui-button-${e.type}`,
            {
              "is-text": e.type === "text",
              "is-borderless": e.borderStyle === "none",
              "is-loading": e.loading
            }
          ]),
          type: e.nativeType,
          disabled: e.disabled || e.loading,
          "aria-busy": e.loading || void 0
        },
        [
          e.loading ? n("span", { class: "vui-button-spinner", "aria-hidden": "true" }) : null,
          (l = t.default) == null ? void 0 : l.call(t)
        ]
      );
    };
  }
}), _t = W({
  name: "VButtonGroup",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("div", fe(a, ["vui-button-group"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Ft = W({
  name: "VDivider",
  inheritAttrs: !1,
  props: {
    content: { type: String, default: "" },
    theme: { type: String, default: "" },
    direction: { type: String, default: "horizontal" },
    contentPosition: { type: String, default: "center" }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var i;
      const l = !!(e.content || t.default);
      return n("div", fe(a, [
        "vui-divider",
        `is-${e.direction}`,
        `is-content-${e.contentPosition}`
      ]), [
        n("span", { class: "vui-divider-line", style: e.theme ? { background: e.theme } : void 0 }),
        l ? n("span", { class: "vui-divider-content" }, ((i = t.default) == null ? void 0 : i.call(t)) || e.content) : null,
        l ? n("span", { class: "vui-divider-line", style: e.theme ? { background: e.theme } : void 0 }) : null
      ]);
    };
  }
}), Rt = W({
  name: "VProgress",
  inheritAttrs: !1,
  props: {
    percent: { type: Number, default: 0 },
    status: { type: String, default: "" }
  },
  setup(e) {
    const t = G(), a = F(() => Math.min(100, Math.max(0, Number(e.percent) || 0)));
    return () => n("div", fe(t, ["vui-progress", `is-${e.status || "normal"}`]), [
      n("div", { class: "vui-progress-track" }, [
        n("div", { class: "vui-progress-bar", style: { width: `${a.value}%` } })
      ]),
      n("span", { class: "vui-progress-label" }, `${a.value}%`)
    ]);
  }
}), jt = W({
  name: "VUpload",
  inheritAttrs: !1,
  props: {
    /** 业务上传端点；组件本身只负责文件选择。 */
    url: { type: String, default: "" },
    /** 原生文件类型过滤表达式。 */
    accept: { type: String, default: "" },
    /** accept 的历史拼写兼容属性。 */
    accpet: { type: String, default: "" },
    /** 是否允许一次选择多个文件。 */
    multiple: { type: Boolean, default: !1 },
    /** 文件选择后的业务处理函数。 */
    beforeUpload: { type: Function, default: void 0 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = P(), i = () => {
      var o;
      return (o = l.value) == null ? void 0 : o.click();
    }, r = (o) => {
      var u;
      const s = o.target.files;
      s != null && s.length && ((u = e.beforeUpload) == null || u.call(e, s)), l.value && (l.value.value = "");
    };
    return () => {
      var o;
      return n("div", fe(a, ["vui-upload"]), [
        n("input", {
          ref: l,
          class: "vui-upload-input",
          type: "file",
          accept: e.accept || e.accpet || void 0,
          multiple: e.multiple,
          onChange: r
        }),
        n(
          "button",
          { type: "button", class: ["vui-button", "vui-upload-trigger"], onClick: i },
          ((o = t.default) == null ? void 0 : o.call(t)) || ["选择文件"]
        )
      ]);
    };
  }
}), ja = W({
  name: "VFullscreen",
  emits: ["fullscreenchange"],
  setup(e, { slots: t, emit: a }) {
    const l = P(!!document.fullscreenElement), i = () => {
      l.value = !!document.fullscreenElement, a("fullscreenchange", l.value);
    }, r = async () => {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    };
    return re(() => document.addEventListener("fullscreenchange", i)), ue(() => document.removeEventListener("fullscreenchange", i)), () => {
      var o;
      return (o = t.default) == null ? void 0 : o.call(t, { toggle: r, isFullscreen: l.value });
    };
  }
}), Ka = W({
  name: "VLayout",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("section", fe(a, ["vui-layout"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Ha = W({
  name: "VHeader",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("header", fe(a, ["vui-header"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), za = W({
  name: "VBody",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("div", fe(a, ["vui-body"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Wa = W({
  name: "VSide",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n("aside", fe(a, ["vui-side"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Kt = W({
  name: "VAvatar",
  inheritAttrs: !1,
  props: {
    size: { type: [String, Number], default: "md" },
    shape: { type: String, default: "circle" },
    src: { type: String, default: "" },
    icon: { type: String, default: "" },
    text: { type: String, default: "" },
    color: { type: String, default: "" },
    fit: { type: String, default: "cover" }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => ({ xs: "is-xs", sm: "is-sm", md: "is-md", lg: "is-lg", xl: "is-xl" })[String(e.size)] || ""), i = F(() => {
      const o = Number(e.size);
      return !isNaN(o) && o > 0 ? { width: `${o}px`, height: `${o}px`, fontSize: `${o * 0.4}px` } : {};
    }), r = F(() => {
      if (e.color) return e.color;
      if (e.text) {
        const o = ["#2f73c5", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96"];
        let s = 0;
        for (let u = 0; u < e.text.length; u++)
          s = e.text.charCodeAt(u) + ((s << 5) - s);
        return o[Math.abs(s) % o.length];
      }
    });
    return () => {
      var c;
      const { class: o, style: s, ...u } = a, f = ((c = t.default) == null ? void 0 : c.call(t)) || (e.src ? n("img", { src: e.src, alt: "", style: { objectFit: e.fit } }) : e.text ? n("span", { class: "vui-avatar-text" }, e.text.slice(0, 2)) : e.icon ? n("span", { class: ["vui-icon", e.icon] }) : n(le, { class: "vui-avatar-icon", type: "user" }));
      return n(
        "div",
        {
          ...u,
          class: L("vui-avatar", o, l.value, `is-${e.shape}`),
          style: De(i.value, r.value ? { backgroundColor: r.value } : void 0, s)
        },
        [f]
      );
    };
  }
}), Ua = W({
  name: "VAvatarGroup",
  inheritAttrs: !1,
  props: {
    max: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var c;
      const { class: l, style: i, ...r } = a, o = ((c = t.default) == null ? void 0 : c.call(t)) || [], s = Number(e.max) || 0, u = s > 0 ? o.slice(0, s) : o, f = s > 0 ? o.length - s : 0;
      return n(
        "div",
        { ...r, class: L("vui-avatar-group", l), style: i },
        [
          ...u,
          f > 0 ? n(Kt, { class: "vui-avatar-excess", text: `+${f}` }) : null
        ]
      );
    };
  }
}), Ht = W({
  name: "VBadge",
  inheritAttrs: !1,
  props: {
    value: { type: [String, Number], default: "" },
    max: { type: [String, Number], default: 99 },
    dot: { type: Boolean, default: !1 },
    type: { type: String, default: "danger" },
    showZero: { type: Boolean, default: !1 },
    hidden: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => {
      const r = Number(e.value);
      return !isNaN(r) && r > Number(e.max) ? `${e.max}+` : String(e.value);
    }), i = F(() => e.hidden ? !1 : e.dot ? !0 : !(e.value === "" || e.value === void 0 || e.value === 0 && !e.showZero));
    return () => {
      var f;
      const { class: r, style: o, ...s } = a;
      return t.default ? n(
        "span",
        { ...s, class: L("vui-badge-host", r), style: o },
        [
          (f = t.default) == null ? void 0 : f.call(t),
          i.value ? n(
            "span",
            {
              class: L("vui-badge", `vui-badge--${e.type}`, {
                "is-dot": e.dot
              })
            },
            e.dot ? void 0 : l.value
          ) : null
        ]
      ) : i.value ? n(
        "span",
        {
          ...s,
          class: L("vui-badge", "vui-badge--alone", r, `vui-badge--${e.type}`, {
            "is-dot": e.dot
          }),
          style: o
        },
        e.dot ? void 0 : l.value
      ) : null;
    };
  }
}), Ga = W({
  name: "VBreadcrumb",
  inheritAttrs: !1,
  props: {
    separator: { type: String, default: "/" },
    separatorIcon: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "nav",
        {
          ...r,
          class: L("vui-breadcrumb", l),
          style: i,
          "aria-label": "面包屑导航"
        },
        (o = t.default) == null ? void 0 : o.call(t)
      );
    };
  }
}), qa = W({
  name: "VBreadcrumbItem",
  inheritAttrs: !1,
  props: {
    to: { type: [String, Object], default: "" },
    replace: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "span",
        { ...r, class: L("vui-breadcrumb-item", l), style: i },
        [
          n(
            "a",
            {
              class: "vui-breadcrumb-link",
              href: typeof e.to == "string" ? e.to : void 0,
              onClick: (s) => {
                e.to && s.preventDefault();
              }
            },
            (o = t.default) == null ? void 0 : o.call(t)
          )
        ]
      );
    };
  }
}), zt = Symbol("VuiForm"), je = Symbol("VuiFormItem"), Wt = Symbol("VuiRadio"), He = 8, Ee = 12;
function Ut(e, t, a, l = !1) {
  const i = e.getBoundingClientRect(), r = window.innerWidth, o = window.innerHeight, s = o - i.bottom - He - Ee, u = i.top - He - Ee, f = s < Math.min(a, 260) && u > s, c = Math.max(80, f ? u : s), m = Math.min(
    t,
    Math.max(0, r - Ee * 2)
  ), y = l ? i.right - m : i.left, w = Math.min(
    Math.max(Ee, y),
    Math.max(
      Ee,
      r - Ee - m
    )
  );
  return {
    dropUp: f,
    alignRight: l || w < i.left,
    style: {
      position: "fixed",
      top: f ? "auto" : `${i.bottom + He}px`,
      right: "auto",
      bottom: f ? `${o - i.top + He}px` : "auto",
      left: `${w}px`,
      width: `${m}px`,
      maxHeight: `${Math.min(a, c)}px`
    }
  };
}
function Ya(e, t) {
  const { class: a, style: l, ...i } = e;
  return {
    rest: i,
    root: {
      class: L(t, a),
      style: l
    }
  };
}
function Ja(e, t, a) {
  const l = we(e), i = l == null ? void 0 : l.match(/^(\d+(?:\.\d+)?)px$/);
  if (!i || !t) return l;
  const r = Number(i[1]);
  if (r === 0) return l;
  const o = Array.from(t).reduce(
    (u, f) => u + (/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(f) ? 1 : 0.55),
    0
  ), s = Math.ceil(o * 14 + 14 + (a ? 14 : 0));
  return `${Math.max(r, s)}px`;
}
function Ke(e = "") {
  return e.replace(/[：:]\s*$/, "").trim();
}
function rt(e, t) {
  const a = Ke(e);
  return a ? `${t === "select" ? "请选择" : "请输入"}${a}` : t === "select" ? "请选择" : "";
}
const Gt = W({
  name: "VForm",
  inheritAttrs: !1,
  props: {
    model: { type: Object, default: () => ({}) },
    rules: { type: Object, default: () => ({}) },
    required: { type: Boolean, default: !1 },
    pane: { type: Boolean, default: !1 },
    labelWidth: { type: [String, Number], default: 100 },
    layout: {
      type: String,
      default: "horizontal"
    }
  },
  setup(e, { slots: t, expose: a }) {
    const l = G(), i = /* @__PURE__ */ new Set(), r = { ...e.model };
    Oe(zt, {
      get model() {
        return e.model;
      },
      get required() {
        return e.required;
      },
      get rules() {
        return e.rules;
      },
      get labelWidth() {
        return e.labelWidth;
      },
      get layout() {
        return e.layout;
      },
      register: (f) => i.add(f),
      unregister: (f) => i.delete(f)
    });
    const o = async () => {
      const c = (await Promise.allSettled([...i].map((m) => m.validate()))).find((m) => m.status === "rejected");
      if ((c == null ? void 0 : c.status) === "rejected") throw c.reason;
      return !0;
    }, s = () => i.forEach((f) => f.clear());
    return a({ validate: o, clearValidate: s, resetFields: () => {
      for (const f of Object.keys(e.model)) delete e.model[f];
      Object.assign(e.model, r), s();
    } }), () => {
      var m;
      const { class: f, ...c } = l;
      return n(
        "form",
        {
          ...c,
          class: L("vui-form", f, `is-${e.layout}`, { "is-pane": e.pane }),
          novalidate: !0,
          onSubmit: (y) => y.preventDefault()
        },
        (m = t.default) == null ? void 0 : m.call(t)
      );
    };
  }
}), qt = W({
  name: "VFormItem",
  inheritAttrs: !1,
  props: {
    label: { type: String, default: "" },
    labelWidth: { type: [String, Number], default: void 0 },
    prop: { type: String, default: "" },
    required: { type: Boolean, default: !1 },
    mode: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = G(), l = Se(zt, void 0), i = P(""), r = F(() => {
      var c;
      return e.prop ? ((c = l == null ? void 0 : l.rules) == null ? void 0 : c[e.prop]) || [] : [];
    }), o = F(() => {
      var c;
      return e.prop ? (c = l == null ? void 0 : l.model) == null ? void 0 : c[e.prop] : void 0;
    }), s = F(
      () => e.required || !!(l != null && l.required && e.prop) || r.value.some((c) => !!c.required)
    );
    Oe(je, {
      get label() {
        return e.label;
      }
    });
    const u = (c) => new Promise((m, y) => {
      if (c.required && Ne(o.value)) {
        y(new Error(String(c.message || `${e.label || e.prop}不能为空`)));
        return;
      }
      if (!Ne(o.value) && (c.min !== void 0 || c.max !== void 0)) {
        const E = typeof o.value == "number" ? o.value : String(o.value).length;
        if (c.min !== void 0 && E < Number(c.min) || c.max !== void 0 && E > Number(c.max)) {
          y(new Error(String(c.message || "校验失败")));
          return;
        }
      }
      if (c.pattern !== void 0 && !Ne(o.value) && !(c.pattern instanceof RegExp ? c.pattern : new RegExp(String(c.pattern))).test(String(o.value))) {
        y(new Error(String(c.message || "校验失败")));
        return;
      }
      if (typeof c.validator != "function" || Ne(o.value)) {
        m();
        return;
      }
      let w = !1;
      const A = (E) => {
        w || (w = !0, E ? y(E) : m());
      };
      try {
        const E = c.validator(c, o.value, A);
        E instanceof Promise ? E.then(() => A()).catch((v) => A(v)) : c.validator.length < 3 && A();
      } catch (E) {
        A(E);
      }
    }), f = {
      prop: e.prop,
      validate: async () => {
        i.value = "";
        const c = [...r.value];
        s.value && !c.some((m) => m.required) && c.unshift({ required: !0, message: `${e.label || e.prop}不能为空` });
        try {
          for (const m of c) await u(m);
        } catch (m) {
          throw i.value = m instanceof Error ? m.message : String(m), m;
        }
      },
      clear: () => {
        i.value = "";
      }
    };
    return re(() => {
      e.prop && (l == null || l.register(f));
    }), ue(() => l == null ? void 0 : l.unregister(f)), () => {
      var A;
      const { class: c, style: m, ...y } = a, w = Ja(
        e.labelWidth ?? (l == null ? void 0 : l.labelWidth),
        e.label,
        s.value
      );
      return n(
        "div",
        {
          ...y,
          class: L("vui-form-item", c, {
            "is-inline": (e.mode || (l == null ? void 0 : l.layout)) === "inline",
            "has-label": !!e.label,
            "is-label-hidden": !e.label && w === "0px",
            "has-error": !!i.value
          }),
          style: De(
            m,
            w ? { "--vui-form-label-width": w } : void 0
          )
        },
        [
          e.label || w !== "0px" ? n(
            "label",
            {
              class: ["vui-form-label"]
            },
            [
              s.value ? n("span", { class: "vui-required", "aria-hidden": "true" }, "*") : null,
              e.label
            ]
          ) : null,
          n(
            "div",
            {
              class: ["vui-form-control"]
            },
            [
              (A = t.default) == null ? void 0 : A.call(t),
              i.value ? n("div", { class: "vui-form-error", role: "alert" }, i.value) : null
            ]
          )
        ]
      );
    };
  }
}), Yt = W({
  name: "VInput",
  inheritAttrs: !1,
  props: {
    /** 当前输入值。 */
    modelValue: { type: [String, Number, Boolean], default: "" },
    /** 原生输入类型。 */
    type: { type: String, default: "text" },
    /** 无值时显示的输入提示。 */
    placeholder: { type: String, default: "" },
    /** 是否禁止输入和交互。 */
    disabled: { type: Boolean, default: !1 },
    /** 是否仅允许读取。 */
    readonly: { type: Boolean, default: !1 },
    /** 是否向表单语义声明必填。 */
    required: { type: Boolean, default: !1 },
    /** 前缀图标 */
    prefixIcon: { type: String, default: "" },
    /** 后缀图标 */
    suffixIcon: { type: String, default: "" },
    /** 前缀文字 */
    prefix: { type: String, default: "" },
    /** 后缀文字 */
    suffix: { type: String, default: "" },
    /** 是否可清空 */
    clearable: { type: Boolean, default: !1 },
    /** 是否显示密码切换（仅 type="password" 时有效） */
    showPassword: { type: Boolean, default: !1 },
    /** 多行输入模式下的可见行数。 */
    rows: { type: [Number, String], default: void 0 }
  },
  emits: ["update:modelValue", "blur", "change", "input", "clear", "focus"],
  setup(e, { emit: t, expose: a, slots: l }) {
    const i = G(), r = Se(je, void 0), o = P(), s = P(!1), u = P(!1), f = F(
      () => e.placeholder || rt(r == null ? void 0 : r.label, "input")
    ), c = F(
      () => Ke(r == null ? void 0 : r.label) || f.value
    ), m = F(
      () => e.clearable && !e.disabled && !e.readonly && e.modelValue !== "" && e.modelValue !== void 0 && e.modelValue !== null && s.value
    ), y = F(
      () => e.showPassword && e.type === "password" && !e.disabled
    ), w = F(() => e.type === "password" && e.showPassword ? u.value ? "text" : "password" : e.type), A = (x) => {
      const D = x.target.value, M = e.type === "number" && D !== "" ? Number(D) : D;
      t("update:modelValue", M), t("input", M);
    }, E = (x) => {
      s.value = !0, t("focus", x);
    }, v = (x) => {
      setTimeout(() => {
        s.value = !1;
      }, 150), t("blur", x);
    }, k = () => {
      var x;
      t("update:modelValue", ""), t("change", ""), t("clear"), (x = o.value) == null || x.focus();
    }, B = () => {
      u.value = !u.value;
    };
    return a({
      focus: () => {
        var x;
        return (x = o.value) == null ? void 0 : x.focus();
      },
      blur: () => {
        var x;
        return (x = o.value) == null ? void 0 : x.blur();
      },
      select: () => {
        var x;
        return (x = o.value) == null ? void 0 : x.select();
      }
    }), () => {
      var M, U;
      if (e.type === "textarea") {
        const { class: z, ...H } = i;
        return n("div", { class: L("vui-textarea-wrapper", { "is-disabled": e.disabled }) }, [
          n("textarea", {
            ...H,
            ref: o,
            class: L("vui-textarea", z, {
              "is-disabled": e.disabled,
              "is-readonly": e.readonly && !e.disabled,
              "is-focused": s.value
            }),
            value: e.modelValue ?? "",
            rows: Number(e.rows) || 3,
            placeholder: f.value,
            "aria-label": c.value || void 0,
            disabled: e.disabled,
            readonly: e.readonly,
            required: e.required,
            onInput: A,
            onFocus: E,
            onChange: (te) => t("change", te.target.value),
            onBlur: v
          }),
          e.clearable && e.modelValue ? n("span", {
            class: "vui-textarea-clear",
            onClick: k
          }, n(le, { type: "close" })) : null
        ]);
      }
      const { rest: x, root: D } = Ya(i, [
        "vui-input",
        {
          "is-disabled": e.disabled,
          "is-readonly": e.readonly && !e.disabled,
          "is-focused": s.value,
          "has-prefix": !!(e.prefixIcon || e.prefix || l.prefix),
          "has-suffix": !!(e.suffixIcon || e.suffix || l.suffix || m.value || y.value)
        }
      ]);
      return n("div", D, [
        // 前缀区域
        e.prefixIcon || e.prefix || l.prefix ? n("span", { class: "vui-input-prefix" }, [
          ((M = l.prefix) == null ? void 0 : M.call(l)) || (e.prefix ? n("span", { class: "vui-input-prefix-text" }, e.prefix) : null),
          e.prefixIcon ? n("span", { class: ["vui-input-prefix-icon", e.prefixIcon] }) : null
        ]) : null,
        // 输入框
        n("input", {
          ...x,
          ref: o,
          class: "vui-input-native",
          value: e.modelValue ?? "",
          type: w.value,
          placeholder: f.value,
          "aria-label": c.value || void 0,
          disabled: e.disabled,
          readonly: e.readonly,
          required: e.required,
          onInput: A,
          onFocus: E,
          onChange: (z) => t("change", z.target.value),
          onBlur: v
        }),
        // 后缀区域
        e.suffixIcon || e.suffix || l.suffix || m.value || y.value ? n("span", { class: "vui-input-suffix" }, [
          // 清除按钮
          m.value ? n("span", {
            class: "vui-input-clear",
            onMousedown: (z) => z.preventDefault(),
            onClick: k
          }, n(le, { type: "close" })) : null,
          // 密码切换按钮
          y.value ? n("span", {
            class: "vui-input-password-toggle",
            onMousedown: (z) => z.preventDefault(),
            onClick: B
          }, n(le, { type: u.value ? "eye-off" : "eye" })) : null,
          ((U = l.suffix) == null ? void 0 : U.call(l)) || (e.suffix ? n("span", { class: "vui-input-suffix-text" }, e.suffix) : null),
          e.suffixIcon ? n("span", { class: ["vui-input-suffix-icon", e.suffixIcon] }) : null
        ]) : null
      ]);
    };
  }
}), Jt = W({
  name: "VTextarea",
  inheritAttrs: !1,
  props: {
    /** 当前多行文本值。 */
    modelValue: { type: String, default: "" },
    /** 无值时显示的输入提示。 */
    placeholder: { type: String, default: "" },
    /** 是否禁止输入。 */
    disabled: { type: Boolean, default: !1 },
    /** 是否仅允许读取。 */
    readonly: { type: Boolean, default: !1 },
    /** 默认可见行数。 */
    rows: { type: [Number, String], default: 3 },
    /** 是否根据内容自动调整高度。 */
    autosize: { type: [Boolean, Object], default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = G(), l = Se(je, void 0), i = P(), r = F(
      () => e.placeholder || rt(l == null ? void 0 : l.label, "input")
    ), o = () => {
      !e.autosize || !i.value || (i.value.style.height = "auto", i.value.style.height = `${i.value.scrollHeight}px`);
    };
    return de(() => e.modelValue, () => queueMicrotask(o)), re(o), () => {
      const { class: s, ...u } = a;
      return n("textarea", {
        ...u,
        ref: i,
        class: L("vui-textarea", s, {
          "is-disabled": e.disabled,
          "is-readonly": e.readonly && !e.disabled
        }),
        value: e.modelValue,
        rows: Number(e.rows) || 3,
        placeholder: r.value,
        "aria-label": Ke(l == null ? void 0 : l.label) || r.value || void 0,
        disabled: e.disabled,
        readonly: e.readonly,
        onInput: (f) => {
          t("update:modelValue", f.target.value), o();
        },
        onChange: (f) => t("change", f.target.value)
      });
    };
  }
}), Xt = W({
  name: "VInputNumber",
  inheritAttrs: !1,
  props: {
    /** 当前数值。 */
    modelValue: { type: Number, default: void 0 },
    /** 允许输入的最小值。 */
    min: { type: Number, default: void 0 },
    /** 允许输入的最大值。 */
    max: { type: Number, default: void 0 },
    /** 是否禁止输入和步进操作。 */
    disabled: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = G(), l = (i) => {
      const r = Math.min(e.max ?? 1 / 0, Math.max(e.min ?? -1 / 0, i));
      t("update:modelValue", r), t("change", r);
    };
    return () => {
      const { class: i, style: r, ...o } = a;
      return n(
        "div",
        {
          class: L("vui-number", i, {
            "is-disabled": e.disabled
          }),
          style: r,
          "aria-disabled": e.disabled || void 0
        },
        [
          n("button", {
            type: "button",
            class: "vui-number-step",
            disabled: e.disabled,
            onClick: () => l(Number(e.modelValue || 0) - 1)
          }, "−"),
          n("input", {
            ...o,
            class: "vui-number-input",
            type: "number",
            value: e.modelValue ?? "",
            min: e.min,
            max: e.max,
            disabled: e.disabled,
            onInput: (s) => l(Number(s.target.value))
          }),
          n("button", {
            type: "button",
            class: "vui-number-step",
            disabled: e.disabled,
            onClick: () => l(Number(e.modelValue || 0) + 1)
          }, "+")
        ]
      );
    };
  }
});
function Je(e) {
  if (typeof e == "string" || typeof e == "number") return String(e);
  if (Array.isArray(e)) return e.map(Je).join("");
  if (!e || typeof e != "object") return "";
  const t = e;
  return typeof t.default == "function" ? Je(t.default()) : Je(t.children);
}
function Zt(e, t = []) {
  return e.forEach((a, l) => {
    if ((typeof a.type == "object" && a.type ? a.type.name : "") === "VSelectOption") {
      const r = a.props || {}, o = r.value ?? "", s = Je(a.children).trim();
      t.push({
        key: String(a.key ?? `${String(o)}-${l}`),
        value: o,
        label: String(r.label ?? (s || o)),
        disabled: r.disabled === !0 || r.disabled === ""
      });
      return;
    }
    Array.isArray(a.children) && Zt(a.children, t);
  }), t;
}
const Xa = 8, Qt = W({
  name: "VSelect",
  inheritAttrs: !1,
  props: {
    /** 当前选中值；多选模式使用数组。 */
    modelValue: { type: null, default: "" },
    /** 未选择时显示的提示。 */
    placeholder: { type: String, default: "请选择" },
    /** 是否禁止选择。 */
    disabled: { type: Boolean, default: !1 },
    /** 是否允许选择多个值。 */
    multiple: { type: Boolean, default: !1 },
    /** 是否提供清空入口。 */
    clearable: { type: Boolean, default: !1 },
    /** 是否向表单语义声明必填。 */
    required: { type: Boolean, default: !1 },
    /** 是否强制显示选项检索框。 */
    showSearch: { type: Boolean, default: !1 },
    /** 选项检索框的提示。 */
    searchPlaceholder: { type: String, default: "" },
    /** 下拉面板最小宽度。 */
    dropdownMinWidth: { type: Number, default: 0 },
    /** 下拉面板最大宽度。 */
    dropdownMaxWidth: { type: Number, default: 400 },
    /** 是否将下拉面板右边缘与父元素对齐。 */
    dropdownAlignToParent: { type: Boolean, default: !1 },
    /** 下拉宽度是否自动适应内容 */
    autoWidth: { type: Boolean, default: !0 },
    /** 兼容旧接口的选项集合。 */
    items: { type: Array, default: () => [] },
    /** 结构化选项集合。 */
    options: { type: Array, default: () => [] }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = G(), i = Se(je, void 0), r = P(), o = P(), s = P(), u = P(""), f = P(!1), c = P(!1), m = P(0), y = P({}), w = F(
      () => e.placeholder && e.placeholder !== "请选择" ? e.placeholder : rt(i == null ? void 0 : i.label, "select")
    ), A = F(
      () => Ke(i == null ? void 0 : i.label) || w.value
    ), E = F(() => e.options.length ? e.options : e.items), v = P([]), k = () => {
      f.value = !1, u.value = "";
    }, B = (V) => {
      var N, R;
      const T = V.target;
      !((N = r.value) != null && N.contains(T)) && !((R = o.value) != null && R.contains(T)) && k();
    };
    let x = null;
    const D = () => (x || (x = document.createElement("span"), x.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:14px;padding:0 12px;", document.body.appendChild(x)), x), M = (V) => {
      if (!e.autoWidth) return 0;
      const T = D();
      let N = 0;
      const R = V.slice(0, 20);
      for (const j of R)
        T.textContent = j.label, N = Math.max(N, T.getBoundingClientRect().width);
      return Math.ceil(N) + 32;
    }, U = () => {
      if (!f.value || !r.value) return;
      const V = e.dropdownAlignToParent && r.value.parentElement || r.value, T = V.getBoundingClientRect().width, N = v.value.length > 0 ? M(v.value) : 0, R = Math.max(T, e.dropdownMinWidth), j = e.autoWidth ? Math.max(R, Math.min(N, e.dropdownMaxWidth)) : R, Y = Ut(
        V,
        j,
        te(m.value) ? 300 : 248
      );
      c.value = Y.dropUp, y.value = Y.style;
    }, z = () => {
      if (!e.disabled) {
        if (f.value) {
          k();
          return;
        }
        f.value = !0, me(() => {
          var V;
          U(), (V = s.value) == null || V.focus({ preventScroll: !0 });
        });
      }
    }, H = (V) => {
      const T = u.value.trim().toLowerCase();
      return T ? V.label.toLowerCase().includes(T) || String(V.value ?? "").toLowerCase().includes(T) : !0;
    }, te = (V) => e.showSearch || V >= Xa, ne = (V) => te(V) ? n("div", { class: "vui-select-search" }, [
      n("input", {
        ref: s,
        type: "text",
        class: "vui-select-search-input",
        value: u.value,
        placeholder: e.searchPlaceholder || "输入关键字检索",
        "aria-label": "选项检索",
        autocomplete: "off",
        onInput: (T) => {
          u.value = T.target.value;
        },
        // 弹层常位于表单内，回车不能触发提交；Esc 交给根节点统一关闭
        onKeydown: (T) => {
          T.key === "Enter" && T.preventDefault();
        }
      })
    ]) : null, ae = (V, T) => {
      const N = Array.isArray(e.modelValue) ? [...e.modelValue] : [], R = T ? N.filter((j) => String(j) !== String(V)) : [...N, V];
      t("update:modelValue", R), t("change", R);
    };
    re(() => {
      document.addEventListener("mousedown", B), window.addEventListener("resize", U), window.addEventListener("scroll", U, !0);
    }), ue(() => {
      document.removeEventListener("mousedown", B), window.removeEventListener("resize", U), window.removeEventListener("scroll", U, !0), x && (x.remove(), x = null);
    }), de(() => e.disabled, (V) => {
      V && k();
    });
    const ie = (V) => {
      t("update:modelValue", V), t("change", V), k();
    };
    return () => {
      var C;
      const { class: V, style: T, ...N } = l, R = ((C = a.default) == null ? void 0 : C.call(a)) || [], j = E.value.map((p, K) => {
        const h = p.value ?? p.id ?? p._id ?? K, d = p.label ?? p.name ?? p.title ?? h;
        return {
          key: String(h),
          value: h,
          label: String(d),
          disabled: !!p.disabled
        };
      });
      if (j.push(...Zt(R)), m.value = j.length, v.value = j, e.multiple) {
        const p = Array.isArray(e.modelValue) ? e.modelValue : [], K = new Set(p.map(String)), h = p.map((d) => {
          const b = j.find(($) => String($.value) === String(d));
          return {
            value: d,
            label: (b == null ? void 0 : b.label) || Ce(d)
          };
        });
        return n(
          "div",
          {
            ref: r,
            class: L("vui-select", "vui-select-multiple", V, {
              "is-multiple": !0,
              "is-open": f.value,
              "is-disabled": e.disabled,
              "is-drop-up": c.value
            }),
            style: T,
            onKeydown: (d) => {
              d.key === "Escape" && k();
            }
          },
          [
            n(
              "button",
              {
                ...N,
                type: "button",
                class: "vui-select-multiple-trigger",
                disabled: e.disabled,
                "aria-expanded": String(f.value),
                "aria-haspopup": "listbox",
                "aria-label": A.value || void 0,
                onClick: z
              },
              [
                n(
                  "span",
                  { class: "vui-select-values" },
                  h.length ? [
                    ...h.slice(0, 2).map(
                      (d) => n("span", { class: "vui-select-chip", key: String(d.value) }, [
                        n("span", { class: "vui-select-chip-label" }, d.label),
                        e.disabled ? null : n(
                          "span",
                          {
                            class: "vui-select-chip-remove",
                            role: "button",
                            "aria-label": `移除${d.label}`,
                            onMousedown: (b) => b.stopPropagation(),
                            onClick: (b) => {
                              b.stopPropagation(), ae(d.value, !0);
                            }
                          },
                          n(le, { type: "close" })
                        )
                      ])
                    ),
                    h.length > 2 ? n(
                      "span",
                      { class: "vui-select-selection-count" },
                      `+${h.length - 2}`
                    ) : null
                  ] : n("span", { class: "vui-select-placeholder" }, w.value)
                ),
                n(le, { class: "vui-select-chevron", type: "chevron-down" })
              ]
            ),
            f.value ? n(xe, { to: "body" }, [
              n(
                "div",
                {
                  ref: o,
                  class: L("vui-select-popover", "is-teleported", {
                    "has-search": te(j.length),
                    "is-drop-up": c.value
                  }),
                  style: y.value,
                  role: "listbox",
                  "aria-multiselectable": "true",
                  onKeydown: (d) => {
                    d.key === "Escape" && k();
                  }
                },
                [
                  ne(j.length),
                  ...j.length ? (() => {
                    const d = j.filter(H);
                    return d.length ? d.map((b) => {
                      const $ = K.has(String(b.value));
                      return n(
                        "button",
                        {
                          type: "button",
                          key: b.key,
                          class: L("vui-select-option", {
                            "is-selected": $
                          }),
                          role: "option",
                          disabled: b.disabled,
                          "aria-selected": String($),
                          onClick: () => ae(b.value, $)
                        },
                        [
                          n("span", { class: "vui-select-option-check", "aria-hidden": "true" }, $ ? n(le, { type: "check" }) : void 0),
                          n("span", { class: "vui-select-option-label" }, b.label)
                        ]
                      );
                    }) : [n("div", { class: "vui-select-empty" }, "无匹配选项")];
                  })() : [n("div", { class: "vui-select-empty" }, "暂无可选项")]
                ]
              )
            ]) : null
          ]
        );
      }
      const Y = Ne(e.modelValue), q = Y ? void 0 : j.find((p) => String(p.value) === String(e.modelValue)), X = j.filter(H), S = e.clearable && !u.value.trim() && !j.some((p) => Ne(p.value)) ? [
        {
          key: "__vui-select-placeholder",
          value: "",
          label: w.value,
          disabled: !1
        },
        ...X
      ] : X;
      return n(
        "div",
        {
          ref: r,
          class: L("vui-select", "vui-select-single", V, {
            "is-open": f.value,
            "is-disabled": e.disabled,
            "is-drop-up": c.value,
            "is-placeholder": Y
          }),
          style: T,
          onKeydown: (p) => {
            p.key === "Escape" && k();
          }
        },
        [
          n(
            "button",
            {
              ...N,
              type: "button",
              class: "vui-select-trigger",
              disabled: e.disabled,
              role: "combobox",
              "aria-expanded": String(f.value),
              "aria-haspopup": "listbox",
              "aria-required": String(e.required),
              "aria-label": A.value || void 0,
              onClick: z
            },
            [
              n(
                "span",
                {
                  class: L("vui-select-value", {
                    "is-placeholder": Y
                  })
                },
                (q == null ? void 0 : q.label) || (Y ? w.value : Ce(e.modelValue))
              ),
              n(le, { class: "vui-select-chevron", type: "chevron-down" })
            ]
          ),
          f.value ? n(xe, { to: "body" }, [
            n(
              "div",
              {
                ref: o,
                class: L("vui-select-popover", "is-teleported", {
                  "has-search": te(j.length),
                  "is-drop-up": c.value
                }),
                style: y.value,
                role: "listbox",
                onKeydown: (p) => {
                  p.key === "Escape" && k();
                }
              },
              [
                ne(j.length),
                ...S.length ? S.map((p) => {
                  const K = String(p.value ?? "") === String(e.modelValue ?? "");
                  return n(
                    "button",
                    {
                      type: "button",
                      key: p.key,
                      class: L("vui-select-option", "is-single", {
                        "is-selected": K
                      }),
                      role: "option",
                      disabled: p.disabled,
                      "aria-selected": String(K),
                      onClick: () => ie(p.value)
                    },
                    [
                      n(
                        "span",
                        {
                          class: "vui-select-option-check",
                          "aria-hidden": "true"
                        },
                        K ? n(le, { type: "check" }) : void 0
                      ),
                      n("span", { class: "vui-select-option-label" }, p.label)
                    ]
                  );
                }) : [
                  n(
                    "div",
                    { class: "vui-select-empty" },
                    j.length ? "无匹配选项" : "暂无可选项"
                  )
                ]
              ]
            )
          ]) : null
        ]
      );
    };
  }
}), Za = W({
  name: "VSelectOption",
  inheritAttrs: !1,
  props: {
    value: { type: null, default: "" },
    label: { type: [String, Number], default: "" },
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var l;
      return n(
        "option",
        {
          ...a,
          value: String(e.value ?? ""),
          disabled: e.disabled,
          "data-vui-value": JSON.stringify(e.value)
        },
        ((l = t.default) == null ? void 0 : l.call(t)) || String(e.label ?? e.value ?? "")
      );
    };
  }
}), Qa = ["一", "二", "三", "四", "五", "六", "日"];
function pe(e) {
  const t = String(e || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!t) return;
  const a = Number(t[1]), l = Number(t[2]), i = Number(t[3]), r = new Date(a, l - 1, i);
  if (!(r.getFullYear() !== a || r.getMonth() !== l - 1 || r.getDate() !== i))
    return r;
}
function ce(e) {
  const t = e.getFullYear(), a = String(e.getMonth() + 1).padStart(2, "0"), l = String(e.getDate()).padStart(2, "0");
  return `${t}-${a}-${l}`;
}
function Ve(e, t) {
  return !!(e && t && ce(e) === ce(t));
}
function ye(e) {
  return new Date(e.getFullYear(), e.getMonth(), 1);
}
function Pe(e, t) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate() + t);
}
function el(e, t) {
  return new Date(e.getFullYear(), e.getMonth() + t, 1);
}
function ze() {
  const e = /* @__PURE__ */ new Date();
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}
function tl(e) {
  const t = ye(e), a = (t.getDay() + 6) % 7, l = Pe(t, -a);
  return Array.from({ length: 42 }, (i, r) => Pe(l, r));
}
function al(e) {
  const t = String(e || "").replace("T", " "), a = t.match(/\s(\d{2}):(\d{2})/);
  return {
    date: pe(t),
    hour: (a == null ? void 0 : a[1]) || "09",
    minute: (a == null ? void 0 : a[2]) || "00"
  };
}
const ea = W({
  name: "VDatePicker",
  inheritAttrs: !1,
  props: {
    /** 当前日期、时间或范围值。 */
    modelValue: { type: null, default: "" },
    /** 日期选择精度。 */
    type: { type: String, default: "date" },
    /** 未选择时显示的提示。 */
    placeholder: { type: String, default: "" },
    /** 是否禁止选择。 */
    disabled: { type: Boolean, default: !1 },
    /** 是否向表单语义声明必填。 */
    required: { type: Boolean, default: !1 },
    /** 是否选择起止范围。 */
    range: { type: Boolean, default: !1 },
    /** 是否允许清空当前值。 */
    allowClear: { type: Boolean, default: !1 },
    /** 可选择的最小日期。 */
    min: { type: String, default: "" },
    /** 可选择的最大日期。 */
    max: { type: String, default: "" }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = G(), l = Se(je, void 0), i = P(), r = P(), o = P(), s = P(!1), u = P(!1), f = P(!1), c = P({}), m = P(ye(ze())), y = P(ze()), w = P(), A = P(), E = P("09"), v = P("00"), k = F(
      () => e.placeholder || rt(l == null ? void 0 : l.label, "select")
    ), B = F(
      () => Ke(l == null ? void 0 : l.label) || k.value
    ), x = F(() => pe(e.min)), D = F(() => pe(e.max)), M = F(
      () => e.range ? void 0 : pe(e.modelValue)
    ), U = F(() => !e.range || !Array.isArray(e.modelValue) ? [void 0, void 0] : [pe(e.modelValue[0]), pe(e.modelValue[1])]), z = F(() => {
      if (e.range) {
        const b = Array.isArray(e.modelValue) ? e.modelValue : [], $ = pe(b[0]), g = pe(b[1]), _ = $ ? ce($) : String(b[0] || ""), I = g ? ce(g) : String(b[1] || "");
        return _ && I ? `${_} 至 ${I}` : _;
      }
      const h = String(e.modelValue || "");
      if (e.type === "datetime") return h.replace("T", " ").slice(0, 16);
      const d = pe(h);
      return d ? ce(d) : h;
    }), H = (h) => {
      const d = ce(h);
      return !!(x.value && d < ce(x.value) || D.value && d > ce(D.value) || e.range && w.value && h <= w.value);
    }, te = (h) => x.value && h < x.value ? x.value : D.value && h > D.value ? D.value : h, ne = (h) => {
      t("update:modelValue", h), t("change", h);
    }, ae = (h = !1) => {
      s.value = !1, w.value = void 0, h && me(() => {
        var d;
        return (d = r.value) == null ? void 0 : d.focus();
      });
    }, ie = () => me(() => {
      var h, d;
      (d = (h = o.value) == null ? void 0 : h.querySelector(
        `.vui-calendar-day[data-date="${ce(y.value)}"]`
      )) == null || d.focus();
    }), V = () => {
      const h = al(e.modelValue), d = U.value[0] || U.value[1], b = te(M.value || d || h.date || ze());
      y.value = b, m.value = ye(b), w.value = void 0, A.value = h.date || b, E.value = h.hour, v.value = h.minute;
    }, T = (h = !1) => {
      e.disabled || (V(), s.value = !0, me(() => {
        p(), h && ie();
      }));
    }, N = () => {
      s.value ? ae() : T(!1);
    }, R = (h) => {
      h == null || h.stopPropagation(), ne(e.range ? ["", ""] : ""), ae(), me(() => {
        var d;
        return (d = r.value) == null ? void 0 : d.focus();
      });
    }, j = (h) => {
      if (!H(h)) {
        if (y.value = h, m.value = ye(h), e.range) {
          if (!w.value) {
            w.value = h, y.value = Pe(h, 1), m.value = ye(y.value), ie();
            return;
          }
          ne([w.value, h].map(ce)), ae(!0);
          return;
        }
        if (e.type === "datetime") {
          A.value = h, ie();
          return;
        }
        ne(ce(h)), ae(!0);
      }
    }, Y = () => {
      const h = A.value || y.value, d = String(Math.min(23, Math.max(0, Number(E.value) || 0))).padStart(2, "0"), b = String(Math.min(59, Math.max(0, Number(v.value) || 0))).padStart(2, "0");
      ne(`${ce(h)} ${d}:${b}`), ae(!0);
    }, q = (h) => {
      let d = Pe(y.value, h);
      const b = h < 0 ? -1 : 1;
      let $ = 0;
      for (; H(d) && $ < 370; )
        d = Pe(d, b), $ += 1;
      H(d) || (y.value = d, m.value = ye(d), ie());
    }, X = (h) => {
      const d = el(m.value, h), b = te(
        new Date(
          d.getFullYear(),
          d.getMonth(),
          Math.min(
            y.value.getDate(),
            new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          )
        )
      );
      m.value = ye(b), y.value = b, ie();
    }, S = (h) => {
      const d = {
        ArrowLeft: () => q(-1),
        ArrowRight: () => q(1),
        ArrowUp: () => q(-7),
        ArrowDown: () => q(7),
        Home: () => q(-((y.value.getDay() + 6) % 7)),
        End: () => q(6 - (y.value.getDay() + 6) % 7),
        PageUp: () => X(-1),
        PageDown: () => X(1)
      };
      if (h.key === "Escape") {
        h.preventDefault(), ae(!0);
        return;
      }
      if (h.key === "Enter" || h.key === " ") {
        h.preventDefault(), j(y.value);
        return;
      }
      const b = d[h.key];
      b && (h.preventDefault(), b());
    }, C = (h) => {
      var b, $;
      const d = h.target;
      !((b = i.value) != null && b.contains(d)) && !(($ = o.value) != null && $.contains(d)) && ae();
    }, p = () => {
      if (!s.value || !i.value) return;
      const h = i.value.getBoundingClientRect(), d = Ut(
        i.value,
        328,
        e.type === "datetime" ? 450 : 390,
        h.left + 328 > window.innerWidth - Ee
      );
      u.value = d.dropUp, f.value = d.alignRight, c.value = d.style;
    };
    re(() => {
      document.addEventListener("mousedown", C), window.addEventListener("resize", p), window.addEventListener("scroll", p, !0);
    }), ue(() => {
      document.removeEventListener("mousedown", C), window.removeEventListener("resize", p), window.removeEventListener("scroll", p, !0);
    }), de(
      () => e.disabled,
      (h) => {
        h && ae();
      }
    ), de(
      () => e.modelValue,
      () => {
        s.value || V();
      },
      { deep: !0 }
    );
    const K = () => {
      var Q, ee;
      const h = m.value.getFullYear(), d = m.value.getMonth(), b = ze(), $ = w.value || U.value[0], g = w.value ? void 0 : U.value[1], _ = ((Q = x.value) == null ? void 0 : Q.getFullYear()) ?? b.getFullYear() - 100, I = ((ee = D.value) == null ? void 0 : ee.getFullYear()) ?? b.getFullYear() + 30, Z = Array.from(
        { length: Math.max(1, I - _ + 1) },
        (J, oe) => _ + oe
      ), O = tl(m.value);
      return n(
        "div",
        {
          ref: o,
          class: "vui-calendar-popover",
          style: c.value,
          role: "dialog",
          "aria-label": B.value || "选择日期",
          onKeydown: S
        },
        [
          n("div", { class: "vui-calendar-header" }, [
            n(
              "button",
              {
                type: "button",
                class: "vui-calendar-nav",
                "aria-label": "上个月",
                onClick: () => X(-1)
              },
              "‹"
            ),
            n("div", { class: "vui-calendar-title" }, [
              n(
                "select",
                {
                  class: "vui-calendar-select",
                  value: h,
                  "aria-label": "选择年份",
                  onChange: (J) => {
                    const oe = Number(J.target.value), se = te(new Date(oe, d, 1));
                    m.value = ye(se), y.value = se, ie();
                  }
                },
                Z.map((J) => n("option", { value: J, key: J }, `${J}年`))
              ),
              n(
                "select",
                {
                  class: "vui-calendar-select",
                  value: d,
                  "aria-label": "选择月份",
                  onChange: (J) => {
                    const oe = Number(J.target.value), se = te(new Date(h, oe, 1));
                    m.value = ye(se), y.value = se, ie();
                  }
                },
                Array.from(
                  { length: 12 },
                  (J, oe) => n("option", { value: oe, key: oe }, `${oe + 1}月`)
                )
              )
            ]),
            n(
              "button",
              {
                type: "button",
                class: "vui-calendar-nav",
                "aria-label": "下个月",
                onClick: () => X(1)
              },
              "›"
            )
          ]),
          n(
            "div",
            { class: "vui-calendar-weekdays", "aria-hidden": "true" },
            Qa.map((J) => n("span", { key: J }, J))
          ),
          n(
            "div",
            { class: "vui-calendar-grid", role: "grid" },
            O.map((J) => {
              const oe = ce(J), se = J.getMonth() !== d, ot = H(J), bt = Ve(J, M.value) || Ve(J, $) || Ve(J, g) || e.type === "datetime" && Ve(J, A.value), Oa = !!($ && g && J > $ && J < g);
              return n(
                "button",
                {
                  type: "button",
                  key: oe,
                  class: L("vui-calendar-day", {
                    "is-outside": se,
                    "is-today": Ve(J, b),
                    "is-selected": bt,
                    "is-in-range": Oa,
                    "is-active": Ve(J, y.value)
                  }),
                  "data-date": oe,
                  role: "gridcell",
                  tabindex: Ve(J, y.value) ? 0 : -1,
                  disabled: ot,
                  "aria-selected": String(bt),
                  "aria-label": `${J.getFullYear()}年${J.getMonth() + 1}月${J.getDate()}日`,
                  onClick: () => j(J)
                },
                String(J.getDate())
              );
            })
          ),
          e.type === "datetime" ? n("div", { class: "vui-calendar-time" }, [
            n("span", { class: "vui-calendar-time-label" }, "时间"),
            n("input", {
              class: "vui-calendar-time-input",
              type: "number",
              min: 0,
              max: 23,
              value: E.value,
              "aria-label": "小时",
              onInput: (J) => {
                E.value = J.target.value;
              }
            }),
            n("span", { "aria-hidden": "true" }, ":"),
            n("input", {
              class: "vui-calendar-time-input",
              type: "number",
              min: 0,
              max: 59,
              value: v.value,
              "aria-label": "分钟",
              onInput: (J) => {
                v.value = J.target.value;
              }
            })
          ]) : null,
          n("div", { class: "vui-calendar-footer" }, [
            n(
              "div",
              { class: "vui-calendar-footer-start" },
              e.range && w.value ? n("span", { class: "vui-calendar-hint", role: "status" }, "请选择结束日期") : n(
                "button",
                {
                  type: "button",
                  class: "vui-calendar-text-button",
                  disabled: H(b),
                  onClick: () => j(b)
                },
                "今天"
              )
            ),
            n("div", { class: "vui-calendar-actions" }, [
              e.allowClear && z.value ? n(
                "button",
                {
                  type: "button",
                  class: "vui-calendar-text-button",
                  onClick: R
                },
                "清除"
              ) : null,
              e.type === "datetime" ? [
                n(
                  "button",
                  {
                    type: "button",
                    class: "vui-calendar-text-button",
                    onClick: () => ae(!0)
                  },
                  "取消"
                ),
                n(
                  "button",
                  {
                    type: "button",
                    class: "vui-calendar-confirm",
                    onClick: Y
                  },
                  "确定"
                )
              ] : null
            ])
          ])
        ]
      );
    };
    return () => {
      const { class: h, style: d, ...b } = a;
      return e.type === "month" || e.type === "year" ? n(
        "div",
        {
          class: L("vui-date", h, {
            "is-disabled": e.disabled
          }),
          style: d
        },
        [
          n("input", {
            ...b,
            class: "vui-date-native",
            type: "month",
            value: String(e.modelValue || "").slice(0, 7),
            min: e.min ? e.min.slice(0, 7) : void 0,
            max: e.max ? e.max.slice(0, 7) : void 0,
            placeholder: k.value,
            "aria-label": B.value || void 0,
            disabled: e.disabled,
            required: e.required,
            onInput: ($) => ne($.target.value)
          }),
          n("span", { class: "vui-date-icon", "aria-hidden": "true" }, [
            n("span", { class: "vui-date-icon-binding" }),
            n("span", { class: "vui-date-icon-page" })
          ])
        ]
      ) : n(
        "div",
        {
          ref: i,
          class: L("vui-date", h, {
            "is-range": e.range,
            "is-open": s.value,
            "is-disabled": e.disabled,
            "is-drop-up": u.value,
            "is-align-right": f.value,
            "is-placeholder": !z.value
          }),
          style: d,
          onKeydown: ($) => {
            $.key === "Escape" && ae(!0);
          }
        },
        [
          n(
            "button",
            {
              ...b,
              ref: r,
              type: "button",
              class: "vui-date-trigger",
              disabled: e.disabled,
              role: "combobox",
              "aria-expanded": String(s.value),
              "aria-haspopup": "dialog",
              "aria-required": String(e.required),
              "aria-label": B.value || void 0,
              onClick: N,
              onKeydown: ($) => {
                !s.value && ($.key === "ArrowDown" || $.key === "Enter" || $.key === " ") && ($.preventDefault(), T(!0));
              }
            },
            [
              n(
                "span",
                {
                  class: L("vui-date-value", {
                    "is-placeholder": !z.value
                  })
                },
                z.value || k.value
              ),
              e.allowClear && z.value && !e.disabled ? n(
                "span",
                {
                  class: "vui-date-clear",
                  role: "button",
                  tabindex: 0,
                  "aria-label": "清除日期",
                  onMousedown: ($) => $.preventDefault(),
                  onClick: R,
                  onKeydown: ($) => {
                    ($.key === "Enter" || $.key === " ") && R($);
                  }
                },
                n(le, { type: "close" })
              ) : n("span", { class: "vui-date-icon", "aria-hidden": "true" }, [
                n("span", { class: "vui-date-icon-binding" }),
                n("span", { class: "vui-date-icon-page" })
              ])
            ]
          ),
          s.value ? n(xe, { to: "body" }, [K()]) : null
        ]
      );
    };
  }
}), ta = W({
  name: "VSwitch",
  inheritAttrs: !1,
  props: {
    /** 当前开关值。 */
    modelValue: { type: [Boolean, String, Number], default: !1 },
    /** 是否禁止切换。 */
    disabled: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = G(), l = F(() => e.modelValue === !0 || e.modelValue === 1 || e.modelValue === "1"), i = () => {
      if (e.disabled) return;
      const r = !l.value;
      t("update:modelValue", r), t("change", r);
    };
    return () => {
      const { class: r, ...o } = a;
      return n(
        "button",
        {
          ...o,
          type: "button",
          role: "switch",
          "aria-checked": l.value,
          disabled: e.disabled,
          class: L("vui-switch", r, {
            "is-checked": l.value,
            "is-disabled": e.disabled
          }),
          onClick: i
        },
        n("span", { class: "vui-switch-thumb" })
      );
    };
  }
}), aa = W({
  name: "VRadioGroup",
  inheritAttrs: !1,
  props: {
    /** 当前选中值。 */
    modelValue: { type: null, default: "" },
    /** 是否禁止组内所有选项。 */
    disabled: { type: Boolean, default: !1 },
    /** 无需插槽时使用的结构化选项。 */
    options: {
      type: Array,
      default: () => []
    }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = G(), i = F(() => e.modelValue);
    return Oe(Wt, {
      value: i,
      update: (r) => {
        t("update:modelValue", r), t("change", r);
      }
    }), () => {
      var u;
      const { class: r, ...o } = l, s = (u = a.default) == null ? void 0 : u.call(a);
      return n(
        "div",
        { ...o, class: L("vui-radio-group", r), role: "radiogroup" },
        s != null && s.length ? s : e.options.map((f) => n(
          mt,
          { value: f.value, disabled: e.disabled || f.disabled },
          { default: () => f.label }
        ))
      );
    };
  }
}), mt = W({
  name: "VRadio",
  inheritAttrs: !1,
  props: {
    /** 当前单选项代表的值。 */
    value: { type: null, default: "" },
    /** 是否禁止选择当前项。 */
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = Se(Wt, void 0);
    return () => {
      var o;
      const { class: i, ...r } = a;
      return n("label", {
        class: L("vui-radio", i, {
          "is-disabled": e.disabled
        }),
        "aria-disabled": e.disabled || void 0
      }, [
        n("input", {
          ...r,
          type: "radio",
          checked: (l == null ? void 0 : l.value.value) === e.value,
          disabled: e.disabled,
          onChange: () => l == null ? void 0 : l.update(e.value)
        }),
        n("span", { class: "vui-radio-dot" }),
        n("span", { class: "vui-radio-label" }, (o = t.default) == null ? void 0 : o.call(t))
      ]);
    };
  }
}), la = W({
  name: "VTag",
  inheritAttrs: !1,
  props: {
    /** 标签的语义色类型。 */
    type: { type: String, default: "default" },
    /** 是否展示移除按钮。 */
    closable: { type: Boolean, default: !1 },
    /** 是否禁止移除操作。 */
    disabled: { type: Boolean, default: !1 }
  },
  emits: ["close"],
  setup(e, { slots: t, emit: a }) {
    const l = G();
    return () => {
      var o;
      const { class: i, ...r } = l;
      return n(
        "span",
        {
          ...r,
          class: L("vui-tag", `is-${e.type}`, i, {
            "is-disabled": e.disabled
          })
        },
        [
          (o = t.default) == null ? void 0 : o.call(t),
          e.closable ? n(
            "button",
            {
              type: "button",
              class: "vui-tag-close",
              disabled: e.disabled,
              "aria-label": "关闭",
              onClick: (s) => {
                s.stopPropagation(), a("close", s);
              }
            },
            [n(le, { type: "close" })]
          ) : null
        ]
      );
    };
  }
}), na = W({
  name: "VTagInput",
  inheritAttrs: !1,
  props: {
    /** 当前标签值集合。 */
    modelValue: { type: Array, default: () => [] },
    /** 是否允许清空全部标签。 */
    allowClear: { type: Boolean, default: !1 },
    /** 是否禁止新增标签但允许查看现有值。 */
    disabledInput: { type: Boolean, default: !1 },
    /** 是否禁止全部交互。 */
    disabled: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = G(), l = P(""), i = (s) => s && typeof s == "object" && "label" in s ? String(s.label ?? "") : Ce(s), r = (s) => {
      t("update:modelValue", s), t("change", s);
    }, o = () => {
      const s = l.value.trim();
      s && (r([...e.modelValue, s]), l.value = "");
    };
    return () => {
      const { class: s, style: u, ...f } = a;
      return n(
        "div",
        {
          class: L("vui-tag-input", s, {
            "is-disabled": e.disabled
          }),
          style: u,
          "aria-disabled": e.disabled || void 0
        },
        [
          ...e.modelValue.map(
            (c, m) => n("span", { class: "vui-tag-input-item", key: `${Ce(c)}-${m}` }, [
              i(c),
              e.disabled ? null : n("button", {
                type: "button",
                "aria-label": "移除",
                onClick: () => r(e.modelValue.filter((y, w) => w !== m))
              }, n(le, { type: "close" }))
            ])
          ),
          e.disabledInput ? null : n("input", {
            ...f,
            value: l.value,
            disabled: e.disabled,
            onInput: (c) => {
              l.value = c.target.value;
            },
            onKeydown: (c) => {
              (c.key === "Enter" || c.key === ",") && (c.preventDefault(), o());
            },
            onBlur: o
          }),
          e.allowClear && e.modelValue.length && !e.disabled ? n("button", { type: "button", class: "vui-tag-clear", onClick: () => r([]) }, "清空") : null
        ]
      );
    };
  }
}), ll = 72, nl = 34, il = 8, rl = 28, ia = 88, ol = /[⺀-鿿豈-﫿　-〿＀-￯]/;
function sl(e) {
  return [...e].reduce((t, a) => t + (ol.test(a) ? 14 : 8), 0);
}
function ul(e) {
  return Math.max(ll, Math.ceil(sl(e.trim())) + nl);
}
function cl(e) {
  const t = e.filter((a) => a.trim());
  return t.length ? t.reduce((a, l) => a + ul(l) + il, 0) + rl : 0;
}
function dl(e) {
  return Math.max(ia, ...e.map(cl));
}
const fl = 40, vl = 720, ml = 160;
function gl(e, t) {
  const a = e.reduce((l, i) => l + i, 0) + (t ? fl : 0);
  return Math.max(vl, a);
}
function Be(e) {
  return e ? e.title === "操作" || e.key === "operator" || e.customSlot === "operator" : !1;
}
function St(e, t, a) {
  return e[t] ?? e._id ?? e.id ?? a;
}
function Xe(e) {
  if (e == null || typeof e == "boolean") return "";
  if (typeof e == "string" || typeof e == "number") return String(e);
  if (Array.isArray(e)) return e.map(Xe).join("");
  const t = e.children;
  return t == null ? "" : typeof t == "string" || typeof t == "number" ? String(t) : Array.isArray(t) ? t.map(Xe).join("") : typeof t == "object" && typeof t.default == "function" ? Xe(t.default()) : "";
}
function pl(e) {
  var t;
  return e.type === vt || e.type === "button" || ((t = e.type) == null ? void 0 : t.name) === "VButton";
}
function Ze(e, t = []) {
  if (e == null || typeof e != "object") return t;
  if (Array.isArray(e))
    return e.forEach((i) => Ze(i, t)), t;
  const a = e;
  if (pl(a))
    return t.push(Xe(a)), t;
  const l = a.children;
  return Array.isArray(l) ? l.forEach((i) => Ze(i, t)) : l && typeof l == "object" && typeof l.default == "function" && Ze(l.default(), t), t;
}
function kt(e) {
  return `"${Ce(e).replaceAll('"', '""')}"`;
}
const ra = W({
  name: "VTable",
  inheritAttrs: !1,
  props: {
    /** 表格列定义。 */
    columns: { type: Array, default: () => [] },
    /** 当前展示的数据行。 */
    dataSource: { type: Array, default: () => [] },
    /** 分页配置；false 表示不展示内部分页。 */
    page: { type: [Object, Boolean], default: !1 },
    /** 是否展示加载状态。 */
    loading: { type: Boolean, default: !1 },
    /** 当前选中行的唯一键集合。 */
    selectedKeys: { type: Array, default: () => [] },
    /** 是否展示行选择框。 */
    showCheckbox: { type: Boolean, default: !1 },
    /** 是否展示默认工具栏。 */
    defaultToolbar: { type: Boolean, default: !1 },
    /** 表格内容区高度。 */
    height: { type: [String, Number], default: "" },
    /** 行数据中的唯一键字段名。 */
    id: { type: String, default: "_id" },
    /** 表格密度。 */
    size: { type: String, default: "md" },
    /** 行类名或行类名计算函数。 */
    rowClassName: { type: [String, Function], default: "" },
    /** 树形数据的字段映射。 */
    treeProps: { type: Object, default: () => ({}) },
    /** 是否默认展开全部树节点。 */
    defaultExpandAll: { type: Boolean, default: !1 },
    /** 是否允许拖动列边缘调整宽度。 */
    resize: { type: Boolean, default: !1 },
    /** 启用表头列拖拽排序 */
    draggable: { type: Boolean, default: !1 },
    /** 全量数据，用于导出全部数据。如果提供此属性，导出时会使用此数据而非 dataSource */
    exportAllData: { type: Array, default: void 0 },
    /** 异步获取全量数据的函数，用于导出全部数据 */
    fetchAllData: { type: Function, default: void 0 }
  },
  emits: ["update:selectedKeys", "change", "sortChange", "columnOrderChange"],
  setup(e, { slots: t, emit: a, expose: l }) {
    const i = G(), r = P({ key: "", order: "" }), o = F(() => new Set(e.selectedKeys.map(String))), s = F(
      () => e.columns.some((d) => d.type === "checkbox") || e.showCheckbox
    ), u = F(() => e.columns.filter((d) => d.type !== "checkbox")), f = F(() => u.value.some(Be)), c = P({
      dragging: !1,
      fromIndex: -1,
      toIndex: -1,
      dragOverIndex: -1
    }), m = F(() => u.value.length > 2), y = F(
      () => u.value.length > 2 && Be(u.value[u.value.length - 1])
    ), w = (d) => ({
      "is-sticky-left": m.value && d === 0,
      /* 勾选列在前时，第一个数据列要让开它的宽度 */
      "is-sticky-left-offset": m.value && d === 0 && s.value,
      "is-sticky-right": y.value && d === u.value.length - 1
    }), A = P(null);
    let E = null;
    const v = () => {
      const d = A.value;
      if (!d || !s.value) return;
      const b = d.querySelector("thead th");
      if (!b) return;
      const $ = `${Math.round(b.getBoundingClientRect().width)}px`;
      d.style.getPropertyValue("--vui-table-check-w") !== $ && d.style.setProperty("--vui-table-check-w", $);
    };
    re(() => {
      v(), !(typeof ResizeObserver > "u" || !A.value) && (E = new ResizeObserver(v), E.observe(A.value));
    }), Ba(v), ue(() => E == null ? void 0 : E.disconnect());
    const k = F(() => e.treeProps.children || "children"), B = F(() => {
      if (!e.defaultExpandAll) return e.dataSource.map(($) => ({ row: $, level: 0 }));
      const d = [], b = ($, g) => {
        $.forEach((_) => {
          d.push({ row: _, level: g });
          const I = _[k.value];
          Array.isArray(I) && b(I, g + 1);
        });
      };
      return b(e.dataSource, 0), d;
    }), x = F(() => {
      const d = u.value.find(Be);
      if (!d) return 0;
      const b = d.customSlot ? t[d.customSlot] : void 0;
      return b ? dl(
        B.value.map(
          ({ row: $ }, g) => Ze(b({ row: $, column: d, rowIndex: g }))
        )
      ) : ia;
    }), D = (d) => {
      if (Be(d)) {
        const $ = `${x.value}px`;
        return { width: $, minWidth: $ };
      }
      const b = we(d.width);
      return b ? { width: b, minWidth: b } : void 0;
    }, M = F(
      () => u.value.map((d) => {
        if (Be(d)) return x.value;
        const b = /^(\d+)px$/.exec(we(d.width) || "");
        return b ? Number(b[1]) : ml;
      })
    ), U = F(() => ({
      minWidth: `${gl(M.value, s.value)}px`
    })), z = F(
      () => B.value.map(({ row: d }, b) => St(d, e.id, b))
    ), H = F(
      () => z.value.length > 0 && z.value.every((d) => o.value.has(String(d)))
    ), te = F(
      () => !H.value && z.value.some((d) => o.value.has(String(d)))
    ), ne = (d, b) => {
      const $ = new Map(e.selectedKeys.map((g) => [String(g), g]));
      b ? $.set(String(d), d) : $.delete(String(d)), a("update:selectedKeys", [...$.values()]);
    }, ae = (d) => {
      a("update:selectedKeys", d ? z.value : []);
    }, ie = (d) => {
      if (!d.sort || !d.key) return;
      const b = r.value.key !== d.key || r.value.order === "desc" ? "asc" : r.value.order === "asc" ? "desc" : "";
      r.value = { key: d.key, order: b }, a("sortChange", d.key, b);
    }, V = (d, b) => {
      if (!e.draggable) return;
      c.value.dragging = !0, c.value.fromIndex = b, d.dataTransfer.effectAllowed = "move", d.dataTransfer.setData("text/plain", String(b)), d.target.classList.add("is-dragging");
    }, T = (d, b) => {
      !e.draggable || !c.value.dragging || (d.preventDefault(), d.dataTransfer.dropEffect = "move", c.value.dragOverIndex = b, c.value.toIndex = b);
    }, N = (d) => {
      if (!e.draggable) return;
      d.target.classList.remove("is-drag-over");
    }, R = (d) => {
      if (!e.draggable) return;
      d.target.classList.remove("is-dragging"), c.value.dragging = !1, c.value.dragOverIndex = -1;
    }, j = (d, b) => {
      if (!e.draggable) return;
      d.preventDefault();
      const $ = c.value.fromIndex;
      if ($ === -1 || $ === b) {
        c.value = { dragging: !1, fromIndex: -1, toIndex: -1, dragOverIndex: -1 };
        return;
      }
      const g = [...e.columns], [_] = g.splice($, 1);
      g.splice(b, 0, _), a("columnOrderChange", g, { fromIndex: $, toIndex: b }), c.value = { dragging: !1, fromIndex: -1, toIndex: -1, dragOverIndex: -1 };
    }, Y = (d, b) => {
      !e.page || typeof e.page != "object" || (e.page.current = d, b && (e.page.limit = b), a("change", { ...e.page, current: d, limit: b || e.page.limit }));
    }, q = P(!1), X = P(!1), S = (d, b) => {
      const $ = u.value.filter((Z) => !Z.ignoreExport), g = [
        $.map((Z) => kt(Z.title || Z.key)).join(","),
        ...d.map(
          (Z) => $.map((O) => kt(Z[O.key])).join(",")
        )
      ], _ = new Blob([`\uFEFF${g.join(`
`)}`], { type: "text/csv;charset=utf-8" }), I = document.createElement("a");
      I.href = URL.createObjectURL(_), I.download = `${b}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`, I.click(), URL.revokeObjectURL(I.href);
    }, C = () => {
      S(e.dataSource, "当前页数据"), q.value = !1;
    }, p = async () => {
      X.value = !0, q.value = !1;
      try {
        let d;
        e.exportAllData ? d = e.exportAllData : e.fetchAllData ? d = await e.fetchAllData() : d = e.dataSource, S(d, "全量数据");
      } finally {
        X.value = !1;
      }
    }, K = (d) => {
      d.target.closest(".vui-table-export-dropdown") || (q.value = !1);
    };
    re(() => {
      document.addEventListener("click", K);
    }), ue(() => {
      document.removeEventListener("click", K);
    }), l({ reload: () => {
      var d;
      return Y(Number(((d = e.page) == null ? void 0 : d.current) || 1));
    } });
    const h = (d, b, $, g, _) => {
      var Z;
      let I;
      return d.customSlot && t[d.customSlot] ? I = (Z = t[d.customSlot]) == null ? void 0 : Z.call(t, { row: b, column: d, rowIndex: $ }) : typeof d.render == "function" ? I = d.render(n, { row: b, column: d, rowIndex: $ }) : I = Ce(b[d.key]) || "-", n(
        "td",
        {
          key: d.key || d.title,
          class: L(
            {
              "is-ellipsis": d.ellipsisTooltip
            },
            w(_)
          ),
          style: D(d),
          title: d.ellipsisTooltip ? Ce(b[d.key]) : void 0
        },
        [
          n(
            "div",
            {
              class: "vui-table-cell",
              style: g && d === u.value[0] ? { paddingLeft: `${g * 20 + 16}px` } : void 0
            },
            [I]
          )
        ]
      );
    };
    return () => {
      var Z;
      const { class: d, style: b, ...$ } = i, g = e.page && typeof e.page == "object" ? {
        current: Number(e.page.current || 1),
        limit: Number(e.page.limit || 10),
        total: Number(e.page.total || 0)
      } : null, _ = g ? Math.max(1, Math.ceil(g.total / g.limit)) : 1, I = e.height && e.height !== "100%" ? { maxHeight: we(e.height) } : void 0;
      return n(
        "section",
        {
          ...$,
          class: L("vui-table", d, `is-${e.size}`),
          style: b
        },
        [
          t.toolbar || e.defaultToolbar ? n("div", { class: "vui-table-toolbar" }, [
            n("div", { class: "vui-table-toolbar-main" }, (Z = t.toolbar) == null ? void 0 : Z.call(t)),
            e.defaultToolbar ? n("div", { class: "vui-table-tools" }, [
              n(
                "div",
                { class: "vui-table-export-dropdown" },
                [
                  n(
                    "button",
                    {
                      type: "button",
                      class: "vui-icon-button",
                      title: "导出 CSV",
                      onClick: () => {
                        q.value = !q.value;
                      }
                    },
                    [
                      n(
                        "svg",
                        {
                          width: 18,
                          height: 18,
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": 1.8,
                          "stroke-linecap": "round",
                          "stroke-linejoin": "round",
                          "aria-hidden": "true",
                          focusable: "false"
                        },
                        [
                          n("path", { d: "M12 3v11" }),
                          n("path", { d: "m7.5 9.5 4.5 4.5 4.5-4.5" }),
                          n("path", { d: "M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" })
                        ]
                      ),
                      n(le, { class: "vui-icon-button-arrow", type: "chevron-down" })
                    ]
                  ),
                  q.value ? n(
                    "div",
                    { class: "vui-table-export-menu" },
                    [
                      n(
                        "button",
                        {
                          type: "button",
                          class: "vui-table-export-item",
                          onClick: C
                        },
                        [
                          n(le, { class: "vui-table-export-icon", type: "file-text" }),
                          n("span", "导出当前页")
                        ]
                      ),
                      n(
                        "button",
                        {
                          type: "button",
                          class: L("vui-table-export-item", {
                            "is-disabled": !e.exportAllData && !e.fetchAllData && !e.page,
                            "is-loading": X.value
                          }),
                          disabled: !e.exportAllData && !e.fetchAllData && !e.page,
                          onClick: p
                        },
                        [
                          n(le, { class: "vui-table-export-icon", type: "table" }),
                          n("span", X.value ? "导出中..." : "导出全部数据"),
                          e.page ? n("span", { class: "vui-table-export-hint" }, `共 ${e.page.total || 0} 条`) : null
                        ]
                      )
                    ]
                  ) : null
                ]
              )
            ]) : null
          ]) : null,
          n("div", { class: "vui-table-scroll", style: I }, [
            n("table", {
              ref: A,
              class: L("vui-table-native", {
                "has-operation-column": f.value
              }),
              style: U.value
            }, [
              n("thead", [
                n("tr", [
                  s.value ? n("th", {
                    class: L("vui-table-check", { "is-sticky-left": m.value })
                  }, [
                    n("input", {
                      type: "checkbox",
                      checked: H.value,
                      indeterminate: te.value,
                      "aria-label": "选择全部",
                      onChange: (O) => ae(O.target.checked)
                    })
                  ]) : null,
                  ...u.value.map(
                    (O, Q) => n(
                      "th",
                      {
                        key: O.key || O.title,
                        class: L(
                          {
                            "is-sortable": O.sort,
                            "is-draggable": e.draggable,
                            "is-drag-over": c.value.dragOverIndex === Q
                          },
                          w(Q)
                        ),
                        style: D(O),
                        draggable: e.draggable,
                        onClick: () => ie(O),
                        onDragstart: (ee) => V(ee, Q),
                        onDragover: (ee) => T(ee, Q),
                        onDragleave: N,
                        onDragend: R,
                        onDrop: (ee) => j(ee, Q)
                      },
                      [
                        e.draggable ? n(le, { class: "vui-table-drag-handle", type: "drag-handle" }) : null,
                        n("span", O.title || O.key || ""),
                        O.sort ? n(
                          "span",
                          { class: "vui-table-sort" },
                          r.value.key === O.key ? r.value.order === "asc" ? "↑" : r.value.order === "desc" ? "↓" : "↕" : "↕"
                        ) : null
                      ]
                    )
                  )
                ])
              ]),
              n(
                "tbody",
                B.value.length ? B.value.map(({ row: O, level: Q }, ee) => {
                  const J = St(O, e.id, ee), oe = typeof e.rowClassName == "function" ? e.rowClassName(O, ee) : e.rowClassName;
                  return n(
                    "tr",
                    {
                      key: String(J),
                      class: oe,
                      onDblclick: () => {
                        var se;
                        return (se = t.rowDoubleClick) == null ? void 0 : se.call(t, { row: O, rowIndex: ee });
                      }
                    },
                    [
                      s.value ? n("td", {
                        class: L("vui-table-check", {
                          "is-sticky-left": m.value
                        })
                      }, [
                        n("input", {
                          type: "checkbox",
                          checked: o.value.has(String(J)),
                          "aria-label": `选择第 ${ee + 1} 行`,
                          onChange: (se) => ne(J, se.target.checked)
                        })
                      ]) : null,
                      ...u.value.map(
                        (se, ot) => h(se, O, ee, Q, ot)
                      )
                    ]
                  );
                }) : [
                  n("tr", { class: "vui-table-empty-row" }, [
                    n(
                      "td",
                      { colspan: u.value.length + (s.value ? 1 : 0) },
                      [
                        n("div", { class: "vui-empty" }, [
                          n("span", { class: "vui-empty-icon" }, "◇"),
                          n("span", "暂无数据")
                        ])
                      ]
                    )
                  ])
                ]
              )
            ])
          ]),
          g ? n("footer", { class: "vui-pagination" }, [
            n("span", { class: "vui-pagination-total" }, `共 ${g.total} 条`),
            n(
              "button",
              {
                type: "button",
                disabled: g.current <= 1,
                onClick: () => Y(g.current - 1)
              },
              "‹"
            ),
            n("span", { class: "vui-pagination-current" }, `${g.current} / ${_}`),
            n(
              "button",
              {
                type: "button",
                disabled: g.current >= _,
                onClick: () => Y(g.current + 1)
              },
              "›"
            ),
            n(
              "select",
              {
                value: g.limit,
                "aria-label": "每页数量",
                onChange: (O) => Y(1, Number(O.target.value))
              },
              [10, 20, 30, 50, 100].map(
                (O) => n("option", { value: O }, `${O} 条/页`)
              )
            )
          ]) : null,
          e.loading ? n("div", { class: "vui-table-loading", role: "status" }, [
            n("span", { class: "vui-spinner" }),
            n("span", "正在加载")
          ]) : null
        ]
      );
    };
  }
}), oa = W({
  name: "VDescriptions",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    column: { type: [Number, String], default: 3 },
    border: { type: Boolean, default: !1 },
    labelWidth: { type: [Number, String], default: "" }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "section",
        {
          ...r,
          class: L("vui-descriptions", l, { "is-bordered": e.border }),
          style: De(
            {
              "--vui-description-columns": Math.max(1, Number(e.column) || 1),
              "--vui-description-label-width": we(e.labelWidth) || "auto"
            },
            i
          )
        },
        [
          e.title ? n("h3", { class: "vui-descriptions-title" }, e.title) : null,
          n("div", { class: "vui-descriptions-grid" }, (o = t.default) == null ? void 0 : o.call(t))
        ]
      );
    };
  }
}), sa = W({
  name: "VDescriptionsItem",
  inheritAttrs: !1,
  props: {
    label: { type: String, default: "" },
    span: { type: [Number, String], default: 1 }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "div",
        {
          ...r,
          class: L("vui-descriptions-item", l),
          style: De(
            { gridColumn: `span ${Math.max(1, Number(e.span) || 1)}` },
            i
          )
        },
        [
          n("div", { class: "vui-descriptions-label" }, e.label),
          n("div", { class: "vui-descriptions-value" }, ((o = t.default) == null ? void 0 : o.call(t)) || "-")
        ]
      );
    };
  }
}), ua = W({
  name: "VTree",
  inheritAttrs: !1,
  props: {
    data: { type: Array, default: () => [] },
    checkedKeys: { type: Array, default: () => [] },
    selectedKey: { type: null, default: "" },
    showCheckbox: { type: Boolean, default: !1 },
    showIcon: { type: Boolean, default: !1 },
    draggable: { type: Boolean, default: !1 },
    defaultExpandAll: { type: Boolean, default: !1 },
    expandedKeys: { type: Array, default: void 0 },
    replaceFields: { type: Object, default: () => ({}) }
  },
  emits: [
    "update:checkedKeys",
    "update:selectedKey",
    "update:expandedKeys",
    "check",
    "select",
    "nodeClick",
    "nodeDblclick",
    "nodeContextmenu",
    "expand",
    "dragstart",
    "dragover",
    "drop",
    "dragend"
  ],
  setup(e, { emit: t, slots: a, expose: l }) {
    const i = G();
    F(() => new Set(e.checkedKeys.map(String)));
    const r = (V, T) => e.replaceFields[V] || T, o = P(/* @__PURE__ */ new Set()), s = F(() => e.expandedKeys !== void 0 ? new Set(e.expandedKeys.map(String)) : o.value), u = (V, T) => {
      e.defaultExpandAll && V.forEach((N) => {
        const R = String(N[r("key", "id")] ?? N._id ?? ""), j = N[r("children", "children")];
        Array.isArray(j) && j.length && (o.value.add(R), u(j));
      });
    };
    re(() => {
      u(e.data);
    });
    const f = (V, T) => {
      const N = s.value.has(V), R = new Set(s.value);
      N ? R.delete(V) : R.add(V), e.expandedKeys !== void 0 ? t("update:expandedKeys", [...R]) : o.value = R, t("expand", !N, T);
    }, c = (V, T) => {
      t("update:selectedKey", V), t("select", T);
    }, m = (V) => {
      const T = [], N = V[r("children", "children")];
      return Array.isArray(N) && N.forEach((R) => {
        const j = R[r("key", "id")] ?? R._id;
        T.push(j), T.push(...m(R));
      }), T;
    }, y = (V, T, N = null) => {
      for (const R of T) {
        const j = R[r("key", "id")] ?? R._id;
        if (String(j) === String(V))
          return N;
        const Y = R[r("children", "children")];
        if (Array.isArray(Y)) {
          const q = y(V, Y, R);
          if (q !== void 0) return q;
        }
      }
      return null;
    }, w = (V) => {
      const T = V[r("key", "id")] ?? V._id, N = V[r("children", "children")];
      if (!Array.isArray(N) || N.length === 0)
        return k.value.has(String(T)) ? "checked" : "unchecked";
      let R = 0, j = 0;
      for (const Y of N) {
        const q = w(Y);
        q === "checked" ? R++ : q === "indeterminate" && j++;
      }
      return R === N.length ? "checked" : R > 0 || j > 0 ? "indeterminate" : "unchecked";
    }, A = (V, T) => {
      const N = y(V, e.data);
      if (!N) return;
      const R = N[r("key", "id")] ?? N._id, j = String(R);
      w(N) === "checked" ? T.set(j, R) : T.delete(j), A(R, T);
    }, E = (V, T, N) => {
      const R = new Map(e.checkedKeys.map((X) => [String(X), X])), j = N || v(V, e.data);
      if (!j) return;
      T ? R.set(String(V), V) : R.delete(String(V)), m(j).forEach((X) => {
        T ? R.set(String(X), X) : R.delete(String(X));
      }), A(V, R);
      const q = [...R.values()];
      t("update:checkedKeys", q), t("check", q, { key: V, checked: T, node: j });
    }, v = (V, T) => {
      for (const N of T) {
        const R = N[r("key", "id")] ?? N._id;
        if (String(R) === String(V)) return N;
        const j = N[r("children", "children")];
        if (Array.isArray(j)) {
          const Y = v(V, j);
          if (Y) return Y;
        }
      }
      return null;
    }, k = F(() => new Set(e.checkedKeys.map(String))), B = P({
      dragging: !1,
      dragNode: null,
      dropNode: null,
      dropPosition: 0
      // -1: 上方, 0: 内部, 1: 下方
    }), x = (V, T) => {
      e.draggable && (B.value.dragging = !0, B.value.dragNode = T, V.dataTransfer.effectAllowed = "move", t("dragstart", T, V));
    }, D = (V, T) => {
      if (!e.draggable || !B.value.dragging) return;
      V.preventDefault(), V.dataTransfer.dropEffect = "move";
      const N = V.currentTarget.getBoundingClientRect(), R = V.clientY - N.top, j = N.height;
      R < j * 0.25 ? B.value.dropPosition = -1 : R > j * 0.75 ? B.value.dropPosition = 1 : B.value.dropPosition = 0, B.value.dropNode = T, t("dragover", T, V);
    }, M = (V, T) => {
      !e.draggable || !B.value.dragNode || (V.preventDefault(), t("drop", B.value.dragNode, T, B.value.dropPosition, V), B.value = { dragging: !1, dragNode: null, dropNode: null, dropPosition: 0 });
    }, U = (V) => {
      e.draggable && (t("dragend", B.value.dragNode, V), B.value = { dragging: !1, dragNode: null, dropNode: null, dropPosition: 0 });
    }, z = (V, T, N = []) => {
      for (const R of T) {
        const j = R[r("key", "id")] ?? R._id, Y = [...N, R];
        if (String(j) === String(V))
          return Y;
        const q = R[r("children", "children")];
        if (Array.isArray(q)) {
          const X = z(V, q, Y);
          if (X) return X;
        }
      }
      return null;
    }, H = (V, T = 0) => V.map((N, R) => {
      var _, I, Z;
      const j = N[r("key", "id")] ?? N._id ?? R, Y = String(j), q = N[r("title", "title")] ?? N.name ?? j, X = N[r("icon", "icon")] ?? N.icon, S = N[r("children", "children")], C = Array.isArray(S) && S.length, p = s.value.has(Y), K = String(e.selectedKey) === Y, h = B.value.dragNode === N, d = B.value.dropNode === N, b = C ? w(N) : k.value.has(Y) ? "checked" : "unchecked", $ = {
        node: N,
        key: j,
        title: q,
        level: T,
        path: z(j, e.data) || [N],
        isLeaf: !C,
        isExpanded: p,
        isSelected: K,
        isChecked: k.value.has(Y),
        checkStatus: b
      }, g = (O) => {
        const Q = O.target;
        if (!(Q.closest(".vui-tree-switcher") || Q.closest(".vui-tree-operations"))) {
          if (c(j, N), e.showCheckbox) {
            const ee = k.value.has(Y);
            E(j, !ee, N);
          }
          t("nodeClick", N, $, O);
        }
      };
      return n("li", {
        key: Y,
        class: L("vui-tree-node", {
          "is-expanded": p,
          "is-selected": K,
          "is-checked": k.value.has(Y),
          "is-dragging": h,
          "is-drop-above": d && B.value.dropPosition === -1,
          "is-drop-inside": d && B.value.dropPosition === 0,
          "is-drop-below": d && B.value.dropPosition === 1
        }),
        draggable: e.draggable,
        onDragstart: (O) => x(O, N),
        onDragover: (O) => D(O, N),
        onDrop: (O) => M(O, N),
        onDragend: U
      }, [
        n(
          "div",
          {
            class: L("vui-tree-line", { "is-selected": K }),
            style: { paddingLeft: `${T * 20 + 10}px` },
            onClick: g,
            onDblclick: (O) => {
              t("nodeDblclick", N, $, O);
            },
            onContextmenu: (O) => {
              O.preventDefault(), t("nodeContextmenu", N, $, O);
            }
          },
          [
            // 展开/折叠图标
            C ? n(
              "span",
              {
                class: L("vui-tree-switcher", { "is-expanded": p }),
                role: "button",
                "aria-expanded": String(p),
                "aria-label": p ? "折叠" : "展开",
                onClick: (O) => {
                  O.stopPropagation(), f(Y, N);
                }
              },
              [
                n(
                  "svg",
                  {
                    class: "vui-tree-switcher-icon",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": 2.5,
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round"
                  },
                  [n("path", { d: "M9 6l6 6-6 6" })]
                )
              ]
            ) : n(
              "span",
              { class: "vui-tree-switcher is-leaf" },
              [
                ((_ = a.leafIcon) == null ? void 0 : _.call(a)) || n(
                  "svg",
                  {
                    class: "vui-tree-leaf-icon",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": 2,
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round"
                  },
                  [n("circle", { cx: 12, cy: 12, r: 3 })]
                )
              ]
            ),
            // 自定义图标
            e.showIcon && (X || a.icon) ? n(
              "span",
              { class: "vui-tree-icon" },
              ((I = a.icon) == null ? void 0 : I.call(a, $)) || (typeof X == "string" ? Pa(X) ? n(le, { type: X }) : n("span", { class: X }) : void 0)
            ) : null,
            // 复选框
            e.showCheckbox ? (() => {
              const O = C ? w(N) : k.value.has(Y) ? "checked" : "unchecked", Q = O === "checked", ee = O === "indeterminate";
              return n("span", {
                class: L("vui-tree-checkbox", {
                  "is-checked": Q,
                  "is-indeterminate": ee
                }),
                onClick: (J) => {
                  J.stopPropagation(), E(j, !Q, N);
                }
              }, [
                n("input", {
                  type: "checkbox",
                  checked: Q,
                  indeterminate: ee,
                  "aria-label": `选择 ${q}`,
                  onChange: (J) => {
                    E(j, J.target.checked, N);
                  }
                }),
                n("span", { class: "vui-tree-checkbox-inner" })
              ]);
            })() : null,
            // 标题
            n(
              "span",
              {
                class: L("vui-tree-title", { "is-selected": K })
              },
              ((Z = a.title) == null ? void 0 : Z.call(a, $)) || Ce(q)
            ),
            // 操作按钮
            a.operations ? n("span", { class: "vui-tree-operations" }, a.operations($)) : null
          ]
        ),
        // 子节点
        C && p ? n("ul", { class: "vui-tree-children" }, H(S, T + 1)) : null
      ]);
    }), te = () => {
      const V = [], T = (N) => {
        N.forEach((R) => {
          const j = String(R[r("key", "id")] ?? R._id ?? ""), Y = R[r("children", "children")];
          Array.isArray(Y) && Y.length && (V.push(j), T(Y));
        });
      };
      T(e.data), e.expandedKeys !== void 0 ? t("update:expandedKeys", V) : o.value = new Set(V);
    }, ne = () => {
      e.expandedKeys !== void 0 ? t("update:expandedKeys", []) : o.value = /* @__PURE__ */ new Set();
    }, ae = (V) => {
      const T = String(V);
      s.value.has(T) || f(T, {});
    }, ie = (V) => {
      const T = String(V);
      s.value.has(T) && f(T, {});
    };
    return l == null || l({ expandAll: te, collapseAll: ne, expandNode: ae, collapseNode: ie }), () => {
      const { class: V, style: T, ...N } = i;
      return n(
        "ul",
        {
          ...N,
          class: L("vui-tree", V, {
            "is-draggable": e.draggable
          }),
          style: T
        },
        H(e.data)
      );
    };
  }
}), ca = Symbol("VuiTab"), yl = W({
  name: "VTab",
  inheritAttrs: !1,
  props: {
    modelValue: { type: null, default: "" },
    type: { type: String, default: "" },
    allowClose: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change", "close"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = F(() => e.modelValue);
    return Oe(ca, {
      active: i,
      select: (r) => {
        a("update:modelValue", r), a("change", r);
      },
      close: (r) => a("close", r)
    }), () => {
      var u;
      const { class: r, style: o, ...s } = l;
      return n(
        "div",
        {
          ...s,
          class: L("vui-tabs", r, `is-${e.type}`),
          style: o
        },
        (u = t.default) == null ? void 0 : u.call(t)
      );
    };
  }
}), hl = W({
  name: "VTabItem",
  inheritAttrs: !1,
  props: {
    id: { type: null, default: "" },
    title: { type: String, default: "" },
    closable: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = Se(ca, void 0);
    return () => {
      var u;
      const i = String(l == null ? void 0 : l.active.value) === String(e.id), { class: r, style: o, ...s } = a;
      return n(
        "section",
        {
          ...s,
          class: L("vui-tab-item", r, { "is-active": i }),
          style: o
        },
        [
          n("div", { class: "vui-tab-title", onClick: () => l == null ? void 0 : l.select(e.id) }, [
            n("span", e.title),
            e.closable ? n(
              "button",
              {
                type: "button",
                "aria-label": `关闭${e.title}`,
                onClick: (f) => {
                  f.stopPropagation(), l == null || l.close(e.id);
                }
              },
              n(le, { type: "close" })
            ) : null
          ]),
          i ? n("div", { class: "vui-tab-content" }, (u = t.default) == null ? void 0 : u.call(t)) : null
        ]
      );
    };
  }
}), da = Symbol("VuiCollapse"), bl = W({
  name: "VCollapse",
  inheritAttrs: !1,
  props: {
    modelValue: { type: null, default: "" },
    accordion: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = F(() => e.modelValue);
    return Oe(da, {
      open: i,
      accordion: e.accordion,
      toggle: (r) => {
        const o = String(e.modelValue) === String(r) ? "" : r;
        a("update:modelValue", o), a("change", o);
      }
    }), () => {
      var u;
      const { class: r, style: o, ...s } = l;
      return n(
        "div",
        { ...s, class: L("vui-collapse", r), style: o },
        (u = t.default) == null ? void 0 : u.call(t)
      );
    };
  }
}), wl = W({
  name: "VCollapseItem",
  inheritAttrs: !1,
  props: {
    id: { type: null, default: "" },
    title: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = G(), l = Se(da, void 0);
    return () => {
      var u;
      const i = String(l == null ? void 0 : l.open.value) === String(e.id), { class: r, style: o, ...s } = a;
      return n(
        "section",
        {
          ...s,
          class: L("vui-collapse-item", r, {
            "is-open": i
          }),
          style: o
        },
        [
          n(
            "button",
            { type: "button", class: "vui-collapse-title", onClick: () => l == null ? void 0 : l.toggle(e.id) },
            [n("span", e.title), n("span", i ? "−" : "+")]
          ),
          i ? n("div", { class: "vui-collapse-content" }, (u = t.default) == null ? void 0 : u.call(t)) : null
        ]
      );
    };
  }
}), fa = W({
  name: "VPagination",
  inheritAttrs: !1,
  props: {
    current: { type: Number, default: 1 },
    total: { type: Number, default: 0 },
    pageSize: { type: Number, default: 10 },
    pageSizes: { type: Array, default: () => [10, 20, 30, 50, 100] },
    layout: { type: String, default: "prev, pager, next, jumper, total" },
    pagerCount: { type: Number, default: 7 },
    disabled: { type: Boolean, default: !1 },
    hideOnSinglePage: { type: Boolean, default: !1 },
    background: { type: Boolean, default: !1 }
  },
  emits: ["update:current", "update:pageSize", "change", "sizeChange"],
  setup(e, { emit: t }) {
    const a = G(), l = P(""), i = F(() => Math.max(1, Math.ceil(e.total / e.pageSize))), r = F(() => {
      const f = i.value, c = e.current, m = e.pagerCount, y = Math.floor(m / 2);
      if (f <= m)
        return Array.from({ length: f }, (v, k) => k + 1);
      let w = Math.max(2, c - y), A = Math.min(f - 1, c + y);
      c - y < 2 && (A = m - 1), c + y > f - 1 && (w = f - m + 2);
      const E = [1];
      w > 2 && E.push("...");
      for (let v = w; v <= A; v++) E.push(v);
      return A < f - 1 && E.push("..."), E.push(f), E;
    }), o = (f) => {
      f < 1 || f > i.value || f === e.current || e.disabled || (t("update:current", f), t("change", f, e.pageSize));
    }, s = (f) => {
      if (f === e.pageSize || e.disabled) return;
      t("update:pageSize", f), t("sizeChange", f);
      const c = Math.ceil(e.total / f);
      e.current > c && o(c);
    }, u = () => {
      const f = parseInt(l.value, 10);
      !isNaN(f) && f >= 1 && f <= i.value && o(f), l.value = "";
    };
    return e.hideOnSinglePage && i.value <= 1 ? () => null : () => {
      const { class: f, style: c, ...m } = a, y = e.layout.split(",").map((w) => w.trim());
      return n(
        "div",
        {
          ...m,
          class: L("vui-pagination", f, {
            "is-background": e.background,
            "is-disabled": e.disabled
          }),
          style: c
        },
        [
          y.includes("total") ? n("span", { class: "vui-pagination-total" }, `共 ${e.total} 条`) : null,
          y.includes("prev") ? n(
            "button",
            {
              type: "button",
              class: "vui-pagination-prev",
              disabled: e.current <= 1 || e.disabled,
              "aria-label": "上一页",
              onClick: () => o(e.current - 1)
            },
            "‹"
          ) : null,
          y.includes("pager") ? n(
            "div",
            { class: "vui-pagination-pager", role: "navigation" },
            r.value.map((w) => {
              if (w === "...")
                return n("span", { class: "vui-pagination-ellipsis", key: "..." }, "…");
              const A = w;
              return n(
                "button",
                {
                  type: "button",
                  key: A,
                  class: L("vui-pagination-page", {
                    "is-active": A === e.current
                  }),
                  "aria-label": `第 ${A} 页`,
                  "aria-current": A === e.current ? "page" : void 0,
                  onClick: () => o(A)
                },
                String(A)
              );
            })
          ) : null,
          y.includes("next") ? n(
            "button",
            {
              type: "button",
              class: "vui-pagination-next",
              disabled: e.current >= i.value || e.disabled,
              "aria-label": "下一页",
              onClick: () => o(e.current + 1)
            },
            "›"
          ) : null,
          y.includes("sizes") ? n(
            "select",
            {
              class: "vui-pagination-sizes",
              value: e.pageSize,
              disabled: e.disabled,
              "aria-label": "每页条数",
              onChange: (w) => s(Number(w.target.value))
            },
            e.pageSizes.map(
              (w) => n("option", { value: w, key: w }, `${w} 条/页`)
            )
          ) : null,
          y.includes("jumper") ? n("div", { class: "vui-pagination-jumper" }, [
            n("span", {}, "前往"),
            n("input", {
              type: "number",
              min: 1,
              max: i.value,
              value: l.value,
              disabled: e.disabled,
              "aria-label": "跳转页码",
              onInput: (w) => {
                l.value = w.target.value;
              },
              onKeydown: (w) => {
                w.key === "Enter" && u();
              },
              onBlur: u
            }),
            n("span", {}, "页")
          ]) : null
        ]
      );
    };
  }
}), xl = W({
  name: "VSteps",
  inheritAttrs: !1,
  props: {
    active: { type: Number, default: 0 },
    direction: { type: String, default: "horizontal" },
    processStatus: { type: String, default: "process" },
    finishStatus: { type: String, default: "finish" },
    alignCenter: { type: Boolean, default: !1 },
    simple: { type: Boolean, default: !1 }
  },
  emits: ["change"],
  setup(e, { slots: t, emit: a }) {
    const l = G();
    return () => {
      var u;
      const { class: i, style: r, ...o } = l, s = ((u = t.default) == null ? void 0 : u.call(t)) || [];
      return n(
        "div",
        {
          ...o,
          class: L("vui-steps", i, `is-${e.direction}`, {
            "is-simple": e.simple,
            "is-center": e.alignCenter
          }),
          style: r,
          role: "navigation"
        },
        s.map((f, c) => {
          var y, w, A, E, v;
          const m = c < e.active ? e.finishStatus : c === e.active ? e.processStatus : "wait";
          return n(
            "div",
            {
              key: c,
              class: L("vui-step", `is-${m}`, {
                "is-active": c === e.active
              }),
              onClick: () => a("change", c)
            },
            [
              n("div", { class: "vui-step-head" }, [
                n("div", { class: "vui-step-line" }),
                n(
                  "div",
                  { class: "vui-step-icon" },
                  [
                    ((y = t[`step-${c}-icon`]) == null ? void 0 : y.call(t)) || n("span", { class: "vui-step-number" }, String(c + 1))
                  ]
                )
              ]),
              n("div", { class: "vui-step-main" }, [
                n("div", { class: "vui-step-title" }, ((w = f.props) == null ? void 0 : w.title) || `步骤 ${c + 1}`),
                (A = f.props) != null && A.description || t[`step-${c}-description`] ? n(
                  "div",
                  { class: "vui-step-description" },
                  ((E = t[`step-${c}-description`]) == null ? void 0 : E.call(t)) || ((v = f.props) == null ? void 0 : v.description)
                ) : null
              ])
            ]
          );
        })
      );
    };
  }
}), Sl = W({
  name: "VStep",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    status: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    return () => {
      var a;
      return n("div", {}, (a = t.default) == null ? void 0 : a.call(t));
    };
  }
}), va = W({
  name: "VStatistic",
  inheritAttrs: !1,
  props: {
    value: { type: [Number, String], default: 0 },
    title: { type: String, default: "" },
    precision: { type: Number, default: void 0 },
    prefix: { type: String, default: "" },
    suffix: { type: String, default: "" },
    valueStyle: { type: Object, default: () => ({}) },
    groupSeparator: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => {
      let i = String(e.value);
      const r = Number(e.value);
      if (!isNaN(r) && e.precision !== void 0 && (i = r.toFixed(e.precision)), !isNaN(r) && e.groupSeparator) {
        const o = i.split(".");
        o[0] = o[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","), i = o.join(".");
      }
      return i;
    });
    return () => {
      var s, u, f, c;
      const { class: i, style: r, ...o } = a;
      return n(
        "div",
        { ...o, class: L("vui-statistic", i), style: r },
        [
          e.title || t.title ? n("div", { class: "vui-statistic-title" }, ((s = t.title) == null ? void 0 : s.call(t)) || e.title) : null,
          n(
            "div",
            { class: "vui-statistic-content", style: e.valueStyle },
            [
              e.prefix || t.prefix ? n("span", { class: "vui-statistic-prefix" }, ((u = t.prefix) == null ? void 0 : u.call(t)) || e.prefix) : null,
              n("span", { class: "vui-statistic-value" }, ((f = t.default) == null ? void 0 : f.call(t)) || l.value),
              e.suffix || t.suffix ? n("span", { class: "vui-statistic-suffix" }, ((c = t.suffix) == null ? void 0 : c.call(t)) || e.suffix) : null
            ]
          )
        ]
      );
    };
  }
}), kl = W({
  name: "VCountdown",
  inheritAttrs: !1,
  props: {
    value: { type: [Number, Date], default: 0 },
    format: { type: String, default: "HH:mm:ss" },
    title: { type: String, default: "" },
    prefix: { type: String, default: "" },
    suffix: { type: String, default: "" }
  },
  emits: ["finish", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = G(), i = P(0);
    let r = null;
    const o = F(() => e.value instanceof Date ? e.value.getTime() : Number(e.value)), s = (c) => {
      if (c <= 0) return "00:00:00";
      const m = Math.floor(c / 1e3), y = Math.floor(m / 60), w = Math.floor(y / 60), A = Math.floor(w / 24), E = (k) => String(k).padStart(2, "0");
      let v = e.format;
      return v = v.replace("DD", E(A)), v = v.replace("HH", E(w % 24)), v = v.replace("mm", E(y % 60)), v = v.replace("ss", E(m % 60)), v = v.replace("SSS", E(c % 1e3)), v;
    }, u = () => {
      f();
      const c = () => {
        const m = Date.now(), y = o.value - m;
        i.value = Math.max(0, y), t("change", i.value), y <= 0 && (f(), t("finish"));
      };
      c(), r = setInterval(c, 1e3);
    }, f = () => {
      r && (clearInterval(r), r = null);
    };
    return u(), ue(f), () => {
      var w, A, E, v;
      const { class: c, style: m, ...y } = l;
      return n(
        "div",
        { ...y, class: L("vui-countdown", c), style: m },
        [
          e.title || a.title ? n("div", { class: "vui-countdown-title" }, ((w = a.title) == null ? void 0 : w.call(a)) || e.title) : null,
          n("div", { class: "vui-countdown-content" }, [
            e.prefix || a.prefix ? n("span", { class: "vui-countdown-prefix" }, ((A = a.prefix) == null ? void 0 : A.call(a)) || e.prefix) : null,
            n("span", { class: "vui-countdown-value" }, ((E = a.default) == null ? void 0 : E.call(a)) || s(i.value)),
            e.suffix || a.suffix ? n("span", { class: "vui-countdown-suffix" }, ((v = a.suffix) == null ? void 0 : v.call(a)) || e.suffix) : null
          ])
        ]
      );
    };
  }
}), We = 8, Me = 12, Cl = 160, Vl = 96, Ct = {
  position: "fixed",
  top: "0px",
  left: "-9999px"
};
function El(e, t, a) {
  return Math.min(Math.max(e, t), a);
}
function Al(e, t, a = !1) {
  const l = e.getBoundingClientRect(), i = document.documentElement.clientWidth, r = document.documentElement.clientHeight, o = Math.min(t.offsetWidth, i - Me * 2), s = t.scrollHeight, u = r - l.bottom - We - Me, f = l.top - We - Me, c = u < Math.min(s, Cl) && f > u, m = Math.max(Vl, c ? f : u), y = a ? l.right - o : l.left, w = El(
    y,
    Me,
    Math.max(Me, i - Me - o)
  );
  return {
    dropUp: c,
    style: {
      position: "fixed",
      top: c ? "auto" : `${Math.round(l.bottom + We)}px`,
      bottom: c ? `${Math.round(r - l.top + We)}px` : "auto",
      left: `${Math.round(w)}px`,
      // 放得下就不写上限：贴着内容高度取整容易多出一条一两像素的滚动条
      maxHeight: s > m ? `${Math.round(m)}px` : "none"
    }
  };
}
function Dl(e) {
  const t = Array.isArray(e) ? e : e ? [e] : [];
  return {
    width: we(t[0]) || "min(720px, calc(100vw - 32px))",
    height: we(t[1]),
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100dvh - 32px)"
  };
}
const ma = W({
  name: "VLayer",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Boolean, default: !1 },
    title: { type: String, default: "" },
    area: {
      type: [String, Number, Array],
      default: ""
    },
    shadeClose: { type: Boolean, default: !0 },
    closeBtn: { type: [Boolean, Number, String], default: !0 },
    loading: { type: Boolean, default: !1 },
    type: { type: [String, Number], default: 1 }
  },
  emits: ["update:modelValue", "close", "open"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = P(), r = () => {
      a("update:modelValue", !1), a("close");
    }, o = (s) => {
      e.modelValue && s.key === "Escape" && r();
    };
    return de(
      () => e.modelValue,
      async (s) => {
        var u;
        document.documentElement.classList.toggle("vui-layer-open", s), s && (a("open"), await me(), (u = i.value) == null || u.focus());
      },
      { immediate: !0 }
    ), re(() => document.addEventListener("keydown", o)), ue(() => {
      document.removeEventListener("keydown", o), document.documentElement.classList.remove("vui-layer-open");
    }), () => {
      var s;
      return e.modelValue ? n(xe, { to: "body" }, [
        n(
          "div",
          {
            class: "vui-layer-wrap",
            role: "presentation",
            onMousedown: (u) => {
              const f = u.target;
              e.shadeClose && (u.target === u.currentTarget || f.classList.contains("vui-layer-shade")) && r();
            }
          },
          [
            n("div", { class: "vui-layer-shade" }),
            n(
              "section",
              {
                ...l,
                ref: i,
                class: L("vui-layer", l.class),
                style: De(Dl(e.area), l.style),
                role: "dialog",
                "aria-modal": "true",
                "aria-label": e.title || "对话框",
                tabindex: -1
              },
              [
                n("header", { class: ["vui-layer-header"] }, [
                  n("div", { class: "vui-layer-heading" }, e.title || "信息"),
                  e.closeBtn !== !1 && e.closeBtn !== 0 && e.closeBtn !== "0" ? n(
                    "button",
                    {
                      type: "button",
                      class: "vui-layer-close",
                      "aria-label": "关闭",
                      onClick: r
                    },
                    n(le, { type: "close" })
                  ) : null
                ]),
                n("div", { class: ["vui-layer-content"] }, (s = t.default) == null ? void 0 : s.call(t)),
                t.footer ? n("footer", { class: "vui-layer-footer" }, t.footer()) : null,
                e.loading ? n("div", { class: "vui-layer-loading", role: "status" }, [
                  n("span", { class: "vui-spinner" }),
                  n("span", "处理中…")
                ]) : null
              ]
            )
          ]
        )
      ]) : null;
    };
  }
}), ga = W({
  name: "VDropdown",
  inheritAttrs: !1,
  props: {
    visible: { type: Boolean, default: void 0 },
    placement: { type: String, default: "bottom-start" }
  },
  setup(e, { slots: t }) {
    const a = G(), l = P(), i = P(), r = P(!1), o = P(!1), s = P({ ...Ct });
    let u = null;
    const f = F(() => e.visible === !0 ? !0 : r.value), c = F(() => e.placement === "bottom-end"), m = () => {
      r.value = !1;
    }, y = () => {
      if (!f.value || !l.value || !i.value) return;
      const v = Al(l.value, i.value, c.value);
      o.value = v.dropUp, s.value = v.style;
    }, w = () => {
      var v, k;
      u = document.activeElement, y(), (k = (v = i.value) == null ? void 0 : v.querySelector('button:not(:disabled), [tabindex]:not([tabindex="-1"])')) == null || k.focus({ preventScroll: !0 });
    }, A = () => {
      s.value = { ...Ct }, o.value = !1;
      const v = document.activeElement;
      u && (!v || v === document.body) && u.focus({ preventScroll: !0 }), u = null;
    }, E = (v) => {
      var B, x;
      const k = v.target;
      !((B = l.value) != null && B.contains(k)) && !((x = i.value) != null && x.contains(k)) && m();
    };
    return de(f, (v) => v ? w() : A(), { flush: "post" }), re(() => {
      f.value && w(), document.addEventListener("mousedown", E), window.addEventListener("resize", y), window.addEventListener("scroll", y, !0);
    }), ue(() => {
      document.removeEventListener("mousedown", E), window.removeEventListener("resize", y), window.removeEventListener("scroll", y, !0);
    }), () => {
      var x, D;
      const { class: v, style: k, ...B } = a;
      return n(
        "div",
        {
          ...B,
          ref: l,
          class: L("vui-dropdown", v, `is-${e.placement}`, {
            "is-open": f.value
          }),
          style: k
        },
        [
          n(
            "div",
            {
              class: "vui-dropdown-trigger",
              onClick: (M) => {
                M.stopPropagation(), r.value = !r.value;
              },
              onKeydown: (M) => {
                M.key === "Escape" && m();
              }
            },
            (x = t.default) == null ? void 0 : x.call(t)
          ),
          f.value ? n(xe, { to: "body" }, [
            n(
              "div",
              {
                ref: i,
                class: L("vui-dropdown-popover", {
                  "is-drop-up": o.value,
                  "is-align-end": c.value
                }),
                style: s.value,
                onClick: () => queueMicrotask(m),
                // 焦点进了面板之后，Esc 的 keydown 落在面板上，触发器那个监听收不到
                onKeydown: (M) => {
                  M.key === "Escape" && m();
                }
              },
              (D = t.content) == null ? void 0 : D.call(t)
            )
          ]) : null
        ]
      );
    };
  }
}), Ml = W({
  name: "VDropdownMenu",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "div",
        {
          ...r,
          class: L("vui-dropdown-menu", l),
          style: i,
          role: "menu"
        },
        (o = t.default) == null ? void 0 : o.call(t)
      );
    };
  }
}), Nl = W({
  name: "VDropdownMenuItem",
  inheritAttrs: !1,
  props: {
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = G();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "button",
        {
          ...r,
          type: "button",
          class: L("vui-dropdown-item", l),
          style: i,
          disabled: e.disabled,
          role: "menuitem"
        },
        (o = t.default) == null ? void 0 : o.call(t)
      );
    };
  }
});
function pa(e, t, a) {
  const l = e.getBoundingClientRect(), i = t.getBoundingClientRect(), r = 8, o = 8;
  let s = 0, u = 0;
  switch (a) {
    case "top":
      s = l.top - i.height - r, u = l.left + (l.width - i.width) / 2;
      break;
    case "top-start":
      s = l.top - i.height - r, u = l.left;
      break;
    case "top-end":
      s = l.top - i.height - r, u = l.right - i.width;
      break;
    case "bottom":
      s = l.bottom + r, u = l.left + (l.width - i.width) / 2;
      break;
    case "bottom-start":
      s = l.bottom + r, u = l.left;
      break;
    case "bottom-end":
      s = l.bottom + r, u = l.right - i.width;
      break;
    case "left":
      s = l.top + (l.height - i.height) / 2, u = l.left - i.width - r;
      break;
    case "left-start":
      s = l.top, u = l.left - i.width - r;
      break;
    case "left-end":
      s = l.bottom - i.height, u = l.left - i.width - r;
      break;
    case "right":
      s = l.top + (l.height - i.height) / 2, u = l.right + r;
      break;
    case "right-start":
      s = l.top, u = l.right + r;
      break;
    case "right-end":
      s = l.bottom - i.height, u = l.right + r;
      break;
  }
  return u = Math.max(o, Math.min(u, window.innerWidth - i.width - o)), s = Math.max(o, Math.min(s, window.innerHeight - i.height - o)), {
    position: "fixed",
    top: `${s}px`,
    left: `${u}px`
  };
}
const ya = W({
  name: "VTooltip",
  inheritAttrs: !1,
  props: {
    content: { type: String, default: "" },
    placement: { type: String, default: "top" },
    disabled: { type: Boolean, default: !1 },
    trigger: { type: String, default: "hover" },
    showAfter: { type: Number, default: 0 },
    hideAfter: { type: Number, default: 200 },
    effect: { type: String, default: "dark" },
    enterable: { type: Boolean, default: !0 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = P(), i = P(), r = P(!1), o = P({ position: "fixed", visibility: "hidden" });
    let s = null, u = null;
    const f = () => {
      !r.value || !l.value || !i.value || (o.value = pa(l.value, i.value, e.placement));
    }, c = () => {
      e.disabled || (u && (clearTimeout(u), u = null), s = setTimeout(() => {
        r.value = !0, me(f);
      }, e.showAfter));
    }, m = () => {
      s && (clearTimeout(s), s = null), u = setTimeout(() => {
        r.value = !1;
      }, e.hideAfter);
    };
    return re(() => {
      window.addEventListener("resize", f), window.addEventListener("scroll", f, !0);
    }), ue(() => {
      window.removeEventListener("resize", f), window.removeEventListener("scroll", f, !0), s && clearTimeout(s), u && clearTimeout(u);
    }), () => {
      var E, v;
      const { class: y, style: w, ...A } = a;
      return n(
        "span",
        {
          ...A,
          ref: l,
          class: L("vui-tooltip-host", y),
          style: w,
          onMouseenter: () => {
            e.trigger === "hover" && c();
          },
          onMouseleave: () => {
            e.trigger === "hover" && m();
          },
          onClick: () => {
            e.trigger === "click" && (r.value ? m() : c());
          },
          onFocusin: () => {
            e.trigger === "focus" && c();
          },
          onFocusout: () => {
            e.trigger === "focus" && m();
          }
        },
        [
          (E = t.default) == null ? void 0 : E.call(t),
          r.value && (e.content || t.content) ? n(
            xe,
            { to: "body" },
            [
              n(
                "div",
                {
                  ref: i,
                  class: L("vui-tooltip", `vui-tooltip--${e.placement}`, `is-${e.effect}`, {
                    "is-visible": r.value
                  }),
                  style: o.value,
                  role: "tooltip",
                  onMouseenter: () => {
                    e.enterable && e.trigger === "hover" && u && (clearTimeout(u), u = null);
                  },
                  onMouseleave: () => {
                    e.trigger === "hover" && m();
                  }
                },
                [
                  n("div", { class: "vui-tooltip-arrow" }),
                  n("div", { class: "vui-tooltip-content" }, ((v = t.content) == null ? void 0 : v.call(t)) || e.content)
                ]
              )
            ]
          ) : null
        ]
      );
    };
  }
}), ha = W({
  name: "VPopover",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    placement: { type: String, default: "bottom" },
    disabled: { type: Boolean, default: !1 },
    trigger: { type: String, default: "click" },
    width: { type: [String, Number], default: "" },
    showAfter: { type: Number, default: 0 },
    hideAfter: { type: Number, default: 200 },
    enterable: { type: Boolean, default: !0 },
    popperClass: { type: String, default: "" }
  },
  emits: ["show", "hide"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = P(), r = P(), o = P(!1), s = P({ position: "fixed", visibility: "hidden" });
    let u = null, f = null;
    const c = () => {
      !o.value || !i.value || !r.value || (s.value = pa(i.value, r.value, e.placement));
    }, m = () => {
      e.disabled || (f && (clearTimeout(f), f = null), u = setTimeout(() => {
        o.value = !0, a("show"), me(c);
      }, e.showAfter));
    }, y = () => {
      u && (clearTimeout(u), u = null), f = setTimeout(() => {
        o.value = !1, a("hide");
      }, e.hideAfter);
    }, w = () => {
      o.value ? y() : m();
    }, A = (v) => {
      var B, x;
      const k = v.target;
      o.value && !((B = i.value) != null && B.contains(k)) && !((x = r.value) != null && x.contains(k)) && y();
    }, E = F(() => {
      const v = we(e.width);
      return v ? { width: v, minWidth: v } : {};
    });
    return re(() => {
      document.addEventListener("mousedown", A), window.addEventListener("resize", c), window.addEventListener("scroll", c, !0);
    }), ue(() => {
      document.removeEventListener("mousedown", A), window.removeEventListener("resize", c), window.removeEventListener("scroll", c, !0), u && clearTimeout(u), f && clearTimeout(f);
    }), () => {
      var D, M, U;
      const { class: v, style: k, ...B } = l, x = {};
      return e.trigger === "hover" ? (x.onMouseenter = m, x.onMouseleave = y) : e.trigger === "click" ? x.onClick = w : e.trigger === "focus" && (x.onFocusin = m, x.onFocusout = y), n(
        "span",
        {
          ...B,
          ref: i,
          class: L("vui-popover-host", v),
          style: k,
          ...x
        },
        [
          (D = t.default) == null ? void 0 : D.call(t),
          o.value ? n(
            xe,
            { to: "body" },
            [
              n(
                "div",
                {
                  ref: r,
                  class: L("vui-popover", `vui-popover--${e.placement}`, e.popperClass, {
                    "is-visible": o.value
                  }),
                  style: De(s.value, E.value),
                  onMouseenter: () => {
                    e.enterable && e.trigger === "hover" && f && (clearTimeout(f), f = null);
                  },
                  onMouseleave: () => {
                    e.trigger === "hover" && y();
                  }
                },
                [
                  n("div", { class: "vui-popover-arrow" }),
                  e.title || t.title ? n("div", { class: "vui-popover-title" }, ((M = t.title) == null ? void 0 : M.call(t)) || e.title) : null,
                  n(
                    "div",
                    { class: "vui-popover-content" },
                    ((U = t.content) == null ? void 0 : U.call(t)) || e.content
                  )
                ]
              )
            ]
          ) : null
        ]
      );
    };
  }
}), ba = W({
  name: "VDrawer",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Boolean, default: !1 },
    title: { type: String, default: "" },
    direction: { type: String, default: "rtl" },
    size: { type: [String, Number], default: "30%" },
    modal: { type: Boolean, default: !0 },
    showClose: { type: Boolean, default: !0 },
    closeOnClickModal: { type: Boolean, default: !0 },
    closeOnPressEscape: { type: Boolean, default: !0 },
    beforeClose: { type: Function, default: void 0 },
    destroyOnClose: { type: Boolean, default: !1 },
    withHeader: { type: Boolean, default: !0 }
  },
  emits: ["update:modelValue", "open", "close", "opened", "closed"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = P(), r = P(!1), o = P(!e.destroyOnClose), s = F(() => {
      const m = we(e.size);
      return e.direction === "rtl" || e.direction === "ltr" ? { width: m || "30%" } : { height: m || "30%" };
    }), u = () => {
      const m = () => {
        r.value = !1, a("update:modelValue", !1), a("close");
      };
      e.beforeClose ? e.beforeClose(m) : m();
    }, f = () => {
      e.closeOnClickModal && u();
    }, c = (m) => {
      m.key === "Escape" && e.closeOnPressEscape && u();
    };
    return de(
      () => e.modelValue,
      (m) => {
        m ? (o.value = !0, a("open"), me(() => {
          var y;
          r.value = !0, (y = i.value) == null || y.focus(), a("opened");
        })) : (r.value = !1, e.destroyOnClose && setTimeout(() => {
          o.value = !1;
        }, 300), a("closed"));
      },
      { immediate: !0 }
    ), re(() => {
      document.addEventListener("keydown", c);
    }), ue(() => {
      document.removeEventListener("keydown", c);
    }), () => {
      var A, E;
      if (!o.value && !e.modelValue) return null;
      const { class: m, style: y, ...w } = l;
      return n(
        xe,
        { to: "body" },
        [
          n(
            "div",
            {
              ...w,
              class: L("vui-drawer-wrap", m, {
                "is-open": r.value,
                "is-modal": e.modal
              }),
              style: y
            },
            [
              e.modal ? n("div", {
                class: "vui-drawer-mask",
                onClick: f
              }) : null,
              n(
                "div",
                {
                  ref: i,
                  class: L("vui-drawer", `is-${e.direction}`, {
                    "is-open": r.value
                  }),
                  style: s.value,
                  tabindex: -1,
                  role: "dialog",
                  "aria-modal": e.modal,
                  "aria-label": e.title || "抽屉"
                },
                [
                  e.withHeader ? n("header", { class: "vui-drawer-header" }, [
                    n("div", { class: "vui-drawer-title" }, ((A = t.title) == null ? void 0 : A.call(t)) || e.title || "信息"),
                    e.showClose ? n(
                      "button",
                      {
                        type: "button",
                        class: "vui-drawer-close",
                        "aria-label": "关闭",
                        onClick: u
                      },
                      n(le, { type: "close" })
                    ) : null
                  ]) : null,
                  n("div", { class: "vui-drawer-body" }, (E = t.default) == null ? void 0 : E.call(t)),
                  t.footer ? n("footer", { class: "vui-drawer-footer" }, t.footer()) : null
                ]
              )
            ]
          )
        ]
      );
    };
  }
}), wa = W({
  name: "VLoading",
  props: {
    loading: { type: Boolean, default: !1 },
    /** 遮罩上的文案，留空则只有转圈 */
    text: { type: String, default: "" },
    /** 铺满视口而不是包裹的内容区。此时组件本身不需要有默认插槽 */
    fullscreen: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = () => n(
      "div",
      {
        class: L("vui-loading-mask", { "is-fullscreen": e.fullscreen }),
        role: "status",
        "aria-live": "polite"
      },
      [n("span", { class: "vui-spinner" }), e.text ? n("span", e.text) : null]
    );
    return () => {
      var l, i;
      return e.fullscreen ? n("div", { class: "vui-loading is-fullscreen-host" }, [
        (l = t.default) == null ? void 0 : l.call(t),
        e.loading ? n(xe, { to: "body" }, [a()]) : null
      ]) : n(
        "div",
        { class: "vui-loading", "aria-busy": e.loading ? "true" : "false" },
        [(i = t.default) == null ? void 0 : i.call(t), e.loading ? a() : null]
      );
    };
  }
}), Tl = W({
  name: "VSkeleton",
  props: {
    loading: { type: Boolean, default: !1 },
    type: { type: String, default: "text" },
    /** 正文行数 / 表格行数 */
    rows: { type: [Number, String], default: 3 },
    /** 表格骨架的列数 */
    columns: { type: [Number, String], default: 4 },
    /** 关掉扫光动画（长列表里几十个骨架同时扫光会很吵） */
    animated: { type: Boolean, default: !0 }
  },
  setup(e, { slots: t }) {
    const a = F(() => Math.max(1, Number(e.rows) || 1)), l = F(() => Math.max(1, Number(e.columns) || 1)), i = (o, s) => n("span", { class: L("vui-skeleton-bar", s), style: { width: o } }), r = () => e.type === "table" ? [
      n(
        "div",
        { class: "vui-skeleton-row is-head" },
        Array.from({ length: l.value }, () => i("62%"))
      ),
      ...Array.from(
        { length: a.value },
        () => n(
          "div",
          { class: "vui-skeleton-row" },
          Array.from({ length: l.value }, (o, s) => i(s === 0 ? "54%" : "78%"))
        )
      )
    ] : e.type === "card" ? [
      n("div", { class: "vui-skeleton-head" }, [i("34%", "is-title")]),
      n(
        "div",
        { class: "vui-skeleton-body" },
        // 末行短一截，这样一眼能看出是「文字段落」而不是色块
        Array.from(
          { length: a.value },
          (o, s) => i(s === a.value - 1 ? "58%" : "100%")
        )
      )
    ] : [
      i("34%", "is-title"),
      ...Array.from(
        { length: a.value },
        (o, s) => i(s === a.value - 1 ? "58%" : "100%")
      )
    ];
    return () => {
      var o;
      return e.loading ? n(
        "div",
        {
          class: L("vui-skeleton", `is-${e.type}`, { "is-animated": e.animated }),
          role: "status",
          "aria-live": "polite",
          "aria-label": "加载中"
        },
        r()
      ) : (o = t.default) == null ? void 0 : o.call(t);
    };
  }
}), xa = W({
  name: "VAlert",
  inheritAttrs: !1,
  props: {
    type: { type: String, default: "info" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    closable: { type: Boolean, default: !0 },
    showIcon: { type: Boolean, default: !1 },
    center: { type: Boolean, default: !1 },
    closeText: { type: String, default: "" }
  },
  emits: ["close"],
  setup(e, { slots: t, emit: a }) {
    const l = G(), i = P(!0), r = {
      info: "info",
      success: "check-circle",
      warning: "alert",
      error: "close"
    }, o = () => {
      i.value = !1, a("close");
    };
    return () => {
      var c, m;
      if (!i.value) return null;
      const { class: s, style: u, ...f } = l;
      return n(
        "div",
        {
          ...f,
          class: L("vui-alert", s, `vui-alert--${e.type}`, {
            "is-center": e.center,
            "has-description": e.description || t.description
          }),
          style: u,
          role: "alert"
        },
        [
          e.showIcon ? n(le, { class: "vui-alert-icon", type: r[e.type] || r.info }) : null,
          n("div", { class: "vui-alert-content" }, [
            e.title || t.title ? n("div", { class: "vui-alert-title" }, ((c = t.title) == null ? void 0 : c.call(t)) || e.title) : null,
            e.description || t.description ? n("div", { class: "vui-alert-description" }, ((m = t.description) == null ? void 0 : m.call(t)) || e.description) : null
          ]),
          e.closable ? n(
            "button",
            {
              type: "button",
              class: "vui-alert-close",
              "aria-label": "关闭",
              onClick: o
            },
            e.closeText || n(le, { type: "close" })
          ) : null
        ]
      );
    };
  }
}), Sa = W({
  name: "VEmpty",
  inheritAttrs: !1,
  props: {
    description: { type: String, default: "暂无数据" },
    image: { type: String, default: "" },
    imageSize: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = G(), l = F(() => {
      const i = Number(e.imageSize);
      return i > 0 ? { width: `${i}px`, height: `${i}px` } : {};
    });
    return () => {
      var s, u;
      const { class: i, style: r, ...o } = a;
      return n(
        "div",
        { ...o, class: L("vui-empty", i), style: r },
        [
          n("div", { class: "vui-empty-image", style: l.value }, [
            e.image ? n("img", { src: e.image, alt: "" }) : ((s = t.image) == null ? void 0 : s.call(t)) || n("div", { class: "vui-empty-default-image" }, [
              n("svg", { viewBox: "0 0 64 41", xmlns: "http://www.w3.org/2000/svg" }, [
                n("path", {
                  d: "M32 1C15.432 1 1 13.432 1 30s14.432 29 31 29 31-13.432 31-31S48.568 1 32 1zm0 56C17.64 57 6 45.36 6 31S17.64 5 32 5s26 11.64 26 26-11.64 26-26 26z",
                  fill: "#f0f0f0"
                }),
                n("circle", { cx: "24", cy: "26", r: "3", fill: "#d8d8d8" }),
                n("circle", { cx: "40", cy: "26", r: "3", fill: "#d8d8d8" }),
                n("path", {
                  d: "M22 36s4 6 10 6 10-6 10-6",
                  stroke: "#d8d8d8",
                  fill: "none",
                  "stroke-width": "2",
                  "stroke-linecap": "round"
                })
              ])
            ])
          ]),
          n("div", { class: "vui-empty-description" }, ((u = t.default) == null ? void 0 : u.call(t)) || e.description),
          t.footer ? n("div", { class: "vui-empty-footer" }, t.footer()) : null
        ]
      );
    };
  }
});
let Qe = [], $l = 0;
function Ol() {
  let e = document.querySelector(".vui-message-container");
  return e || (e = document.createElement("div"), e.className = "vui-message-container", document.body.appendChild(e)), e;
}
function Bl(e) {
  const t = Qe.indexOf(e);
  t > -1 && (Qe.splice(t, 1), e.el.classList.add("is-leaving"), setTimeout(() => {
    e.el.remove();
  }, 300));
}
function Le(e) {
  var y;
  const t = typeof e == "string" ? { content: e } : e, a = `message-${++$l}`, l = Ol(), i = {
    info: "info",
    success: "check-circle",
    warning: "alert",
    error: "close"
  }, r = t.type || "info", o = t.duration ?? 3e3, s = t.closable ?? o === 0, u = document.createElement("div");
  u.className = `vui-message vui-message--${r} is-enter`, u.setAttribute("role", "alert");
  const f = t.icon || i[r], c = `
    <span class="vui-message-icon">${$e(f)}</span>
    <span class="vui-message-content">${t.content}</span>
    ${s ? `<button type="button" class="vui-message-close" aria-label="关闭">${$e("close")}</button>` : ""}
  `;
  u.innerHTML = c, l.appendChild(u), requestAnimationFrame(() => {
    u.classList.remove("is-enter");
  });
  const m = {
    id: a,
    vnode: La("div"),
    el: u,
    close: () => Bl(m)
  };
  if (s && ((y = u.querySelector(".vui-message-close")) == null || y.addEventListener("click", () => m.close())), Qe.push(m), o > 0 && setTimeout(() => m.close(), o), t.onClose) {
    const w = m.close;
    m.close = () => {
      var A;
      w(), (A = t.onClose) == null || A.call(t);
    };
  }
  return { close: () => m.close() };
}
const vn = {
  info: (e, t) => Le({ type: "info", content: e, duration: t }),
  success: (e, t) => Le({ type: "success", content: e, duration: t }),
  warning: (e, t) => Le({ type: "warning", content: e, duration: t }),
  error: (e, t) => Le({ type: "error", content: e, duration: t }),
  open: (e) => Le(e),
  closeAll: () => {
    [...Qe].forEach((e) => e.close());
  }
};
function st(e) {
  const t = typeof e == "string" ? { message: e } : e, a = t.title || "提示", l = t.type || "", i = t.showCancelButton ?? !0, r = t.showConfirmButton ?? !0, o = t.confirmButtonText || "确定", s = t.cancelButtonText || "取消", u = t.closeOnClickModal ?? !0, f = t.closeOnPressEscape ?? !0;
  return new Promise((c) => {
    const m = document.createElement("div");
    m.className = "vui-message-box-wrap";
    const y = {
      info: "info",
      success: "check-circle",
      warning: "alert",
      error: "close"
    };
    m.innerHTML = `
      <div class="vui-message-box-mask"></div>
      <div class="vui-message-box" role="dialog" aria-modal="true" tabindex="-1">
        <div class="vui-message-box-header">
          <div class="vui-message-box-title">${a}</div>
          <button type="button" class="vui-message-box-close" aria-label="关闭">${$e("close")}</button>
        </div>
        <div class="vui-message-box-content">
          ${l ? `<span class="vui-message-box-icon vui-message-box-icon--${l}">${$e(y[l] || "info")}</span>` : ""}
          <div class="vui-message-box-message">${t.message}</div>
        </div>
        <div class="vui-message-box-footer">
          ${i ? `<button type="button" class="vui-button vui-message-box-cancel ${t.cancelButtonClass || ""}">${s}</button>` : ""}
          ${r ? `<button type="button" class="vui-button vui-button-primary vui-message-box-confirm ${t.confirmButtonClass || ""}">${o}</button>` : ""}
        </div>
      </div>
    `, document.body.appendChild(m);
    const w = m.querySelector(".vui-message-box"), A = m.querySelector(".vui-message-box-close"), E = m.querySelector(".vui-message-box-cancel"), v = m.querySelector(".vui-message-box-confirm"), k = m.querySelector(".vui-message-box-mask");
    let B = !1;
    const x = (M = "close") => {
      if (B) return;
      const U = () => {
        B = !0, m.classList.add("is-leaving"), setTimeout(() => {
          m.remove(), c(M);
        }, 200);
      };
      t.beforeClose ? t.beforeClose(M, D, U) : U();
    }, D = {
      el: m,
      close: x
    };
    if (A == null || A.addEventListener("click", () => x("close")), E == null || E.addEventListener("click", () => x("cancel")), v == null || v.addEventListener("click", () => x("confirm")), u && (k == null || k.addEventListener("click", () => x("close"))), f) {
      const M = (U) => {
        U.key === "Escape" && (x("close"), document.removeEventListener("keydown", M));
      };
      document.addEventListener("keydown", M);
    }
    requestAnimationFrame(() => w == null ? void 0 : w.focus());
  });
}
const mn = {
  alert: (e, t, a) => st({ ...a, message: e, title: t, showCancelButton: !1 }),
  confirm: (e, t, a) => st({ ...a, message: e, title: t }),
  prompt: (e, t, a) => st({ ...a, message: e, title: t })
}, ka = "vui-columns:";
function ut(e, t) {
  return String(e.key ?? e.customSlot ?? e.title ?? `#${t}`);
}
function Ll(e, t) {
  return String(e.title || e.key || e.customSlot || `第 ${t + 1} 列`);
}
function Vt(e) {
  if (!e || typeof localStorage > "u") return null;
  try {
    const t = localStorage.getItem(ka + e), a = t ? JSON.parse(t) : null;
    return Array.isArray(a) ? a : null;
  } catch {
    return null;
  }
}
function Il(e, t) {
  if (!(!e || typeof localStorage > "u"))
    try {
      localStorage.setItem(ka + e, JSON.stringify(t));
    } catch {
    }
}
const Pl = W({
  name: "VColumnSetting",
  props: {
    /** 全量列定义，顺序即默认顺序 */
    source: { type: Array, default: () => [] },
    /** v-model：生效的列，直接喂给 VTable 的 columns */
    modelValue: { type: Array, default: () => [] },
    /** 记忆用的键，同一张表在不同页面要用不同的键。留空 = 不落盘 */
    storageKey: { type: String, default: "" },
    label: { type: String, default: "列设置" },
    disabled: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t }) {
    const a = P(), l = P(!1), i = P([]), r = P([]), o = P(-1), s = P(!1), u = P(), f = () => e.source.map((D, M) => ({
      key: ut(D, M),
      title: Ll(D, M),
      visible: !0
    })), c = (D) => {
      const M = f();
      if (!(D != null && D.length)) return M;
      const U = new Map(M.map((H) => [H.key, H])), z = [];
      for (const H of D) {
        const te = U.get(H.key);
        te && (z.push({ ...te, visible: H.visible !== !1 }), U.delete(H.key));
      }
      for (const H of M) U.has(H.key) && z.push(H);
      return z.length ? z : M;
    }, m = (D) => {
      const M = new Map(e.source.map((z, H) => [ut(z, H), z])), U = D.filter((z) => z.visible).map((z) => M.get(z.key)).filter(Boolean);
      t("update:modelValue", U), t("change", { columns: U, state: D.map((z) => ({ ...z })) });
    }, y = (D, M = !0) => {
      r.value = D.map((U) => ({ ...U })), M && e.storageKey && Il(e.storageKey, D.map(({ key: U, visible: z }) => ({ key: U, visible: z }))), m(D);
    };
    re(() => y(c(Vt(e.storageKey)), !1)), de(
      () => e.source.map((D, M) => ut(D, M)).join("|"),
      () => y(c(Vt(e.storageKey)), !1)
    );
    const w = () => r.value.filter((D) => D.visible).length, A = async () => {
      var U;
      if (e.disabled) return;
      if (l.value || (i.value = r.value.map((z) => ({ ...z }))), l.value = !l.value, !l.value) {
        s.value = !1;
        return;
      }
      await me();
      const D = (U = u.value) == null ? void 0 : U.getBoundingClientRect();
      if (!D || !a.value) return;
      const M = v(a.value).getBoundingClientRect();
      D.left < Math.max(M.left, 0) + 4 && (s.value = !0);
    }, E = (D, M) => {
      const U = i.value;
      if (D < 0 || M < 0 || D >= U.length || M >= U.length || D === M) return;
      const z = U.slice(), [H] = z.splice(D, 1);
      z.splice(M, 0, H), i.value = z;
    };
    function v(D) {
      let M = D.parentElement;
      for (; M && M !== document.body; ) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(M).overflowX)) return M;
        M = M.parentElement;
      }
      return document.documentElement;
    }
    const k = (D) => {
      var M;
      l.value && !((M = a.value) != null && M.contains(D.target)) && (l.value = !1);
    }, B = (D) => {
      l.value && D.key === "Escape" && (l.value = !1);
    };
    re(() => {
      document.addEventListener("mousedown", k), document.addEventListener("keydown", B);
    }), ue(() => {
      document.removeEventListener("mousedown", k), document.removeEventListener("keydown", B);
    });
    const x = (D, M) => {
      const U = i.value.filter((H) => H.visible).length, z = D.visible && U <= 1;
      return n(
        "li",
        {
          key: D.key,
          class: L("vui-column-setting-item", { "is-hidden": !D.visible }),
          draggable: !0,
          onDragstart: () => {
            o.value = M;
          },
          onDragover: (H) => {
            H.preventDefault(), o.value !== -1 && o.value !== M && (E(o.value, M), o.value = M);
          },
          onDragend: () => {
            o.value = -1;
          }
        },
        [
          n("label", { class: "vui-column-setting-label" }, [
            n("input", {
              type: "checkbox",
              checked: D.visible,
              disabled: z,
              title: z ? "至少保留一列" : void 0,
              onChange: (H) => {
                const te = i.value.slice();
                te[M] = { ...D, visible: H.target.checked }, i.value = te;
              }
            }),
            n("span", D.title)
          ]),
          n(
            "button",
            {
              type: "button",
              class: "vui-column-setting-handle",
              // 只能拖会把键盘用户挡在外面，把手聚焦后上下键即可移动
              "aria-label": `调整「${D.title}」的顺序：拖拽，或用上下方向键`,
              onKeydown: async (H) => {
                var ne, ae;
                if (H.key !== "ArrowUp" && H.key !== "ArrowDown") return;
                H.preventDefault();
                const te = M + (H.key === "ArrowUp" ? -1 : 1);
                te < 0 || te >= i.value.length || (E(M, te), await me(), (ae = (ne = u.value) == null ? void 0 : ne.querySelectorAll(".vui-column-setting-handle")[te]) == null || ae.focus());
              }
            },
            n(le, { type: "drag-handle" })
          )
        ]
      );
    };
    return () => n(
      "div",
      { ref: a, class: L("vui-column-setting", { "is-open": l.value }) },
      [
        n(
          "button",
          {
            type: "button",
            class: "vui-column-setting-trigger",
            disabled: e.disabled,
            "aria-expanded": l.value ? "true" : "false",
            "aria-haspopup": "dialog",
            title: e.label,
            onClick: A
          },
          [
            n(le, { class: "vui-column-setting-gear", type: "settings" }),
            n("span", { class: "vui-column-setting-text" }, e.label),
            // 隐藏了列却没有任何提示，用户会以为是数据丢了
            r.value.length && w() < r.value.length ? n(
              "span",
              { class: "vui-column-setting-badge" },
              `隐藏 ${r.value.length - w()}`
            ) : null
          ]
        ),
        l.value ? n(
          "div",
          {
            ref: u,
            class: L("vui-column-setting-panel", { "is-align-left": s.value }),
            role: "dialog",
            "aria-label": e.label
          },
          [
            n("div", { class: "vui-column-setting-head" }, "勾选显示，拖动排序"),
            n(
              "ul",
              { class: "vui-column-setting-list" },
              i.value.map((D, M) => x(D, M))
            ),
            n("div", { class: "vui-column-setting-foot" }, [
              n(
                "button",
                {
                  type: "button",
                  class: "vui-button vui-button-sm",
                  onClick: () => {
                    i.value = f();
                  }
                },
                "重置"
              ),
              n(
                "button",
                {
                  type: "button",
                  class: "vui-button vui-button-sm vui-button-primary",
                  onClick: () => {
                    y(i.value), l.value = !1;
                  }
                },
                "确定"
              )
            ])
          ]
        ) : null
      ]
    );
  }
}), Ca = Symbol("VuiCheckboxGroup"), Va = W({
  name: "VCheckboxGroup",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: !1 },
    options: { type: Array, default: () => [] }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = G(), i = F(() => e.modelValue);
    return Oe(Ca, {
      value: i,
      get disabled() {
        return e.disabled;
      },
      update: (r, o) => {
        if (e.disabled) return;
        const s = o ? [...e.modelValue.filter((u) => !Object.is(u, r)), r] : e.modelValue.filter((u) => !Object.is(u, r));
        t("update:modelValue", s), t("change", s);
      }
    }), () => {
      var u;
      const { class: r, ...o } = l, s = (u = a.default) == null ? void 0 : u.call(a);
      return n(
        "div",
        {
          ...o,
          class: L("vui-checkbox-group", r, { "is-disabled": e.disabled }),
          role: "group",
          "aria-disabled": e.disabled || void 0
        },
        s != null && s.length ? s : e.options.map((f) => n(
          gt,
          { value: f.value, label: f.label, disabled: f.disabled }
        ))
      );
    };
  }
}), gt = W({
  name: "VCheckbox",
  inheritAttrs: !1,
  props: {
    modelValue: { type: null, default: !1 },
    value: { type: [String, Number, Boolean], default: "" },
    label: { type: String, default: "" },
    disabled: { type: Boolean, default: !1 },
    indeterminate: { type: Boolean, default: !1 },
    trueValue: { type: null, default: !0 },
    falseValue: { type: null, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = G(), i = Se(Ca, void 0), r = F(() => i ? i.value.value.some((u) => Object.is(u, e.value)) : Object.is(e.modelValue, e.trueValue)), o = F(() => e.disabled || (i == null ? void 0 : i.disabled) || !1), s = (u) => {
      if (o.value) return;
      if (i) {
        i.update(e.value, u);
        return;
      }
      const f = u ? e.trueValue : e.falseValue;
      t("update:modelValue", f), t("change", f);
    };
    return () => {
      var y;
      const { class: u, style: f, ...c } = l, m = e.indeterminate && !r.value;
      return n(
        "label",
        {
          class: L("vui-checkbox", u, {
            "is-checked": r.value,
            "is-indeterminate": m,
            "is-disabled": o.value
          }),
          style: f,
          "aria-disabled": o.value || void 0
        },
        [
          n("input", {
            ...c,
            class: "vui-checkbox-input",
            type: "checkbox",
            checked: r.value,
            disabled: o.value,
            "aria-checked": m ? "mixed" : String(r.value),
            onChange: (w) => s(w.target.checked)
          }),
          n("span", { class: "vui-checkbox-box", "aria-hidden": "true" }, [
            m ? n("span", { class: "vui-checkbox-mixed" }) : n(le, { type: "check" })
          ]),
          e.label || a.default ? n("span", { class: "vui-checkbox-label" }, ((y = a.default) == null ? void 0 : y.call(a)) || e.label) : null
        ]
      );
    };
  }
}), Ea = W({
  name: "VTimePicker",
  inheritAttrs: !1,
  props: {
    modelValue: { type: String, default: "" },
    min: { type: String, default: "" },
    max: { type: String, default: "" },
    step: { type: [Number, String], default: 60 },
    disabled: { type: Boolean, default: !1 },
    readonly: { type: Boolean, default: !1 },
    clearable: { type: Boolean, default: !0 }
  },
  emits: ["update:modelValue", "change", "focus", "blur", "clear"],
  setup(e, { emit: t }) {
    const a = G(), l = (r) => t("update:modelValue", r), i = () => {
      l(""), t("change", ""), t("clear");
    };
    return () => {
      const { class: r, style: o, ...s } = a;
      return n(
        "span",
        {
          class: L("vui-time-picker", r, {
            "is-disabled": e.disabled,
            "is-readonly": e.readonly
          }),
          style: o
        },
        [
          n(le, { class: "vui-time-picker-icon", type: "clock" }),
          n("input", {
            ...s,
            class: "vui-time-picker-input",
            type: "time",
            value: e.modelValue,
            min: e.min || void 0,
            max: e.max || void 0,
            step: e.step,
            disabled: e.disabled,
            readonly: e.readonly,
            onInput: (u) => l(u.target.value),
            onChange: (u) => t("change", u.target.value),
            onFocus: (u) => t("focus", u),
            onBlur: (u) => t("blur", u)
          }),
          e.clearable && e.modelValue && !e.disabled && !e.readonly ? n("button", { type: "button", class: "vui-time-picker-clear", "aria-label": "清除时间", onClick: i }, [
            n(le, { type: "close" })
          ]) : null
        ]
      );
    };
  }
}), Aa = W({
  name: "VLink",
  inheritAttrs: !1,
  props: {
    href: { type: String, default: "" },
    target: { type: String, default: "_self" },
    type: { type: String, default: "default" },
    underline: { type: Boolean, default: !1 },
    disabled: { type: Boolean, default: !1 },
    download: { type: [Boolean, String], default: !1 }
  },
  emits: ["click"],
  setup(e, { emit: t, slots: a }) {
    const l = G();
    return () => {
      var o;
      const { class: i, ...r } = l;
      return n(
        "a",
        {
          ...r,
          class: L("vui-link", `is-${e.type}`, i, {
            "is-underline": e.underline,
            "is-disabled": e.disabled
          }),
          href: e.disabled ? void 0 : e.href || void 0,
          target: e.target,
          rel: e.target === "_blank" ? "noopener noreferrer" : void 0,
          download: e.download || void 0,
          tabindex: e.disabled ? -1 : void 0,
          "aria-disabled": e.disabled || void 0,
          onClick: (s) => {
            if (e.disabled) {
              s.preventDefault();
              return;
            }
            t("click", s);
          }
        },
        (o = a.default) == null ? void 0 : o.call(a)
      );
    };
  }
}), _l = {
  cols: 24,
  /* 行高 40 是照着控件高度定的：--vui-control-height 是 38px，
     行高再低一档（比如 32）会让「占 1 行」的输入框被压扁。 */
  rowHeight: 40,
  gap: 12,
  width: 1440,
  height: 900,
  snapThreshold: 6
}, Fl = {
  lg: 1100,
  md: 768,
  sm: 0
}, Da = ["lg", "md", "sm"];
function et(e) {
  return { ..._l, ...e };
}
function gn(e) {
  return Da.find((t) => e >= Fl[t]) || "sm";
}
function _e(e, t = "lg") {
  var i;
  const a = e == null ? void 0 : e.grid;
  if (!a) return;
  if (t === "lg") return { ...a };
  const l = (i = e == null ? void 0 : e.breakpoints) == null ? void 0 : i[t];
  return l ? { ...a, ...l } : { ...a };
}
function Et(e, t, a) {
  let l = e;
  return typeof t == "number" && (l = Math.max(l, t)), typeof a == "number" && (l = Math.min(l, a)), l;
}
function Re(e, t) {
  let a = Math.max(1, Et(e.w, e.minW, e.maxW)), l = Math.max(1, Et(e.h, e.minH, e.maxH));
  typeof (t == null ? void 0 : t.maxX) == "number" && (a = Math.max(e.minW ?? 1, Math.min(a, t.maxX))), typeof (t == null ? void 0 : t.maxY) == "number" && (l = Math.max(e.minH ?? 1, Math.min(l, t.maxY)));
  let i = Math.max(0, e.x), r = Math.max(0, e.y);
  return typeof (t == null ? void 0 : t.maxX) == "number" && (i = Math.min(i, Math.max(0, t.maxX - a))), typeof (t == null ? void 0 : t.maxY) == "number" && (r = Math.min(r, Math.max(0, t.maxY - l))), { ...e, x: i, y: r, w: a, h: l };
}
function tt(e, t) {
  return !(e.id === t.id || e.x + e.w <= t.x || e.x >= t.x + t.w || e.y + e.h <= t.y || e.y >= t.y + t.h);
}
function pn(e, t) {
  return t.filter((a) => tt(e, a));
}
function Rl(e, t) {
  const a = e.map((o) => ({ ...o })), l = [], i = a.find((o) => o.id === t);
  i && l.push(i);
  for (const o of a)
    o.static && o.id !== t && l.push(o);
  const r = a.filter((o) => o.id !== t && !o.static).sort((o, s) => o.y - s.y || o.x - s.x);
  for (const o of r) {
    const s = o.y + a.length * Math.max(1, ...a.map((u) => u.h)) + 1;
    for (; o.y < s && l.some((u) => tt(o, u)); ) o.y++;
    l.push(o);
  }
  return e.map((o) => a.find((s) => s.id === o.id));
}
function jl(e) {
  const t = [...e].map((l) => ({ ...l })).sort((l, i) => l.y - i.y || l.x - i.x), a = [];
  for (const l of t) {
    if (l.static) {
      a.push(l);
      continue;
    }
    for (; l.y > 0 && !a.some((i) => tt({ ...l, y: l.y - 1 }, i)); )
      l.y--;
    for (; a.some((i) => tt(l, i)); )
      l.y++;
    a.push(l);
  }
  return a;
}
function yn(e) {
  return e.reduce((t, a) => Math.max(t, a.y + a.h), 0);
}
function Te(e, t, a) {
  return (e - a * (t - 1)) / t;
}
function Ma(e, t, a) {
  const l = Te(t, a.cols, a.gap);
  return {
    left: e.x * (l + a.gap),
    top: e.y * (a.rowHeight + a.gap),
    // n 格的宽 = n 个单格宽 + 中间 n-1 条间距
    width: e.w * l + (e.w - 1) * a.gap,
    height: e.h * a.rowHeight + (e.h - 1) * a.gap
  };
}
function Kl(e, t, a) {
  const l = Te(t, a.cols, a.gap), i = a.rowHeight + a.gap;
  return {
    x: Math.max(0, Math.round(e.x / (l + a.gap))),
    y: Math.max(0, Math.round(e.y / i)),
    w: Math.max(1, Math.round((e.w + a.gap) / (l + a.gap))),
    h: Math.max(1, Math.round((e.h + a.gap) / i))
  };
}
function hn(e, t, a, l) {
  const i = Te(a, l.cols, l.gap);
  return {
    dx: Math.round(e / (i + l.gap)),
    dy: Math.round(t / (l.rowHeight + l.gap))
  };
}
function Na(e, t) {
  return t === "x" ? [e.x, e.x + e.w / 2, e.x + e.w] : [e.y, e.y + e.h / 2, e.y + e.h];
}
function Hl(e, t, a, l = a.snapThreshold) {
  if (l <= 0) return { x: e.x, y: e.y, guides: [] };
  const i = [], r = { x: e.x, y: e.y };
  for (const o of ["x", "y"]) {
    const s = o === "x" ? e.w : e.h, u = o === "x" ? a.width : a.height, f = [
      { value: 0, source: "canvas" },
      { value: u / 2, source: "canvas" },
      { value: u, source: "canvas" }
    ];
    for (const y of t)
      if (y.id !== e.id)
        for (const w of Na(y, o)) f.push({ value: w, source: "node" });
    const c = [0, s / 2, s];
    let m = null;
    for (const y of c) {
      const w = r[o] + y;
      for (const A of f) {
        const E = A.value - w;
        Math.abs(E) <= l && (!m || Math.abs(E) < Math.abs(m.delta)) && (m = { delta: E, position: A.value, source: A.source });
      }
    }
    m && (r[o] += m.delta, i.push({ axis: o, position: m.position, source: m.source }));
  }
  return { x: Math.round(r.x), y: Math.round(r.y), guides: i };
}
function bn(e, t, a, l, i = l.snapThreshold) {
  const r = e.x + e.w, o = e.y + e.h, s = { ...e }, u = (c, m) => {
    if (i <= 0) return c;
    const y = m === "x" ? l.width : l.height, w = [0, y / 2, y];
    for (const E of a)
      E.id !== e.id && w.push(...Na(E, m));
    let A = null;
    for (const E of w)
      Math.abs(E - c) <= i && (A === null || Math.abs(E - c) < Math.abs(A - c)) && (A = E);
    return A === null ? c : A;
  };
  if (t.includes("e") && (s.w = u(r, "x") - e.x), t.includes("s") && (s.h = u(o, "y") - e.y), t.includes("w")) {
    const c = u(e.x, "x");
    s.x = c, s.w = r - c;
  }
  if (t.includes("n")) {
    const c = u(e.y, "y");
    s.y = c, s.h = o - c;
  }
  const f = Re(s);
  return t.includes("w") && (f.x = r - f.w), t.includes("n") && (f.y = o - f.h), Re(f, { maxX: l.width, maxY: l.height });
}
const zl = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
function At(e, t, a, l) {
  const i = { ...e };
  return t.includes("e") && (i.w = e.w + a), t.includes("s") && (i.h = e.h + l), t.includes("w") && (i.x = e.x + a, i.w = e.w - a), t.includes("n") && (i.y = e.y + l, i.h = e.h - l), i;
}
const Wl = {
  grid: "vui-tpl-grid",
  absolute: "vui-tpl-canvas"
}, ve = (e) => typeof e == "number" ? `${e}px` : void 0;
function Ul(e, t) {
  return e === "grid" ? {
    "--vui-tpl-cols": String(t.cols),
    "--vui-tpl-row-height": ve(t.rowHeight),
    "--vui-tpl-gap": ve(t.gap)
  } : {
    "--vui-tpl-canvas-width": ve(t.width),
    "--vui-tpl-canvas-height": ve(t.height)
  };
}
function Gl(e, t) {
  var l, i;
  if (t === "grid") {
    if (!((l = e.layout) != null && l.grid)) return;
    const r = {};
    for (const o of Da) {
      const s = _e(e.layout, o);
      s && (r[`--vui-tpl-col-${o}`] = `${s.x + 1} / span ${s.w}`, r[`--vui-tpl-row-${o}`] = `${s.y + 1} / span ${s.h}`);
    }
    return r;
  }
  const a = (i = e.layout) == null ? void 0 : i.absolute;
  if (a)
    return {
      left: ve(a.x),
      top: ve(a.y),
      width: ve(a.w),
      height: ve(a.h),
      minWidth: ve(a.minW),
      maxWidth: ve(a.maxW),
      minHeight: ve(a.minH),
      maxHeight: ve(a.maxH)
    };
}
function ql(e) {
  return e && typeof e == "object" && e.__expression === !0;
}
function at(e, t, a) {
  try {
    if (_a(e)) return Fa(t, e);
    if (a !== "trusted") throw new Error("不可信模板不能执行动态表达式");
    const l = Object.keys(t), i = l.map((o) => t[o]);
    return new Function(...l, `return ${e}`)(...i);
  } catch (l) {
    console.warn(`表达式解析失败: ${e}`, l);
    return;
  }
}
function Ae(e, t, a) {
  if (ql(e))
    return at(e.expr, t, a);
  if (typeof e == "string" && e.startsWith("{{") && e.endsWith("}}")) {
    const l = e.slice(2, -2).trim();
    return at(l, t, a);
  }
  if (Array.isArray(e))
    return e.map((l) => Ae(l, t, a));
  if (typeof e == "object" && e !== null) {
    const l = {};
    for (const i of Object.keys(e))
      l[i] = Ae(e[i], t, a);
    return l;
  }
  return e;
}
function Yl(e, t, a) {
  return async (l) => {
    var s, u, f, c, m, y, w, A, E, v, k, B;
    const { action: i, params: r, handler: o } = e;
    switch (i) {
      case "setValue":
        typeof (r == null ? void 0 : r.field) == "string" && Ot(r.field) && (t.formData[r.field] = r.value ?? l);
        break;
      case "getData":
        r != null && r.dataSourceId && ((u = (s = t.methods).loadData) == null || u.call(s, r.dataSourceId));
        break;
      case "submit":
        await ((c = (f = t.methods).submit) == null ? void 0 : c.call(f));
        break;
      case "validate":
        await ((y = (m = t.methods).validate) == null ? void 0 : y.call(m));
        break;
      case "reset":
        (A = (w = t.methods).reset) == null || A.call(w);
        break;
      case "navigate":
        r != null && r.url && (window.location.href = r.url);
        break;
      case "showModal":
        (v = (E = t.methods).showModal) == null || v.call(E, r);
        break;
      case "closeModal":
        (B = (k = t.methods).closeModal) == null || B.call(k, r);
        break;
      case "custom":
        if (o && a === "trusted")
          try {
            await new Function("context", "event", o)(t, l);
          } catch (x) {
            console.error("自定义事件处理失败:", x);
          }
        break;
    }
  };
}
const pt = {};
function wn(e, t) {
  pt[e] = t;
}
function Jl(e) {
  Object.assign(pt, e);
}
const yt = W({
  name: "TemplateRenderer",
  props: {
    /** 模板定义 */
    template: {
      type: Object,
      required: !0
    },
    /** 表单数据 */
    modelValue: {
      type: Object,
      default: () => ({})
    },
    /** 全局数据 */
    globalData: {
      type: Object,
      default: () => ({})
    },
    /** 渲染器配置 */
    config: {
      type: Object,
      default: () => ({})
    },
    /** 是否预览模式 */
    preview: {
      type: Boolean,
      default: !1
    }
  },
  emits: ["update:modelValue", "submit", "validate", "reset", "change"],
  setup(e, { emit: t, expose: a }) {
    const l = F(() => e.config.trustLevel || "untrusted"), i = F(() => Ye(e.template, {
      trustLevel: l.value,
      allowedApiOrigins: e.config.allowedApiOrigins
    })), r = wt({ ...e.modelValue }), o = P({}), s = wt({}), u = {
      formData: r,
      globalData: e.globalData,
      refs: o.value,
      methods: {},
      computed: { dataSources: s },
      hooks: {}
    };
    de(r, (v) => {
      t("update:modelValue", { ...v }), t("change", { ...v });
    }, { deep: !0 }), de(() => e.modelValue, (v) => {
      Object.keys(r).forEach((k) => {
        k in v || delete r[k];
      }), xt(r, v);
    }, { deep: !0 });
    const f = () => {
      var B;
      const v = ((B = e.template.formConfig) == null ? void 0 : B.initialValues) || {}, k = (x) => {
        var D;
        if (x.type === "form-item" && ((D = x.props) != null && D.field)) {
          const M = x.props.field;
          r[M] === void 0 && (r[M] = x.props.defaultValue ?? v[M] ?? "");
        }
        x.children && x.children.forEach(k), x.slots && Object.values(x.slots).flat().forEach(k);
      };
      k(e.template.root);
    }, c = (v, k, B) => {
      const x = v != null && v.targetId ? o.value[v.targetId] : void 0;
      if (typeof (x == null ? void 0 : x[k]) == "function") x[k](v);
      else {
        const D = typeof (v == null ? void 0 : v.field) == "string" ? v.field : "modalVisible";
        Ot(D) && (r[D] = B);
      }
    };
    u.methods = {
      submit: async () => {
        t("submit", { ...r });
      },
      validate: async () => {
        const v = o.value[e.template.root.id];
        try {
          const k = typeof (v == null ? void 0 : v.validate) == "function" ? await v.validate() : !0;
          return t("validate", !0), k;
        } catch (k) {
          throw t("validate", !1, k), k;
        }
      },
      reset: () => {
        Object.keys(r).forEach((v) => {
          delete r[v];
        }), f(), t("reset");
      },
      showModal: (v) => c(v, "open", !0),
      closeModal: (v) => c(v, "close", !1),
      loadData: async (v) => {
        var x, D;
        if (!i.value.valid)
          throw new Error("模板未通过安全校验，不能加载数据源");
        const k = (x = e.template.dataSources) == null ? void 0 : x.find((M) => M.id === v);
        if (!k) throw new Error(`数据源不存在: ${v}`);
        let B;
        if (k.type === "static")
          B = k.data;
        else if (k.type === "function" && k.handler && l.value === "trusted")
          B = await new Function("context", k.handler)(u);
        else if (k.type === "api" && k.api) {
          const M = k.api.method || "GET", U = new URL(k.api.url, (D = globalThis.location) == null ? void 0 : D.href), z = { method: M, headers: k.api.headers };
          M === "GET" ? Object.entries(k.api.params || {}).forEach(([ne, ae]) => {
            ae != null && U.searchParams.set(ne, String(ae));
          }) : k.api.params && (z.body = JSON.stringify(k.api.params), z.headers = { "Content-Type": "application/json", ...k.api.headers });
          const H = await fetch(U, z);
          if (!H.ok) throw new Error(`数据源请求失败: ${H.status}`);
          B = (H.headers.get("content-type") || "").includes("application/json") ? await H.json() : await H.text();
        }
        return s[v] = B, B;
      }
    }, a({
      formData: r,
      submit: u.methods.submit,
      validate: u.methods.validate,
      reset: u.methods.reset,
      loadData: u.methods.loadData,
      dataSources: s,
      getDiagnostics: () => [...i.value.diagnostics],
      getFormData: () => ({ ...r }),
      setFormData: (v) => {
        xt(r, v);
      }
    }), re(() => {
      var v, k, B, x, D;
      if (!i.value.valid) {
        const M = new Error(i.value.diagnostics.map((U) => U.message).join(`
`));
        (k = (v = e.config).onError) == null || k.call(v, M, e.template.root);
        return;
      }
      f(), (B = e.template.dataSources) == null || B.filter((M) => M.autoLoad).forEach((M) => u.methods.loadData(M.id).catch((U) => {
        var z, H;
        (H = (z = e.config).onError) == null || H.call(z, U instanceof Error ? U : new Error(String(U)), e.template.root);
      })), (D = (x = u.hooks).mounted) == null || D.call(x);
    }), Ia(() => {
      var v, k;
      (k = (v = u.hooks).unmounted) == null || k.call(v);
    });
    const m = F(() => et(e.template.canvas)), y = (v) => v.layoutMode || (v === e.template.root ? e.template.layoutMode : void 0) || "flow", w = (v, k, B) => {
      const x = k === "grid" ? "vui-tpl-cell" : "vui-tpl-abs", D = Gl(v, k);
      return n(
        "div",
        {
          key: `cell-${v.id}`,
          class: D ? x : [x, "is-auto"],
          style: D,
          "data-node-id": v.id
        },
        [B]
      );
    }, A = (v, k = u, B) => {
      if (v.condition && !(typeof v.condition == "string" ? at(v.condition, { formData: k.formData, dataSources: s, ...e.globalData }, l.value) : Ae(v.condition, { formData: k.formData, dataSources: s, ...e.globalData }, l.value)))
        return null;
      if (v.loop) {
        const x = typeof v.loop.data == "string" ? at(v.loop.data, { formData: k.formData, dataSources: s, ...e.globalData }, l.value) : Ae(v.loop.data, { formData: k.formData, dataSources: s, ...e.globalData }, l.value);
        return Array.isArray(x) ? n(
          "div",
          { key: `loop-${v.id}` },
          x.map((D, M) => {
            const U = {
              ...u,
              formData: {
                ...r,
                [v.loop.item]: D,
                [v.loop.index || "index"]: M
              }
            };
            return E(v, U);
          })
        ) : null;
      }
      return E(v, k, B);
    }, E = (v, k, B) => {
      var T, N, R, j, Y;
      const x = {};
      if (v.props)
        for (const [q, X] of Object.entries(v.props))
          x[q] = Ae(X, { formData: k.formData, dataSources: s, ...e.globalData }, l.value);
      v.type === "form" && (x.model = k.formData, x.rules ?? (x.rules = (T = e.template.formConfig) == null ? void 0 : T.rules), x.layout ?? (x.layout = (N = e.template.formConfig) == null ? void 0 : N.layout), x.labelWidth ?? (x.labelWidth = (R = e.template.formConfig) == null ? void 0 : R.labelWidth));
      const D = {};
      if (v.events)
        for (const [q, X] of Object.entries(v.events)) {
          const S = `on${q.charAt(0).toUpperCase()}${q.slice(1)}`;
          D[S] = Yl(X, k, l.value);
        }
      B && (x.modelValue = k.formData[B], D["onUpdate:modelValue"] = (q) => {
        k.formData[B] = q;
      }), v.type === "form-item" && x.field && x.prop === void 0 && (x.prop = x.field);
      const M = v.style ? Ae(v.style, { formData: k.formData, dataSources: s }, l.value) : void 0, U = v.className ? Ae(v.className, { formData: k.formData, dataSources: s }, l.value) : void 0, z = y(v), H = z !== "flow", te = H ? [U, Wl[z]].filter(Boolean) : U, ne = H ? { ...M, ...Ul(z, m.value) } : M, ae = ((j = e.config.componentMap) == null ? void 0 : j[v.type]) || pt[v.type];
      if ((Y = e.config.customRenderers) != null && Y[v.type])
        return e.config.customRenderers[v.type](v, k);
      const ie = ae || "div";
      let V;
      if (v.slots) {
        V = {};
        for (const [q, X] of Object.entries(v.slots))
          V[q] = () => X.map((S) => A(S, k)).filter(Boolean);
      } else if (v.children) {
        const q = v.type === "form-item" ? x.field : void 0, X = v.children.map((S, C) => {
          const p = A(S, k, C === 0 ? q : void 0);
          return p ? H ? w(S, z, p) : p : null;
        }).filter(Boolean);
        V = typeof ie == "string" ? X : { default: () => X };
      }
      if (V === void 0 && (x.text !== void 0 || x.content !== void 0)) {
        const q = String(x.text ?? x.content);
        V = typeof ie == "string" ? q : { default: () => q };
      }
      return n(
        ie,
        {
          ...x,
          ...D,
          style: ne,
          class: te,
          ref: (q) => {
            v.id && (o.value[v.id] = q);
          }
        },
        V
      );
    };
    return () => {
      if (!i.value.valid)
        return n(
          "div",
          { class: ["vui-alert", "is-error"], role: "alert" },
          i.value.diagnostics.map((B) => `${B.code}: ${B.message}`).join("；")
        );
      const v = e.template.root;
      if (!v) return null;
      if (v.type === "form")
        return A(v);
      const k = A(v);
      return n("div", { class: "vui-template-container" }, k || void 0);
    };
  }
}), xn = W({
  name: "FormTemplateRenderer",
  props: {
    template: { type: Object, required: !0 },
    modelValue: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "submit", "validate", "reset"],
  setup(e, { emit: t, expose: a }) {
    const l = P();
    return a({
      submit: () => {
        var i;
        return (i = l.value) == null ? void 0 : i.submit();
      },
      validate: () => {
        var i;
        return (i = l.value) == null ? void 0 : i.validate();
      },
      reset: () => {
        var i;
        return (i = l.value) == null ? void 0 : i.reset();
      },
      getFormData: () => {
        var i;
        return (i = l.value) == null ? void 0 : i.getFormData();
      },
      setFormData: (i) => {
        var r;
        return (r = l.value) == null ? void 0 : r.setFormData(i);
      }
    }), () => n(yt, {
      ref: l,
      template: e.template,
      modelValue: e.modelValue,
      "onUpdate:modelValue": (i) => t("update:modelValue", i),
      onSubmit: (i) => t("submit", i),
      onValidate: (i, r) => t("validate", i, r),
      onReset: () => t("reset")
    });
  }
}), Sn = W({
  name: "CardTemplateRenderer",
  props: {
    template: { type: Object, required: !0 },
    data: { type: Object, default: () => ({}) }
  },
  setup(e) {
    return () => n(yt, {
      template: e.template,
      globalData: e.data,
      preview: !0
    });
  }
});
let Dt = 0;
function ge() {
  var e;
  return typeof ((e = globalThis.crypto) == null ? void 0 : e.randomUUID) == "function" ? globalThis.crypto.randomUUID().replace(/-/g, "") : (Dt += 1, `${Date.now().toString(36)}${Dt.toString(36)}${Math.random().toString(36).slice(2, 10)}`);
}
const Ta = [
  {
    name: "布局",
    icon: "layout",
    components: [
      { type: "container", label: "容器", icon: "package", description: "通用容器" },
      { type: "row", label: "行", icon: "layout", description: "行布局" },
      { type: "col", label: "列", icon: "layout", description: "列布局" },
      { type: "card", label: "卡片", icon: "app", description: "卡片容器" },
      { type: "divider", label: "分割线", icon: "divider", description: "分割线" }
    ]
  },
  {
    name: "表单",
    icon: "form",
    components: [
      { type: "form", label: "表单", icon: "form", description: "表单容器" },
      { type: "form-item", label: "表单项", icon: "file-text", description: "表单项" },
      { type: "input", label: "输入框", icon: "edit", description: "文本输入" },
      { type: "input-number", label: "数字输入", icon: "text", description: "数字输入" },
      { type: "select", label: "选择器", icon: "chevron-down", description: "下拉选择" },
      { type: "switch", label: "开关", icon: "button", description: "开关选择" },
      { type: "radio", label: "单选", icon: "circle", description: "单选框" },
      { type: "radio-group", label: "单选组", icon: "circle", description: "单选组" },
      { type: "checkbox", label: "多选", icon: "check-circle", description: "多选框" },
      { type: "checkbox-group", label: "多选组", icon: "check-circle", description: "多选组" },
      { type: "datepicker", label: "日期选择", icon: "app", description: "日期选择器" },
      { type: "timepicker", label: "时间选择", icon: "circle", description: "时间选择器" },
      { type: "textarea", label: "文本域", icon: "text", description: "多行文本" },
      { type: "tag-input", label: "标签输入", icon: "tag", description: "标签集合输入" },
      { type: "upload", label: "上传", icon: "upload", description: "文件上传" }
    ]
  },
  {
    name: "数据展示",
    icon: "chart-bar",
    components: [
      { type: "icon", label: "图标", icon: "circle", description: "统一 SVG 图标" },
      { type: "text", label: "文本", icon: "text", description: "文本内容" },
      { type: "table", label: "表格", icon: "table", description: "数据表格" },
      { type: "pagination", label: "分页", icon: "more-vertical", description: "分页导航" },
      { type: "tag", label: "标签", icon: "file-text", description: "标签" },
      { type: "badge", label: "徽标", icon: "circle", description: "徽标" },
      { type: "progress", label: "进度条", icon: "chart-bar", description: "进度条" },
      { type: "statistic", label: "统计", icon: "chart-bar", description: "统计数值" },
      { type: "descriptions", label: "描述列表", icon: "file-text", description: "描述列表" },
      { type: "descriptions-item", label: "描述项", icon: "file-text", description: "描述列表条目" },
      { type: "tree", label: "树", icon: "layout", description: "树形控件" }
    ]
  },
  {
    name: "反馈",
    icon: "info",
    components: [
      { type: "alert", label: "警告提示", icon: "alert", description: "警告提示" },
      { type: "empty", label: "空状态", icon: "package", description: "空数据提示" },
      { type: "loading", label: "加载", icon: "refresh", description: "加载状态" },
      { type: "tooltip", label: "文字提示", icon: "info", description: "文字提示" },
      { type: "popover", label: "气泡卡片", icon: "info", description: "气泡卡片" }
    ]
  },
  {
    name: "操作",
    icon: "settings",
    components: [
      { type: "button", label: "按钮", icon: "button", description: "按钮" },
      { type: "button-group", label: "按钮组", icon: "button", description: "按钮组" },
      { type: "link", label: "链接", icon: "link", description: "链接" },
      { type: "dropdown", label: "下拉菜单", icon: "chevron-down", description: "下拉菜单" }
    ]
  }
], $a = {
  container: [],
  row: [
    { name: "gutter", label: "间距", type: "number", defaultValue: 16 },
    { name: "justify", label: "水平对齐", type: "select", options: [
      { label: "左对齐", value: "start" },
      { label: "居中", value: "center" },
      { label: "右对齐", value: "end" },
      { label: "两端对齐", value: "space-between" },
      { label: "分散对齐", value: "space-around" }
    ] },
    { name: "align", label: "垂直对齐", type: "select", options: [
      { label: "顶部", value: "top" },
      { label: "居中", value: "middle" },
      { label: "底部", value: "bottom" }
    ] }
  ],
  col: [
    { name: "span", label: "栅格数", type: "number", defaultValue: 12 },
    { name: "offset", label: "偏移", type: "number", defaultValue: 0 }
  ],
  card: [
    { name: "title", label: "标题", type: "string" },
    { name: "shadow", label: "阴影", type: "select", options: [
      { label: "总是显示", value: "always" },
      { label: "悬停显示", value: "hover" },
      { label: "从不显示", value: "never" }
    ] }
  ],
  divider: [
    { name: "direction", label: "方向", type: "select", options: [
      { label: "水平", value: "horizontal" },
      { label: "垂直", value: "vertical" }
    ] },
    { name: "contentPosition", label: "内容位置", type: "select", options: [
      { label: "左", value: "left" },
      { label: "中", value: "center" },
      { label: "右", value: "right" }
    ] }
  ],
  form: [
    { name: "layout", label: "布局", type: "select", options: [
      { label: "水平", value: "horizontal" },
      { label: "垂直", value: "vertical" },
      { label: "行内", value: "inline" }
    ] },
    { name: "labelWidth", label: "标签宽度", type: "string" }
  ],
  "form-item": [
    { name: "label", label: "标签", type: "string" },
    { name: "field", label: "字段名", type: "string" },
    { name: "required", label: "必填", type: "boolean", defaultValue: !1 }
  ],
  input: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "文本", value: "text" },
      { label: "密码", value: "password" },
      { label: "邮箱", value: "email" },
      { label: "手机号", value: "tel" }
    ] },
    { name: "placeholder", label: "占位符", type: "string" },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 },
    { name: "clearable", label: "可清空", type: "boolean", defaultValue: !1 },
    { name: "prefix", label: "前缀", type: "string" },
    { name: "suffix", label: "后缀", type: "string" }
  ],
  "input-number": [
    { name: "min", label: "最小值", type: "number" },
    { name: "max", label: "最大值", type: "number" },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 }
  ],
  select: [
    { name: "placeholder", label: "占位符", type: "string" },
    { name: "multiple", label: "多选", type: "boolean", defaultValue: !1 },
    { name: "clearable", label: "可清空", type: "boolean", defaultValue: !1 },
    { name: "options", label: "选项", type: "json" }
  ],
  switch: [
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 }
  ],
  radio: [
    { name: "value", label: "值", type: "string" },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 }
  ],
  "radio-group": [
    { name: "options", label: "选项", type: "json" }
  ],
  checkbox: [
    { name: "value", label: "值", type: "string" },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 }
  ],
  "checkbox-group": [
    { name: "options", label: "选项", type: "json" }
  ],
  datepicker: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "日期", value: "date" },
      { label: "日期时间", value: "datetime" }
    ] },
    { name: "placeholder", label: "占位符", type: "string" },
    { name: "range", label: "日期范围", type: "boolean", defaultValue: !1 },
    { name: "allowClear", label: "可清空", type: "boolean", defaultValue: !1 }
  ],
  timepicker: [
    { name: "min", label: "最早时间", type: "string" },
    { name: "max", label: "最晚时间", type: "string" },
    { name: "step", label: "步长秒数", type: "number", defaultValue: 60 },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 },
    { name: "readonly", label: "只读", type: "boolean", defaultValue: !1 },
    { name: "clearable", label: "可清空", type: "boolean", defaultValue: !0 }
  ],
  textarea: [
    { name: "placeholder", label: "占位符", type: "string" },
    { name: "rows", label: "行数", type: "number", defaultValue: 3 },
    { name: "autosize", label: "自适应高度", type: "boolean", defaultValue: !1 }
  ],
  "tag-input": [
    { name: "allowClear", label: "可清空", type: "boolean", defaultValue: !1 },
    { name: "disabledInput", label: "禁止新增", type: "boolean", defaultValue: !1 },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 }
  ],
  upload: [
    { name: "url", label: "上传地址", type: "string" },
    { name: "accept", label: "接受类型", type: "string" },
    { name: "multiple", label: "多选", type: "boolean", defaultValue: !1 }
  ],
  icon: [
    { name: "name", label: "图标名称", type: "string" },
    { name: "size", label: "尺寸", type: "string", defaultValue: "1em" },
    { name: "title", label: "可访问标题", type: "string" }
  ],
  text: [
    { name: "content", label: "内容", type: "string", defaultValue: "文本内容" }
  ],
  table: [
    { name: "columns", label: "列配置", type: "json" }
  ],
  pagination: [
    { name: "current", label: "当前页", type: "number", defaultValue: 1 },
    { name: "pageSize", label: "每页条数", type: "number", defaultValue: 10 },
    { name: "total", label: "总条数", type: "number", defaultValue: 0 }
  ],
  tag: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "默认", value: "" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "危险", value: "danger" },
      { label: "信息", value: "info" }
    ] },
    { name: "closable", label: "可关闭", type: "boolean", defaultValue: !1 }
  ],
  badge: [
    { name: "value", label: "值", type: "string" },
    { name: "type", label: "类型", type: "select", options: [
      { label: "主要", value: "primary" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "危险", value: "danger" },
      { label: "信息", value: "info" }
    ] }
  ],
  progress: [
    { name: "percent", label: "百分比", type: "number" },
    { name: "status", label: "状态", type: "select", options: [
      { label: "正常", value: "" },
      { label: "成功", value: "success" },
      { label: "异常", value: "exception" }
    ] }
  ],
  statistic: [
    { name: "title", label: "标题", type: "string" },
    { name: "value", label: "值", type: "string" },
    { name: "prefix", label: "前缀", type: "string" },
    { name: "suffix", label: "后缀", type: "string" }
  ],
  descriptions: [
    { name: "title", label: "标题", type: "string" },
    { name: "column", label: "列数", type: "number", defaultValue: 3 },
    { name: "border", label: "边框", type: "boolean", defaultValue: !1 }
  ],
  "descriptions-item": [
    { name: "label", label: "标签", type: "string" },
    { name: "span", label: "占列数", type: "number", defaultValue: 1 }
  ],
  tree: [
    { name: "data", label: "数据", type: "json" },
    { name: "showCheckbox", label: "显示复选框", type: "boolean", defaultValue: !1 }
  ],
  alert: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "信息", value: "info" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "错误", value: "error" }
    ] },
    { name: "title", label: "标题", type: "string" },
    { name: "description", label: "描述", type: "string" },
    { name: "closable", label: "可关闭", type: "boolean", defaultValue: !0 }
  ],
  empty: [
    { name: "description", label: "描述", type: "string" }
  ],
  loading: [
    { name: "text", label: "提示", type: "string" },
    { name: "fullscreen", label: "全屏", type: "boolean", defaultValue: !1 }
  ],
  message: [],
  modal: [],
  drawer: [],
  tooltip: [
    { name: "content", label: "内容", type: "string" },
    { name: "placement", label: "位置", type: "select", options: [
      { label: "上", value: "top" },
      { label: "下", value: "bottom" },
      { label: "左", value: "left" },
      { label: "右", value: "right" }
    ] }
  ],
  popover: [
    { name: "title", label: "标题", type: "string" },
    { name: "content", label: "内容", type: "string" },
    { name: "trigger", label: "触发方式", type: "select", options: [
      { label: "点击", value: "click" },
      { label: "悬停", value: "hover" }
    ] }
  ],
  button: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "默认", value: "default" },
      { label: "主要", value: "primary" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "危险", value: "danger" },
      { label: "信息", value: "info" },
      { label: "文字", value: "text" }
    ] },
    { name: "size", label: "尺寸", type: "select", options: [
      { label: "大", value: "large" },
      { label: "中", value: "default" },
      { label: "小", value: "small" }
    ] },
    { name: "disabled", label: "禁用", type: "boolean", defaultValue: !1 },
    { name: "loading", label: "加载中", type: "boolean", defaultValue: !1 }
  ],
  "button-group": [],
  link: [
    { name: "type", label: "类型", type: "select", options: [
      { label: "默认", value: "" },
      { label: "主要", value: "primary" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "危险", value: "danger" },
      { label: "信息", value: "info" }
    ] },
    { name: "href", label: "链接", type: "string" },
    { name: "target", label: "打开方式", type: "select", options: [
      { label: "当前窗口", value: "_self" },
      { label: "新窗口", value: "_blank" }
    ] }
  ],
  dropdown: [
    { name: "placement", label: "展开方向", type: "select", options: [
      { label: "底部左侧", value: "bottom-start" },
      { label: "底部右侧", value: "bottom-end" }
    ] }
  ],
  custom: []
};
function kn(e, t) {
  const a = ge(), l = {
    form: {
      id: ge(),
      type: "form",
      props: { layout: "vertical", labelWidth: "100px" },
      children: [],
      meta: { label: "表单", icon: "form" }
    },
    card: {
      id: ge(),
      type: "card",
      props: { title: t },
      children: [],
      meta: { label: "卡片", icon: "app" }
    },
    list: {
      id: ge(),
      type: "container",
      children: [],
      meta: { label: "列表容器", icon: "package" }
    },
    page: {
      id: ge(),
      type: "container",
      children: [],
      meta: { label: "页面", icon: "file" }
    },
    custom: {
      id: ge(),
      type: "container",
      children: [],
      meta: { label: "自定义", icon: "settings" }
    }
  };
  return {
    id: a,
    name: t,
    type: e,
    version: "1.0.0",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    root: l[e],
    formConfig: e === "form" ? {
      layout: "vertical",
      labelWidth: "100px"
    } : void 0
  };
}
function dt(e, t) {
  var r;
  const a = ((r = $a[e]) == null ? void 0 : r.reduce((o, s) => (s.defaultValue !== void 0 && (o[s.name] = s.defaultValue), o), {})) || {}, l = Ta.flatMap((o) => o.components).find((o) => o.type === e), i = e === "form-item" ? [dt("input")] : [];
  return {
    id: ge(),
    type: e,
    props: { ...a, ...t },
    children: i,
    meta: {
      label: (l == null ? void 0 : l.label) || e,
      icon: l == null ? void 0 : l.icon
    }
  };
}
function be(e, t) {
  if (e.id === t) return e;
  if (e.children)
    for (const a of e.children) {
      const l = be(a, t);
      if (l) return l;
    }
  if (e.slots)
    for (const a of Object.values(e.slots))
      for (const l of a) {
        const i = be(l, t);
        if (i) return i;
      }
  return null;
}
function ft(e, t) {
  if (e.children)
    for (const a of e.children) {
      if (a.id === t) return e;
      const l = ft(a, t);
      if (l) return l;
    }
  if (e.slots)
    for (const a of Object.values(e.slots))
      for (const l of a) {
        if (l.id === t) return e;
        const i = ft(l, t);
        if (i) return i;
      }
  return null;
}
function Mt(e, t = !1) {
  const a = JSON.parse(JSON.stringify(e));
  if (t) {
    const l = (i) => {
      var r;
      i.id = ge(), (r = i.children) == null || r.forEach(l), Object.values(i.slots || {}).flat().forEach(l);
    };
    l(a);
  }
  return a;
}
function Cn(e) {
  return JSON.stringify(e, null, 2);
}
function Vn(e) {
  var t, a;
  try {
    const l = JSON.parse(e);
    if (!l.id || !l.name || !l.type || !((t = l.root) != null && t.id) || !((a = l.root) != null && a.type))
      throw new Error("无效的模板格式");
    return l;
  } catch (l) {
    throw new Error(`导入模板失败: ${l.message}`);
  }
}
const Ue = { x: 0, y: 0, w: 12, h: 1 }, Ie = { x: 24, y: 24, w: 320, h: 38 }, Ge = (e) => JSON.parse(JSON.stringify(e));
function Xl(e, t = {}) {
  const a = t.historyLimit ?? 100, l = P(Ge(e)), i = P([]), r = P("lg"), o = P([]), s = P([]), u = P([]);
  let f = 0;
  const c = F(() => o.value.length > 0), m = F(() => s.value.length > 0), y = F(() => u.value.length > 0), w = F(
    () => {
      var g;
      return ((g = l.value.root) == null ? void 0 : g.layoutMode) || l.value.layoutMode || "flow";
    }
  );
  function A() {
    o.value.push(Ge(l.value)), o.value.length > a && o.value.shift(), s.value = [];
  }
  function E(g) {
    f === 0 && A(), g();
  }
  function v() {
    f === 0 && A(), f++;
  }
  function k() {
    f = Math.max(0, f - 1);
  }
  function B(g) {
    v();
    try {
      g();
    } finally {
      k();
    }
  }
  function x() {
    const g = o.value.pop();
    g && (s.value.push(Ge(l.value)), l.value = g, M());
  }
  function D() {
    const g = s.value.pop();
    g && (o.value.push(Ge(l.value)), l.value = g, M());
  }
  function M() {
    i.value = i.value.filter((g) => be(l.value.root, g));
  }
  function U(g, _ = {}) {
    if (!g) {
      i.value = [];
      return;
    }
    if (!_.additive) {
      i.value = [g];
      return;
    }
    i.value = i.value.includes(g) ? i.value.filter((I) => I !== g) : [...i.value, g];
  }
  const z = () => {
    var g;
    i.value = (((g = l.value.root) == null ? void 0 : g.children) || []).map((_) => _.id);
  }, H = () => {
    i.value = [];
  }, te = (g) => i.value.includes(g);
  function ne(g) {
    return ft(l.value.root, g);
  }
  function ae(g, _) {
    _ !== "flow" && (g.layout = g.layout || {}, _ === "grid" && !g.layout.grid && (g.layout.grid = { ...Ue }), _ === "absolute" && !g.layout.absolute && (g.layout.absolute = { ...Ie }));
  }
  function ie(g, _) {
    E(() => {
      const I = _ ? be(l.value.root, _) : l.value.root;
      if (!I) return;
      I.children = I.children || [];
      const Z = I.layoutMode || (I === l.value.root ? l.value.layoutMode : void 0) || "flow";
      ae(g, Z), I.children.push(g), i.value = [g.id], Z === "grid" && q(I, g.id);
    });
  }
  function V(g) {
    E(() => {
      const _ = ne(g);
      _ != null && _.children && (_.children = _.children.filter((I) => I.id !== g), i.value = i.value.filter((I) => I !== g));
    });
  }
  function T() {
    i.value.length && B(() => {
      for (const g of [...i.value]) V(g);
      i.value = [];
    });
  }
  function N(g, _) {
    E(() => {
      const I = be(l.value.root, g);
      I && Object.assign(I, _);
    });
  }
  function R(g, _) {
    E(() => {
      const I = be(l.value.root, g);
      I && (I.props = { ...I.props, ..._ });
    });
  }
  function j(g, _) {
    var I;
    if (_ === "grid") return _e(g.layout, r.value);
    if (_ === "absolute") return (I = g.layout) == null ? void 0 : I.absolute;
  }
  function Y(g) {
    const _ = ne(g) || l.value.root, I = _.layoutMode || (_ === l.value.root ? l.value.layoutMode : void 0) || "flow";
    return (_.children || []).map((Z) => {
      const O = j(Z, I);
      return O ? { id: Z.id, ...O } : null;
    }).filter(Boolean);
  }
  function q(g, _) {
    const I = (g.children || []).map((O) => {
      const Q = _e(O.layout, r.value);
      return Q ? { id: O.id, ...Q } : null;
    }).filter(Boolean);
    if (I.length < 2) return;
    const Z = Rl(I, _);
    for (const O of Z) {
      const Q = (g.children || []).find((ee) => ee.id === O.id);
      Q && X(Q, { y: O.y }, "grid");
    }
  }
  function X(g, _, I) {
    if (g.layout = g.layout || {}, I === "absolute") {
      g.layout.absolute = { ...Ie, ...g.layout.absolute, ..._ };
      return;
    }
    if (I === "grid") {
      if (r.value === "lg") {
        g.layout.grid = { ...Ue, ...g.layout.grid, ..._ };
        return;
      }
      g.layout.breakpoints = g.layout.breakpoints || {}, g.layout.breakpoints[r.value] = {
        ...g.layout.breakpoints[r.value],
        ..._
      };
    }
  }
  function S(g, _, I = {}) {
    E(() => {
      const Z = be(l.value.root, g);
      if (!Z) return;
      const O = ne(g) || l.value.root, Q = O.layoutMode || (O === l.value.root ? l.value.layoutMode : void 0) || "flow";
      if (Q === "flow") return;
      const ee = et(l.value.canvas), J = j(Z, Q) || (Q === "grid" ? Ue : Ie), oe = Q === "grid" ? { maxX: ee.cols } : { maxX: ee.width, maxY: ee.height }, se = Re({ ...J, ..._ }, oe);
      X(Z, se, Q), Q === "grid" && (I.resolveCollision ?? !0) && q(O, g);
    });
  }
  function C(g, _) {
    i.value.length && B(() => {
      for (const I of i.value) {
        const Z = be(l.value.root, I);
        if (!Z) continue;
        const O = ne(I) || l.value.root, Q = O.layoutMode || (O === l.value.root ? l.value.layoutMode : void 0) || "flow", ee = j(Z, Q);
        ee && S(I, { x: ee.x + g, y: ee.y + _ });
      }
    });
  }
  function p() {
    u.value = i.value.map((g) => be(l.value.root, g)).filter(Boolean).map((g) => Mt(g));
  }
  function K() {
    p(), T();
  }
  function h() {
    u.value.length && B(() => {
      var _, I;
      const g = [];
      for (const Z of u.value) {
        const O = Mt(Z, !0);
        O.id = O.id || ge();
        const Q = w.value;
        Q === "grid" && ((_ = O.layout) != null && _.grid) ? O.layout.grid = { ...O.layout.grid, y: O.layout.grid.y + 1 } : Q === "absolute" && ((I = O.layout) != null && I.absolute) && (O.layout.absolute = {
          ...O.layout.absolute,
          x: O.layout.absolute.x + 16,
          y: O.layout.absolute.y + 16
        }), ie(O), g.push(O.id);
      }
      i.value = g;
    });
  }
  function d() {
    p(), h();
  }
  function b() {
    w.value === "grid" && E(() => {
      const g = l.value.root, _ = (g.children || []).map((I) => {
        const Z = _e(I.layout, r.value);
        return Z ? { id: I.id, ...Z } : null;
      }).filter(Boolean);
      for (const I of jl(_)) {
        const Z = (g.children || []).find((O) => O.id === I.id);
        Z && X(Z, { y: I.y }, "grid");
      }
    });
  }
  function $(g) {
    E(() => {
      var Z;
      if (l.value.layoutMode = g, l.value.root && (l.value.root.layoutMode = g), g === "flow") return;
      const _ = et(l.value.canvas);
      let I = 0;
      for (const O of ((Z = l.value.root) == null ? void 0 : Z.children) || []) {
        if (O.layout = O.layout || {}, g === "absolute" && !O.layout.absolute) {
          const Q = O.layout.grid;
          if (Q) {
            const ee = Ma(Q, _.width, _);
            O.layout.absolute = {
              x: Math.round(ee.left),
              y: Math.round(ee.top),
              w: Math.round(ee.width),
              h: Math.round(ee.height)
            };
          } else
            O.layout.absolute = { ...Ie, y: Ie.y + I * 56 };
        }
        if (g === "grid" && !O.layout.grid) {
          const Q = O.layout.absolute;
          O.layout.grid = Q ? Kl(Q, _.width, _) : { ...Ue, y: I };
        }
        I++;
      }
    });
  }
  return {
    template: l,
    selection: i,
    breakpoint: r,
    canUndo: c,
    canRedo: m,
    layoutMode: w,
    hasClipboard: y,
    select: U,
    selectAll: z,
    clearSelection: H,
    isSelected: te,
    addNode: ie,
    removeNode: V,
    removeSelected: T,
    updateNode: N,
    updateProps: R,
    updateGeometry: S,
    nudgeSelected: C,
    copy: p,
    cut: K,
    paste: h,
    duplicate: d,
    undo: x,
    redo: D,
    transaction: B,
    beginBatch: v,
    endBatch: k,
    compact: b,
    setLayoutMode: $,
    siblingRects: Y
  };
}
const Nt = 3, Zl = W({
  name: "VTemplateEditor",
  props: {
    /** 被编辑的模板。编辑器内部持有副本，通过 update:modelValue 回吐 */
    modelValue: { type: Object, required: !0 },
    /** 只读模式：仍可浏览与选中，但不能改动 */
    readonly: { type: Boolean, default: !1 },
    /** 组件面板只显示这些分类名，不传则全部显示 */
    categories: { type: Array, default: void 0 }
  },
  emits: ["update:modelValue", "save", "select"],
  setup(e, { emit: t }) {
    const a = Xl(e.modelValue), l = P("props"), i = P([]), r = P(null), o = P(0), s = F(() => et(a.template.value.canvas)), u = F(() => a.layoutMode.value), f = F(() => {
      var S;
      return ((S = a.template.value.root) == null ? void 0 : S.children) || [];
    });
    let c = null;
    de(
      a.template,
      (S) => {
        c = S, t("update:modelValue", S);
      },
      { deep: !0 }
    ), de(
      () => e.modelValue,
      (S) => {
        S && S !== c && (a.template.value = JSON.parse(JSON.stringify(S)), a.clearSelection());
      }
    ), de(a.selection, (S) => t("select", S));
    let m = null;
    const y = () => {
      r.value && (o.value = r.value.clientWidth);
    };
    re(() => {
      y(), typeof ResizeObserver < "u" && r.value && (m = new ResizeObserver(y), m.observe(r.value)), window.addEventListener("keydown", U);
    }), ue(() => {
      m == null || m.disconnect(), window.removeEventListener("keydown", U);
    });
    const w = (S) => {
      var C;
      return u.value === "grid" ? _e(S.layout, a.breakpoint.value) : (C = S.layout) == null ? void 0 : C.absolute;
    }, A = (S) => {
      const C = w(S);
      return C ? u.value === "absolute" ? { left: C.x, top: C.y, width: C.w, height: C.h } : o.value ? Ma(C, o.value, s.value) : null : null;
    }, E = (S) => f.value.filter((C) => C.id !== S).map((C) => {
      const p = w(C);
      return p ? { id: C.id, ...p } : null;
    }).filter(Boolean), v = () => !e.readonly && u.value !== "flow";
    function k(S, C, p) {
      const K = S.clientX, h = S.clientY;
      let d = !1;
      const b = (g) => {
        const _ = g.clientX - K, I = g.clientY - h;
        !d && Math.abs(_) < Nt && Math.abs(I) < Nt || (d || (d = !0, a.beginBatch()), C(_, I));
      }, $ = () => {
        d && a.endBatch(), i.value = [], window.removeEventListener("pointermove", b), window.removeEventListener("pointerup", $);
      };
      window.addEventListener("pointermove", b), window.addEventListener("pointerup", $);
    }
    function B(S, C) {
      if (!v()) return;
      const p = w(C);
      !p || p.static || (S.preventDefault(), k(S, (K, h) => {
        if (u.value === "grid") {
          const $ = Te(o.value, s.value.cols, s.value.gap) + s.value.gap, g = s.value.rowHeight + s.value.gap;
          a.updateGeometry(C.id, {
            x: p.x + Math.round(K / $),
            y: Math.max(0, p.y + Math.round(h / g))
          });
          return;
        }
        const d = { id: C.id, ...p, x: p.x + K, y: p.y + h }, b = Hl(d, E(C.id), s.value);
        i.value = b.guides, a.updateGeometry(C.id, { x: b.x, y: b.y });
      }));
    }
    function x(S, C, p) {
      if (!v()) return;
      const K = w(C);
      !K || K.static || (S.preventDefault(), S.stopPropagation(), k(S, (h, d) => {
        if (u.value === "grid") {
          const $ = Te(o.value, s.value.cols, s.value.gap) + s.value.gap, g = s.value.rowHeight + s.value.gap, _ = At(K, p, Math.round(h / $), Math.round(d / g));
          a.updateGeometry(C.id, Re(_, { maxX: s.value.cols }));
          return;
        }
        const b = At(K, p, h, d);
        a.updateGeometry(
          C.id,
          Re(b, { maxX: s.value.width, maxY: s.value.height })
        );
      }));
    }
    let D = null;
    function M(S) {
      var K;
      if (S.preventDefault(), !D || e.readonly) return;
      const C = dt(D), p = (K = r.value) == null ? void 0 : K.getBoundingClientRect();
      if (p && u.value !== "flow") {
        const h = S.clientX - p.left, d = S.clientY - p.top;
        if (C.layout = C.layout || {}, u.value === "grid") {
          const b = Te(o.value, s.value.cols, s.value.gap) + s.value.gap;
          C.layout.grid = {
            x: Math.max(0, Math.floor(h / b)),
            y: Math.max(0, Math.floor(d / (s.value.rowHeight + s.value.gap))),
            w: 6,
            h: 1
          };
        } else
          C.layout.absolute = { x: Math.round(h), y: Math.round(d), w: 320, h: 38 };
      }
      a.addNode(C), D = null;
    }
    function U(S) {
      const C = S.target;
      if (C && /^(INPUT|TEXTAREA|SELECT)$/.test(C.tagName) || e.readonly) return;
      const p = S.ctrlKey || S.metaKey;
      if (p && S.key.toLowerCase() === "z") {
        S.preventDefault(), S.shiftKey ? a.redo() : a.undo();
        return;
      }
      if (p && S.key.toLowerCase() === "y") {
        S.preventDefault(), a.redo();
        return;
      }
      if (p && S.key.toLowerCase() === "c") return a.copy();
      if (p && S.key.toLowerCase() === "x") return a.cut();
      if (p && S.key.toLowerCase() === "v") return a.paste();
      if (p && S.key.toLowerCase() === "d")
        return S.preventDefault(), a.duplicate();
      if (p && S.key.toLowerCase() === "a")
        return S.preventDefault(), a.selectAll();
      if (S.key === "Delete" || S.key === "Backspace")
        return a.selection.value.length ? (S.preventDefault(), a.removeSelected()) : void 0;
      const h = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      }[S.key];
      if (h && a.selection.value.length) {
        S.preventDefault();
        const d = u.value === "absolute" && S.shiftKey ? 10 : 1;
        a.nudgeSelected(h[0] * d, h[1] * d);
      }
    }
    function z() {
      const S = Ta.filter(
        (C) => !e.categories || e.categories.includes(C.name)
      );
      return n("aside", { class: "vui-tpl-editor-palette" }, [
        n("div", { class: "vui-tpl-editor-panel-title" }, "组件"),
        ...S.map(
          (C) => n("div", { class: "vui-tpl-editor-group", key: C.name }, [
            n("div", { class: "vui-tpl-editor-group-title" }, C.name),
            n(
              "div",
              { class: "vui-tpl-editor-chips" },
              C.components.map(
                (p) => n(
                  "div",
                  {
                    class: "vui-tpl-editor-chip",
                    key: p.type,
                    draggable: !e.readonly,
                    title: p.description,
                    onDragstart: () => {
                      D = p.type;
                    },
                    // 面板项也支持双击直接加进画布，比拖拽快
                    onDblclick: () => {
                      e.readonly || a.addNode(dt(p.type));
                    }
                  },
                  p.label
                )
              )
            )
          ])
        )
      ]);
    }
    function H(S, C, p = {}) {
      return n(
        "button",
        {
          type: "button",
          class: ["vui-tpl-editor-tool", p.active ? "is-active" : ""],
          disabled: p.disabled || !1,
          title: p.title || S,
          onClick: C
        },
        S
      );
    }
    function te() {
      const S = [
        ["flow", "流式"],
        ["grid", "栅格"],
        ["absolute", "自由"]
      ], C = ["lg", "md", "sm"];
      return n("div", { class: "vui-tpl-editor-toolbar" }, [
        H("撤销", a.undo, { disabled: !a.canUndo.value, title: "撤销 (Ctrl+Z)" }),
        H("重做", a.redo, { disabled: !a.canRedo.value, title: "重做 (Ctrl+Shift+Z)" }),
        n("span", { class: "vui-tpl-editor-sep" }),
        H("复制", a.copy, { disabled: !a.selection.value.length, title: "复制 (Ctrl+C)" }),
        H("粘贴", a.paste, { disabled: !a.hasClipboard.value, title: "粘贴 (Ctrl+V)" }),
        H("删除", a.removeSelected, { disabled: !a.selection.value.length, title: "删除 (Delete)" }),
        n("span", { class: "vui-tpl-editor-sep" }),
        ...S.map(
          ([p, K]) => H(K, () => a.setLayoutMode(p), {
            active: u.value === p,
            title: `切换到${K}布局`
          })
        ),
        n("span", { class: "vui-tpl-editor-sep" }),
        // 断点只对栅格有意义：自由画布是固定像素，没有响应式可言
        ...C.map(
          (p) => H(p.toUpperCase(), () => a.breakpoint.value = p, {
            active: a.breakpoint.value === p,
            disabled: u.value !== "grid",
            title: u.value === "grid" ? `编辑 ${p} 断点的布局` : "仅栅格模式支持断点"
          })
        ),
        n("span", { class: "vui-tpl-editor-spacer" }),
        H("紧凑排列", a.compact, { disabled: u.value !== "grid", title: "把所有节点上浮填掉空行" }),
        H("保存", () => t("save", a.template.value))
      ]);
    }
    function ne(S) {
      var C;
      return e.readonly || (C = w(S)) != null && C.static ? [] : zl.map(
        (p) => n("span", {
          class: ["vui-tpl-editor-handle", `is-${p}`],
          key: p,
          onPointerdown: (K) => x(K, S, p)
        })
      );
    }
    function ae() {
      const S = f.value.map((p) => {
        const K = A(p);
        if (!K) return null;
        const h = a.isSelected(p.id);
        return n(
          "div",
          {
            key: p.id,
            class: ["vui-tpl-editor-item", h ? "is-selected" : ""],
            style: {
              left: `${K.left}px`,
              top: `${K.top}px`,
              width: `${K.width}px`,
              height: `${K.height}px`
            },
            onPointerdown: (d) => {
              a.select(p.id, { additive: d.shiftKey || d.ctrlKey || d.metaKey }), B(d, p);
            }
          },
          h ? ne(p) : []
        );
      }).filter(Boolean), C = i.value.map(
        (p, K) => n("span", {
          key: `guide-${K}`,
          class: ["vui-tpl-editor-guide", `is-${p.axis}`],
          style: p.axis === "x" ? { left: `${p.position}px` } : { top: `${p.position}px` }
        })
      );
      return n("div", { class: "vui-tpl-editor-overlay" }, [...S, ...C]);
    }
    function ie() {
      return n(
        "div",
        {
          class: "vui-tpl-editor-stage",
          onDragover: (S) => S.preventDefault(),
          onDrop: M,
          // 点空白处取消选中
          onPointerdown: (S) => {
            S.target === S.currentTarget && a.clearSelection();
          }
        },
        [
          n(
            "div",
            {
              class: ["vui-tpl-editor-canvas", u.value === "absolute" ? "is-fixed" : ""],
              ref: r
            },
            [
              n(yt, { template: a.template.value, preview: !0 }),
              u.value === "flow" ? null : ae()
            ]
          )
        ]
      );
    }
    function V() {
      return f.value.length ? n(
        "div",
        { class: "vui-tpl-editor-pane" },
        f.value.map(
          (S) => {
            var C;
            return n(
              "div",
              {
                key: S.id,
                class: ["vui-tpl-editor-layer", a.isSelected(S.id) ? "is-active" : ""],
                onClick: (p) => a.select(S.id, { additive: p.shiftKey || p.ctrlKey || p.metaKey })
              },
              `${((C = S.meta) == null ? void 0 : C.label) || S.type}`
            );
          }
        )
      ) : n("div", { class: "vui-tpl-editor-empty" }, "画布还是空的，从左侧拖一个组件进来");
    }
    function T(S, C) {
      return n("label", { class: "vui-tpl-editor-field" }, [
        n("span", { class: "vui-tpl-editor-field-label" }, S),
        C
      ]);
    }
    function N(S, C, p) {
      return T(
        S,
        n("input", {
          type: "number",
          value: C ?? "",
          onInput: (K) => {
            const h = K.target.value;
            p(h === "" ? void 0 : Number(h));
          }
        })
      );
    }
    function R(S) {
      const C = w(S);
      if (!C) return null;
      const p = u.value === "grid" ? "格 / 行" : "px", K = (h) => a.updateGeometry(S.id, h);
      return n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, `位置与尺寸（${p}）`),
        N("X", C.x, (h) => K({ x: h ?? 0 })),
        N("Y", C.y, (h) => K({ y: h ?? 0 })),
        N("宽", C.w, (h) => K({ w: h ?? 1 })),
        N("高", C.h, (h) => K({ h: h ?? 1 })),
        n("div", { class: "vui-tpl-editor-section-title" }, "尺寸限制"),
        N("最小宽", C.minW, (h) => K({ minW: h })),
        N("最大宽", C.maxW, (h) => K({ maxW: h })),
        N("最小高", C.minH, (h) => K({ minH: h })),
        N("最大高", C.maxH, (h) => K({ maxH: h })),
        T(
          "锁定",
          n("input", {
            type: "checkbox",
            checked: C.static === !0,
            onChange: (h) => K({ static: h.target.checked })
          })
        )
      ]);
    }
    function j(S) {
      const C = $a[S.type] || [];
      return C.length ? n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "组件属性"),
        ...C.map((p) => {
          var h, d;
          const K = (h = S.props) == null ? void 0 : h[p.name];
          return p.type === "boolean" ? T(
            p.label,
            n("input", {
              type: "checkbox",
              checked: !!K,
              onChange: (b) => a.updateProps(S.id, { [p.name]: b.target.checked })
            })
          ) : p.type === "select" && ((d = p.options) != null && d.length) ? T(
            p.label,
            n(
              "select",
              {
                value: K ?? "",
                onChange: (b) => a.updateProps(S.id, { [p.name]: b.target.value })
              },
              p.options.map(
                (b) => n("option", { key: String(b.value), value: b.value }, b.label)
              )
            )
          ) : T(
            p.label,
            n("input", {
              type: p.type === "number" ? "number" : "text",
              value: K ?? "",
              onInput: (b) => {
                const $ = b.target.value;
                a.updateProps(S.id, { [p.name]: p.type === "number" ? Number($) : $ });
              }
            })
          );
        })
      ]) : n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "组件属性"),
        n("div", { class: "vui-tpl-editor-empty" }, "这个组件没有可配置属性")
      ]);
    }
    function Y(S) {
      const C = ["click", "change", "submit"], p = ["", "submit", "validate", "reset", "setValue", "showModal", "closeModal"];
      return n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "事件"),
        ...C.map(
          (K) => {
            var h, d;
            return T(
              K,
              n(
                "select",
                {
                  value: ((d = (h = S.events) == null ? void 0 : h[K]) == null ? void 0 : d.action) || "",
                  onChange: (b) => {
                    const $ = b.target.value, g = { ...S.events || {} };
                    $ ? g[K] = { type: K, action: $ } : delete g[K], a.updateNode(S.id, { events: g });
                  }
                },
                p.map(
                  (b) => n("option", { key: b || "none", value: b }, b || "（无）")
                )
              )
            );
          }
        )
      ]);
    }
    function q() {
      var p, K;
      const S = a.selection.value[0], C = S ? f.value.find((h) => h.id === S) : void 0;
      return C ? n("div", { class: "vui-tpl-editor-pane" }, [
        n("div", { class: "vui-tpl-editor-section" }, [
          n("div", { class: "vui-tpl-editor-section-title" }, ((p = C.meta) == null ? void 0 : p.label) || C.type),
          T(
            "标注名",
            n("input", {
              type: "text",
              value: ((K = C.meta) == null ? void 0 : K.label) || "",
              onInput: (h) => a.updateNode(C.id, {
                meta: { ...C.meta, label: h.target.value }
              })
            })
          )
        ]),
        R(C),
        j(C),
        Y(C)
      ].filter(Boolean)) : n("div", { class: "vui-tpl-editor-empty" }, "选中一个组件后在这里改它的属性");
    }
    function X() {
      return n("aside", { class: "vui-tpl-editor-side" }, [
        n(
          "div",
          { class: "vui-tpl-editor-tabs" },
          [
            ["props", "属性"],
            ["layers", "图层"]
          ].map(
            ([C, p]) => n(
              "button",
              {
                type: "button",
                key: C,
                class: ["vui-tpl-editor-tab", l.value === C ? "is-active" : ""],
                onClick: () => l.value = C
              },
              p
            )
          )
        ),
        l.value === "layers" ? V() : q()
      ]);
    }
    return () => n("div", { class: "vui-tpl-editor" }, [
      z(),
      n("div", { class: "vui-tpl-editor-main" }, [te(), ie()]),
      X()
    ]);
  }
}), Ql = {
  msg: "msg",
  notify: "notify",
  loading: "loading",
  confirm: "confirm",
  dialog: "confirm",
  page: "confirm",
  prompt: "confirm"
};
let Tt = 0;
const lt = /* @__PURE__ */ new Map(), nt = /* @__PURE__ */ new Map(), ht = /* @__PURE__ */ new Map();
function en() {
  return Tt += 1, `vui-layer-${Tt}`;
}
function qe(e, t, a = en()) {
  return e.dataset.layerId = String(a), document.body.appendChild(e), lt.set(a, e), ht.set(a, t), a;
}
function he(e) {
  const t = lt.get(e);
  if (!t) return;
  t.classList.add("is-leaving"), window.setTimeout(() => t.remove(), 150), lt.delete(e), ht.delete(e);
  const a = nt.get(e);
  a && window.clearTimeout(a), nt.delete(e);
}
function tn(e) {
  const t = e == null || e === "" ? null : Ql[String(e)];
  e != null && e !== "" && !t || Array.from(lt.keys()).forEach((a) => {
    (!t || ht.get(a) === t) && he(a);
  });
}
function an(e) {
  return e === 1 ? "check" : e === 2 ? "alert" : "info";
}
const En = {
  msg(e, t = {}, a) {
    const l = document.createElement("div");
    l.className = `vui-native-message is-icon-${t.icon || 0}`, l.setAttribute("role", "status"), l.innerHTML = '<span class="vui-native-message-icon"></span><span></span>', l.firstElementChild.innerHTML = $e(an(t.icon)), l.lastElementChild.textContent = String(e ?? "");
    const i = qe(l, "msg"), r = window.setTimeout(() => {
      he(i), a == null || a();
    }, Number(t.time || 2200));
    return nt.set(i, r), i;
  },
  notify(e = {}) {
    const t = document.createElement("aside");
    t.className = "vui-native-notify", t.setAttribute("role", "status");
    const a = document.createElement("strong");
    a.textContent = String(e.title || "提示");
    const l = document.createElement("div");
    l.textContent = String(e.content ?? "");
    const i = document.createElement("button");
    i.type = "button", i.setAttribute("aria-label", "关闭"), i.innerHTML = $e("close"), t.append(a, l, i);
    const r = qe(t, "notify");
    i.addEventListener("click", () => he(r));
    const o = window.setTimeout(() => he(r), Number(e.time || 3600));
    return nt.set(r, o), r;
  },
  confirm(e, t = {}) {
    var f;
    const a = document.createElement("div");
    a.className = "vui-native-confirm-wrap", a.setAttribute("role", "presentation");
    const l = document.createElement("section");
    l.className = "vui-native-confirm", l.setAttribute("role", "alertdialog"), l.setAttribute("aria-modal", "true");
    const i = document.createElement("header");
    i.textContent = String(t.title || "请确认");
    const r = document.createElement("div");
    r.className = "vui-native-confirm-body", r.textContent = String(e ?? "");
    const o = document.createElement("footer");
    l.append(i, r, o), a.append(l);
    const s = qe(a, "confirm"), u = (f = t.btn) != null && f.length ? t.btn : [
      { text: "确认", callback: (c) => he(c) },
      { text: "取消", callback: (c) => he(c) }
    ];
    return u.forEach((c, m) => {
      const y = document.createElement("button");
      y.type = "button", y.className = m === 0 ? "is-primary" : "", y.textContent = c.text || (m === 0 ? "确认" : "取消"), y.addEventListener("click", () => {
        c.callback ? c.callback(s) : he(s);
      }), o.append(y);
    }), a.addEventListener("mousedown", (c) => {
      if (c.target === a && u.length > 1) {
        const m = u[u.length - 1];
        m.callback ? m.callback(s) : he(s);
      }
    }), queueMicrotask(() => {
      var c;
      return (c = o.querySelector("button")) == null ? void 0 : c.focus();
    }), s;
  },
  load() {
    const e = document.createElement("div");
    return e.className = "vui-native-loading", e.setAttribute("role", "status"), e.innerHTML = '<span class="vui-spinner"></span><span></span>', e.lastElementChild.textContent = "正在处理…", qe(e, "loading");
  },
  close(e) {
    he(e);
  },
  closeAll(e) {
    tn(e);
  }
};
function ct(e, t) {
  const a = e.toLowerCase(), l = (t || e).toLowerCase();
  return /name|姓名|名称/.test(a) || /name|姓名|名称/.test(l) ? {
    type: "text",
    required: !0,
    placeholder: `请输入${t || "姓名"}`,
    max: 50
  } : /email|邮箱|邮件/.test(a) || /email|邮箱|邮件/.test(l) ? {
    type: "email",
    required: !0,
    placeholder: `请输入${t || "邮箱"}`,
    pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$"
  } : /phone|mobile|手机|电话|手机号/.test(a) || /phone|mobile|手机|电话/.test(l) ? {
    type: "tel",
    required: !0,
    placeholder: `请输入${t || "手机号"}`,
    pattern: "^1[3-9]\\d{9}$"
  } : /password|密码/.test(a) || /password|密码/.test(l) ? {
    type: "password",
    required: !0,
    placeholder: `请输入${t || "密码"}`,
    min: 8,
    max: 20
  } : /age|年龄/.test(a) || /age|年龄/.test(l) ? {
    type: "number",
    placeholder: `请输入${t || "年龄"}`,
    min: 0,
    max: 150
  } : /address|地址/.test(a) || /address|地址/.test(l) ? {
    type: "textarea",
    placeholder: `请输入${t || "详细地址"}`,
    rows: 3
  } : /status|状态/.test(a) || /status|状态/.test(l) ? {
    type: "select",
    placeholder: `请选择${t || "状态"}`,
    options: [
      { value: "active", label: "启用" },
      { value: "disabled", label: "禁用" }
    ]
  } : /date|时间|日期/.test(a) || /date|时间|日期/.test(l) ? {
    type: "date",
    placeholder: `请选择${t || "日期"}`
  } : {
    type: "text",
    placeholder: `请输入${t || "内容"}`
  };
}
class $t extends Error {
  constructor(t) {
    super(t.message), this.name = "UIError", this.code = t.code, this.component = t.component, this.prop = t.prop, this.received = t.received, this.expected = t.expected, this.suggestion = t.suggestion, this.documentation = t.documentation;
  }
  toJSON() {
    return {
      code: this.code,
      component: this.component,
      prop: this.prop,
      received: this.received,
      expected: this.expected,
      message: this.message,
      suggestion: this.suggestion,
      documentation: this.documentation
    };
  }
}
function An(e, t, a, l, i) {
  if (i && typeof a !== i)
    throw new $t({
      code: "INVALID_PROP_TYPE",
      component: e,
      prop: t,
      received: typeof a,
      expected: i,
      message: `${e}的${t}属性类型错误`,
      suggestion: `期望类型为${i}，实际为${typeof a}`
    });
  if (l && !l.includes(a))
    throw new $t({
      code: "INVALID_PROP_VALUE",
      component: e,
      prop: t,
      received: a,
      expected: l,
      message: `${e}的${t}属性值"${a}"无效`,
      suggestion: `可选值为: ${l.join(", ")}`
    });
}
function Dn(e) {
  return {
    value: e,
    valid: !0,
    errors: [],
    dirty: !1,
    touched: !1,
    pristine: !0
  };
}
function Mn(e) {
  const t = `import { ref, reactive } from 'vue'
import { VForm, VFormItem, VInput, VSelect, VDatePicker, VSwitch, VInputNumber } from "@vima-tech/ui-admin"`, a = `<template>
  <VForm :model="formData" :rules="rules" @submit="handleSubmit">
${e.map((i) => {
    const r = ct(i.name, i.label), o = ln(r.type || "text");
    return `    <VFormItem label="${i.label}" prop="${i.name}">
      <${o} v-model="formData.${i.name}"${r.required ? " required" : ""} />
    </VFormItem>`;
  }).join(`
`)}
    <VFormItem>
      <VButton mode="primary" type="submit">提交</VButton>
    </VFormItem>
  </VForm>
</template>`, l = `<script setup>
${t}

const formData = reactive({
${e.map((i) => {
    const r = ct(i.name, i.label);
    return `  ${i.name}: ${nn(r.type || "text")}`;
  }).join(`,
`)}
})

const rules = {
${e.filter((i) => ct(i.name, i.label).required).map((i) => `  ${i.name}: [{ required: true, message: '请输入${i.label}' }]`).join(`,
`)}
}

const handleSubmit = () => {
  console.log('提交数据:', formData)
}
<\/script>`;
  return `${a}

${l}`;
}
function Nn(e) {
  const t = `<template>
  <VTable 
    :columns="columns" 
    :data-source="dataSource"
    :default-toolbar="true"
  >
${e.filter((l) => l.slot).map((l) => `    <template #${l.slot}="{ row }">
      <!-- ${l.label}的自定义渲染 -->
      <span>{{ row.${l.name} }}</span>
    </template>`).join(`
`)}
  </VTable>
</template>`, a = `<script setup>
import { ref } from 'vue'
import { VTable } from "@vima-tech/ui-admin"

const columns = [
${e.map((l) => `  { key: '${l.name}', title: '${l.label}', width: ${l.width || 120} }`).join(`,
`)}
]

const dataSource = ref([])
<\/script>`;
  return `${t}

${a}`;
}
function ln(e) {
  return {
    text: "VInput",
    email: "VInput",
    tel: "VInput",
    password: "VInput",
    number: "VInputNumber",
    textarea: "VInput",
    select: "VSelect",
    date: "VDatePicker",
    boolean: "VSwitch"
  }[e] || "VInput";
}
function nn(e) {
  return {
    text: "''",
    email: "''",
    tel: "''",
    password: "''",
    number: "0",
    textarea: "''",
    select: "''",
    date: "''",
    boolean: "false"
  }[e] || "''";
}
const Fe = [];
function Tn(e, t, a) {
  Fe.push({
    component: e,
    props: t,
    state: a,
    timestamp: Date.now()
  }), Fe.length > 100 && Fe.shift();
}
function $n() {
  return [...Fe];
}
function On() {
  Fe.length = 0;
}
const it = [];
function Bn(e, t, a) {
  const l = performance.now();
  a();
  const i = performance.now() - l;
  return it.push({
    component: e,
    operation: t,
    duration: i,
    timestamp: Date.now()
  }), i;
}
function Ln() {
  return [...it];
}
function In(e) {
  const t = e ? it.filter((i) => i.component === e) : it, a = {};
  for (const i of t) {
    const r = `${i.component}.${i.operation}`;
    a[r] || (a[r] = []), a[r].push(i.duration);
  }
  const l = {};
  for (const [i, r] of Object.entries(a))
    l[i] = r.reduce((o, s) => o + s, 0) / r.length;
  return l;
}
const rn = "vui-template:";
class on {
  constructor(t = rn, a = {}) {
    this.prefix = t, this.validationOptions = a;
  }
  async save(t) {
    try {
      ke(t, this.validationOptions), t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), t.createdAt || (t.createdAt = t.updatedAt), localStorage.setItem(
        `${this.prefix}${t.id}`,
        JSON.stringify(t)
      );
    } catch (a) {
      throw new Error(`保存模板失败: ${a.message}`);
    }
  }
  async load(t) {
    try {
      const a = localStorage.getItem(`${this.prefix}${t}`);
      if (!a) return null;
      const l = JSON.parse(a);
      return ke(l, this.validationOptions), l;
    } catch (a) {
      throw new Error(`加载模板失败: ${a.message}`);
    }
  }
  async list(t) {
    var a;
    try {
      const l = [], i = Object.keys(localStorage).filter((y) => y.startsWith(this.prefix));
      for (const y of i)
        try {
          const w = localStorage.getItem(y);
          if (w) {
            const A = JSON.parse(w);
            ke(A, this.validationOptions), l.push(A);
          }
        } catch {
        }
      let r = l;
      if (t != null && t.keyword) {
        const y = t.keyword.toLowerCase();
        r = r.filter(
          (w) => {
            var A, E;
            return w.name.toLowerCase().includes(y) || ((A = w.description) == null ? void 0 : A.toLowerCase().includes(y)) || ((E = w.tags) == null ? void 0 : E.some((v) => v.toLowerCase().includes(y)));
          }
        );
      }
      t != null && t.type && (r = r.filter((y) => y.type === t.type)), (a = t == null ? void 0 : t.tags) != null && a.length && (r = r.filter(
        (y) => {
          var w;
          return (w = y.tags) == null ? void 0 : w.some((A) => t.tags.includes(A));
        }
      ));
      const o = (t == null ? void 0 : t.sortBy) || "updatedAt", s = (t == null ? void 0 : t.sortOrder) || "desc";
      r.sort((y, w) => {
        const A = y[o] || "", E = w[o] || "";
        return s === "asc" ? String(A).localeCompare(String(E)) : String(E).localeCompare(String(A));
      });
      const u = (t == null ? void 0 : t.page) || 1, f = (t == null ? void 0 : t.pageSize) || 20, c = (u - 1) * f, m = c + f;
      return r.slice(c, m);
    } catch (l) {
      throw new Error(`列出模板失败: ${l.message}`);
    }
  }
  async delete(t) {
    try {
      localStorage.removeItem(`${this.prefix}${t}`);
    } catch (a) {
      throw new Error(`删除模板失败: ${a.message}`);
    }
  }
  async export(t) {
    const a = await this.load(t);
    if (!a)
      throw new Error(`模板不存在: ${t}`);
    return JSON.stringify(a, null, 2);
  }
  async import(t) {
    try {
      const a = JSON.parse(t);
      if (!a.id || !a.name || !a.root)
        throw new Error("无效的模板格式");
      return a.id = `imported-${ge()}`, a.createdAt = (/* @__PURE__ */ new Date()).toISOString(), a.updatedAt = a.createdAt, await this.save(a), a;
    } catch (a) {
      throw new Error(`导入模板失败: ${a.message}`);
    }
  }
  /**
   * 清空所有模板
   */
  async clear() {
    Object.keys(localStorage).filter((a) => a.startsWith(this.prefix)).forEach((a) => localStorage.removeItem(a));
  }
  /**
   * 获取存储大小
   */
  getSize() {
    let t = 0;
    return Object.keys(localStorage).filter((l) => l.startsWith(this.prefix)).forEach((l) => {
      const i = localStorage.getItem(l);
      i && (t += i.length);
    }), t;
  }
}
class Pn {
  constructor(t) {
    this.config = t;
  }
  async request(t, a) {
    const l = `${this.config.baseUrl}${t}`, i = await fetch(l, {
      ...a,
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
        ...a == null ? void 0 : a.headers
      }
    });
    if (!i.ok)
      throw new Error(`API请求失败: ${i.status} ${i.statusText}`);
    return i.json();
  }
  async save(t) {
    ke(t, this.config.validation), await this.request(`/templates/${t.id}`, {
      method: "PUT",
      body: JSON.stringify(t)
    });
  }
  async load(t) {
    try {
      const a = await this.request(`/templates/${t}`);
      return ke(a, this.config.validation), a;
    } catch {
      return null;
    }
  }
  async list(t) {
    const a = new URLSearchParams();
    t != null && t.page && a.set("page", String(t.page)), t != null && t.pageSize && a.set("pageSize", String(t.pageSize)), t != null && t.keyword && a.set("keyword", t.keyword), t != null && t.type && a.set("type", t.type), t != null && t.tags && a.set("tags", t.tags.join(",")), t != null && t.sortBy && a.set("sortBy", t.sortBy), t != null && t.sortOrder && a.set("sortOrder", t.sortOrder);
    const l = await this.request(`/templates?${a.toString()}`);
    if (!Array.isArray(l)) throw new Error("API 返回的模板列表格式无效");
    return l.forEach((i) => ke(i, this.config.validation)), l;
  }
  async delete(t) {
    await this.request(`/templates/${t}`, { method: "DELETE" });
  }
  async export(t) {
    const a = await this.load(t);
    return JSON.stringify(a, null, 2);
  }
  async import(t) {
    const a = JSON.parse(t);
    ke(a, this.config.validation);
    const l = await this.request("/templates/import", {
      method: "POST",
      body: JSON.stringify(a)
    });
    return ke(l, this.config.validation), l;
  }
}
class sn {
  constructor(t, a) {
    this.storage = t, this.aiEndpoint = a;
  }
  /**
   * 处理 AI 请求
   */
  async handleRequest(t) {
    try {
      switch (t.operation) {
        case "create":
          return await this.createTemplate(t);
        case "read":
          return await this.readTemplate(t);
        case "update":
          return await this.updateTemplate(t);
        case "delete":
          return await this.deleteTemplate(t);
        case "generate":
          return await this.generateTemplate(t);
        case "transform":
          return await this.transformTemplate(t);
        default:
          throw new Error(`未知的操作类型: ${t.operation}`);
      }
    } catch (a) {
      return {
        success: !1,
        error: a.message,
        code: a.code || "AI_TEMPLATE_REQUEST_FAILED",
        diagnostics: a.diagnostics
      };
    }
  }
  /**
   * 创建模板
   */
  async createTemplate(t) {
    if (!t.template)
      throw new Error("缺少模板数据");
    const a = t.template;
    a.id = a.id || `ai-${Date.now()}`, a.createdAt = (/* @__PURE__ */ new Date()).toISOString(), a.updatedAt = a.createdAt;
    const l = Ye(a);
    return l.valid ? (await this.storage.save(a), { success: !0, template: a }) : {
      success: !1,
      code: "TEMPLATE_VALIDATION_FAILED",
      error: "模板未通过结构或安全校验",
      diagnostics: l.diagnostics
    };
  }
  /**
   * 读取模板
   */
  async readTemplate(t) {
    if (!t.templateId)
      throw new Error("缺少模板ID");
    const a = await this.storage.load(t.templateId);
    if (!a)
      throw new Error(`模板不存在: ${t.templateId}`);
    return { success: !0, template: a };
  }
  /**
   * 更新模板
   */
  async updateTemplate(t) {
    if (!t.templateId || !t.template)
      throw new Error("缺少模板ID或数据");
    const a = await this.storage.load(t.templateId);
    if (!a)
      throw new Error(`模板不存在: ${t.templateId}`);
    const l = { ...a, ...t.template, id: t.templateId };
    l.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const i = Ye(l);
    return i.valid ? (await this.storage.save(l), { success: !0, template: l }) : {
      success: !1,
      code: "TEMPLATE_VALIDATION_FAILED",
      error: "模板未通过结构或安全校验",
      diagnostics: i.diagnostics
    };
  }
  /**
   * 删除模板
   */
  async deleteTemplate(t) {
    if (!t.templateId)
      throw new Error("缺少模板ID");
    return await this.storage.delete(t.templateId), { success: !0 };
  }
  /**
   * AI 生成模板
   */
  async generateTemplate(t) {
    if (!t.prompt)
      throw new Error("缺少生成提示");
    if (!this.aiEndpoint)
      return {
        success: !1,
        code: "AI_ENDPOINT_NOT_CONFIGURED",
        error: "未配置 AI 模板生成端点"
      };
    const a = await fetch(this.aiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: t.prompt, params: t.params })
    });
    if (!a.ok)
      return {
        success: !1,
        code: "AI_ENDPOINT_ERROR",
        error: `AI 模板端点请求失败: ${a.status}`
      };
    const l = await a.json(), i = Ye(l.template);
    return i.valid ? (await this.storage.save(l.template), { success: !0, template: l.template }) : {
      success: !1,
      code: "TEMPLATE_VALIDATION_FAILED",
      error: "AI 返回的模板未通过结构或安全校验",
      diagnostics: i.diagnostics
    };
  }
  /**
   * 转换模板
   */
  async transformTemplate(t) {
    return {
      success: !1,
      code: "UNSUPPORTED_OPERATION",
      error: `模板转换尚未实现${t.target ? `: ${t.target}` : ""}`
    };
  }
  /**
   * 列出所有模板
   */
  async listTemplates(t) {
    return this.storage.list(t);
  }
  /**
   * 导出模板
   */
  async exportTemplate(t) {
    return this.storage.export(t);
  }
  /**
   * 导入模板
   */
  async importTemplate(t) {
    return this.storage.import(t);
  }
}
const un = new on(), _n = new sn(un), cn = [
  xa,
  Kt,
  Ua,
  Ht,
  Ga,
  qa,
  za,
  Pl,
  vt,
  _t,
  Pt,
  gt,
  Va,
  It,
  bl,
  wl,
  Bt,
  kl,
  ea,
  oa,
  sa,
  Ft,
  ba,
  ga,
  Ml,
  Nl,
  Sa,
  Gt,
  qt,
  ja,
  Ha,
  le,
  Yt,
  Xt,
  ma,
  Ka,
  wa,
  Aa,
  fa,
  ha,
  Rt,
  mt,
  aa,
  Lt,
  Qt,
  Za,
  Wa,
  Tl,
  va,
  Sl,
  xl,
  ta,
  yl,
  hl,
  ra,
  la,
  na,
  Ea,
  Jt,
  ya,
  ua,
  jt,
  Zl
];
Jl(Ra({
  VAlert: xa,
  VBadge: Ht,
  VButton: vt,
  VButtonGroup: _t,
  VCard: Pt,
  VCheckbox: gt,
  VCheckboxGroup: Va,
  VCol: It,
  VContainer: Bt,
  VDatePicker: ea,
  VDescriptions: oa,
  VDescriptionsItem: sa,
  VDivider: Ft,
  VDrawer: ba,
  VDropdown: ga,
  VEmpty: Sa,
  VForm: Gt,
  VFormItem: qt,
  VIcon: le,
  VInput: Yt,
  VInputNumber: Xt,
  VLayer: ma,
  VLink: Aa,
  VLoading: wa,
  VPagination: fa,
  VPopover: ha,
  VProgress: Rt,
  VRadio: mt,
  VRadioGroup: aa,
  VRow: Lt,
  VSelect: Qt,
  VStatistic: va,
  VSwitch: ta,
  VTable: ra,
  VTag: la,
  VTagInput: na,
  VTextarea: Jt,
  VTimePicker: Ea,
  VTooltip: ya,
  VTree: ua,
  VUpload: jt
}));
const Fn = {
  install(e) {
    cn.forEach((t) => {
      t.name && e.component(t.name, t);
    });
  }
};
export {
  sn as AITemplateService,
  Pn as ApiTemplateStorage,
  Da as BREAKPOINTS_DESC,
  Fl as BREAKPOINT_MIN_WIDTH,
  nl as BUTTON_FRAME_WIDTH,
  il as BUTTON_GAP,
  ll as BUTTON_MIN_WIDTH,
  rl as CELL_PADDING_X,
  fl as CHECK_COLUMN_WIDTH,
  Ta as COMPONENT_CATEGORIES,
  $a as COMPONENT_PROPS_CONFIG,
  Sn as CardTemplateRenderer,
  _l as DEFAULT_CANVAS,
  ml as FLEXIBLE_COLUMN_MIN_WIDTH,
  xn as FormTemplateRenderer,
  on as LocalTemplateStorage,
  ia as OPERATION_COLUMN_MIN_WIDTH,
  zl as RESIZE_HANDLES,
  vl as TABLE_MIN_WIDTH,
  Kn as TEMPLATE_COMPONENT_NAMES,
  Hn as TEMPLATE_COMPONENT_TYPES,
  yt as TemplateRenderer,
  $t as UIError,
  xa as VAlert,
  Kt as VAvatar,
  Ua as VAvatarGroup,
  Ht as VBadge,
  za as VBody,
  Ga as VBreadcrumb,
  qa as VBreadcrumbItem,
  vt as VButton,
  _t as VButtonGroup,
  Pt as VCard,
  gt as VCheckbox,
  Va as VCheckboxGroup,
  It as VCol,
  bl as VCollapse,
  wl as VCollapseItem,
  Pl as VColumnSetting,
  Bt as VContainer,
  kl as VCountdown,
  ea as VDatePicker,
  oa as VDescriptions,
  sa as VDescriptionsItem,
  Ft as VDivider,
  ba as VDrawer,
  ga as VDropdown,
  Ml as VDropdownMenu,
  Nl as VDropdownMenuItem,
  Sa as VEmpty,
  Gt as VForm,
  qt as VFormItem,
  ja as VFullscreen,
  Ha as VHeader,
  le as VIcon,
  Yt as VInput,
  Xt as VInputNumber,
  ma as VLayer,
  Ka as VLayout,
  Aa as VLink,
  wa as VLoading,
  fa as VPagination,
  ha as VPopover,
  Rt as VProgress,
  mt as VRadio,
  aa as VRadioGroup,
  Lt as VRow,
  Qt as VSelect,
  Za as VSelectOption,
  Wa as VSide,
  Tl as VSkeleton,
  va as VStatistic,
  Sl as VStep,
  xl as VSteps,
  ta as VSwitch,
  yl as VTab,
  hl as VTabItem,
  ra as VTable,
  la as VTag,
  na as VTagInput,
  Zl as VTemplateEditor,
  Jt as VTextarea,
  Ea as VTimePicker,
  ya as VTooltip,
  ua as VTree,
  je as VUI_FORM_ITEM_KEY,
  zt as VUI_FORM_KEY,
  Wt as VUI_RADIO_KEY,
  jt as VUpload,
  Fn as VimaUiAdmin,
  At as applyResizeDelta,
  ke as assertValidTemplate,
  sl as buttonLabelWidth,
  ul as buttonWidth,
  Et as clamp,
  Re as clampGeometry,
  L as classes,
  On as clearDebugHistory,
  Mt as cloneNode,
  Te as colWidth,
  tt as collides,
  jl as compactGrid,
  cn as components,
  kn as createEmptyTemplate,
  dt as createNode,
  Dn as createStandardState,
  Ra as createTemplateComponentMap,
  Xl as createTemplateEditor,
  Fn as default,
  _n as defaultAIService,
  un as defaultStorage,
  Ce as displayValue,
  Cn as exportTemplate,
  pn as findCollisions,
  be as findNode,
  ft as findParentNode,
  Mn as generateFormCode,
  Nn as generateTableCode,
  In as getAveragePerformance,
  $n as getDebugHistory,
  zn as getIconNames,
  Ln as getPerformanceMetrics,
  yn as gridHeight,
  Ma as gridToPixel,
  Pa as hasIcon,
  $e as iconSvgMarkup,
  Vn as importTemplate,
  ct as inferFieldConfig,
  Ne as isEmptyValue,
  En as layer,
  Tn as logComponentDebug,
  Bn as measurePerformance,
  De as mergeStyles,
  vn as message,
  mn as messageBox,
  Wn as normalizeIconName,
  cl as operationCellWidth,
  dl as operationColumnWidth,
  gn as pickBreakpoint,
  Kl as pixelToGrid,
  hn as pixelToGridDelta,
  wn as registerComponent,
  Jl as registerComponents,
  Un as registerIcon,
  et as resolveCanvas,
  Rl as resolveGridCollisions,
  _e as resolveGridGeometry,
  we as sizeToCss,
  Hl as snapPosition,
  bn as snapResize,
  gl as tableMinWidth,
  Gn as templateComponentName,
  An as validateProp,
  Ye as validateTemplate
};
//# sourceMappingURL=index.js.map
