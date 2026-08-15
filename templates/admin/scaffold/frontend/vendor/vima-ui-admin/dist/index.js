import { defineComponent as H, useAttrs as Y, computed as P, h as n, ref as I, onMounted as ve, onBeforeUnmount as ge, inject as De, watch as me, Teleport as Ae, provide as je, nextTick as we, onUpdated as ja, createVNode as Ka, reactive as Et, onUnmounted as Ha } from "vue";
import { V as ie, m as Be, c as L, d as Ne, a as _e, s as Ee, h as za, b as Re, v as lt, e as At, f as Wa, r as Ua, i as Ft, g as Me, j as Ga } from "./icons-B1oeJ8GI.js";
import { T as Yn, k as Jn, l as Xn, n as Zn, o as Qn, t as ei } from "./icons-B1oeJ8GI.js";
function he(e, t, a) {
  const { class: l, style: i, ...r } = e;
  return {
    ...r,
    class: L(t, l),
    style: Be(a, i)
  };
}
const Rt = H({
  name: "VContainer",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("main", he(a, ["vui-container"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), jt = H({
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
    const a = Y(), l = P(() => ({
      start: "flex-start",
      center: "center",
      end: "flex-end",
      "space-between": "space-between",
      "space-around": "space-around"
    })[e.justify]), i = P(() => ({ top: "flex-start", middle: "center", bottom: "flex-end" })[e.align]);
    return () => {
      var r;
      return n(
        "div",
        he(a, ["vui-row"], {
          "--vui-row-gutter": `${Math.max(0, Number(e.gutter) || 0)}px`,
          justifyContent: l.value,
          alignItems: i.value
        }),
        (r = t.default) == null ? void 0 : r.call(t)
      );
    };
  }
}), Kt = H({
  name: "VCol",
  inheritAttrs: !1,
  props: {
    md: { type: [Number, String], default: 24 },
    span: { type: [Number, String], default: void 0 },
    offset: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = P(() => Math.min(24, Math.max(1, Number(e.span ?? e.md) || 24))), i = P(() => Math.min(23, Math.max(0, Number(e.offset) || 0)));
    return () => {
      var r;
      return n(
        "div",
        he(
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
}), Ht = H({
  name: "VCard",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    shadow: { type: String, default: "always" }
  },
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l, i;
      return n("section", he(a, ["vui-card", `is-shadow-${e.shadow}`]), [
        e.title || t.title || t.extra ? n("header", { class: ["vui-card-header"] }, [
          n("div", { class: "vui-card-title" }, ((l = t.title) == null ? void 0 : l.call(t)) || e.title),
          t.extra ? n("div", { class: "vui-card-extra" }, t.extra()) : null
        ]) : null,
        n("div", { class: ["vui-card-body"] }, (i = t.default) == null ? void 0 : i.call(t))
      ]);
    };
  }
}), wt = H({
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
    const a = Y();
    return () => {
      var l;
      return n(
        "button",
        {
          ...he(a, [
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
}), zt = H({
  name: "VButtonGroup",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("div", he(a, ["vui-button-group"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Wt = H({
  name: "VDivider",
  inheritAttrs: !1,
  props: {
    content: { type: String, default: "" },
    theme: { type: String, default: "" },
    direction: { type: String, default: "horizontal" },
    contentPosition: { type: String, default: "center" }
  },
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var i;
      const l = !!(e.content || t.default);
      return n("div", he(a, [
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
}), Ut = H({
  name: "VProgress",
  inheritAttrs: !1,
  props: {
    percent: { type: Number, default: 0 },
    status: { type: String, default: "" }
  },
  setup(e) {
    const t = Y(), a = P(() => Math.min(100, Math.max(0, Number(e.percent) || 0)));
    return () => n("div", he(t, ["vui-progress", `is-${e.status || "normal"}`]), [
      n("div", { class: "vui-progress-track" }, [
        n("div", { class: "vui-progress-bar", style: { width: `${a.value}%` } })
      ]),
      n("span", { class: "vui-progress-label" }, `${a.value}%`)
    ]);
  }
}), Gt = H({
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
    const a = Y(), l = I(), i = () => {
      var o;
      return (o = l.value) == null ? void 0 : o.click();
    }, r = (o) => {
      var u;
      const s = o.target.files;
      s != null && s.length && ((u = e.beforeUpload) == null || u.call(e, s)), l.value && (l.value.value = "");
    };
    return () => {
      var o;
      return n("div", he(a, ["vui-upload"]), [
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
}), qa = H({
  name: "VFullscreen",
  emits: ["fullscreenchange"],
  setup(e, { slots: t, emit: a }) {
    const l = I(!!document.fullscreenElement), i = () => {
      l.value = !!document.fullscreenElement, a("fullscreenchange", l.value);
    }, r = async () => {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    };
    return ve(() => document.addEventListener("fullscreenchange", i)), ge(() => document.removeEventListener("fullscreenchange", i)), () => {
      var o;
      return (o = t.default) == null ? void 0 : o.call(t, { toggle: r, isFullscreen: l.value });
    };
  }
}), Ya = H({
  name: "VLayout",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("section", he(a, ["vui-layout"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Ja = H({
  name: "VHeader",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("header", he(a, ["vui-header"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Xa = H({
  name: "VBody",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("div", he(a, ["vui-body"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), Za = H({
  name: "VSide",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var l;
      return n("aside", he(a, ["vui-side"]), (l = t.default) == null ? void 0 : l.call(t));
    };
  }
}), qt = H({
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
    const a = Y(), l = P(() => ({ xs: "is-xs", sm: "is-sm", md: "is-md", lg: "is-lg", xl: "is-xl" })[String(e.size)] || ""), i = P(() => {
      const o = Number(e.size);
      return !isNaN(o) && o > 0 ? { width: `${o}px`, height: `${o}px`, fontSize: `${o * 0.4}px` } : {};
    }), r = P(() => {
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
      const { class: o, style: s, ...u } = a, d = ((c = t.default) == null ? void 0 : c.call(t)) || (e.src ? n("img", { src: e.src, alt: "", style: { objectFit: e.fit } }) : e.text ? n("span", { class: "vui-avatar-text" }, e.text.slice(0, 2)) : e.icon ? n("span", { class: ["vui-icon", e.icon] }) : n(ie, { class: "vui-avatar-icon", type: "user" }));
      return n(
        "div",
        {
          ...u,
          class: L("vui-avatar", o, l.value, `is-${e.shape}`),
          style: Be(i.value, r.value ? { backgroundColor: r.value } : void 0, s)
        },
        [d]
      );
    };
  }
}), Qa = H({
  name: "VAvatarGroup",
  inheritAttrs: !1,
  props: {
    max: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var c;
      const { class: l, style: i, ...r } = a, o = ((c = t.default) == null ? void 0 : c.call(t)) || [], s = Number(e.max) || 0, u = s > 0 ? o.slice(0, s) : o, d = s > 0 ? o.length - s : 0;
      return n(
        "div",
        { ...r, class: L("vui-avatar-group", l), style: i },
        [
          ...u,
          d > 0 ? n(qt, { class: "vui-avatar-excess", text: `+${d}` }) : null
        ]
      );
    };
  }
}), Yt = H({
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
    const a = Y(), l = P(() => {
      const r = Number(e.value);
      return !isNaN(r) && r > Number(e.max) ? `${e.max}+` : String(e.value);
    }), i = P(() => e.hidden ? !1 : e.dot ? !0 : !(e.value === "" || e.value === void 0 || e.value === 0 && !e.showZero));
    return () => {
      var d;
      const { class: r, style: o, ...s } = a;
      return t.default ? n(
        "span",
        { ...s, class: L("vui-badge-host", r), style: o },
        [
          (d = t.default) == null ? void 0 : d.call(t),
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
}), el = H({
  name: "VBreadcrumb",
  inheritAttrs: !1,
  props: {
    separator: { type: String, default: "/" },
    separatorIcon: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = Y();
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
}), tl = H({
  name: "VBreadcrumbItem",
  inheritAttrs: !1,
  props: {
    to: { type: [String, Object], default: "" },
    replace: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = Y();
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
}), Jt = Symbol("VuiForm"), Ye = Symbol("VuiFormItem"), Xt = Symbol("VuiRadio"), Xe = 8, Te = 12;
function Zt(e, t, a, l = !1) {
  const i = e.getBoundingClientRect(), r = window.innerWidth, o = window.innerHeight, s = o - i.bottom - Xe - Te, u = i.top - Xe - Te, d = s < Math.min(a, 260) && u > s, c = Math.max(80, d ? u : s), v = Math.min(
    t,
    Math.max(0, r - Te * 2)
  ), p = l ? i.right - v : i.left, b = Math.min(
    Math.max(Te, p),
    Math.max(
      Te,
      r - Te - v
    )
  );
  return {
    dropUp: d,
    alignRight: l || b < i.left,
    style: {
      position: "fixed",
      top: d ? "auto" : `${i.bottom + Xe}px`,
      right: "auto",
      bottom: d ? `${o - i.top + Xe}px` : "auto",
      left: `${b}px`,
      width: `${v}px`,
      maxHeight: `${Math.min(a, c)}px`
    }
  };
}
function al(e, t) {
  const { class: a, style: l, ...i } = e;
  return {
    rest: i,
    root: {
      class: L(t, a),
      style: l
    }
  };
}
function ll(e, t, a) {
  const l = Ee(e), i = l == null ? void 0 : l.match(/^(\d+(?:\.\d+)?)px$/);
  if (!i || !t) return l;
  const r = Number(i[1]);
  if (r === 0) return l;
  const o = Array.from(t).reduce(
    (u, d) => u + (/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(d) ? 1 : 0.55),
    0
  ), s = Math.ceil(o * 14 + 14 + (a ? 14 : 0));
  return `${Math.max(r, s)}px`;
}
function Je(e = "") {
  return e.replace(/[：:]\s*$/, "").trim();
}
function mt(e, t) {
  const a = Je(e);
  return a ? `${t === "select" ? "请选择" : "请输入"}${a}` : t === "select" ? "请选择" : "";
}
const Qt = H({
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
    const l = Y(), i = /* @__PURE__ */ new Set(), r = { ...e.model };
    je(Jt, {
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
      register: (d) => i.add(d),
      unregister: (d) => i.delete(d)
    });
    const o = async () => {
      const c = (await Promise.allSettled([...i].map((v) => v.validate()))).find((v) => v.status === "rejected");
      if ((c == null ? void 0 : c.status) === "rejected") throw c.reason;
      return !0;
    }, s = () => i.forEach((d) => d.clear());
    return a({ validate: o, clearValidate: s, resetFields: () => {
      for (const d of Object.keys(e.model)) delete e.model[d];
      Object.assign(e.model, r), s();
    } }), () => {
      var v;
      const { class: d, ...c } = l;
      return n(
        "form",
        {
          ...c,
          class: L("vui-form", d, `is-${e.layout}`, { "is-pane": e.pane }),
          novalidate: !0,
          onSubmit: (p) => p.preventDefault()
        },
        (v = t.default) == null ? void 0 : v.call(t)
      );
    };
  }
}), ea = H({
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
    const a = Y(), l = De(Jt, void 0), i = I(""), r = P(() => {
      var c;
      return e.prop ? ((c = l == null ? void 0 : l.rules) == null ? void 0 : c[e.prop]) || [] : [];
    }), o = P(() => {
      var c;
      return e.prop ? (c = l == null ? void 0 : l.model) == null ? void 0 : c[e.prop] : void 0;
    }), s = P(
      () => e.required || !!(l != null && l.required && e.prop) || r.value.some((c) => !!c.required)
    );
    je(Ye, {
      get label() {
        return e.label;
      }
    });
    const u = (c) => new Promise((v, p) => {
      if (c.required && _e(o.value)) {
        p(new Error(String(c.message || `${e.label || e.prop}不能为空`)));
        return;
      }
      if (!_e(o.value) && (c.min !== void 0 || c.max !== void 0)) {
        const A = typeof o.value == "number" ? o.value : String(o.value).length;
        if (c.min !== void 0 && A < Number(c.min) || c.max !== void 0 && A > Number(c.max)) {
          p(new Error(String(c.message || "校验失败")));
          return;
        }
      }
      if (c.pattern !== void 0 && !_e(o.value) && !(c.pattern instanceof RegExp ? c.pattern : new RegExp(String(c.pattern))).test(String(o.value))) {
        p(new Error(String(c.message || "校验失败")));
        return;
      }
      if (typeof c.validator != "function" || _e(o.value)) {
        v();
        return;
      }
      let b = !1;
      const D = (A) => {
        b || (b = !0, A ? p(A) : v());
      };
      try {
        const A = c.validator(c, o.value, D);
        A instanceof Promise ? A.then(() => D()).catch((f) => D(f)) : c.validator.length < 3 && D();
      } catch (A) {
        D(A);
      }
    }), d = {
      prop: e.prop,
      validate: async () => {
        i.value = "";
        const c = [...r.value];
        s.value && !c.some((v) => v.required) && c.unshift({ required: !0, message: `${e.label || e.prop}不能为空` });
        try {
          for (const v of c) await u(v);
        } catch (v) {
          throw i.value = v instanceof Error ? v.message : String(v), v;
        }
      },
      clear: () => {
        i.value = "";
      }
    };
    return ve(() => {
      e.prop && (l == null || l.register(d));
    }), ge(() => l == null ? void 0 : l.unregister(d)), () => {
      var D;
      const { class: c, style: v, ...p } = a, b = ll(
        e.labelWidth ?? (l == null ? void 0 : l.labelWidth),
        e.label,
        s.value
      );
      return n(
        "div",
        {
          ...p,
          class: L("vui-form-item", c, {
            "is-inline": (e.mode || (l == null ? void 0 : l.layout)) === "inline",
            "has-label": !!e.label,
            "is-label-hidden": !e.label && b === "0px",
            "has-error": !!i.value
          }),
          style: Be(
            v,
            b ? { "--vui-form-label-width": b } : void 0
          )
        },
        [
          e.label || b !== "0px" ? n(
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
              (D = t.default) == null ? void 0 : D.call(t),
              i.value ? n("div", { class: "vui-form-error", role: "alert" }, i.value) : null
            ]
          )
        ]
      );
    };
  }
}), ta = H({
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
    const i = Y(), r = De(Ye, void 0), o = I(), s = I(!1), u = I(!1), d = P(
      () => e.placeholder || mt(r == null ? void 0 : r.label, "input")
    ), c = P(
      () => Je(r == null ? void 0 : r.label) || d.value
    ), v = P(
      () => e.clearable && !e.disabled && !e.readonly && e.modelValue !== "" && e.modelValue !== void 0 && e.modelValue !== null && s.value
    ), p = P(
      () => e.showPassword && e.type === "password" && !e.disabled
    ), b = P(() => e.type === "password" && e.showPassword ? u.value ? "text" : "password" : e.type), D = (h) => {
      const M = h.target.value, N = e.type === "number" && M !== "" ? Number(M) : M;
      t("update:modelValue", N), t("input", N);
    }, A = (h) => {
      s.value = !0, t("focus", h);
    }, f = (h) => {
      setTimeout(() => {
        s.value = !1;
      }, 150), t("blur", h);
    }, x = () => {
      var h;
      t("update:modelValue", ""), t("change", ""), t("clear"), (h = o.value) == null || h.focus();
    }, B = () => {
      u.value = !u.value;
    };
    return a({
      focus: () => {
        var h;
        return (h = o.value) == null ? void 0 : h.focus();
      },
      blur: () => {
        var h;
        return (h = o.value) == null ? void 0 : h.blur();
      },
      select: () => {
        var h;
        return (h = o.value) == null ? void 0 : h.select();
      }
    }), () => {
      var N, j;
      if (e.type === "textarea") {
        const { class: G, ...K } = i;
        return n("div", { class: L("vui-textarea-wrapper", { "is-disabled": e.disabled }) }, [
          n("textarea", {
            ...K,
            ref: o,
            class: L("vui-textarea", G, {
              "is-disabled": e.disabled,
              "is-readonly": e.readonly && !e.disabled,
              "is-focused": s.value
            }),
            value: e.modelValue ?? "",
            rows: Number(e.rows) || 3,
            placeholder: d.value,
            "aria-label": c.value || void 0,
            disabled: e.disabled,
            readonly: e.readonly,
            required: e.required,
            onInput: D,
            onFocus: A,
            onChange: (te) => t("change", te.target.value),
            onBlur: f
          }),
          e.clearable && e.modelValue ? n("span", {
            class: "vui-textarea-clear",
            onClick: x
          }, n(ie, { type: "close" })) : null
        ]);
      }
      const { rest: h, root: M } = al(i, [
        "vui-input",
        {
          "is-disabled": e.disabled,
          "is-readonly": e.readonly && !e.disabled,
          "is-focused": s.value,
          "has-prefix": !!(e.prefixIcon || e.prefix || l.prefix),
          "has-suffix": !!(e.suffixIcon || e.suffix || l.suffix || v.value || p.value)
        }
      ]);
      return n("div", M, [
        // 前缀区域
        e.prefixIcon || e.prefix || l.prefix ? n("span", { class: "vui-input-prefix" }, [
          ((N = l.prefix) == null ? void 0 : N.call(l)) || (e.prefix ? n("span", { class: "vui-input-prefix-text" }, e.prefix) : null),
          e.prefixIcon ? n("span", { class: ["vui-input-prefix-icon", e.prefixIcon] }) : null
        ]) : null,
        // 输入框
        n("input", {
          ...h,
          ref: o,
          class: "vui-input-native",
          value: e.modelValue ?? "",
          type: b.value,
          placeholder: d.value,
          "aria-label": c.value || void 0,
          disabled: e.disabled,
          readonly: e.readonly,
          required: e.required,
          onInput: D,
          onFocus: A,
          onChange: (G) => t("change", G.target.value),
          onBlur: f
        }),
        // 后缀区域
        e.suffixIcon || e.suffix || l.suffix || v.value || p.value ? n("span", { class: "vui-input-suffix" }, [
          // 清除按钮
          v.value ? n("span", {
            class: "vui-input-clear",
            onMousedown: (G) => G.preventDefault(),
            onClick: x
          }, n(ie, { type: "close" })) : null,
          // 密码切换按钮
          p.value ? n("span", {
            class: "vui-input-password-toggle",
            onMousedown: (G) => G.preventDefault(),
            onClick: B
          }, n(ie, { type: u.value ? "eye-off" : "eye" })) : null,
          ((j = l.suffix) == null ? void 0 : j.call(l)) || (e.suffix ? n("span", { class: "vui-input-suffix-text" }, e.suffix) : null),
          e.suffixIcon ? n("span", { class: ["vui-input-suffix-icon", e.suffixIcon] }) : null
        ]) : null
      ]);
    };
  }
}), aa = H({
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
    const a = Y(), l = De(Ye, void 0), i = I(), r = P(
      () => e.placeholder || mt(l == null ? void 0 : l.label, "input")
    ), o = () => {
      !e.autosize || !i.value || (i.value.style.height = "auto", i.value.style.height = `${i.value.scrollHeight}px`);
    };
    return me(() => e.modelValue, () => queueMicrotask(o)), ve(o), () => {
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
        "aria-label": Je(l == null ? void 0 : l.label) || r.value || void 0,
        disabled: e.disabled,
        readonly: e.readonly,
        onInput: (d) => {
          t("update:modelValue", d.target.value), o();
        },
        onChange: (d) => t("change", d.target.value)
      });
    };
  }
}), la = H({
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
    const a = Y(), l = (i) => {
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
function nt(e) {
  if (typeof e == "string" || typeof e == "number") return String(e);
  if (Array.isArray(e)) return e.map(nt).join("");
  if (!e || typeof e != "object") return "";
  const t = e;
  return typeof t.default == "function" ? nt(t.default()) : nt(t.children);
}
function na(e, t = []) {
  return e.forEach((a, l) => {
    if ((typeof a.type == "object" && a.type ? a.type.name : "") === "VSelectOption") {
      const r = a.props || {}, o = r.value ?? "", s = nt(a.children).trim();
      t.push({
        key: String(a.key ?? `${String(o)}-${l}`),
        value: o,
        label: String(r.label ?? (s || o)),
        disabled: r.disabled === !0 || r.disabled === ""
      });
      return;
    }
    Array.isArray(a.children) && na(a.children, t);
  }), t;
}
const nl = 8, ia = H({
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
    const l = Y(), i = De(Ye, void 0), r = I(), o = I(), s = I(), u = I(""), d = I(!1), c = I(!1), v = I(0), p = I({}), b = P(
      () => e.placeholder && e.placeholder !== "请选择" ? e.placeholder : mt(i == null ? void 0 : i.label, "select")
    ), D = P(
      () => Je(i == null ? void 0 : i.label) || b.value
    ), A = P(() => e.options.length ? e.options : e.items), f = I([]), x = () => {
      d.value = !1, u.value = "";
    }, B = (C) => {
      var $, _;
      const T = C.target;
      !(($ = r.value) != null && $.contains(T)) && !((_ = o.value) != null && _.contains(T)) && x();
    };
    let h = null;
    const M = () => (h || (h = document.createElement("span"), h.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:14px;padding:0 12px;", document.body.appendChild(h)), h), N = (C) => {
      if (!e.autoWidth) return 0;
      const T = M();
      let $ = 0;
      const _ = C.slice(0, 20);
      for (const F of _)
        T.textContent = F.label, $ = Math.max($, T.getBoundingClientRect().width);
      return Math.ceil($) + 32;
    }, j = () => {
      if (!d.value || !r.value) return;
      const C = e.dropdownAlignToParent && r.value.parentElement || r.value, T = C.getBoundingClientRect().width, $ = f.value.length > 0 ? N(f.value) : 0, _ = Math.max(T, e.dropdownMinWidth), F = e.autoWidth ? Math.max(_, Math.min($, e.dropdownMaxWidth)) : _, X = Zt(
        C,
        F,
        te(v.value) ? 300 : 248
      );
      c.value = X.dropUp, p.value = X.style;
    }, G = () => {
      if (!e.disabled) {
        if (d.value) {
          x();
          return;
        }
        d.value = !0, we(() => {
          var C;
          j(), (C = s.value) == null || C.focus({ preventScroll: !0 });
        });
      }
    }, K = (C) => {
      const T = u.value.trim().toLowerCase();
      return T ? C.label.toLowerCase().includes(T) || String(C.value ?? "").toLowerCase().includes(T) : !0;
    }, te = (C) => e.showSearch || C >= nl, oe = (C) => te(C) ? n("div", { class: "vui-select-search" }, [
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
    ]) : null, ne = (C, T) => {
      const $ = Array.isArray(e.modelValue) ? [...e.modelValue] : [], _ = T ? $.filter((F) => String(F) !== String(C)) : [...$, C];
      t("update:modelValue", _), t("change", _);
    };
    ve(() => {
      document.addEventListener("mousedown", B), window.addEventListener("resize", j), window.addEventListener("scroll", j, !0);
    }), ge(() => {
      document.removeEventListener("mousedown", B), window.removeEventListener("resize", j), window.removeEventListener("scroll", j, !0), h && (h.remove(), h = null);
    }), me(() => e.disabled, (C) => {
      C && x();
    });
    const se = (C) => {
      t("update:modelValue", C), t("change", C), x();
    };
    return () => {
      var k;
      const { class: C, style: T, ...$ } = l, _ = ((k = a.default) == null ? void 0 : k.call(a)) || [], F = A.value.map((m, R) => {
        const y = m.value ?? m.id ?? m._id ?? R, E = m.label ?? m.name ?? m.title ?? y;
        return {
          key: String(y),
          value: y,
          label: String(E),
          disabled: !!m.disabled
        };
      });
      if (F.push(...na(_)), v.value = F.length, f.value = F, e.multiple) {
        const m = Array.isArray(e.modelValue) ? e.modelValue : [], R = new Set(m.map(String)), y = m.map((E) => {
          const O = F.find((q) => String(q.value) === String(E));
          return {
            value: E,
            label: (O == null ? void 0 : O.label) || Ne(E)
          };
        });
        return n(
          "div",
          {
            ref: r,
            class: L("vui-select", "vui-select-multiple", C, {
              "is-multiple": !0,
              "is-open": d.value,
              "is-disabled": e.disabled,
              "is-drop-up": c.value
            }),
            style: T,
            onKeydown: (E) => {
              E.key === "Escape" && x();
            }
          },
          [
            n(
              "button",
              {
                ...$,
                type: "button",
                class: "vui-select-multiple-trigger",
                disabled: e.disabled,
                "aria-expanded": String(d.value),
                "aria-haspopup": "listbox",
                "aria-label": D.value || void 0,
                onClick: G
              },
              [
                n(
                  "span",
                  { class: "vui-select-values" },
                  y.length ? [
                    ...y.slice(0, 2).map(
                      (E) => n("span", { class: "vui-select-chip", key: String(E.value) }, [
                        n("span", { class: "vui-select-chip-label" }, E.label),
                        e.disabled ? null : n(
                          "span",
                          {
                            class: "vui-select-chip-remove",
                            role: "button",
                            "aria-label": `移除${E.label}`,
                            onMousedown: (O) => O.stopPropagation(),
                            onClick: (O) => {
                              O.stopPropagation(), ne(E.value, !0);
                            }
                          },
                          n(ie, { type: "close" })
                        )
                      ])
                    ),
                    y.length > 2 ? n(
                      "span",
                      { class: "vui-select-selection-count" },
                      `+${y.length - 2}`
                    ) : null
                  ] : n("span", { class: "vui-select-placeholder" }, b.value)
                ),
                n(ie, { class: "vui-select-chevron", type: "chevron-down" })
              ]
            ),
            d.value ? n(Ae, { to: "body" }, [
              n(
                "div",
                {
                  ref: o,
                  class: L("vui-select-popover", "is-teleported", {
                    "has-search": te(F.length),
                    "is-drop-up": c.value
                  }),
                  style: p.value,
                  role: "listbox",
                  "aria-multiselectable": "true",
                  onKeydown: (E) => {
                    E.key === "Escape" && x();
                  }
                },
                [
                  oe(F.length),
                  ...F.length ? (() => {
                    const E = F.filter(K);
                    return E.length ? E.map((O) => {
                      const q = R.has(String(O.value));
                      return n(
                        "button",
                        {
                          type: "button",
                          key: O.key,
                          class: L("vui-select-option", {
                            "is-selected": q
                          }),
                          role: "option",
                          disabled: O.disabled,
                          "aria-selected": String(q),
                          onClick: () => ne(O.value, q)
                        },
                        [
                          n("span", { class: "vui-select-option-check", "aria-hidden": "true" }, q ? n(ie, { type: "check" }) : void 0),
                          n("span", { class: "vui-select-option-label" }, O.label)
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
      const X = _e(e.modelValue), J = X ? void 0 : F.find((m) => String(m.value) === String(e.modelValue)), Q = F.filter(K), w = e.clearable && !u.value.trim() && !F.some((m) => _e(m.value)) ? [
        {
          key: "__vui-select-placeholder",
          value: "",
          label: b.value,
          disabled: !1
        },
        ...Q
      ] : Q;
      return n(
        "div",
        {
          ref: r,
          class: L("vui-select", "vui-select-single", C, {
            "is-open": d.value,
            "is-disabled": e.disabled,
            "is-drop-up": c.value,
            "is-placeholder": X
          }),
          style: T,
          onKeydown: (m) => {
            m.key === "Escape" && x();
          }
        },
        [
          n(
            "button",
            {
              ...$,
              type: "button",
              class: "vui-select-trigger",
              disabled: e.disabled,
              role: "combobox",
              "aria-expanded": String(d.value),
              "aria-haspopup": "listbox",
              "aria-required": String(e.required),
              "aria-label": D.value || void 0,
              onClick: G
            },
            [
              n(
                "span",
                {
                  class: L("vui-select-value", {
                    "is-placeholder": X
                  })
                },
                (J == null ? void 0 : J.label) || (X ? b.value : Ne(e.modelValue))
              ),
              n(ie, { class: "vui-select-chevron", type: "chevron-down" })
            ]
          ),
          d.value ? n(Ae, { to: "body" }, [
            n(
              "div",
              {
                ref: o,
                class: L("vui-select-popover", "is-teleported", {
                  "has-search": te(F.length),
                  "is-drop-up": c.value
                }),
                style: p.value,
                role: "listbox",
                onKeydown: (m) => {
                  m.key === "Escape" && x();
                }
              },
              [
                oe(F.length),
                ...w.length ? w.map((m) => {
                  const R = String(m.value ?? "") === String(e.modelValue ?? "");
                  return n(
                    "button",
                    {
                      type: "button",
                      key: m.key,
                      class: L("vui-select-option", "is-single", {
                        "is-selected": R
                      }),
                      role: "option",
                      disabled: m.disabled,
                      "aria-selected": String(R),
                      onClick: () => se(m.value)
                    },
                    [
                      n(
                        "span",
                        {
                          class: "vui-select-option-check",
                          "aria-hidden": "true"
                        },
                        R ? n(ie, { type: "check" }) : void 0
                      ),
                      n("span", { class: "vui-select-option-label" }, m.label)
                    ]
                  );
                }) : [
                  n(
                    "div",
                    { class: "vui-select-empty" },
                    F.length ? "无匹配选项" : "暂无可选项"
                  )
                ]
              ]
            )
          ]) : null
        ]
      );
    };
  }
}), il = H({
  name: "VSelectOption",
  inheritAttrs: !1,
  props: {
    value: { type: null, default: "" },
    label: { type: [String, Number], default: "" },
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = Y();
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
}), rl = ["一", "二", "三", "四", "五", "六", "日"];
function Se(e) {
  const t = String(e || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!t) return;
  const a = Number(t[1]), l = Number(t[2]), i = Number(t[3]), r = new Date(a, l - 1, i);
  if (!(r.getFullYear() !== a || r.getMonth() !== l - 1 || r.getDate() !== i))
    return r;
}
function ye(e) {
  const t = e.getFullYear(), a = String(e.getMonth() + 1).padStart(2, "0"), l = String(e.getDate()).padStart(2, "0");
  return `${t}-${a}-${l}`;
}
function $e(e, t) {
  return !!(e && t && ye(e) === ye(t));
}
function ke(e) {
  return new Date(e.getFullYear(), e.getMonth(), 1);
}
function We(e, t) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate() + t);
}
function ol(e, t) {
  return new Date(e.getFullYear(), e.getMonth() + t, 1);
}
function Ze() {
  const e = /* @__PURE__ */ new Date();
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}
function sl(e) {
  const t = ke(e), a = (t.getDay() + 6) % 7, l = We(t, -a);
  return Array.from({ length: 42 }, (i, r) => We(l, r));
}
function ul(e) {
  const t = String(e || "").replace("T", " "), a = t.match(/\s(\d{2}):(\d{2})/);
  return {
    date: Se(t),
    hour: (a == null ? void 0 : a[1]) || "09",
    minute: (a == null ? void 0 : a[2]) || "00"
  };
}
const ra = H({
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
    const a = Y(), l = De(Ye, void 0), i = I(), r = I(), o = I(), s = I(!1), u = I(!1), d = I(!1), c = I({}), v = I(ke(Ze())), p = I(Ze()), b = I(), D = I(), A = I("09"), f = I("00"), x = P(
      () => e.placeholder || mt(l == null ? void 0 : l.label, "select")
    ), B = P(
      () => Je(l == null ? void 0 : l.label) || x.value
    ), h = P(() => Se(e.min)), M = P(() => Se(e.max)), N = P(
      () => e.range ? void 0 : Se(e.modelValue)
    ), j = P(() => !e.range || !Array.isArray(e.modelValue) ? [void 0, void 0] : [Se(e.modelValue[0]), Se(e.modelValue[1])]), G = P(() => {
      if (e.range) {
        const O = Array.isArray(e.modelValue) ? e.modelValue : [], q = Se(O[0]), S = Se(O[1]), z = q ? ye(q) : String(O[0] || ""), U = S ? ye(S) : String(O[1] || "");
        return z && U ? `${z} 至 ${U}` : z;
      }
      const y = String(e.modelValue || "");
      if (e.type === "datetime") return y.replace("T", " ").slice(0, 16);
      const E = Se(y);
      return E ? ye(E) : y;
    }), K = (y) => {
      const E = ye(y);
      return !!(h.value && E < ye(h.value) || M.value && E > ye(M.value) || e.range && b.value && y <= b.value);
    }, te = (y) => h.value && y < h.value ? h.value : M.value && y > M.value ? M.value : y, oe = (y) => {
      t("update:modelValue", y), t("change", y);
    }, ne = (y = !1) => {
      s.value = !1, b.value = void 0, y && we(() => {
        var E;
        return (E = r.value) == null ? void 0 : E.focus();
      });
    }, se = () => we(() => {
      var y, E;
      (E = (y = o.value) == null ? void 0 : y.querySelector(
        `.vui-calendar-day[data-date="${ye(p.value)}"]`
      )) == null || E.focus();
    }), C = () => {
      const y = ul(e.modelValue), E = j.value[0] || j.value[1], O = te(N.value || E || y.date || Ze());
      p.value = O, v.value = ke(O), b.value = void 0, D.value = y.date || O, A.value = y.hour, f.value = y.minute;
    }, T = (y = !1) => {
      e.disabled || (C(), s.value = !0, we(() => {
        m(), y && se();
      }));
    }, $ = () => {
      s.value ? ne() : T(!1);
    }, _ = (y) => {
      y == null || y.stopPropagation(), oe(e.range ? ["", ""] : ""), ne(), we(() => {
        var E;
        return (E = r.value) == null ? void 0 : E.focus();
      });
    }, F = (y) => {
      if (!K(y)) {
        if (p.value = y, v.value = ke(y), e.range) {
          if (!b.value) {
            b.value = y, p.value = We(y, 1), v.value = ke(p.value), se();
            return;
          }
          oe([b.value, y].map(ye)), ne(!0);
          return;
        }
        if (e.type === "datetime") {
          D.value = y, se();
          return;
        }
        oe(ye(y)), ne(!0);
      }
    }, X = () => {
      const y = D.value || p.value, E = String(Math.min(23, Math.max(0, Number(A.value) || 0))).padStart(2, "0"), O = String(Math.min(59, Math.max(0, Number(f.value) || 0))).padStart(2, "0");
      oe(`${ye(y)} ${E}:${O}`), ne(!0);
    }, J = (y) => {
      let E = We(p.value, y);
      const O = y < 0 ? -1 : 1;
      let q = 0;
      for (; K(E) && q < 370; )
        E = We(E, O), q += 1;
      K(E) || (p.value = E, v.value = ke(E), se());
    }, Q = (y) => {
      const E = ol(v.value, y), O = te(
        new Date(
          E.getFullYear(),
          E.getMonth(),
          Math.min(
            p.value.getDate(),
            new Date(E.getFullYear(), E.getMonth() + 1, 0).getDate()
          )
        )
      );
      v.value = ke(O), p.value = O, se();
    }, w = (y) => {
      const E = {
        ArrowLeft: () => J(-1),
        ArrowRight: () => J(1),
        ArrowUp: () => J(-7),
        ArrowDown: () => J(7),
        Home: () => J(-((p.value.getDay() + 6) % 7)),
        End: () => J(6 - (p.value.getDay() + 6) % 7),
        PageUp: () => Q(-1),
        PageDown: () => Q(1)
      };
      if (y.key === "Escape") {
        y.preventDefault(), ne(!0);
        return;
      }
      if (y.key === "Enter" || y.key === " ") {
        y.preventDefault(), F(p.value);
        return;
      }
      const O = E[y.key];
      O && (y.preventDefault(), O());
    }, k = (y) => {
      var O, q;
      const E = y.target;
      !((O = i.value) != null && O.contains(E)) && !((q = o.value) != null && q.contains(E)) && ne();
    }, m = () => {
      if (!s.value || !i.value) return;
      const y = i.value.getBoundingClientRect(), E = Zt(
        i.value,
        328,
        e.type === "datetime" ? 450 : 390,
        y.left + 328 > window.innerWidth - Te
      );
      u.value = E.dropUp, d.value = E.alignRight, c.value = E.style;
    };
    ve(() => {
      document.addEventListener("mousedown", k), window.addEventListener("resize", m), window.addEventListener("scroll", m, !0);
    }), ge(() => {
      document.removeEventListener("mousedown", k), window.removeEventListener("resize", m), window.removeEventListener("scroll", m, !0);
    }), me(
      () => e.disabled,
      (y) => {
        y && ne();
      }
    ), me(
      () => e.modelValue,
      () => {
        s.value || C();
      },
      { deep: !0 }
    );
    const R = () => {
      var ae, g;
      const y = v.value.getFullYear(), E = v.value.getMonth(), O = Ze(), q = b.value || j.value[0], S = b.value ? void 0 : j.value[1], z = ((ae = h.value) == null ? void 0 : ae.getFullYear()) ?? O.getFullYear() - 100, U = ((g = M.value) == null ? void 0 : g.getFullYear()) ?? O.getFullYear() + 30, le = Array.from(
        { length: Math.max(1, U - z + 1) },
        (V, Z) => z + Z
      ), W = sl(v.value);
      return n(
        "div",
        {
          ref: o,
          class: "vui-calendar-popover",
          style: c.value,
          role: "dialog",
          "aria-label": B.value || "选择日期",
          onKeydown: w
        },
        [
          n("div", { class: "vui-calendar-header" }, [
            n(
              "button",
              {
                type: "button",
                class: "vui-calendar-nav",
                "aria-label": "上个月",
                onClick: () => Q(-1)
              },
              "‹"
            ),
            n("div", { class: "vui-calendar-title" }, [
              n(
                "select",
                {
                  class: "vui-calendar-select",
                  value: y,
                  "aria-label": "选择年份",
                  onChange: (V) => {
                    const Z = Number(V.target.value), ee = te(new Date(Z, E, 1));
                    v.value = ke(ee), p.value = ee, se();
                  }
                },
                le.map((V) => n("option", { value: V, key: V }, `${V}年`))
              ),
              n(
                "select",
                {
                  class: "vui-calendar-select",
                  value: E,
                  "aria-label": "选择月份",
                  onChange: (V) => {
                    const Z = Number(V.target.value), ee = te(new Date(y, Z, 1));
                    v.value = ke(ee), p.value = ee, se();
                  }
                },
                Array.from(
                  { length: 12 },
                  (V, Z) => n("option", { value: Z, key: Z }, `${Z + 1}月`)
                )
              )
            ]),
            n(
              "button",
              {
                type: "button",
                class: "vui-calendar-nav",
                "aria-label": "下个月",
                onClick: () => Q(1)
              },
              "›"
            )
          ]),
          n(
            "div",
            { class: "vui-calendar-weekdays", "aria-hidden": "true" },
            rl.map((V) => n("span", { key: V }, V))
          ),
          n(
            "div",
            { class: "vui-calendar-grid", role: "grid" },
            W.map((V) => {
              const Z = ye(V), ee = V.getMonth() !== E, ce = K(V), de = $e(V, N.value) || $e(V, q) || $e(V, S) || e.type === "datetime" && $e(V, D.value), ue = !!(q && S && V > q && V < S);
              return n(
                "button",
                {
                  type: "button",
                  key: Z,
                  class: L("vui-calendar-day", {
                    "is-outside": ee,
                    "is-today": $e(V, O),
                    "is-selected": de,
                    "is-in-range": ue,
                    "is-active": $e(V, p.value)
                  }),
                  "data-date": Z,
                  role: "gridcell",
                  tabindex: $e(V, p.value) ? 0 : -1,
                  disabled: ce,
                  "aria-selected": String(de),
                  "aria-label": `${V.getFullYear()}年${V.getMonth() + 1}月${V.getDate()}日`,
                  onClick: () => F(V)
                },
                String(V.getDate())
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
              value: A.value,
              "aria-label": "小时",
              onInput: (V) => {
                A.value = V.target.value;
              }
            }),
            n("span", { "aria-hidden": "true" }, ":"),
            n("input", {
              class: "vui-calendar-time-input",
              type: "number",
              min: 0,
              max: 59,
              value: f.value,
              "aria-label": "分钟",
              onInput: (V) => {
                f.value = V.target.value;
              }
            })
          ]) : null,
          n("div", { class: "vui-calendar-footer" }, [
            n(
              "div",
              { class: "vui-calendar-footer-start" },
              e.range && b.value ? n("span", { class: "vui-calendar-hint", role: "status" }, "请选择结束日期") : n(
                "button",
                {
                  type: "button",
                  class: "vui-calendar-text-button",
                  disabled: K(O),
                  onClick: () => F(O)
                },
                "今天"
              )
            ),
            n("div", { class: "vui-calendar-actions" }, [
              e.allowClear && G.value ? n(
                "button",
                {
                  type: "button",
                  class: "vui-calendar-text-button",
                  onClick: _
                },
                "清除"
              ) : null,
              e.type === "datetime" ? [
                n(
                  "button",
                  {
                    type: "button",
                    class: "vui-calendar-text-button",
                    onClick: () => ne(!0)
                  },
                  "取消"
                ),
                n(
                  "button",
                  {
                    type: "button",
                    class: "vui-calendar-confirm",
                    onClick: X
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
      const { class: y, style: E, ...O } = a;
      return e.type === "month" || e.type === "year" ? n(
        "div",
        {
          class: L("vui-date", y, {
            "is-disabled": e.disabled
          }),
          style: E
        },
        [
          n("input", {
            ...O,
            class: "vui-date-native",
            type: "month",
            value: String(e.modelValue || "").slice(0, 7),
            min: e.min ? e.min.slice(0, 7) : void 0,
            max: e.max ? e.max.slice(0, 7) : void 0,
            placeholder: x.value,
            "aria-label": B.value || void 0,
            disabled: e.disabled,
            required: e.required,
            onInput: (q) => oe(q.target.value)
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
          class: L("vui-date", y, {
            "is-range": e.range,
            "is-open": s.value,
            "is-disabled": e.disabled,
            "is-drop-up": u.value,
            "is-align-right": d.value,
            "is-placeholder": !G.value
          }),
          style: E,
          onKeydown: (q) => {
            q.key === "Escape" && ne(!0);
          }
        },
        [
          n(
            "button",
            {
              ...O,
              ref: r,
              type: "button",
              class: "vui-date-trigger",
              disabled: e.disabled,
              role: "combobox",
              "aria-expanded": String(s.value),
              "aria-haspopup": "dialog",
              "aria-required": String(e.required),
              "aria-label": B.value || void 0,
              onClick: $,
              onKeydown: (q) => {
                !s.value && (q.key === "ArrowDown" || q.key === "Enter" || q.key === " ") && (q.preventDefault(), T(!0));
              }
            },
            [
              n(
                "span",
                {
                  class: L("vui-date-value", {
                    "is-placeholder": !G.value
                  })
                },
                G.value || x.value
              ),
              e.allowClear && G.value && !e.disabled ? n(
                "span",
                {
                  class: "vui-date-clear",
                  role: "button",
                  tabindex: 0,
                  "aria-label": "清除日期",
                  onMousedown: (q) => q.preventDefault(),
                  onClick: _,
                  onKeydown: (q) => {
                    (q.key === "Enter" || q.key === " ") && _(q);
                  }
                },
                n(ie, { type: "close" })
              ) : n("span", { class: "vui-date-icon", "aria-hidden": "true" }, [
                n("span", { class: "vui-date-icon-binding" }),
                n("span", { class: "vui-date-icon-page" })
              ])
            ]
          ),
          s.value ? n(Ae, { to: "body" }, [R()]) : null
        ]
      );
    };
  }
}), oa = H({
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
    const a = Y(), l = P(() => e.modelValue === !0 || e.modelValue === 1 || e.modelValue === "1"), i = () => {
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
}), sa = H({
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
    const l = Y(), i = P(() => e.modelValue);
    return je(Xt, {
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
        s != null && s.length ? s : e.options.map((d) => n(
          xt,
          { value: d.value, disabled: e.disabled || d.disabled },
          { default: () => d.label }
        ))
      );
    };
  }
}), xt = H({
  name: "VRadio",
  inheritAttrs: !1,
  props: {
    /** 当前单选项代表的值。 */
    value: { type: null, default: "" },
    /** 是否禁止选择当前项。 */
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = De(Xt, void 0);
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
}), ua = H({
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
    const l = Y();
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
            [n(ie, { type: "close" })]
          ) : null
        ]
      );
    };
  }
}), ca = H({
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
    const a = Y(), l = I(""), i = (s) => s && typeof s == "object" && "label" in s ? String(s.label ?? "") : Ne(s), r = (s) => {
      t("update:modelValue", s), t("change", s);
    }, o = () => {
      const s = l.value.trim();
      s && (r([...e.modelValue, s]), l.value = "");
    };
    return () => {
      const { class: s, style: u, ...d } = a;
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
            (c, v) => n("span", { class: "vui-tag-input-item", key: `${Ne(c)}-${v}` }, [
              i(c),
              e.disabled ? null : n("button", {
                type: "button",
                "aria-label": "移除",
                onClick: () => r(e.modelValue.filter((p, b) => b !== v))
              }, n(ie, { type: "close" }))
            ])
          ),
          e.disabledInput ? null : n("input", {
            ...d,
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
}), cl = 54, dl = 22, fl = 8, vl = 28, da = 88, ml = /[⺀-鿿豈-﫿　-〿＀-￯]/;
function gl(e) {
  return [...e].reduce((t, a) => t + (ml.test(a) ? 12 : 7), 0);
}
function pl(e) {
  return Math.max(cl, Math.ceil(gl(e.trim())) + dl);
}
function yl(e) {
  const t = e.filter((a) => a.trim());
  return t.length ? t.reduce((a, l) => a + pl(l) + fl, 0) + vl : 0;
}
function hl(e) {
  return Math.max(da, ...e.map(yl));
}
const bl = 40, wl = 720, xl = 160;
function Sl(e, t) {
  const a = e.reduce((l, i) => l + i, 0) + (t ? bl : 0);
  return Math.max(wl, a);
}
function Ke(e) {
  return e ? e.title === "操作" || e.key === "operator" || e.customSlot === "operator" : !1;
}
function Dt(e, t, a) {
  return e[t] ?? e._id ?? e.id ?? a;
}
function it(e) {
  if (e == null || typeof e == "boolean") return "";
  if (typeof e == "string" || typeof e == "number") return String(e);
  if (Array.isArray(e)) return e.map(it).join("");
  const t = e.children;
  return t == null ? "" : typeof t == "string" || typeof t == "number" ? String(t) : Array.isArray(t) ? t.map(it).join("") : typeof t == "object" && typeof t.default == "function" ? it(t.default()) : "";
}
function kl(e) {
  var t;
  return e.type === wt || e.type === "button" || ((t = e.type) == null ? void 0 : t.name) === "VButton";
}
function rt(e, t = []) {
  if (e == null || typeof e != "object") return t;
  if (Array.isArray(e))
    return e.forEach((i) => rt(i, t)), t;
  const a = e;
  if (kl(a))
    return t.push(it(a)), t;
  const l = a.children;
  return Array.isArray(l) ? l.forEach((i) => rt(i, t)) : l && typeof l == "object" && typeof l.default == "function" && rt(l.default(), t), t;
}
function Mt(e) {
  return `"${Ne(e).replaceAll('"', '""')}"`;
}
const fa = H({
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
    /** 是否展开全部树节点；绑定响应式布尔值即可当「全部展开/全部折叠」开关用，单行展开态由表格自己维护。 */
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
    const i = Y(), r = I({ key: "", order: "" }), o = P(() => new Set(e.selectedKeys.map(String))), s = P(
      () => e.columns.some((g) => g.type === "checkbox") || e.showCheckbox
    ), u = P(() => e.columns.filter((g) => g.type !== "checkbox")), d = P(() => u.value.some(Ke)), c = I({
      dragging: !1,
      fromIndex: -1,
      toIndex: -1,
      dragOverIndex: -1
    }), v = P(() => u.value.length > 2), p = P(
      () => u.value.length > 2 && Ke(u.value[u.value.length - 1])
    ), b = (g) => ({
      "is-sticky-left": v.value && g === 0,
      /* 勾选列在前时，第一个数据列要让开它的宽度 */
      "is-sticky-left-offset": v.value && g === 0 && s.value,
      "is-sticky-right": p.value && g === u.value.length - 1
    }), D = I(null);
    let A = null;
    const f = () => {
      const g = D.value;
      if (!g || !s.value) return;
      const V = g.querySelector("thead th");
      if (!V) return;
      const Z = `${Math.round(V.getBoundingClientRect().width)}px`;
      g.style.getPropertyValue("--vui-table-check-w") !== Z && g.style.setProperty("--vui-table-check-w", Z);
    };
    ve(() => {
      f(), !(typeof ResizeObserver > "u" || !D.value) && (A = new ResizeObserver(f), A.observe(D.value));
    }), ja(f), ge(() => A == null ? void 0 : A.disconnect());
    const x = P(() => e.treeProps.children || "children"), B = (g) => {
      const V = g[x.value];
      return Array.isArray(V) && V.length ? V : [];
    }, h = I(/* @__PURE__ */ new Set()), M = (g, V) => String(g[e.id] ?? g._id ?? g.id ?? V), N = (g, V, Z) => (g.forEach((ee, ce) => {
      const de = V ? `${V}-${ce}` : String(ce), ue = B(ee);
      ue.length && (Z.push(M(ee, de)), N(ue, de, Z));
    }), Z), j = () => {
      h.value = new Set(N(e.dataSource, "", []));
    }, G = () => {
      h.value = /* @__PURE__ */ new Set();
    };
    me(
      () => e.dataSource,
      () => {
        e.defaultExpandAll && j();
      },
      { immediate: !0 }
    ), me(
      () => e.defaultExpandAll,
      (g) => g ? j() : G()
    );
    const K = (g) => {
      const V = new Set(h.value);
      V.has(g) ? V.delete(g) : V.add(g), h.value = V;
    }, te = P(() => {
      const g = [], V = (Z, ee, ce) => {
        Z.forEach((de, ue) => {
          const re = ce ? `${ce}-${ue}` : String(ue), fe = M(de, re), pe = B(de), Le = pe.length > 0 && h.value.has(fe);
          g.push({ row: de, level: ee, expandable: pe.length > 0, expanded: Le, nodeKey: fe }), Le && V(pe, ee + 1, re);
        });
      };
      return V(e.dataSource, 0, ""), g;
    }), oe = P(() => te.value.some((g) => g.expandable || g.level > 0)), ne = P(() => {
      const g = u.value.find(Ke);
      if (!g) return 0;
      const V = g.customSlot ? t[g.customSlot] : void 0;
      return V ? hl(
        te.value.map(
          ({ row: Z }, ee) => rt(V({ row: Z, column: g, rowIndex: ee }))
        )
      ) : da;
    }), se = (g) => {
      if (Ke(g)) {
        const Z = `${ne.value}px`;
        return { width: Z, minWidth: Z };
      }
      const V = Ee(g.width);
      return V ? { width: V, minWidth: V } : void 0;
    }, C = P(
      () => u.value.map((g) => {
        if (Ke(g)) return ne.value;
        const V = /^(\d+)px$/.exec(Ee(g.width) || "");
        return V ? Number(V[1]) : xl;
      })
    ), T = P(() => ({
      minWidth: `${Sl(C.value, s.value)}px`
    })), $ = P(
      () => te.value.map(({ row: g }, V) => Dt(g, e.id, V))
    ), _ = P(
      () => $.value.length > 0 && $.value.every((g) => o.value.has(String(g)))
    ), F = P(
      () => !_.value && $.value.some((g) => o.value.has(String(g)))
    ), X = (g, V) => {
      const Z = new Map(e.selectedKeys.map((ee) => [String(ee), ee]));
      V ? Z.set(String(g), g) : Z.delete(String(g)), a("update:selectedKeys", [...Z.values()]);
    }, J = (g) => {
      a("update:selectedKeys", g ? $.value : []);
    }, Q = (g) => {
      if (!g.sort || !g.key) return;
      const V = r.value.key !== g.key || r.value.order === "desc" ? "asc" : r.value.order === "asc" ? "desc" : "";
      r.value = { key: g.key, order: V }, a("sortChange", g.key, V);
    }, w = (g, V) => {
      if (!e.draggable) return;
      c.value.dragging = !0, c.value.fromIndex = V, g.dataTransfer.effectAllowed = "move", g.dataTransfer.setData("text/plain", String(V)), g.target.classList.add("is-dragging");
    }, k = (g, V) => {
      !e.draggable || !c.value.dragging || (g.preventDefault(), g.dataTransfer.dropEffect = "move", c.value.dragOverIndex = V, c.value.toIndex = V);
    }, m = (g) => {
      if (!e.draggable) return;
      g.target.classList.remove("is-drag-over");
    }, R = (g) => {
      if (!e.draggable) return;
      g.target.classList.remove("is-dragging"), c.value.dragging = !1, c.value.dragOverIndex = -1;
    }, y = (g, V) => {
      if (!e.draggable) return;
      g.preventDefault();
      const Z = c.value.fromIndex;
      if (Z === -1 || Z === V) {
        c.value = { dragging: !1, fromIndex: -1, toIndex: -1, dragOverIndex: -1 };
        return;
      }
      const ee = [...e.columns], [ce] = ee.splice(Z, 1);
      ee.splice(V, 0, ce), a("columnOrderChange", ee, { fromIndex: Z, toIndex: V }), c.value = { dragging: !1, fromIndex: -1, toIndex: -1, dragOverIndex: -1 };
    }, E = (g, V) => {
      !e.page || typeof e.page != "object" || (e.page.current = g, V && (e.page.limit = V), a("change", { ...e.page, current: g, limit: V || e.page.limit }));
    }, O = I(!1), q = I(!1), S = (g, V) => {
      const Z = u.value.filter((ue) => !ue.ignoreExport), ee = [
        Z.map((ue) => Mt(ue.title || ue.key)).join(","),
        ...g.map(
          (ue) => Z.map((re) => Mt(ue[re.key])).join(",")
        )
      ], ce = new Blob([`\uFEFF${ee.join(`
`)}`], { type: "text/csv;charset=utf-8" }), de = document.createElement("a");
      de.href = URL.createObjectURL(ce), de.download = `${V}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`, de.click(), URL.revokeObjectURL(de.href);
    }, z = () => {
      S(e.dataSource, "当前页数据"), O.value = !1;
    }, U = async () => {
      q.value = !0, O.value = !1;
      try {
        let g;
        e.exportAllData ? g = e.exportAllData : e.fetchAllData ? g = await e.fetchAllData() : g = e.dataSource, S(g, "全量数据");
      } finally {
        q.value = !1;
      }
    }, le = (g) => {
      g.target.closest(".vui-table-export-dropdown") || (O.value = !1);
    };
    ve(() => {
      document.addEventListener("click", le);
    }), ge(() => {
      document.removeEventListener("click", le);
    }), l({ reload: () => {
      var g;
      return E(Number(((g = e.page) == null ? void 0 : g.current) || 1));
    } });
    const W = (g) => g.expandable ? n(
      "button",
      {
        type: "button",
        class: L("vui-table-expander", { "is-expanded": g.expanded }),
        "aria-expanded": String(g.expanded),
        "aria-label": g.expanded ? "折叠下级" : "展开下级",
        onClick: (V) => {
          V.stopPropagation(), K(g.nodeKey);
        }
      },
      [n("span", { class: "vui-table-expander-icon" })]
    ) : n("span", { class: "vui-table-expander is-placeholder" }), ae = (g, V, Z, ee) => {
      var fe;
      const { row: ce, level: de } = V;
      let ue;
      g.customSlot && t[g.customSlot] ? ue = (fe = t[g.customSlot]) == null ? void 0 : fe.call(t, { row: ce, column: g, rowIndex: Z }) : typeof g.render == "function" ? ue = g.render(n, { row: ce, column: g, rowIndex: Z }) : ue = Ne(ce[g.key]) || "-";
      const re = oe.value && g === u.value[0];
      return n(
        "td",
        {
          key: g.key || g.title,
          class: L(
            {
              "is-ellipsis": g.ellipsisTooltip
            },
            b(ee)
          ),
          style: se(g),
          title: g.ellipsisTooltip ? Ne(ce[g.key]) : void 0
        },
        [
          n(
            "div",
            {
              class: L("vui-table-cell", { "is-tree-cell": re }),
              style: de && g === u.value[0] ? { paddingLeft: `${de * 20 + 16}px` } : void 0
            },
            re ? [W(V), n("span", { class: "vui-table-tree-label" }, [ue])] : [ue]
          )
        ]
      );
    };
    return () => {
      var ue;
      const { class: g, style: V, ...Z } = i, ee = e.page && typeof e.page == "object" ? {
        current: Number(e.page.current || 1),
        limit: Number(e.page.limit || 10),
        total: Number(e.page.total || 0)
      } : null, ce = ee ? Math.max(1, Math.ceil(ee.total / ee.limit)) : 1, de = e.height && e.height !== "100%" ? { maxHeight: Ee(e.height) } : void 0;
      return n(
        "section",
        {
          ...Z,
          class: L("vui-table", g, `is-${e.size}`),
          style: V
        },
        [
          t.toolbar || e.defaultToolbar ? n("div", { class: "vui-table-toolbar" }, [
            n("div", { class: "vui-table-toolbar-main" }, (ue = t.toolbar) == null ? void 0 : ue.call(t)),
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
                        O.value = !O.value;
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
                      n(ie, { class: "vui-icon-button-arrow", type: "chevron-down" })
                    ]
                  ),
                  O.value ? n(
                    "div",
                    { class: "vui-table-export-menu" },
                    [
                      n(
                        "button",
                        {
                          type: "button",
                          class: "vui-table-export-item",
                          onClick: z
                        },
                        [
                          n(ie, { class: "vui-table-export-icon", type: "file-text" }),
                          n("span", "导出当前页")
                        ]
                      ),
                      n(
                        "button",
                        {
                          type: "button",
                          class: L("vui-table-export-item", {
                            "is-disabled": !e.exportAllData && !e.fetchAllData && !e.page,
                            "is-loading": q.value
                          }),
                          disabled: !e.exportAllData && !e.fetchAllData && !e.page,
                          onClick: U
                        },
                        [
                          n(ie, { class: "vui-table-export-icon", type: "table" }),
                          n("span", q.value ? "导出中..." : "导出全部数据"),
                          e.page ? n("span", { class: "vui-table-export-hint" }, `共 ${e.page.total || 0} 条`) : null
                        ]
                      )
                    ]
                  ) : null
                ]
              )
            ]) : null
          ]) : null,
          n("div", { class: "vui-table-scroll", style: de }, [
            n("table", {
              ref: D,
              class: L("vui-table-native", {
                "has-operation-column": d.value
              }),
              style: T.value
            }, [
              n("thead", [
                n("tr", [
                  s.value ? n("th", {
                    class: L("vui-table-check", { "is-sticky-left": v.value })
                  }, [
                    n("input", {
                      type: "checkbox",
                      checked: _.value,
                      indeterminate: F.value,
                      "aria-label": "选择全部",
                      onChange: (re) => J(re.target.checked)
                    })
                  ]) : null,
                  ...u.value.map(
                    (re, fe) => n(
                      "th",
                      {
                        key: re.key || re.title,
                        class: L(
                          {
                            "is-sortable": re.sort,
                            "is-draggable": e.draggable,
                            "is-drag-over": c.value.dragOverIndex === fe
                          },
                          b(fe)
                        ),
                        style: se(re),
                        draggable: e.draggable,
                        onClick: () => Q(re),
                        onDragstart: (pe) => w(pe, fe),
                        onDragover: (pe) => k(pe, fe),
                        onDragleave: m,
                        onDragend: R,
                        onDrop: (pe) => y(pe, fe)
                      },
                      [
                        e.draggable ? n(ie, { class: "vui-table-drag-handle", type: "drag-handle" }) : null,
                        n("span", re.title || re.key || ""),
                        re.sort ? n(
                          "span",
                          { class: "vui-table-sort" },
                          r.value.key === re.key ? r.value.order === "asc" ? "↑" : r.value.order === "desc" ? "↓" : "↕" : "↕"
                        ) : null
                      ]
                    )
                  )
                ])
              ]),
              n(
                "tbody",
                te.value.length ? te.value.map((re, fe) => {
                  const { row: pe } = re, Le = Dt(pe, e.id, fe), Fa = typeof e.rowClassName == "function" ? e.rowClassName(pe, fe) : e.rowClassName;
                  return n(
                    "tr",
                    {
                      key: String(Le),
                      class: Fa,
                      onDblclick: () => {
                        var Ie;
                        return (Ie = t.rowDoubleClick) == null ? void 0 : Ie.call(t, { row: pe, rowIndex: fe });
                      }
                    },
                    [
                      s.value ? n("td", {
                        class: L("vui-table-check", {
                          "is-sticky-left": v.value
                        })
                      }, [
                        n("input", {
                          type: "checkbox",
                          checked: o.value.has(String(Le)),
                          "aria-label": `选择第 ${fe + 1} 行`,
                          onChange: (Ie) => X(Le, Ie.target.checked)
                        })
                      ]) : null,
                      ...u.value.map(
                        (Ie, Ra) => ae(Ie, re, fe, Ra)
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
          ee ? n("footer", { class: "vui-pagination" }, [
            n("span", { class: "vui-pagination-total" }, `共 ${ee.total} 条`),
            n(
              "button",
              {
                type: "button",
                disabled: ee.current <= 1,
                onClick: () => E(ee.current - 1)
              },
              "‹"
            ),
            n("span", { class: "vui-pagination-current" }, `${ee.current} / ${ce}`),
            n(
              "button",
              {
                type: "button",
                disabled: ee.current >= ce,
                onClick: () => E(ee.current + 1)
              },
              "›"
            ),
            n(
              "select",
              {
                value: ee.limit,
                "aria-label": "每页数量",
                onChange: (re) => E(1, Number(re.target.value))
              },
              [10, 20, 30, 50, 100].map(
                (re) => n("option", { value: re }, `${re} 条/页`)
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
}), va = H({
  name: "VDescriptions",
  inheritAttrs: !1,
  props: {
    title: { type: String, default: "" },
    column: { type: [Number, String], default: 3 },
    border: { type: Boolean, default: !1 },
    labelWidth: { type: [Number, String], default: "" }
  },
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "section",
        {
          ...r,
          class: L("vui-descriptions", l, { "is-bordered": e.border }),
          style: Be(
            {
              "--vui-description-columns": Math.max(1, Number(e.column) || 1),
              "--vui-description-label-width": Ee(e.labelWidth) || "auto"
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
}), ma = H({
  name: "VDescriptionsItem",
  inheritAttrs: !1,
  props: {
    label: { type: String, default: "" },
    span: { type: [Number, String], default: 1 }
  },
  setup(e, { slots: t }) {
    const a = Y();
    return () => {
      var o;
      const { class: l, style: i, ...r } = a;
      return n(
        "div",
        {
          ...r,
          class: L("vui-descriptions-item", l),
          style: Be(
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
}), ga = H({
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
    const i = Y();
    P(() => new Set(e.checkedKeys.map(String)));
    const r = (C, T) => e.replaceFields[C] || T, o = I(/* @__PURE__ */ new Set()), s = P(() => e.expandedKeys !== void 0 ? new Set(e.expandedKeys.map(String)) : o.value), u = (C, T) => {
      e.defaultExpandAll && C.forEach(($) => {
        const _ = String($[r("key", "id")] ?? $._id ?? ""), F = $[r("children", "children")];
        Array.isArray(F) && F.length && (o.value.add(_), u(F));
      });
    };
    ve(() => {
      u(e.data);
    });
    const d = (C, T) => {
      const $ = s.value.has(C), _ = new Set(s.value);
      $ ? _.delete(C) : _.add(C), e.expandedKeys !== void 0 ? t("update:expandedKeys", [..._]) : o.value = _, t("expand", !$, T);
    }, c = (C, T) => {
      t("update:selectedKey", C), t("select", T);
    }, v = (C) => {
      const T = [], $ = C[r("children", "children")];
      return Array.isArray($) && $.forEach((_) => {
        const F = _[r("key", "id")] ?? _._id;
        T.push(F), T.push(...v(_));
      }), T;
    }, p = (C, T, $ = null) => {
      for (const _ of T) {
        const F = _[r("key", "id")] ?? _._id;
        if (String(F) === String(C))
          return $;
        const X = _[r("children", "children")];
        if (Array.isArray(X)) {
          const J = p(C, X, _);
          if (J !== void 0) return J;
        }
      }
      return null;
    }, b = (C, T = x.value) => {
      const $ = C[r("key", "id")] ?? C._id, _ = C[r("children", "children")];
      if (!Array.isArray(_) || _.length === 0)
        return T.has(String($)) ? "checked" : "unchecked";
      let F = 0, X = 0;
      for (const J of _) {
        const Q = b(J, T);
        Q === "checked" ? F++ : Q === "indeterminate" && X++;
      }
      return F === _.length ? "checked" : F > 0 || X > 0 ? "indeterminate" : "unchecked";
    }, D = (C, T) => {
      const $ = p(C, e.data);
      if (!$) return;
      const _ = $[r("key", "id")] ?? $._id, F = String(_);
      b($, new Set(T.keys())) === "checked" ? T.set(F, _) : T.delete(F), D(_, T);
    }, A = (C, T, $) => {
      const _ = new Map(e.checkedKeys.map((Q) => [String(Q), Q])), F = $ || f(C, e.data);
      if (!F) return;
      T ? _.set(String(C), C) : _.delete(String(C)), v(F).forEach((Q) => {
        T ? _.set(String(Q), Q) : _.delete(String(Q));
      }), D(C, _);
      const J = [..._.values()];
      t("update:checkedKeys", J), t("check", J, { key: C, checked: T, node: F });
    }, f = (C, T) => {
      for (const $ of T) {
        const _ = $[r("key", "id")] ?? $._id;
        if (String(_) === String(C)) return $;
        const F = $[r("children", "children")];
        if (Array.isArray(F)) {
          const X = f(C, F);
          if (X) return X;
        }
      }
      return null;
    }, x = P(() => new Set(e.checkedKeys.map(String))), B = I({
      dragging: !1,
      dragNode: null,
      dropNode: null,
      dropPosition: 0
      // -1: 上方, 0: 内部, 1: 下方
    }), h = (C, T) => {
      e.draggable && (B.value.dragging = !0, B.value.dragNode = T, C.dataTransfer.effectAllowed = "move", t("dragstart", T, C));
    }, M = (C, T) => {
      if (!e.draggable || !B.value.dragging) return;
      C.preventDefault(), C.dataTransfer.dropEffect = "move";
      const $ = C.currentTarget.getBoundingClientRect(), _ = C.clientY - $.top, F = $.height;
      _ < F * 0.25 ? B.value.dropPosition = -1 : _ > F * 0.75 ? B.value.dropPosition = 1 : B.value.dropPosition = 0, B.value.dropNode = T, t("dragover", T, C);
    }, N = (C, T) => {
      !e.draggable || !B.value.dragNode || (C.preventDefault(), t("drop", B.value.dragNode, T, B.value.dropPosition, C), B.value = { dragging: !1, dragNode: null, dropNode: null, dropPosition: 0 });
    }, j = (C) => {
      e.draggable && (t("dragend", B.value.dragNode, C), B.value = { dragging: !1, dragNode: null, dropNode: null, dropPosition: 0 });
    }, G = (C, T, $ = []) => {
      for (const _ of T) {
        const F = _[r("key", "id")] ?? _._id, X = [...$, _];
        if (String(F) === String(C))
          return X;
        const J = _[r("children", "children")];
        if (Array.isArray(J)) {
          const Q = G(C, J, X);
          if (Q) return Q;
        }
      }
      return null;
    }, K = (C, T = 0) => C.map(($, _) => {
      var z, U, le;
      const F = $[r("key", "id")] ?? $._id ?? _, X = String(F), J = $[r("title", "title")] ?? $.name ?? F, Q = $[r("icon", "icon")] ?? $.icon, w = $[r("children", "children")], k = Array.isArray(w) && w.length, m = s.value.has(X), R = String(e.selectedKey) === X, y = B.value.dragNode === $, E = B.value.dropNode === $, O = k ? b($) : x.value.has(X) ? "checked" : "unchecked", q = {
        node: $,
        key: F,
        title: J,
        level: T,
        path: G(F, e.data) || [$],
        isLeaf: !k,
        isExpanded: m,
        isSelected: R,
        isChecked: x.value.has(X),
        checkStatus: O
      }, S = (W) => {
        const ae = W.target;
        if (!(ae.closest(".vui-tree-switcher") || ae.closest(".vui-tree-operations"))) {
          if (c(F, $), e.showCheckbox) {
            const g = x.value.has(X);
            A(F, !g, $);
          }
          t("nodeClick", $, q, W);
        }
      };
      return n("li", {
        key: X,
        class: L("vui-tree-node", {
          "is-expanded": m,
          "is-selected": R,
          "is-checked": x.value.has(X),
          "is-dragging": y,
          "is-drop-above": E && B.value.dropPosition === -1,
          "is-drop-inside": E && B.value.dropPosition === 0,
          "is-drop-below": E && B.value.dropPosition === 1
        }),
        draggable: e.draggable,
        onDragstart: (W) => h(W, $),
        onDragover: (W) => M(W, $),
        onDrop: (W) => N(W, $),
        onDragend: j
      }, [
        n(
          "div",
          {
            class: L("vui-tree-line", { "is-selected": R }),
            style: { paddingLeft: `${T * 20 + 10}px` },
            onClick: S,
            onDblclick: (W) => {
              t("nodeDblclick", $, q, W);
            },
            onContextmenu: (W) => {
              W.preventDefault(), t("nodeContextmenu", $, q, W);
            }
          },
          [
            // 展开/折叠图标
            k ? n(
              "span",
              {
                class: L("vui-tree-switcher", { "is-expanded": m }),
                role: "button",
                "aria-expanded": String(m),
                "aria-label": m ? "折叠" : "展开",
                onClick: (W) => {
                  W.stopPropagation(), d(X, $);
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
                ((z = a.leafIcon) == null ? void 0 : z.call(a)) || n(
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
            e.showIcon && (Q || a.icon) ? n(
              "span",
              { class: "vui-tree-icon" },
              ((U = a.icon) == null ? void 0 : U.call(a, q)) || (typeof Q == "string" ? za(Q) ? n(ie, { type: Q }) : n("span", { class: Q }) : void 0)
            ) : null,
            // 复选框
            e.showCheckbox ? (() => {
              const W = k ? b($) : x.value.has(X) ? "checked" : "unchecked", ae = W === "checked", g = W === "indeterminate";
              return n("span", {
                class: L("vui-tree-checkbox", {
                  "is-checked": ae,
                  "is-indeterminate": g
                }),
                onClick: (V) => {
                  V.stopPropagation(), A(F, !ae, $);
                }
              }, [
                n("input", {
                  type: "checkbox",
                  checked: ae,
                  indeterminate: g,
                  "aria-label": `选择 ${J}`,
                  onChange: (V) => {
                    A(F, V.target.checked, $);
                  }
                }),
                n("span", { class: "vui-tree-checkbox-inner" })
              ]);
            })() : null,
            // 标题
            n(
              "span",
              {
                class: L("vui-tree-title", { "is-selected": R })
              },
              ((le = a.title) == null ? void 0 : le.call(a, q)) || Ne(J)
            ),
            // 操作按钮
            a.operations ? n("span", { class: "vui-tree-operations" }, a.operations(q)) : null
          ]
        ),
        // 子节点
        k && m ? n("ul", { class: "vui-tree-children" }, K(w, T + 1)) : null
      ]);
    }), te = () => {
      const C = [], T = ($) => {
        $.forEach((_) => {
          const F = String(_[r("key", "id")] ?? _._id ?? ""), X = _[r("children", "children")];
          Array.isArray(X) && X.length && (C.push(F), T(X));
        });
      };
      T(e.data), e.expandedKeys !== void 0 ? t("update:expandedKeys", C) : o.value = new Set(C);
    }, oe = () => {
      e.expandedKeys !== void 0 ? t("update:expandedKeys", []) : o.value = /* @__PURE__ */ new Set();
    }, ne = (C) => {
      const T = String(C);
      s.value.has(T) || d(T, {});
    }, se = (C) => {
      const T = String(C);
      s.value.has(T) && d(T, {});
    };
    return l == null || l({ expandAll: te, collapseAll: oe, expandNode: ne, collapseNode: se }), () => {
      const { class: C, style: T, ...$ } = i;
      return n(
        "ul",
        {
          ...$,
          class: L("vui-tree", C, {
            "is-draggable": e.draggable
          }),
          style: T
        },
        K(e.data)
      );
    };
  }
}), pa = Symbol("VuiTab"), Cl = H({
  name: "VTab",
  inheritAttrs: !1,
  props: {
    modelValue: { type: null, default: "" },
    type: { type: String, default: "" },
    allowClose: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change", "close"],
  setup(e, { slots: t, emit: a }) {
    const l = Y(), i = P(() => e.modelValue);
    return je(pa, {
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
}), Vl = H({
  name: "VTabItem",
  inheritAttrs: !1,
  props: {
    id: { type: null, default: "" },
    title: { type: String, default: "" },
    closable: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = De(pa, void 0);
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
                onClick: (d) => {
                  d.stopPropagation(), l == null || l.close(e.id);
                }
              },
              n(ie, { type: "close" })
            ) : null
          ]),
          i ? n("div", { class: "vui-tab-content" }, (u = t.default) == null ? void 0 : u.call(t)) : null
        ]
      );
    };
  }
}), ya = Symbol("VuiCollapse"), El = H({
  name: "VCollapse",
  inheritAttrs: !1,
  props: {
    modelValue: { type: null, default: "" },
    accordion: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { slots: t, emit: a }) {
    const l = Y(), i = P(() => e.modelValue);
    return je(ya, {
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
}), Al = H({
  name: "VCollapseItem",
  inheritAttrs: !1,
  props: {
    id: { type: null, default: "" },
    title: { type: String, default: "" }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = De(ya, void 0);
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
}), ha = H({
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
    const a = Y(), l = I(""), i = P(() => Math.max(1, Math.ceil(e.total / e.pageSize))), r = P(() => {
      const d = i.value, c = e.current, v = e.pagerCount, p = Math.floor(v / 2);
      if (d <= v)
        return Array.from({ length: d }, (f, x) => x + 1);
      let b = Math.max(2, c - p), D = Math.min(d - 1, c + p);
      c - p < 2 && (D = v - 1), c + p > d - 1 && (b = d - v + 2);
      const A = [1];
      b > 2 && A.push("...");
      for (let f = b; f <= D; f++) A.push(f);
      return D < d - 1 && A.push("..."), A.push(d), A;
    }), o = (d) => {
      d < 1 || d > i.value || d === e.current || e.disabled || (t("update:current", d), t("change", d, e.pageSize));
    }, s = (d) => {
      if (d === e.pageSize || e.disabled) return;
      t("update:pageSize", d), t("sizeChange", d);
      const c = Math.ceil(e.total / d);
      e.current > c && o(c);
    }, u = () => {
      const d = parseInt(l.value, 10);
      !isNaN(d) && d >= 1 && d <= i.value && o(d), l.value = "";
    };
    return e.hideOnSinglePage && i.value <= 1 ? () => null : () => {
      const { class: d, style: c, ...v } = a, p = e.layout.split(",").map((b) => b.trim());
      return n(
        "div",
        {
          ...v,
          class: L("vui-pagination", d, {
            "is-background": e.background,
            "is-disabled": e.disabled
          }),
          style: c
        },
        [
          p.includes("total") ? n("span", { class: "vui-pagination-total" }, `共 ${e.total} 条`) : null,
          p.includes("prev") ? n(
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
          p.includes("pager") ? n(
            "div",
            { class: "vui-pagination-pager", role: "navigation" },
            r.value.map((b) => {
              if (b === "...")
                return n("span", { class: "vui-pagination-ellipsis", key: "..." }, "…");
              const D = b;
              return n(
                "button",
                {
                  type: "button",
                  key: D,
                  class: L("vui-pagination-page", {
                    "is-active": D === e.current
                  }),
                  "aria-label": `第 ${D} 页`,
                  "aria-current": D === e.current ? "page" : void 0,
                  onClick: () => o(D)
                },
                String(D)
              );
            })
          ) : null,
          p.includes("next") ? n(
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
          p.includes("sizes") ? n(
            "select",
            {
              class: "vui-pagination-sizes",
              value: e.pageSize,
              disabled: e.disabled,
              "aria-label": "每页条数",
              onChange: (b) => s(Number(b.target.value))
            },
            e.pageSizes.map(
              (b) => n("option", { value: b, key: b }, `${b} 条/页`)
            )
          ) : null,
          p.includes("jumper") ? n("div", { class: "vui-pagination-jumper" }, [
            n("span", {}, "前往"),
            n("input", {
              type: "number",
              min: 1,
              max: i.value,
              value: l.value,
              disabled: e.disabled,
              "aria-label": "跳转页码",
              onInput: (b) => {
                l.value = b.target.value;
              },
              onKeydown: (b) => {
                b.key === "Enter" && u();
              },
              onBlur: u
            }),
            n("span", {}, "页")
          ]) : null
        ]
      );
    };
  }
}), Dl = H({
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
    const l = Y();
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
        s.map((d, c) => {
          var p, b, D, A, f;
          const v = c < e.active ? e.finishStatus : c === e.active ? e.processStatus : "wait";
          return n(
            "div",
            {
              key: c,
              class: L("vui-step", `is-${v}`, {
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
                    ((p = t[`step-${c}-icon`]) == null ? void 0 : p.call(t)) || n("span", { class: "vui-step-number" }, String(c + 1))
                  ]
                )
              ]),
              n("div", { class: "vui-step-main" }, [
                n("div", { class: "vui-step-title" }, ((b = d.props) == null ? void 0 : b.title) || `步骤 ${c + 1}`),
                (D = d.props) != null && D.description || t[`step-${c}-description`] ? n(
                  "div",
                  { class: "vui-step-description" },
                  ((A = t[`step-${c}-description`]) == null ? void 0 : A.call(t)) || ((f = d.props) == null ? void 0 : f.description)
                ) : null
              ])
            ]
          );
        })
      );
    };
  }
}), Ml = H({
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
}), ba = H({
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
    const a = Y(), l = P(() => {
      let i = String(e.value);
      const r = Number(e.value);
      if (!isNaN(r) && e.precision !== void 0 && (i = r.toFixed(e.precision)), !isNaN(r) && e.groupSeparator) {
        const o = i.split(".");
        o[0] = o[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","), i = o.join(".");
      }
      return i;
    });
    return () => {
      var s, u, d, c;
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
              n("span", { class: "vui-statistic-value" }, ((d = t.default) == null ? void 0 : d.call(t)) || l.value),
              e.suffix || t.suffix ? n("span", { class: "vui-statistic-suffix" }, ((c = t.suffix) == null ? void 0 : c.call(t)) || e.suffix) : null
            ]
          )
        ]
      );
    };
  }
}), Nl = H({
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
    const l = Y(), i = I(0);
    let r = null;
    const o = P(() => e.value instanceof Date ? e.value.getTime() : Number(e.value)), s = (c) => {
      if (c <= 0) return "00:00:00";
      const v = Math.floor(c / 1e3), p = Math.floor(v / 60), b = Math.floor(p / 60), D = Math.floor(b / 24), A = (x) => String(x).padStart(2, "0");
      let f = e.format;
      return f = f.replace("DD", A(D)), f = f.replace("HH", A(b % 24)), f = f.replace("mm", A(p % 60)), f = f.replace("ss", A(v % 60)), f = f.replace("SSS", A(c % 1e3)), f;
    }, u = () => {
      d();
      const c = () => {
        const v = Date.now(), p = o.value - v;
        i.value = Math.max(0, p), t("change", i.value), p <= 0 && (d(), t("finish"));
      };
      c(), r = setInterval(c, 1e3);
    }, d = () => {
      r && (clearInterval(r), r = null);
    };
    return u(), ge(d), () => {
      var b, D, A, f;
      const { class: c, style: v, ...p } = l;
      return n(
        "div",
        { ...p, class: L("vui-countdown", c), style: v },
        [
          e.title || a.title ? n("div", { class: "vui-countdown-title" }, ((b = a.title) == null ? void 0 : b.call(a)) || e.title) : null,
          n("div", { class: "vui-countdown-content" }, [
            e.prefix || a.prefix ? n("span", { class: "vui-countdown-prefix" }, ((D = a.prefix) == null ? void 0 : D.call(a)) || e.prefix) : null,
            n("span", { class: "vui-countdown-value" }, ((A = a.default) == null ? void 0 : A.call(a)) || s(i.value)),
            e.suffix || a.suffix ? n("span", { class: "vui-countdown-suffix" }, ((f = a.suffix) == null ? void 0 : f.call(a)) || e.suffix) : null
          ])
        ]
      );
    };
  }
}), Qe = 8, Pe = 12, $l = 160, Tl = 96, Nt = {
  position: "fixed",
  top: "0px",
  left: "-9999px"
};
function Ol(e, t, a) {
  return Math.min(Math.max(e, t), a);
}
function Bl(e, t, a = !1) {
  const l = e.getBoundingClientRect(), i = document.documentElement.clientWidth, r = document.documentElement.clientHeight, o = Math.min(t.offsetWidth, i - Pe * 2), s = t.scrollHeight, u = r - l.bottom - Qe - Pe, d = l.top - Qe - Pe, c = u < Math.min(s, $l) && d > u, v = Math.max(Tl, c ? d : u), p = a ? l.right - o : l.left, b = Ol(
    p,
    Pe,
    Math.max(Pe, i - Pe - o)
  );
  return {
    dropUp: c,
    style: {
      position: "fixed",
      top: c ? "auto" : `${Math.round(l.bottom + Qe)}px`,
      bottom: c ? `${Math.round(r - l.top + Qe)}px` : "auto",
      left: `${Math.round(b)}px`,
      // 放得下就不写上限：贴着内容高度取整容易多出一条一两像素的滚动条
      maxHeight: s > v ? `${Math.round(v)}px` : "none"
    }
  };
}
function Ll(e) {
  const t = Array.isArray(e) ? e : e ? [e] : [];
  return {
    width: Ee(t[0]) || "min(720px, calc(100vw - 32px))",
    height: Ee(t[1]),
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100dvh - 32px)"
  };
}
const wa = H({
  name: "VLayer",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Boolean, default: !1 },
    title: { type: String, default: "" },
    area: {
      type: [String, Number, Array],
      default: ""
    },
    shadeClose: { type: Boolean, default: !1 },
    closeBtn: { type: [Boolean, Number, String], default: !0 },
    loading: { type: Boolean, default: !1 },
    type: { type: [String, Number], default: 1 }
  },
  emits: ["update:modelValue", "close", "open"],
  setup(e, { slots: t, emit: a }) {
    const l = Y(), i = I(), r = () => {
      a("update:modelValue", !1), a("close");
    }, o = (s) => {
      e.modelValue && s.key === "Escape" && r();
    };
    return me(
      () => e.modelValue,
      async (s) => {
        var u;
        document.documentElement.classList.toggle("vui-layer-open", s), s && (a("open"), await we(), (u = i.value) == null || u.focus());
      },
      { immediate: !0 }
    ), ve(() => document.addEventListener("keydown", o)), ge(() => {
      document.removeEventListener("keydown", o), document.documentElement.classList.remove("vui-layer-open");
    }), () => {
      var s;
      return e.modelValue ? n(Ae, { to: "body" }, [
        n(
          "div",
          {
            class: "vui-layer-wrap",
            role: "presentation",
            onMousedown: (u) => {
              const d = u.target;
              e.shadeClose && (u.target === u.currentTarget || d.classList.contains("vui-layer-shade")) && r();
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
                style: Be(Ll(e.area), l.style),
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
                    n(ie, { type: "close" })
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
}), xa = H({
  name: "VDropdown",
  inheritAttrs: !1,
  props: {
    visible: { type: Boolean, default: void 0 },
    placement: { type: String, default: "bottom-start" }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = I(), i = I(), r = I(!1), o = I(!1), s = I({ ...Nt });
    let u = null;
    const d = P(() => e.visible === !0 ? !0 : r.value), c = P(() => e.placement === "bottom-end"), v = () => {
      r.value = !1;
    }, p = () => {
      if (!d.value || !l.value || !i.value) return;
      const f = Bl(l.value, i.value, c.value);
      o.value = f.dropUp, s.value = f.style;
    }, b = () => {
      var f, x;
      u = document.activeElement, p(), (x = (f = i.value) == null ? void 0 : f.querySelector('button:not(:disabled), [tabindex]:not([tabindex="-1"])')) == null || x.focus({ preventScroll: !0 });
    }, D = () => {
      s.value = { ...Nt }, o.value = !1;
      const f = document.activeElement;
      u && (!f || f === document.body) && u.focus({ preventScroll: !0 }), u = null;
    }, A = (f) => {
      var B, h;
      const x = f.target;
      !((B = l.value) != null && B.contains(x)) && !((h = i.value) != null && h.contains(x)) && v();
    };
    return me(d, (f) => f ? b() : D(), { flush: "post" }), ve(() => {
      d.value && b(), document.addEventListener("mousedown", A), window.addEventListener("resize", p), window.addEventListener("scroll", p, !0);
    }), ge(() => {
      document.removeEventListener("mousedown", A), window.removeEventListener("resize", p), window.removeEventListener("scroll", p, !0);
    }), () => {
      var h, M;
      const { class: f, style: x, ...B } = a;
      return n(
        "div",
        {
          ...B,
          ref: l,
          class: L("vui-dropdown", f, `is-${e.placement}`, {
            "is-open": d.value
          }),
          style: x
        },
        [
          n(
            "div",
            {
              class: "vui-dropdown-trigger",
              onClick: (N) => {
                N.stopPropagation(), r.value = !r.value;
              },
              onKeydown: (N) => {
                N.key === "Escape" && v();
              }
            },
            (h = t.default) == null ? void 0 : h.call(t)
          ),
          d.value ? n(Ae, { to: "body" }, [
            n(
              "div",
              {
                ref: i,
                class: L("vui-dropdown-popover", {
                  "is-drop-up": o.value,
                  "is-align-end": c.value
                }),
                style: s.value,
                onClick: () => queueMicrotask(v),
                // 焦点进了面板之后，Esc 的 keydown 落在面板上，触发器那个监听收不到
                onKeydown: (N) => {
                  N.key === "Escape" && v();
                }
              },
              (M = t.content) == null ? void 0 : M.call(t)
            )
          ]) : null
        ]
      );
    };
  }
}), Il = H({
  name: "VDropdownMenu",
  inheritAttrs: !1,
  setup(e, { slots: t }) {
    const a = Y();
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
}), Pl = H({
  name: "VDropdownMenuItem",
  inheritAttrs: !1,
  props: {
    disabled: { type: Boolean, default: !1 }
  },
  setup(e, { slots: t }) {
    const a = Y();
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
function Sa(e, t, a) {
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
const ka = H({
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
    const a = Y(), l = I(), i = I(), r = I(!1), o = I({ position: "fixed", visibility: "hidden" });
    let s = null, u = null;
    const d = () => {
      !r.value || !l.value || !i.value || (o.value = Sa(l.value, i.value, e.placement));
    }, c = () => {
      e.disabled || (u && (clearTimeout(u), u = null), s = setTimeout(() => {
        r.value = !0, we(d);
      }, e.showAfter));
    }, v = () => {
      s && (clearTimeout(s), s = null), u = setTimeout(() => {
        r.value = !1;
      }, e.hideAfter);
    };
    return ve(() => {
      window.addEventListener("resize", d), window.addEventListener("scroll", d, !0);
    }), ge(() => {
      window.removeEventListener("resize", d), window.removeEventListener("scroll", d, !0), s && clearTimeout(s), u && clearTimeout(u);
    }), () => {
      var A, f;
      const { class: p, style: b, ...D } = a;
      return n(
        "span",
        {
          ...D,
          ref: l,
          class: L("vui-tooltip-host", p),
          style: b,
          onMouseenter: () => {
            e.trigger === "hover" && c();
          },
          onMouseleave: () => {
            e.trigger === "hover" && v();
          },
          onClick: () => {
            e.trigger === "click" && (r.value ? v() : c());
          },
          onFocusin: () => {
            e.trigger === "focus" && c();
          },
          onFocusout: () => {
            e.trigger === "focus" && v();
          }
        },
        [
          (A = t.default) == null ? void 0 : A.call(t),
          r.value && (e.content || t.content) ? n(
            Ae,
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
                    e.trigger === "hover" && v();
                  }
                },
                [
                  n("div", { class: "vui-tooltip-arrow" }),
                  n("div", { class: "vui-tooltip-content" }, ((f = t.content) == null ? void 0 : f.call(t)) || e.content)
                ]
              )
            ]
          ) : null
        ]
      );
    };
  }
}), Ca = H({
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
    const l = Y(), i = I(), r = I(), o = I(!1), s = I({ position: "fixed", visibility: "hidden" });
    let u = null, d = null;
    const c = () => {
      !o.value || !i.value || !r.value || (s.value = Sa(i.value, r.value, e.placement));
    }, v = () => {
      e.disabled || (d && (clearTimeout(d), d = null), u = setTimeout(() => {
        o.value = !0, a("show"), we(c);
      }, e.showAfter));
    }, p = () => {
      u && (clearTimeout(u), u = null), d = setTimeout(() => {
        o.value = !1, a("hide");
      }, e.hideAfter);
    }, b = () => {
      o.value ? p() : v();
    }, D = (f) => {
      var B, h;
      const x = f.target;
      o.value && !((B = i.value) != null && B.contains(x)) && !((h = r.value) != null && h.contains(x)) && p();
    }, A = P(() => {
      const f = Ee(e.width);
      return f ? { width: f, minWidth: f } : {};
    });
    return ve(() => {
      document.addEventListener("mousedown", D), window.addEventListener("resize", c), window.addEventListener("scroll", c, !0);
    }), ge(() => {
      document.removeEventListener("mousedown", D), window.removeEventListener("resize", c), window.removeEventListener("scroll", c, !0), u && clearTimeout(u), d && clearTimeout(d);
    }), () => {
      var M, N, j;
      const { class: f, style: x, ...B } = l, h = {};
      return e.trigger === "hover" ? (h.onMouseenter = v, h.onMouseleave = p) : e.trigger === "click" ? h.onClick = b : e.trigger === "focus" && (h.onFocusin = v, h.onFocusout = p), n(
        "span",
        {
          ...B,
          ref: i,
          class: L("vui-popover-host", f),
          style: x,
          ...h
        },
        [
          (M = t.default) == null ? void 0 : M.call(t),
          o.value ? n(
            Ae,
            { to: "body" },
            [
              n(
                "div",
                {
                  ref: r,
                  class: L("vui-popover", `vui-popover--${e.placement}`, e.popperClass, {
                    "is-visible": o.value
                  }),
                  style: Be(s.value, A.value),
                  onMouseenter: () => {
                    e.enterable && e.trigger === "hover" && d && (clearTimeout(d), d = null);
                  },
                  onMouseleave: () => {
                    e.trigger === "hover" && p();
                  }
                },
                [
                  n("div", { class: "vui-popover-arrow" }),
                  e.title || t.title ? n("div", { class: "vui-popover-title" }, ((N = t.title) == null ? void 0 : N.call(t)) || e.title) : null,
                  n(
                    "div",
                    { class: "vui-popover-content" },
                    ((j = t.content) == null ? void 0 : j.call(t)) || e.content
                  )
                ]
              )
            ]
          ) : null
        ]
      );
    };
  }
}), Va = H({
  name: "VDrawer",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Boolean, default: !1 },
    title: { type: String, default: "" },
    direction: { type: String, default: "rtl" },
    size: { type: [String, Number], default: "30%" },
    modal: { type: Boolean, default: !0 },
    showClose: { type: Boolean, default: !0 },
    closeOnClickModal: { type: Boolean, default: !1 },
    closeOnPressEscape: { type: Boolean, default: !0 },
    beforeClose: { type: Function, default: void 0 },
    destroyOnClose: { type: Boolean, default: !1 },
    withHeader: { type: Boolean, default: !0 }
  },
  emits: ["update:modelValue", "open", "close", "opened", "closed"],
  setup(e, { slots: t, emit: a }) {
    const l = Y(), i = I(), r = I(!1), o = I(!e.destroyOnClose), s = P(() => {
      const v = Ee(e.size);
      return e.direction === "rtl" || e.direction === "ltr" ? { width: v || "30%" } : { height: v || "30%" };
    }), u = () => {
      const v = () => {
        r.value = !1, a("update:modelValue", !1), a("close");
      };
      e.beforeClose ? e.beforeClose(v) : v();
    }, d = () => {
      e.closeOnClickModal && u();
    }, c = (v) => {
      v.key === "Escape" && e.closeOnPressEscape && u();
    };
    return me(
      () => e.modelValue,
      (v) => {
        v ? (o.value = !0, a("open"), we(() => {
          var p;
          r.value = !0, (p = i.value) == null || p.focus(), a("opened");
        })) : (r.value = !1, e.destroyOnClose && setTimeout(() => {
          o.value = !1;
        }, 300), a("closed"));
      },
      { immediate: !0 }
    ), ve(() => {
      document.addEventListener("keydown", c);
    }), ge(() => {
      document.removeEventListener("keydown", c);
    }), () => {
      var D, A;
      if (!o.value && !e.modelValue) return null;
      const { class: v, style: p, ...b } = l;
      return n(
        Ae,
        { to: "body" },
        [
          n(
            "div",
            {
              ...b,
              class: L("vui-drawer-wrap", v, {
                "is-open": r.value,
                "is-modal": e.modal
              }),
              style: p
            },
            [
              e.modal ? n("div", {
                class: "vui-drawer-mask",
                onClick: d
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
                    n("div", { class: "vui-drawer-title" }, ((D = t.title) == null ? void 0 : D.call(t)) || e.title || "信息"),
                    e.showClose ? n(
                      "button",
                      {
                        type: "button",
                        class: "vui-drawer-close",
                        "aria-label": "关闭",
                        onClick: u
                      },
                      n(ie, { type: "close" })
                    ) : null
                  ]) : null,
                  n("div", { class: "vui-drawer-body" }, (A = t.default) == null ? void 0 : A.call(t)),
                  t.footer ? n("footer", { class: "vui-drawer-footer" }, t.footer()) : null
                ]
              )
            ]
          )
        ]
      );
    };
  }
}), Ea = H({
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
        e.loading ? n(Ae, { to: "body" }, [a()]) : null
      ]) : n(
        "div",
        { class: "vui-loading", "aria-busy": e.loading ? "true" : "false" },
        [(i = t.default) == null ? void 0 : i.call(t), e.loading ? a() : null]
      );
    };
  }
}), _l = H({
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
    const a = P(() => Math.max(1, Number(e.rows) || 1)), l = P(() => Math.max(1, Number(e.columns) || 1)), i = (o, s) => n("span", { class: L("vui-skeleton-bar", s), style: { width: o } }), r = () => e.type === "table" ? [
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
}), Aa = H({
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
    const l = Y(), i = I(!0), r = {
      info: "info",
      success: "check-circle",
      warning: "alert",
      error: "close"
    }, o = () => {
      i.value = !1, a("close");
    };
    return () => {
      var c, v;
      if (!i.value) return null;
      const { class: s, style: u, ...d } = l;
      return n(
        "div",
        {
          ...d,
          class: L("vui-alert", s, `vui-alert--${e.type}`, {
            "is-center": e.center,
            "has-description": e.description || t.description
          }),
          style: u,
          role: "alert"
        },
        [
          e.showIcon ? n(ie, { class: "vui-alert-icon", type: r[e.type] || r.info }) : null,
          n("div", { class: "vui-alert-content" }, [
            e.title || t.title ? n("div", { class: "vui-alert-title" }, ((c = t.title) == null ? void 0 : c.call(t)) || e.title) : null,
            e.description || t.description ? n("div", { class: "vui-alert-description" }, ((v = t.description) == null ? void 0 : v.call(t)) || e.description) : null
          ]),
          e.closable ? n(
            "button",
            {
              type: "button",
              class: "vui-alert-close",
              "aria-label": "关闭",
              onClick: o
            },
            e.closeText || n(ie, { type: "close" })
          ) : null
        ]
      );
    };
  }
}), Da = H({
  name: "VEmpty",
  inheritAttrs: !1,
  props: {
    description: { type: String, default: "暂无数据" },
    image: { type: String, default: "" },
    imageSize: { type: [Number, String], default: 0 }
  },
  setup(e, { slots: t }) {
    const a = Y(), l = P(() => {
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
let ot = [], Fl = 0;
function Rl() {
  let e = document.querySelector(".vui-message-container");
  return e || (e = document.createElement("div"), e.className = "vui-message-container", document.body.appendChild(e)), e;
}
function jl(e) {
  const t = ot.indexOf(e);
  t > -1 && (ot.splice(t, 1), e.el.classList.add("is-leaving"), setTimeout(() => {
    e.el.remove();
  }, 300));
}
function He(e) {
  var p;
  const t = typeof e == "string" ? { content: e } : e, a = `message-${++Fl}`, l = Rl(), i = {
    info: "info",
    success: "check-circle",
    warning: "alert",
    error: "close"
  }, r = t.type || "info", o = t.duration ?? 3e3, s = t.closable ?? o === 0, u = document.createElement("div");
  u.className = `vui-message vui-message--${r} is-enter`, u.setAttribute("role", "alert");
  const d = t.icon || i[r], c = `
    <span class="vui-message-icon">${Re(d)}</span>
    <span class="vui-message-content">${t.content}</span>
    ${s ? `<button type="button" class="vui-message-close" aria-label="关闭">${Re("close")}</button>` : ""}
  `;
  u.innerHTML = c, l.appendChild(u), requestAnimationFrame(() => {
    u.classList.remove("is-enter");
  });
  const v = {
    id: a,
    vnode: Ka("div"),
    el: u,
    close: () => jl(v)
  };
  if (s && ((p = u.querySelector(".vui-message-close")) == null || p.addEventListener("click", () => v.close())), ot.push(v), o > 0 && setTimeout(() => v.close(), o), t.onClose) {
    const b = v.close;
    v.close = () => {
      var D;
      b(), (D = t.onClose) == null || D.call(t);
    };
  }
  return { close: () => v.close() };
}
const wn = {
  info: (e, t) => He({ type: "info", content: e, duration: t }),
  success: (e, t) => He({ type: "success", content: e, duration: t }),
  warning: (e, t) => He({ type: "warning", content: e, duration: t }),
  error: (e, t) => He({ type: "error", content: e, duration: t }),
  open: (e) => He(e),
  closeAll: () => {
    [...ot].forEach((e) => e.close());
  }
};
function gt(e) {
  const t = typeof e == "string" ? { message: e } : e, a = t.title || "提示", l = t.type || "", i = t.showCancelButton ?? !0, r = t.showConfirmButton ?? !0, o = t.confirmButtonText || "确定", s = t.cancelButtonText || "取消", u = t.closeOnClickModal ?? !1, d = t.closeOnPressEscape ?? !0;
  return new Promise((c) => {
    const v = document.createElement("div");
    v.className = "vui-message-box-wrap";
    const p = {
      info: "info",
      success: "check-circle",
      warning: "alert",
      error: "close"
    };
    v.innerHTML = `
      <div class="vui-message-box-mask"></div>
      <div class="vui-message-box" role="dialog" aria-modal="true" tabindex="-1">
        <div class="vui-message-box-header">
          <div class="vui-message-box-title">${a}</div>
          <button type="button" class="vui-message-box-close" aria-label="关闭">${Re("close")}</button>
        </div>
        <div class="vui-message-box-content">
          ${l ? `<span class="vui-message-box-icon vui-message-box-icon--${l}">${Re(p[l] || "info")}</span>` : ""}
          <div class="vui-message-box-message">${t.message}</div>
        </div>
        <div class="vui-message-box-footer">
          ${i ? `<button type="button" class="vui-button vui-message-box-cancel ${t.cancelButtonClass || ""}">${s}</button>` : ""}
          ${r ? `<button type="button" class="vui-button vui-button-primary vui-message-box-confirm ${t.confirmButtonClass || ""}">${o}</button>` : ""}
        </div>
      </div>
    `, document.body.appendChild(v);
    const b = v.querySelector(".vui-message-box"), D = v.querySelector(".vui-message-box-close"), A = v.querySelector(".vui-message-box-cancel"), f = v.querySelector(".vui-message-box-confirm"), x = v.querySelector(".vui-message-box-mask");
    let B = !1;
    const h = (N = "close") => {
      if (B) return;
      const j = () => {
        B = !0, v.classList.add("is-leaving"), setTimeout(() => {
          v.remove(), c(N);
        }, 200);
      };
      t.beforeClose ? t.beforeClose(N, M, j) : j();
    }, M = {
      el: v,
      close: h
    };
    if (D == null || D.addEventListener("click", () => h("close")), A == null || A.addEventListener("click", () => h("cancel")), f == null || f.addEventListener("click", () => h("confirm")), u && (x == null || x.addEventListener("click", () => h("close"))), d) {
      const N = (j) => {
        j.key === "Escape" && (h("close"), document.removeEventListener("keydown", N));
      };
      document.addEventListener("keydown", N);
    }
    requestAnimationFrame(() => b == null ? void 0 : b.focus());
  });
}
const xn = {
  alert: (e, t, a) => gt({ ...a, message: e, title: t, showCancelButton: !1 }),
  confirm: (e, t, a) => gt({ ...a, message: e, title: t }),
  prompt: (e, t, a) => gt({ ...a, message: e, title: t })
}, Ma = "vui-columns:";
function pt(e, t) {
  return String(e.key ?? e.customSlot ?? e.title ?? `#${t}`);
}
function Kl(e, t) {
  return String(e.title || e.key || e.customSlot || `第 ${t + 1} 列`);
}
function $t(e) {
  if (!e || typeof localStorage > "u") return null;
  try {
    const t = localStorage.getItem(Ma + e), a = t ? JSON.parse(t) : null;
    return Array.isArray(a) ? a : null;
  } catch {
    return null;
  }
}
function Hl(e, t) {
  if (!(!e || typeof localStorage > "u"))
    try {
      localStorage.setItem(Ma + e, JSON.stringify(t));
    } catch {
    }
}
const zl = H({
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
    const a = I(), l = I(!1), i = I([]), r = I([]), o = I(-1), s = I(!1), u = I(), d = () => e.source.map((M, N) => ({
      key: pt(M, N),
      title: Kl(M, N),
      visible: !0
    })), c = (M) => {
      const N = d();
      if (!(M != null && M.length)) return N;
      const j = new Map(N.map((K) => [K.key, K])), G = [];
      for (const K of M) {
        const te = j.get(K.key);
        te && (G.push({ ...te, visible: K.visible !== !1 }), j.delete(K.key));
      }
      for (const K of N) j.has(K.key) && G.push(K);
      return G.length ? G : N;
    }, v = (M) => {
      const N = new Map(e.source.map((G, K) => [pt(G, K), G])), j = M.filter((G) => G.visible).map((G) => N.get(G.key)).filter(Boolean);
      t("update:modelValue", j), t("change", { columns: j, state: M.map((G) => ({ ...G })) });
    }, p = (M, N = !0) => {
      r.value = M.map((j) => ({ ...j })), N && e.storageKey && Hl(e.storageKey, M.map(({ key: j, visible: G }) => ({ key: j, visible: G }))), v(M);
    };
    ve(() => p(c($t(e.storageKey)), !1)), me(
      () => e.source.map((M, N) => pt(M, N)).join("|"),
      () => p(c($t(e.storageKey)), !1)
    );
    const b = () => r.value.filter((M) => M.visible).length, D = async () => {
      var j;
      if (e.disabled) return;
      if (l.value || (i.value = r.value.map((G) => ({ ...G }))), l.value = !l.value, !l.value) {
        s.value = !1;
        return;
      }
      await we();
      const M = (j = u.value) == null ? void 0 : j.getBoundingClientRect();
      if (!M || !a.value) return;
      const N = f(a.value).getBoundingClientRect();
      M.left < Math.max(N.left, 0) + 4 && (s.value = !0);
    }, A = (M, N) => {
      const j = i.value;
      if (M < 0 || N < 0 || M >= j.length || N >= j.length || M === N) return;
      const G = j.slice(), [K] = G.splice(M, 1);
      G.splice(N, 0, K), i.value = G;
    };
    function f(M) {
      let N = M.parentElement;
      for (; N && N !== document.body; ) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(N).overflowX)) return N;
        N = N.parentElement;
      }
      return document.documentElement;
    }
    const x = (M) => {
      var N;
      l.value && !((N = a.value) != null && N.contains(M.target)) && (l.value = !1);
    }, B = (M) => {
      l.value && M.key === "Escape" && (l.value = !1);
    };
    ve(() => {
      document.addEventListener("mousedown", x), document.addEventListener("keydown", B);
    }), ge(() => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", B);
    });
    const h = (M, N) => {
      const j = i.value.filter((K) => K.visible).length, G = M.visible && j <= 1;
      return n(
        "li",
        {
          key: M.key,
          class: L("vui-column-setting-item", { "is-hidden": !M.visible }),
          draggable: !0,
          onDragstart: () => {
            o.value = N;
          },
          onDragover: (K) => {
            K.preventDefault(), o.value !== -1 && o.value !== N && (A(o.value, N), o.value = N);
          },
          onDragend: () => {
            o.value = -1;
          }
        },
        [
          n("label", { class: "vui-column-setting-label" }, [
            n("input", {
              type: "checkbox",
              checked: M.visible,
              disabled: G,
              title: G ? "至少保留一列" : void 0,
              onChange: (K) => {
                const te = i.value.slice();
                te[N] = { ...M, visible: K.target.checked }, i.value = te;
              }
            }),
            n("span", M.title)
          ]),
          n(
            "button",
            {
              type: "button",
              class: "vui-column-setting-handle",
              // 只能拖会把键盘用户挡在外面，把手聚焦后上下键即可移动
              "aria-label": `调整「${M.title}」的顺序：拖拽，或用上下方向键`,
              onKeydown: async (K) => {
                var oe, ne;
                if (K.key !== "ArrowUp" && K.key !== "ArrowDown") return;
                K.preventDefault();
                const te = N + (K.key === "ArrowUp" ? -1 : 1);
                te < 0 || te >= i.value.length || (A(N, te), await we(), (ne = (oe = u.value) == null ? void 0 : oe.querySelectorAll(".vui-column-setting-handle")[te]) == null || ne.focus());
              }
            },
            n(ie, { type: "drag-handle" })
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
            onClick: D
          },
          [
            n(ie, { class: "vui-column-setting-gear", type: "settings" }),
            n("span", { class: "vui-column-setting-text" }, e.label),
            // 隐藏了列却没有任何提示，用户会以为是数据丢了
            r.value.length && b() < r.value.length ? n(
              "span",
              { class: "vui-column-setting-badge" },
              `隐藏 ${r.value.length - b()}`
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
              i.value.map((M, N) => h(M, N))
            ),
            n("div", { class: "vui-column-setting-foot" }, [
              n(
                "button",
                {
                  type: "button",
                  class: "vui-button vui-button-sm",
                  onClick: () => {
                    i.value = d();
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
                    p(i.value), l.value = !1;
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
}), Na = Symbol("VuiCheckboxGroup"), $a = H({
  name: "VCheckboxGroup",
  inheritAttrs: !1,
  props: {
    modelValue: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: !1 },
    options: { type: Array, default: () => [] }
  },
  emits: ["update:modelValue", "change"],
  setup(e, { emit: t, slots: a }) {
    const l = Y(), i = P(() => e.modelValue);
    return je(Na, {
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
        s != null && s.length ? s : e.options.map((d) => n(
          St,
          { value: d.value, label: d.label, disabled: d.disabled }
        ))
      );
    };
  }
}), St = H({
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
    const l = Y(), i = De(Na, void 0), r = P(() => i ? i.value.value.some((u) => Object.is(u, e.value)) : Object.is(e.modelValue, e.trueValue)), o = P(() => e.disabled || (i == null ? void 0 : i.disabled) || !1), s = (u) => {
      if (o.value) return;
      if (i) {
        i.update(e.value, u);
        return;
      }
      const d = u ? e.trueValue : e.falseValue;
      t("update:modelValue", d), t("change", d);
    };
    return () => {
      var p;
      const { class: u, style: d, ...c } = l, v = e.indeterminate && !r.value;
      return n(
        "label",
        {
          class: L("vui-checkbox", u, {
            "is-checked": r.value,
            "is-indeterminate": v,
            "is-disabled": o.value
          }),
          style: d,
          "aria-disabled": o.value || void 0
        },
        [
          n("input", {
            ...c,
            class: "vui-checkbox-input",
            type: "checkbox",
            checked: r.value,
            disabled: o.value,
            "aria-checked": v ? "mixed" : String(r.value),
            onChange: (b) => s(b.target.checked)
          }),
          n("span", { class: "vui-checkbox-box", "aria-hidden": "true" }, [
            v ? n("span", { class: "vui-checkbox-mixed" }) : n(ie, { type: "check" })
          ]),
          e.label || a.default ? n("span", { class: "vui-checkbox-label" }, ((p = a.default) == null ? void 0 : p.call(a)) || e.label) : null
        ]
      );
    };
  }
}), Ta = H({
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
    const a = Y(), l = (r) => t("update:modelValue", r), i = () => {
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
          n(ie, { class: "vui-time-picker-icon", type: "clock" }),
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
            n(ie, { type: "close" })
          ]) : null
        ]
      );
    };
  }
}), Oa = H({
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
    const l = Y();
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
}), Wl = {
  cols: 24,
  /* 行高 40 是照着控件高度定的：--vui-control-height 是 38px，
     行高再低一档（比如 32）会让「占 1 行」的输入框被压扁。 */
  rowHeight: 40,
  gap: 12,
  width: 1440,
  height: 900,
  snapThreshold: 6
}, Ul = {
  lg: 1100,
  md: 768,
  sm: 0
}, Ba = ["lg", "md", "sm"];
function st(e) {
  return { ...Wl, ...e };
}
function Sn(e) {
  return Ba.find((t) => e >= Ul[t]) || "sm";
}
function Ue(e, t = "lg") {
  var i;
  const a = e == null ? void 0 : e.grid;
  if (!a) return;
  if (t === "lg") return { ...a };
  const l = (i = e == null ? void 0 : e.breakpoints) == null ? void 0 : i[t];
  return l ? { ...a, ...l } : { ...a };
}
function Tt(e, t, a) {
  let l = e;
  return typeof t == "number" && (l = Math.max(l, t)), typeof a == "number" && (l = Math.min(l, a)), l;
}
function qe(e, t) {
  let a = Math.max(1, Tt(e.w, e.minW, e.maxW)), l = Math.max(1, Tt(e.h, e.minH, e.maxH));
  typeof (t == null ? void 0 : t.maxX) == "number" && (a = Math.max(e.minW ?? 1, Math.min(a, t.maxX))), typeof (t == null ? void 0 : t.maxY) == "number" && (l = Math.max(e.minH ?? 1, Math.min(l, t.maxY)));
  let i = Math.max(0, e.x), r = Math.max(0, e.y);
  return typeof (t == null ? void 0 : t.maxX) == "number" && (i = Math.min(i, Math.max(0, t.maxX - a))), typeof (t == null ? void 0 : t.maxY) == "number" && (r = Math.min(r, Math.max(0, t.maxY - l))), { ...e, x: i, y: r, w: a, h: l };
}
function ut(e, t) {
  return !(e.id === t.id || e.x + e.w <= t.x || e.x >= t.x + t.w || e.y + e.h <= t.y || e.y >= t.y + t.h);
}
function kn(e, t) {
  return t.filter((a) => ut(e, a));
}
function Gl(e, t) {
  const a = e.map((o) => ({ ...o })), l = [], i = a.find((o) => o.id === t);
  i && l.push(i);
  for (const o of a)
    o.static && o.id !== t && l.push(o);
  const r = a.filter((o) => o.id !== t && !o.static).sort((o, s) => o.y - s.y || o.x - s.x);
  for (const o of r) {
    const s = o.y + a.length * Math.max(1, ...a.map((u) => u.h)) + 1;
    for (; o.y < s && l.some((u) => ut(o, u)); ) o.y++;
    l.push(o);
  }
  return e.map((o) => a.find((s) => s.id === o.id));
}
function ql(e) {
  const t = [...e].map((l) => ({ ...l })).sort((l, i) => l.y - i.y || l.x - i.x), a = [];
  for (const l of t) {
    if (l.static) {
      a.push(l);
      continue;
    }
    for (; l.y > 0 && !a.some((i) => ut({ ...l, y: l.y - 1 }, i)); )
      l.y--;
    for (; a.some((i) => ut(l, i)); )
      l.y++;
    a.push(l);
  }
  return a;
}
function Cn(e) {
  return e.reduce((t, a) => Math.max(t, a.y + a.h), 0);
}
function Fe(e, t, a) {
  return (e - a * (t - 1)) / t;
}
function La(e, t, a) {
  const l = Fe(t, a.cols, a.gap);
  return {
    left: e.x * (l + a.gap),
    top: e.y * (a.rowHeight + a.gap),
    // n 格的宽 = n 个单格宽 + 中间 n-1 条间距
    width: e.w * l + (e.w - 1) * a.gap,
    height: e.h * a.rowHeight + (e.h - 1) * a.gap
  };
}
function Yl(e, t, a) {
  const l = Fe(t, a.cols, a.gap), i = a.rowHeight + a.gap;
  return {
    x: Math.max(0, Math.round(e.x / (l + a.gap))),
    y: Math.max(0, Math.round(e.y / i)),
    w: Math.max(1, Math.round((e.w + a.gap) / (l + a.gap))),
    h: Math.max(1, Math.round((e.h + a.gap) / i))
  };
}
function Vn(e, t, a, l) {
  const i = Fe(a, l.cols, l.gap);
  return {
    dx: Math.round(e / (i + l.gap)),
    dy: Math.round(t / (l.rowHeight + l.gap))
  };
}
function Ia(e, t) {
  return t === "x" ? [e.x, e.x + e.w / 2, e.x + e.w] : [e.y, e.y + e.h / 2, e.y + e.h];
}
function Jl(e, t, a, l = a.snapThreshold) {
  if (l <= 0) return { x: e.x, y: e.y, guides: [] };
  const i = [], r = { x: e.x, y: e.y };
  for (const o of ["x", "y"]) {
    const s = o === "x" ? e.w : e.h, u = o === "x" ? a.width : a.height, d = [
      { value: 0, source: "canvas" },
      { value: u / 2, source: "canvas" },
      { value: u, source: "canvas" }
    ];
    for (const p of t)
      if (p.id !== e.id)
        for (const b of Ia(p, o)) d.push({ value: b, source: "node" });
    const c = [0, s / 2, s];
    let v = null;
    for (const p of c) {
      const b = r[o] + p;
      for (const D of d) {
        const A = D.value - b;
        Math.abs(A) <= l && (!v || Math.abs(A) < Math.abs(v.delta)) && (v = { delta: A, position: D.value, source: D.source });
      }
    }
    v && (r[o] += v.delta, i.push({ axis: o, position: v.position, source: v.source }));
  }
  return { x: Math.round(r.x), y: Math.round(r.y), guides: i };
}
function En(e, t, a, l, i = l.snapThreshold) {
  const r = e.x + e.w, o = e.y + e.h, s = { ...e }, u = (c, v) => {
    if (i <= 0) return c;
    const p = v === "x" ? l.width : l.height, b = [0, p / 2, p];
    for (const A of a)
      A.id !== e.id && b.push(...Ia(A, v));
    let D = null;
    for (const A of b)
      Math.abs(A - c) <= i && (D === null || Math.abs(A - c) < Math.abs(D - c)) && (D = A);
    return D === null ? c : D;
  };
  if (t.includes("e") && (s.w = u(r, "x") - e.x), t.includes("s") && (s.h = u(o, "y") - e.y), t.includes("w")) {
    const c = u(e.x, "x");
    s.x = c, s.w = r - c;
  }
  if (t.includes("n")) {
    const c = u(e.y, "y");
    s.y = c, s.h = o - c;
  }
  const d = qe(s);
  return t.includes("w") && (d.x = r - d.w), t.includes("n") && (d.y = o - d.h), qe(d, { maxX: l.width, maxY: l.height });
}
const Xl = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
function Ot(e, t, a, l) {
  const i = { ...e };
  return t.includes("e") && (i.w = e.w + a), t.includes("s") && (i.h = e.h + l), t.includes("w") && (i.x = e.x + a, i.w = e.w - a), t.includes("n") && (i.y = e.y + l, i.h = e.h - l), i;
}
const Zl = {
  grid: "vui-tpl-grid",
  absolute: "vui-tpl-canvas"
}, be = (e) => typeof e == "number" ? `${e}px` : void 0;
function Ql(e, t) {
  return e === "grid" ? {
    "--vui-tpl-cols": String(t.cols),
    "--vui-tpl-row-height": be(t.rowHeight),
    "--vui-tpl-gap": be(t.gap)
  } : {
    "--vui-tpl-canvas-width": be(t.width),
    "--vui-tpl-canvas-height": be(t.height)
  };
}
function en(e, t) {
  var l, i;
  if (t === "grid") {
    if (!((l = e.layout) != null && l.grid)) return;
    const r = {};
    for (const o of Ba) {
      const s = Ue(e.layout, o);
      s && (r[`--vui-tpl-col-${o}`] = `${s.x + 1} / span ${s.w}`, r[`--vui-tpl-row-${o}`] = `${s.y + 1} / span ${s.h}`);
    }
    return r;
  }
  const a = (i = e.layout) == null ? void 0 : i.absolute;
  if (a)
    return {
      left: be(a.x),
      top: be(a.y),
      width: be(a.w),
      height: be(a.h),
      minWidth: be(a.minW),
      maxWidth: be(a.maxW),
      minHeight: be(a.minH),
      maxHeight: be(a.maxH)
    };
}
function tn(e) {
  return e && typeof e == "object" && e.__expression === !0;
}
function ct(e, t, a) {
  try {
    if (Wa(e)) return Ua(t, e);
    if (a !== "trusted") throw new Error("不可信模板不能执行动态表达式");
    const l = Object.keys(t), i = l.map((o) => t[o]);
    return new Function(...l, `return ${e}`)(...i);
  } catch (l) {
    console.warn(`表达式解析失败: ${e}`, l);
    return;
  }
}
function Oe(e, t, a) {
  if (tn(e))
    return ct(e.expr, t, a);
  if (typeof e == "string" && e.startsWith("{{") && e.endsWith("}}")) {
    const l = e.slice(2, -2).trim();
    return ct(l, t, a);
  }
  if (Array.isArray(e))
    return e.map((l) => Oe(l, t, a));
  if (typeof e == "object" && e !== null) {
    const l = {};
    for (const i of Object.keys(e))
      l[i] = Oe(e[i], t, a);
    return l;
  }
  return e;
}
function an(e, t, a) {
  return async (l) => {
    var s, u, d, c, v, p, b, D, A, f, x, B;
    const { action: i, params: r, handler: o } = e;
    switch (i) {
      case "setValue":
        typeof (r == null ? void 0 : r.field) == "string" && Ft(r.field) && (t.formData[r.field] = r.value ?? l);
        break;
      case "getData":
        r != null && r.dataSourceId && ((u = (s = t.methods).loadData) == null || u.call(s, r.dataSourceId));
        break;
      case "submit":
        await ((c = (d = t.methods).submit) == null ? void 0 : c.call(d));
        break;
      case "validate":
        await ((p = (v = t.methods).validate) == null ? void 0 : p.call(v));
        break;
      case "reset":
        (D = (b = t.methods).reset) == null || D.call(b);
        break;
      case "navigate":
        r != null && r.url && (window.location.href = r.url);
        break;
      case "showModal":
        (f = (A = t.methods).showModal) == null || f.call(A, r);
        break;
      case "closeModal":
        (B = (x = t.methods).closeModal) == null || B.call(x, r);
        break;
      case "custom":
        if (o && a === "trusted")
          try {
            await new Function("context", "event", o)(t, l);
          } catch (h) {
            console.error("自定义事件处理失败:", h);
          }
        break;
    }
  };
}
const kt = {};
function An(e, t) {
  kt[e] = t;
}
function ln(e) {
  Object.assign(kt, e);
}
const Ct = H({
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
    const l = P(() => e.config.trustLevel || "untrusted"), i = P(() => lt(e.template, {
      trustLevel: l.value,
      allowedApiOrigins: e.config.allowedApiOrigins
    })), r = Et({ ...e.modelValue }), o = I({}), s = Et({}), u = {
      formData: r,
      globalData: e.globalData,
      refs: o.value,
      methods: {},
      computed: { dataSources: s },
      hooks: {}
    };
    me(r, (f) => {
      t("update:modelValue", { ...f }), t("change", { ...f });
    }, { deep: !0 }), me(() => e.modelValue, (f) => {
      Object.keys(r).forEach((x) => {
        x in f || delete r[x];
      }), At(r, f);
    }, { deep: !0 });
    const d = () => {
      var B;
      const f = ((B = e.template.formConfig) == null ? void 0 : B.initialValues) || {}, x = (h) => {
        var M;
        if (h.type === "form-item" && ((M = h.props) != null && M.field)) {
          const N = h.props.field;
          r[N] === void 0 && (r[N] = h.props.defaultValue ?? f[N] ?? "");
        }
        h.children && h.children.forEach(x), h.slots && Object.values(h.slots).flat().forEach(x);
      };
      x(e.template.root);
    }, c = (f, x, B) => {
      const h = f != null && f.targetId ? o.value[f.targetId] : void 0;
      if (typeof (h == null ? void 0 : h[x]) == "function") h[x](f);
      else {
        const M = typeof (f == null ? void 0 : f.field) == "string" ? f.field : "modalVisible";
        Ft(M) && (r[M] = B);
      }
    };
    u.methods = {
      submit: async () => {
        t("submit", { ...r });
      },
      validate: async () => {
        const f = o.value[e.template.root.id];
        try {
          const x = typeof (f == null ? void 0 : f.validate) == "function" ? await f.validate() : !0;
          return t("validate", !0), x;
        } catch (x) {
          throw t("validate", !1, x), x;
        }
      },
      reset: () => {
        Object.keys(r).forEach((f) => {
          delete r[f];
        }), d(), t("reset");
      },
      showModal: (f) => c(f, "open", !0),
      closeModal: (f) => c(f, "close", !1),
      loadData: async (f) => {
        var h, M;
        if (!i.value.valid)
          throw new Error("模板未通过安全校验，不能加载数据源");
        const x = (h = e.template.dataSources) == null ? void 0 : h.find((N) => N.id === f);
        if (!x) throw new Error(`数据源不存在: ${f}`);
        let B;
        if (x.type === "static")
          B = x.data;
        else if (x.type === "function" && x.handler && l.value === "trusted")
          B = await new Function("context", x.handler)(u);
        else if (x.type === "api" && x.api) {
          const N = x.api.method || "GET", j = new URL(x.api.url, (M = globalThis.location) == null ? void 0 : M.href), G = { method: N, headers: x.api.headers };
          N === "GET" ? Object.entries(x.api.params || {}).forEach(([oe, ne]) => {
            ne != null && j.searchParams.set(oe, String(ne));
          }) : x.api.params && (G.body = JSON.stringify(x.api.params), G.headers = { "Content-Type": "application/json", ...x.api.headers });
          const K = await fetch(j, G);
          if (!K.ok) throw new Error(`数据源请求失败: ${K.status}`);
          B = (K.headers.get("content-type") || "").includes("application/json") ? await K.json() : await K.text();
        }
        return s[f] = B, B;
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
      setFormData: (f) => {
        At(r, f);
      }
    }), ve(() => {
      var f, x, B, h, M;
      if (!i.value.valid) {
        const N = new Error(i.value.diagnostics.map((j) => j.message).join(`
`));
        (x = (f = e.config).onError) == null || x.call(f, N, e.template.root);
        return;
      }
      d(), (B = e.template.dataSources) == null || B.filter((N) => N.autoLoad).forEach((N) => u.methods.loadData(N.id).catch((j) => {
        var G, K;
        (K = (G = e.config).onError) == null || K.call(G, j instanceof Error ? j : new Error(String(j)), e.template.root);
      })), (M = (h = u.hooks).mounted) == null || M.call(h);
    }), Ha(() => {
      var f, x;
      (x = (f = u.hooks).unmounted) == null || x.call(f);
    });
    const v = P(() => st(e.template.canvas)), p = (f) => f.layoutMode || (f === e.template.root ? e.template.layoutMode : void 0) || "flow", b = (f, x, B) => {
      const h = x === "grid" ? "vui-tpl-cell" : "vui-tpl-abs", M = en(f, x);
      return n(
        "div",
        {
          key: `cell-${f.id}`,
          class: M ? h : [h, "is-auto"],
          style: M,
          "data-node-id": f.id
        },
        [B]
      );
    }, D = (f, x = u, B) => {
      if (f.condition && !(typeof f.condition == "string" ? ct(f.condition, { formData: x.formData, dataSources: s, ...e.globalData }, l.value) : Oe(f.condition, { formData: x.formData, dataSources: s, ...e.globalData }, l.value)))
        return null;
      if (f.loop) {
        const h = typeof f.loop.data == "string" ? ct(f.loop.data, { formData: x.formData, dataSources: s, ...e.globalData }, l.value) : Oe(f.loop.data, { formData: x.formData, dataSources: s, ...e.globalData }, l.value);
        return Array.isArray(h) ? n(
          "div",
          { key: `loop-${f.id}` },
          h.map((M, N) => {
            const j = {
              ...u,
              formData: {
                ...r,
                [f.loop.item]: M,
                [f.loop.index || "index"]: N
              }
            };
            return A(f, j);
          })
        ) : null;
      }
      return A(f, x, B);
    }, A = (f, x, B) => {
      var T, $, _, F, X;
      const h = {};
      if (f.props)
        for (const [J, Q] of Object.entries(f.props))
          h[J] = Oe(Q, { formData: x.formData, dataSources: s, ...e.globalData }, l.value);
      f.type === "form" && (h.model = x.formData, h.rules ?? (h.rules = (T = e.template.formConfig) == null ? void 0 : T.rules), h.layout ?? (h.layout = ($ = e.template.formConfig) == null ? void 0 : $.layout), h.labelWidth ?? (h.labelWidth = (_ = e.template.formConfig) == null ? void 0 : _.labelWidth));
      const M = {};
      if (f.events)
        for (const [J, Q] of Object.entries(f.events)) {
          const w = `on${J.charAt(0).toUpperCase()}${J.slice(1)}`;
          M[w] = an(Q, x, l.value);
        }
      B && (h.modelValue = x.formData[B], M["onUpdate:modelValue"] = (J) => {
        x.formData[B] = J;
      }), f.type === "form-item" && h.field && h.prop === void 0 && (h.prop = h.field);
      const N = f.style ? Oe(f.style, { formData: x.formData, dataSources: s }, l.value) : void 0, j = f.className ? Oe(f.className, { formData: x.formData, dataSources: s }, l.value) : void 0, G = p(f), K = G !== "flow", te = K ? [j, Zl[G]].filter(Boolean) : j, oe = K ? { ...N, ...Ql(G, v.value) } : N, ne = ((F = e.config.componentMap) == null ? void 0 : F[f.type]) || kt[f.type];
      if ((X = e.config.customRenderers) != null && X[f.type])
        return e.config.customRenderers[f.type](f, x);
      const se = ne || "div";
      let C;
      if (f.slots) {
        C = {};
        for (const [J, Q] of Object.entries(f.slots))
          C[J] = () => Q.map((w) => D(w, x)).filter(Boolean);
      } else if (f.children) {
        const J = f.type === "form-item" ? h.field : void 0, Q = f.children.map((w, k) => {
          const m = D(w, x, k === 0 ? J : void 0);
          return m ? K ? b(w, G, m) : m : null;
        }).filter(Boolean);
        C = typeof se == "string" ? Q : { default: () => Q };
      }
      if (C === void 0 && (h.text !== void 0 || h.content !== void 0)) {
        const J = String(h.text ?? h.content);
        C = typeof se == "string" ? J : { default: () => J };
      }
      return n(
        se,
        {
          ...h,
          ...M,
          style: oe,
          class: te,
          ref: (J) => {
            f.id && (o.value[f.id] = J);
          }
        },
        C
      );
    };
    return () => {
      if (!i.value.valid)
        return n(
          "div",
          { class: ["vui-alert", "is-error"], role: "alert" },
          i.value.diagnostics.map((B) => `${B.code}: ${B.message}`).join("；")
        );
      const f = e.template.root;
      if (!f) return null;
      if (f.type === "form")
        return D(f);
      const x = D(f);
      return n("div", { class: "vui-template-container" }, x || void 0);
    };
  }
}), Dn = H({
  name: "FormTemplateRenderer",
  props: {
    template: { type: Object, required: !0 },
    modelValue: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: !1 }
  },
  emits: ["update:modelValue", "submit", "validate", "reset"],
  setup(e, { emit: t, expose: a }) {
    const l = I();
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
    }), () => n(Ct, {
      ref: l,
      template: e.template,
      modelValue: e.modelValue,
      "onUpdate:modelValue": (i) => t("update:modelValue", i),
      onSubmit: (i) => t("submit", i),
      onValidate: (i, r) => t("validate", i, r),
      onReset: () => t("reset")
    });
  }
}), Mn = H({
  name: "CardTemplateRenderer",
  props: {
    template: { type: Object, required: !0 },
    data: { type: Object, default: () => ({}) }
  },
  setup(e) {
    return () => n(Ct, {
      template: e.template,
      globalData: e.data,
      preview: !0
    });
  }
});
let Bt = 0;
function xe() {
  var e;
  return typeof ((e = globalThis.crypto) == null ? void 0 : e.randomUUID) == "function" ? globalThis.crypto.randomUUID().replace(/-/g, "") : (Bt += 1, `${Date.now().toString(36)}${Bt.toString(36)}${Math.random().toString(36).slice(2, 10)}`);
}
const Pa = [
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
], _a = {
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
function Nn(e, t) {
  const a = xe(), l = {
    form: {
      id: xe(),
      type: "form",
      props: { layout: "vertical", labelWidth: "100px" },
      children: [],
      meta: { label: "表单", icon: "form" }
    },
    card: {
      id: xe(),
      type: "card",
      props: { title: t },
      children: [],
      meta: { label: "卡片", icon: "app" }
    },
    list: {
      id: xe(),
      type: "container",
      children: [],
      meta: { label: "列表容器", icon: "package" }
    },
    page: {
      id: xe(),
      type: "container",
      children: [],
      meta: { label: "页面", icon: "file" }
    },
    custom: {
      id: xe(),
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
function ht(e, t) {
  var r;
  const a = ((r = _a[e]) == null ? void 0 : r.reduce((o, s) => (s.defaultValue !== void 0 && (o[s.name] = s.defaultValue), o), {})) || {}, l = Pa.flatMap((o) => o.components).find((o) => o.type === e), i = e === "form-item" ? [ht("input")] : [];
  return {
    id: xe(),
    type: e,
    props: { ...a, ...t },
    children: i,
    meta: {
      label: (l == null ? void 0 : l.label) || e,
      icon: l == null ? void 0 : l.icon
    }
  };
}
function Ve(e, t) {
  if (e.id === t) return e;
  if (e.children)
    for (const a of e.children) {
      const l = Ve(a, t);
      if (l) return l;
    }
  if (e.slots)
    for (const a of Object.values(e.slots))
      for (const l of a) {
        const i = Ve(l, t);
        if (i) return i;
      }
  return null;
}
function bt(e, t) {
  if (e.children)
    for (const a of e.children) {
      if (a.id === t) return e;
      const l = bt(a, t);
      if (l) return l;
    }
  if (e.slots)
    for (const a of Object.values(e.slots))
      for (const l of a) {
        if (l.id === t) return e;
        const i = bt(l, t);
        if (i) return i;
      }
  return null;
}
function Lt(e, t = !1) {
  const a = JSON.parse(JSON.stringify(e));
  if (t) {
    const l = (i) => {
      var r;
      i.id = xe(), (r = i.children) == null || r.forEach(l), Object.values(i.slots || {}).flat().forEach(l);
    };
    l(a);
  }
  return a;
}
function $n(e) {
  return JSON.stringify(e, null, 2);
}
function Tn(e) {
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
const et = { x: 0, y: 0, w: 12, h: 1 }, ze = { x: 24, y: 24, w: 320, h: 38 }, tt = (e) => JSON.parse(JSON.stringify(e));
function nn(e, t = {}) {
  const a = t.historyLimit ?? 100, l = I(tt(e)), i = I([]), r = I("lg"), o = I([]), s = I([]), u = I([]);
  let d = 0;
  const c = P(() => o.value.length > 0), v = P(() => s.value.length > 0), p = P(() => u.value.length > 0), b = P(
    () => {
      var S;
      return ((S = l.value.root) == null ? void 0 : S.layoutMode) || l.value.layoutMode || "flow";
    }
  );
  function D() {
    o.value.push(tt(l.value)), o.value.length > a && o.value.shift(), s.value = [];
  }
  function A(S) {
    d === 0 && D(), S();
  }
  function f() {
    d === 0 && D(), d++;
  }
  function x() {
    d = Math.max(0, d - 1);
  }
  function B(S) {
    f();
    try {
      S();
    } finally {
      x();
    }
  }
  function h() {
    const S = o.value.pop();
    S && (s.value.push(tt(l.value)), l.value = S, N());
  }
  function M() {
    const S = s.value.pop();
    S && (o.value.push(tt(l.value)), l.value = S, N());
  }
  function N() {
    i.value = i.value.filter((S) => Ve(l.value.root, S));
  }
  function j(S, z = {}) {
    if (!S) {
      i.value = [];
      return;
    }
    if (!z.additive) {
      i.value = [S];
      return;
    }
    i.value = i.value.includes(S) ? i.value.filter((U) => U !== S) : [...i.value, S];
  }
  const G = () => {
    var S;
    i.value = (((S = l.value.root) == null ? void 0 : S.children) || []).map((z) => z.id);
  }, K = () => {
    i.value = [];
  }, te = (S) => i.value.includes(S);
  function oe(S) {
    return bt(l.value.root, S);
  }
  function ne(S, z) {
    z !== "flow" && (S.layout = S.layout || {}, z === "grid" && !S.layout.grid && (S.layout.grid = { ...et }), z === "absolute" && !S.layout.absolute && (S.layout.absolute = { ...ze }));
  }
  function se(S, z) {
    A(() => {
      const U = z ? Ve(l.value.root, z) : l.value.root;
      if (!U) return;
      U.children = U.children || [];
      const le = U.layoutMode || (U === l.value.root ? l.value.layoutMode : void 0) || "flow";
      ne(S, le), U.children.push(S), i.value = [S.id], le === "grid" && J(U, S.id);
    });
  }
  function C(S) {
    A(() => {
      const z = oe(S);
      z != null && z.children && (z.children = z.children.filter((U) => U.id !== S), i.value = i.value.filter((U) => U !== S));
    });
  }
  function T() {
    i.value.length && B(() => {
      for (const S of [...i.value]) C(S);
      i.value = [];
    });
  }
  function $(S, z) {
    A(() => {
      const U = Ve(l.value.root, S);
      U && Object.assign(U, z);
    });
  }
  function _(S, z) {
    A(() => {
      const U = Ve(l.value.root, S);
      U && (U.props = { ...U.props, ...z });
    });
  }
  function F(S, z) {
    var U;
    if (z === "grid") return Ue(S.layout, r.value);
    if (z === "absolute") return (U = S.layout) == null ? void 0 : U.absolute;
  }
  function X(S) {
    const z = oe(S) || l.value.root, U = z.layoutMode || (z === l.value.root ? l.value.layoutMode : void 0) || "flow";
    return (z.children || []).map((le) => {
      const W = F(le, U);
      return W ? { id: le.id, ...W } : null;
    }).filter(Boolean);
  }
  function J(S, z) {
    const U = (S.children || []).map((W) => {
      const ae = Ue(W.layout, r.value);
      return ae ? { id: W.id, ...ae } : null;
    }).filter(Boolean);
    if (U.length < 2) return;
    const le = Gl(U, z);
    for (const W of le) {
      const ae = (S.children || []).find((g) => g.id === W.id);
      ae && Q(ae, { y: W.y }, "grid");
    }
  }
  function Q(S, z, U) {
    if (S.layout = S.layout || {}, U === "absolute") {
      S.layout.absolute = { ...ze, ...S.layout.absolute, ...z };
      return;
    }
    if (U === "grid") {
      if (r.value === "lg") {
        S.layout.grid = { ...et, ...S.layout.grid, ...z };
        return;
      }
      S.layout.breakpoints = S.layout.breakpoints || {}, S.layout.breakpoints[r.value] = {
        ...S.layout.breakpoints[r.value],
        ...z
      };
    }
  }
  function w(S, z, U = {}) {
    A(() => {
      const le = Ve(l.value.root, S);
      if (!le) return;
      const W = oe(S) || l.value.root, ae = W.layoutMode || (W === l.value.root ? l.value.layoutMode : void 0) || "flow";
      if (ae === "flow") return;
      const g = st(l.value.canvas), V = F(le, ae) || (ae === "grid" ? et : ze), Z = ae === "grid" ? { maxX: g.cols } : { maxX: g.width, maxY: g.height }, ee = qe({ ...V, ...z }, Z);
      Q(le, ee, ae), ae === "grid" && (U.resolveCollision ?? !0) && J(W, S);
    });
  }
  function k(S, z) {
    i.value.length && B(() => {
      for (const U of i.value) {
        const le = Ve(l.value.root, U);
        if (!le) continue;
        const W = oe(U) || l.value.root, ae = W.layoutMode || (W === l.value.root ? l.value.layoutMode : void 0) || "flow", g = F(le, ae);
        g && w(U, { x: g.x + S, y: g.y + z });
      }
    });
  }
  function m() {
    u.value = i.value.map((S) => Ve(l.value.root, S)).filter(Boolean).map((S) => Lt(S));
  }
  function R() {
    m(), T();
  }
  function y() {
    u.value.length && B(() => {
      var z, U;
      const S = [];
      for (const le of u.value) {
        const W = Lt(le, !0);
        W.id = W.id || xe();
        const ae = b.value;
        ae === "grid" && ((z = W.layout) != null && z.grid) ? W.layout.grid = { ...W.layout.grid, y: W.layout.grid.y + 1 } : ae === "absolute" && ((U = W.layout) != null && U.absolute) && (W.layout.absolute = {
          ...W.layout.absolute,
          x: W.layout.absolute.x + 16,
          y: W.layout.absolute.y + 16
        }), se(W), S.push(W.id);
      }
      i.value = S;
    });
  }
  function E() {
    m(), y();
  }
  function O() {
    b.value === "grid" && A(() => {
      const S = l.value.root, z = (S.children || []).map((U) => {
        const le = Ue(U.layout, r.value);
        return le ? { id: U.id, ...le } : null;
      }).filter(Boolean);
      for (const U of ql(z)) {
        const le = (S.children || []).find((W) => W.id === U.id);
        le && Q(le, { y: U.y }, "grid");
      }
    });
  }
  function q(S) {
    A(() => {
      var le;
      if (l.value.layoutMode = S, l.value.root && (l.value.root.layoutMode = S), S === "flow") return;
      const z = st(l.value.canvas);
      let U = 0;
      for (const W of ((le = l.value.root) == null ? void 0 : le.children) || []) {
        if (W.layout = W.layout || {}, S === "absolute" && !W.layout.absolute) {
          const ae = W.layout.grid;
          if (ae) {
            const g = La(ae, z.width, z);
            W.layout.absolute = {
              x: Math.round(g.left),
              y: Math.round(g.top),
              w: Math.round(g.width),
              h: Math.round(g.height)
            };
          } else
            W.layout.absolute = { ...ze, y: ze.y + U * 56 };
        }
        if (S === "grid" && !W.layout.grid) {
          const ae = W.layout.absolute;
          W.layout.grid = ae ? Yl(ae, z.width, z) : { ...et, y: U };
        }
        U++;
      }
    });
  }
  return {
    template: l,
    selection: i,
    breakpoint: r,
    canUndo: c,
    canRedo: v,
    layoutMode: b,
    hasClipboard: p,
    select: j,
    selectAll: G,
    clearSelection: K,
    isSelected: te,
    addNode: se,
    removeNode: C,
    removeSelected: T,
    updateNode: $,
    updateProps: _,
    updateGeometry: w,
    nudgeSelected: k,
    copy: m,
    cut: R,
    paste: y,
    duplicate: E,
    undo: h,
    redo: M,
    transaction: B,
    beginBatch: f,
    endBatch: x,
    compact: O,
    setLayoutMode: q,
    siblingRects: X
  };
}
const It = 3, rn = H({
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
    const a = nn(e.modelValue), l = I("props"), i = I([]), r = I(null), o = I(0), s = P(() => st(a.template.value.canvas)), u = P(() => a.layoutMode.value), d = P(() => {
      var w;
      return ((w = a.template.value.root) == null ? void 0 : w.children) || [];
    });
    let c = null;
    me(
      a.template,
      (w) => {
        c = w, t("update:modelValue", w);
      },
      { deep: !0 }
    ), me(
      () => e.modelValue,
      (w) => {
        w && w !== c && (a.template.value = JSON.parse(JSON.stringify(w)), a.clearSelection());
      }
    ), me(a.selection, (w) => t("select", w));
    let v = null;
    const p = () => {
      r.value && (o.value = r.value.clientWidth);
    };
    ve(() => {
      p(), typeof ResizeObserver < "u" && r.value && (v = new ResizeObserver(p), v.observe(r.value)), window.addEventListener("keydown", j);
    }), ge(() => {
      v == null || v.disconnect(), window.removeEventListener("keydown", j);
    });
    const b = (w) => {
      var k;
      return u.value === "grid" ? Ue(w.layout, a.breakpoint.value) : (k = w.layout) == null ? void 0 : k.absolute;
    }, D = (w) => {
      const k = b(w);
      return k ? u.value === "absolute" ? { left: k.x, top: k.y, width: k.w, height: k.h } : o.value ? La(k, o.value, s.value) : null : null;
    }, A = (w) => d.value.filter((k) => k.id !== w).map((k) => {
      const m = b(k);
      return m ? { id: k.id, ...m } : null;
    }).filter(Boolean), f = () => !e.readonly && u.value !== "flow";
    function x(w, k, m) {
      const R = w.clientX, y = w.clientY;
      let E = !1;
      const O = (S) => {
        const z = S.clientX - R, U = S.clientY - y;
        !E && Math.abs(z) < It && Math.abs(U) < It || (E || (E = !0, a.beginBatch()), k(z, U));
      }, q = () => {
        E && a.endBatch(), i.value = [], window.removeEventListener("pointermove", O), window.removeEventListener("pointerup", q);
      };
      window.addEventListener("pointermove", O), window.addEventListener("pointerup", q);
    }
    function B(w, k) {
      if (!f()) return;
      const m = b(k);
      !m || m.static || (w.preventDefault(), x(w, (R, y) => {
        if (u.value === "grid") {
          const q = Fe(o.value, s.value.cols, s.value.gap) + s.value.gap, S = s.value.rowHeight + s.value.gap;
          a.updateGeometry(k.id, {
            x: m.x + Math.round(R / q),
            y: Math.max(0, m.y + Math.round(y / S))
          });
          return;
        }
        const E = { id: k.id, ...m, x: m.x + R, y: m.y + y }, O = Jl(E, A(k.id), s.value);
        i.value = O.guides, a.updateGeometry(k.id, { x: O.x, y: O.y });
      }));
    }
    function h(w, k, m) {
      if (!f()) return;
      const R = b(k);
      !R || R.static || (w.preventDefault(), w.stopPropagation(), x(w, (y, E) => {
        if (u.value === "grid") {
          const q = Fe(o.value, s.value.cols, s.value.gap) + s.value.gap, S = s.value.rowHeight + s.value.gap, z = Ot(R, m, Math.round(y / q), Math.round(E / S));
          a.updateGeometry(k.id, qe(z, { maxX: s.value.cols }));
          return;
        }
        const O = Ot(R, m, y, E);
        a.updateGeometry(
          k.id,
          qe(O, { maxX: s.value.width, maxY: s.value.height })
        );
      }));
    }
    let M = null;
    function N(w) {
      var R;
      if (w.preventDefault(), !M || e.readonly) return;
      const k = ht(M), m = (R = r.value) == null ? void 0 : R.getBoundingClientRect();
      if (m && u.value !== "flow") {
        const y = w.clientX - m.left, E = w.clientY - m.top;
        if (k.layout = k.layout || {}, u.value === "grid") {
          const O = Fe(o.value, s.value.cols, s.value.gap) + s.value.gap;
          k.layout.grid = {
            x: Math.max(0, Math.floor(y / O)),
            y: Math.max(0, Math.floor(E / (s.value.rowHeight + s.value.gap))),
            w: 6,
            h: 1
          };
        } else
          k.layout.absolute = { x: Math.round(y), y: Math.round(E), w: 320, h: 38 };
      }
      a.addNode(k), M = null;
    }
    function j(w) {
      const k = w.target;
      if (k && /^(INPUT|TEXTAREA|SELECT)$/.test(k.tagName) || e.readonly) return;
      const m = w.ctrlKey || w.metaKey;
      if (m && w.key.toLowerCase() === "z") {
        w.preventDefault(), w.shiftKey ? a.redo() : a.undo();
        return;
      }
      if (m && w.key.toLowerCase() === "y") {
        w.preventDefault(), a.redo();
        return;
      }
      if (m && w.key.toLowerCase() === "c") return a.copy();
      if (m && w.key.toLowerCase() === "x") return a.cut();
      if (m && w.key.toLowerCase() === "v") return a.paste();
      if (m && w.key.toLowerCase() === "d")
        return w.preventDefault(), a.duplicate();
      if (m && w.key.toLowerCase() === "a")
        return w.preventDefault(), a.selectAll();
      if (w.key === "Delete" || w.key === "Backspace")
        return a.selection.value.length ? (w.preventDefault(), a.removeSelected()) : void 0;
      const y = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      }[w.key];
      if (y && a.selection.value.length) {
        w.preventDefault();
        const E = u.value === "absolute" && w.shiftKey ? 10 : 1;
        a.nudgeSelected(y[0] * E, y[1] * E);
      }
    }
    function G() {
      const w = Pa.filter(
        (k) => !e.categories || e.categories.includes(k.name)
      );
      return n("aside", { class: "vui-tpl-editor-palette" }, [
        n("div", { class: "vui-tpl-editor-panel-title" }, "组件"),
        ...w.map(
          (k) => n("div", { class: "vui-tpl-editor-group", key: k.name }, [
            n("div", { class: "vui-tpl-editor-group-title" }, k.name),
            n(
              "div",
              { class: "vui-tpl-editor-chips" },
              k.components.map(
                (m) => n(
                  "div",
                  {
                    class: "vui-tpl-editor-chip",
                    key: m.type,
                    draggable: !e.readonly,
                    title: m.description,
                    onDragstart: () => {
                      M = m.type;
                    },
                    // 面板项也支持双击直接加进画布，比拖拽快
                    onDblclick: () => {
                      e.readonly || a.addNode(ht(m.type));
                    }
                  },
                  m.label
                )
              )
            )
          ])
        )
      ]);
    }
    function K(w, k, m = {}) {
      return n(
        "button",
        {
          type: "button",
          class: ["vui-tpl-editor-tool", m.active ? "is-active" : ""],
          disabled: m.disabled || !1,
          title: m.title || w,
          onClick: k
        },
        w
      );
    }
    function te() {
      const w = [
        ["flow", "流式"],
        ["grid", "栅格"],
        ["absolute", "自由"]
      ], k = ["lg", "md", "sm"];
      return n("div", { class: "vui-tpl-editor-toolbar" }, [
        K("撤销", a.undo, { disabled: !a.canUndo.value, title: "撤销 (Ctrl+Z)" }),
        K("重做", a.redo, { disabled: !a.canRedo.value, title: "重做 (Ctrl+Shift+Z)" }),
        n("span", { class: "vui-tpl-editor-sep" }),
        K("复制", a.copy, { disabled: !a.selection.value.length, title: "复制 (Ctrl+C)" }),
        K("粘贴", a.paste, { disabled: !a.hasClipboard.value, title: "粘贴 (Ctrl+V)" }),
        K("删除", a.removeSelected, { disabled: !a.selection.value.length, title: "删除 (Delete)" }),
        n("span", { class: "vui-tpl-editor-sep" }),
        ...w.map(
          ([m, R]) => K(R, () => a.setLayoutMode(m), {
            active: u.value === m,
            title: `切换到${R}布局`
          })
        ),
        n("span", { class: "vui-tpl-editor-sep" }),
        // 断点只对栅格有意义：自由画布是固定像素，没有响应式可言
        ...k.map(
          (m) => K(m.toUpperCase(), () => a.breakpoint.value = m, {
            active: a.breakpoint.value === m,
            disabled: u.value !== "grid",
            title: u.value === "grid" ? `编辑 ${m} 断点的布局` : "仅栅格模式支持断点"
          })
        ),
        n("span", { class: "vui-tpl-editor-spacer" }),
        K("紧凑排列", a.compact, { disabled: u.value !== "grid", title: "把所有节点上浮填掉空行" }),
        K("保存", () => t("save", a.template.value))
      ]);
    }
    function oe(w) {
      var k;
      return e.readonly || (k = b(w)) != null && k.static ? [] : Xl.map(
        (m) => n("span", {
          class: ["vui-tpl-editor-handle", `is-${m}`],
          key: m,
          onPointerdown: (R) => h(R, w, m)
        })
      );
    }
    function ne() {
      const w = d.value.map((m) => {
        const R = D(m);
        if (!R) return null;
        const y = a.isSelected(m.id);
        return n(
          "div",
          {
            key: m.id,
            class: ["vui-tpl-editor-item", y ? "is-selected" : ""],
            style: {
              left: `${R.left}px`,
              top: `${R.top}px`,
              width: `${R.width}px`,
              height: `${R.height}px`
            },
            onPointerdown: (E) => {
              a.select(m.id, { additive: E.shiftKey || E.ctrlKey || E.metaKey }), B(E, m);
            }
          },
          y ? oe(m) : []
        );
      }).filter(Boolean), k = i.value.map(
        (m, R) => n("span", {
          key: `guide-${R}`,
          class: ["vui-tpl-editor-guide", `is-${m.axis}`],
          style: m.axis === "x" ? { left: `${m.position}px` } : { top: `${m.position}px` }
        })
      );
      return n("div", { class: "vui-tpl-editor-overlay" }, [...w, ...k]);
    }
    function se() {
      return n(
        "div",
        {
          class: "vui-tpl-editor-stage",
          onDragover: (w) => w.preventDefault(),
          onDrop: N,
          // 点空白处取消选中
          onPointerdown: (w) => {
            w.target === w.currentTarget && a.clearSelection();
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
              n(Ct, { template: a.template.value, preview: !0 }),
              u.value === "flow" ? null : ne()
            ]
          )
        ]
      );
    }
    function C() {
      return d.value.length ? n(
        "div",
        { class: "vui-tpl-editor-pane" },
        d.value.map(
          (w) => {
            var k;
            return n(
              "div",
              {
                key: w.id,
                class: ["vui-tpl-editor-layer", a.isSelected(w.id) ? "is-active" : ""],
                onClick: (m) => a.select(w.id, { additive: m.shiftKey || m.ctrlKey || m.metaKey })
              },
              `${((k = w.meta) == null ? void 0 : k.label) || w.type}`
            );
          }
        )
      ) : n("div", { class: "vui-tpl-editor-empty" }, "画布还是空的，从左侧拖一个组件进来");
    }
    function T(w, k) {
      return n("label", { class: "vui-tpl-editor-field" }, [
        n("span", { class: "vui-tpl-editor-field-label" }, w),
        k
      ]);
    }
    function $(w, k, m) {
      return T(
        w,
        n("input", {
          type: "number",
          value: k ?? "",
          onInput: (R) => {
            const y = R.target.value;
            m(y === "" ? void 0 : Number(y));
          }
        })
      );
    }
    function _(w) {
      const k = b(w);
      if (!k) return null;
      const m = u.value === "grid" ? "格 / 行" : "px", R = (y) => a.updateGeometry(w.id, y);
      return n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, `位置与尺寸（${m}）`),
        $("X", k.x, (y) => R({ x: y ?? 0 })),
        $("Y", k.y, (y) => R({ y: y ?? 0 })),
        $("宽", k.w, (y) => R({ w: y ?? 1 })),
        $("高", k.h, (y) => R({ h: y ?? 1 })),
        n("div", { class: "vui-tpl-editor-section-title" }, "尺寸限制"),
        $("最小宽", k.minW, (y) => R({ minW: y })),
        $("最大宽", k.maxW, (y) => R({ maxW: y })),
        $("最小高", k.minH, (y) => R({ minH: y })),
        $("最大高", k.maxH, (y) => R({ maxH: y })),
        T(
          "锁定",
          n("input", {
            type: "checkbox",
            checked: k.static === !0,
            onChange: (y) => R({ static: y.target.checked })
          })
        )
      ]);
    }
    function F(w) {
      const k = _a[w.type] || [];
      return k.length ? n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "组件属性"),
        ...k.map((m) => {
          var y, E;
          const R = (y = w.props) == null ? void 0 : y[m.name];
          return m.type === "boolean" ? T(
            m.label,
            n("input", {
              type: "checkbox",
              checked: !!R,
              onChange: (O) => a.updateProps(w.id, { [m.name]: O.target.checked })
            })
          ) : m.type === "select" && ((E = m.options) != null && E.length) ? T(
            m.label,
            n(
              "select",
              {
                value: R ?? "",
                onChange: (O) => a.updateProps(w.id, { [m.name]: O.target.value })
              },
              m.options.map(
                (O) => n("option", { key: String(O.value), value: O.value }, O.label)
              )
            )
          ) : T(
            m.label,
            n("input", {
              type: m.type === "number" ? "number" : "text",
              value: R ?? "",
              onInput: (O) => {
                const q = O.target.value;
                a.updateProps(w.id, { [m.name]: m.type === "number" ? Number(q) : q });
              }
            })
          );
        })
      ]) : n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "组件属性"),
        n("div", { class: "vui-tpl-editor-empty" }, "这个组件没有可配置属性")
      ]);
    }
    function X(w) {
      const k = ["click", "change", "submit"], m = ["", "submit", "validate", "reset", "setValue", "showModal", "closeModal"];
      return n("div", { class: "vui-tpl-editor-section" }, [
        n("div", { class: "vui-tpl-editor-section-title" }, "事件"),
        ...k.map(
          (R) => {
            var y, E;
            return T(
              R,
              n(
                "select",
                {
                  value: ((E = (y = w.events) == null ? void 0 : y[R]) == null ? void 0 : E.action) || "",
                  onChange: (O) => {
                    const q = O.target.value, S = { ...w.events || {} };
                    q ? S[R] = { type: R, action: q } : delete S[R], a.updateNode(w.id, { events: S });
                  }
                },
                m.map(
                  (O) => n("option", { key: O || "none", value: O }, O || "（无）")
                )
              )
            );
          }
        )
      ]);
    }
    function J() {
      var m, R;
      const w = a.selection.value[0], k = w ? d.value.find((y) => y.id === w) : void 0;
      return k ? n("div", { class: "vui-tpl-editor-pane" }, [
        n("div", { class: "vui-tpl-editor-section" }, [
          n("div", { class: "vui-tpl-editor-section-title" }, ((m = k.meta) == null ? void 0 : m.label) || k.type),
          T(
            "标注名",
            n("input", {
              type: "text",
              value: ((R = k.meta) == null ? void 0 : R.label) || "",
              onInput: (y) => a.updateNode(k.id, {
                meta: { ...k.meta, label: y.target.value }
              })
            })
          )
        ]),
        _(k),
        F(k),
        X(k)
      ].filter(Boolean)) : n("div", { class: "vui-tpl-editor-empty" }, "选中一个组件后在这里改它的属性");
    }
    function Q() {
      return n("aside", { class: "vui-tpl-editor-side" }, [
        n(
          "div",
          { class: "vui-tpl-editor-tabs" },
          [
            ["props", "属性"],
            ["layers", "图层"]
          ].map(
            ([k, m]) => n(
              "button",
              {
                type: "button",
                key: k,
                class: ["vui-tpl-editor-tab", l.value === k ? "is-active" : ""],
                onClick: () => l.value = k
              },
              m
            )
          )
        ),
        l.value === "layers" ? C() : J()
      ]);
    }
    return () => n("div", { class: "vui-tpl-editor" }, [
      G(),
      n("div", { class: "vui-tpl-editor-main" }, [te(), se()]),
      Q()
    ]);
  }
}), on = {
  msg: "msg",
  notify: "notify",
  loading: "loading",
  confirm: "confirm",
  dialog: "confirm",
  page: "confirm",
  prompt: "confirm"
};
let Pt = 0;
const dt = /* @__PURE__ */ new Map(), ft = /* @__PURE__ */ new Map(), Vt = /* @__PURE__ */ new Map();
function sn() {
  return Pt += 1, `vui-layer-${Pt}`;
}
function at(e, t, a = sn()) {
  return e.dataset.layerId = String(a), document.body.appendChild(e), dt.set(a, e), Vt.set(a, t), a;
}
function Ce(e) {
  const t = dt.get(e);
  if (!t) return;
  t.classList.add("is-leaving"), window.setTimeout(() => t.remove(), 150), dt.delete(e), Vt.delete(e);
  const a = ft.get(e);
  a && window.clearTimeout(a), ft.delete(e);
}
function un(e) {
  const t = e == null || e === "" ? null : on[String(e)];
  e != null && e !== "" && !t || Array.from(dt.keys()).forEach((a) => {
    (!t || Vt.get(a) === t) && Ce(a);
  });
}
function cn(e) {
  return e === 1 ? "check" : e === 2 ? "alert" : "info";
}
const On = {
  msg(e, t = {}, a) {
    const l = document.createElement("div");
    l.className = `vui-native-message is-icon-${t.icon || 0}`, l.setAttribute("role", "status"), l.innerHTML = '<span class="vui-native-message-icon"></span><span></span>', l.firstElementChild.innerHTML = Re(cn(t.icon)), l.lastElementChild.textContent = String(e ?? "");
    const i = at(l, "msg"), r = window.setTimeout(() => {
      Ce(i), a == null || a();
    }, Number(t.time || 2200));
    return ft.set(i, r), i;
  },
  notify(e = {}) {
    const t = document.createElement("aside");
    t.className = "vui-native-notify", t.setAttribute("role", "status");
    const a = document.createElement("strong");
    a.textContent = String(e.title || "提示");
    const l = document.createElement("div");
    l.textContent = String(e.content ?? "");
    const i = document.createElement("button");
    i.type = "button", i.setAttribute("aria-label", "关闭"), i.innerHTML = Re("close"), t.append(a, l, i);
    const r = at(t, "notify");
    i.addEventListener("click", () => Ce(r));
    const o = window.setTimeout(() => Ce(r), Number(e.time || 3600));
    return ft.set(r, o), r;
  },
  confirm(e, t = {}) {
    var d;
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
    const s = at(a, "confirm"), u = (d = t.btn) != null && d.length ? t.btn : [
      { text: "确认", callback: (c) => Ce(c) },
      { text: "取消", callback: (c) => Ce(c) }
    ];
    return u.forEach((c, v) => {
      const p = document.createElement("button");
      p.type = "button", p.className = v === 0 ? "is-primary" : "", p.textContent = c.text || (v === 0 ? "确认" : "取消"), p.addEventListener("click", () => {
        c.callback ? c.callback(s) : Ce(s);
      }), o.append(p);
    }), queueMicrotask(() => {
      var c;
      return (c = o.querySelector("button")) == null ? void 0 : c.focus();
    }), s;
  },
  load() {
    const e = document.createElement("div");
    return e.className = "vui-native-loading", e.setAttribute("role", "status"), e.innerHTML = '<span class="vui-spinner"></span><span></span>', e.lastElementChild.textContent = "正在处理…", at(e, "loading");
  },
  close(e) {
    Ce(e);
  },
  closeAll(e) {
    un(e);
  }
};
function yt(e, t) {
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
class _t extends Error {
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
function Bn(e, t, a, l, i) {
  if (i && typeof a !== i)
    throw new _t({
      code: "INVALID_PROP_TYPE",
      component: e,
      prop: t,
      received: typeof a,
      expected: i,
      message: `${e}的${t}属性类型错误`,
      suggestion: `期望类型为${i}，实际为${typeof a}`
    });
  if (l && !l.includes(a))
    throw new _t({
      code: "INVALID_PROP_VALUE",
      component: e,
      prop: t,
      received: a,
      expected: l,
      message: `${e}的${t}属性值"${a}"无效`,
      suggestion: `可选值为: ${l.join(", ")}`
    });
}
function Ln(e) {
  return {
    value: e,
    valid: !0,
    errors: [],
    dirty: !1,
    touched: !1,
    pristine: !0
  };
}
function In(e) {
  const t = `import { ref, reactive } from 'vue'
import { VForm, VFormItem, VInput, VSelect, VDatePicker, VSwitch, VInputNumber } from "@vima-tech/ui-admin"`, a = `<template>
  <VForm :model="formData" :rules="rules" @submit="handleSubmit">
${e.map((i) => {
    const r = yt(i.name, i.label), o = dn(r.type || "text");
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
    const r = yt(i.name, i.label);
    return `  ${i.name}: ${fn(r.type || "text")}`;
  }).join(`,
`)}
})

const rules = {
${e.filter((i) => yt(i.name, i.label).required).map((i) => `  ${i.name}: [{ required: true, message: '请输入${i.label}' }]`).join(`,
`)}
}

const handleSubmit = () => {
  // 在这里提交 formData；不要在生产控制台输出表单内容。
}
<\/script>`;
  return `${a}

${l}`;
}
function Pn(e) {
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
function dn(e) {
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
function fn(e) {
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
const Ge = [];
function _n(e, t, a) {
  Ge.push({
    component: e,
    props: t,
    state: a,
    timestamp: Date.now()
  }), Ge.length > 100 && Ge.shift();
}
function Fn() {
  return [...Ge];
}
function Rn() {
  Ge.length = 0;
}
const vt = [];
function jn(e, t, a) {
  const l = performance.now();
  a();
  const i = performance.now() - l;
  return vt.push({
    component: e,
    operation: t,
    duration: i,
    timestamp: Date.now()
  }), i;
}
function Kn() {
  return [...vt];
}
function Hn(e) {
  const t = e ? vt.filter((i) => i.component === e) : vt, a = {};
  for (const i of t) {
    const r = `${i.component}.${i.operation}`;
    a[r] || (a[r] = []), a[r].push(i.duration);
  }
  const l = {};
  for (const [i, r] of Object.entries(a))
    l[i] = r.reduce((o, s) => o + s, 0) / r.length;
  return l;
}
const vn = "vui-template:";
class mn {
  constructor(t = vn, a = {}) {
    this.prefix = t, this.validationOptions = a;
  }
  async save(t) {
    try {
      Me(t, this.validationOptions), t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), t.createdAt || (t.createdAt = t.updatedAt), localStorage.setItem(
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
      return Me(l, this.validationOptions), l;
    } catch (a) {
      throw new Error(`加载模板失败: ${a.message}`);
    }
  }
  async list(t) {
    var a;
    try {
      const l = [], i = Object.keys(localStorage).filter((p) => p.startsWith(this.prefix));
      for (const p of i)
        try {
          const b = localStorage.getItem(p);
          if (b) {
            const D = JSON.parse(b);
            Me(D, this.validationOptions), l.push(D);
          }
        } catch {
        }
      let r = l;
      if (t != null && t.keyword) {
        const p = t.keyword.toLowerCase();
        r = r.filter(
          (b) => {
            var D, A;
            return b.name.toLowerCase().includes(p) || ((D = b.description) == null ? void 0 : D.toLowerCase().includes(p)) || ((A = b.tags) == null ? void 0 : A.some((f) => f.toLowerCase().includes(p)));
          }
        );
      }
      t != null && t.type && (r = r.filter((p) => p.type === t.type)), (a = t == null ? void 0 : t.tags) != null && a.length && (r = r.filter(
        (p) => {
          var b;
          return (b = p.tags) == null ? void 0 : b.some((D) => t.tags.includes(D));
        }
      ));
      const o = (t == null ? void 0 : t.sortBy) || "updatedAt", s = (t == null ? void 0 : t.sortOrder) || "desc";
      r.sort((p, b) => {
        const D = p[o] || "", A = b[o] || "";
        return s === "asc" ? String(D).localeCompare(String(A)) : String(A).localeCompare(String(D));
      });
      const u = (t == null ? void 0 : t.page) || 1, d = (t == null ? void 0 : t.pageSize) || 20, c = (u - 1) * d, v = c + d;
      return r.slice(c, v);
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
      return a.id = `imported-${xe()}`, a.createdAt = (/* @__PURE__ */ new Date()).toISOString(), a.updatedAt = a.createdAt, await this.save(a), a;
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
class zn {
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
    Me(t, this.config.validation), await this.request(`/templates/${t.id}`, {
      method: "PUT",
      body: JSON.stringify(t)
    });
  }
  async load(t) {
    try {
      const a = await this.request(`/templates/${t}`);
      return Me(a, this.config.validation), a;
    } catch {
      return null;
    }
  }
  async list(t) {
    const a = new URLSearchParams();
    t != null && t.page && a.set("page", String(t.page)), t != null && t.pageSize && a.set("pageSize", String(t.pageSize)), t != null && t.keyword && a.set("keyword", t.keyword), t != null && t.type && a.set("type", t.type), t != null && t.tags && a.set("tags", t.tags.join(",")), t != null && t.sortBy && a.set("sortBy", t.sortBy), t != null && t.sortOrder && a.set("sortOrder", t.sortOrder);
    const l = await this.request(`/templates?${a.toString()}`);
    if (!Array.isArray(l)) throw new Error("API 返回的模板列表格式无效");
    return l.forEach((i) => Me(i, this.config.validation)), l;
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
    Me(a, this.config.validation);
    const l = await this.request("/templates/import", {
      method: "POST",
      body: JSON.stringify(a)
    });
    return Me(l, this.config.validation), l;
  }
}
class gn {
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
    const l = lt(a);
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
    const i = lt(l);
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
    const l = await a.json(), i = lt(l.template);
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
const pn = new mn(), Wn = new gn(pn), yn = [
  Aa,
  qt,
  Qa,
  Yt,
  el,
  tl,
  Xa,
  zl,
  wt,
  zt,
  Ht,
  St,
  $a,
  Kt,
  El,
  Al,
  Rt,
  Nl,
  ra,
  va,
  ma,
  Wt,
  Va,
  xa,
  Il,
  Pl,
  Da,
  Qt,
  ea,
  qa,
  Ja,
  ie,
  ta,
  la,
  wa,
  Ya,
  Ea,
  Oa,
  ha,
  Ca,
  Ut,
  xt,
  sa,
  jt,
  ia,
  il,
  Za,
  _l,
  ba,
  Ml,
  Dl,
  oa,
  Cl,
  Vl,
  fa,
  ua,
  ca,
  Ta,
  aa,
  ka,
  ga,
  Gt,
  rn
];
ln(Ga({
  VAlert: Aa,
  VBadge: Yt,
  VButton: wt,
  VButtonGroup: zt,
  VCard: Ht,
  VCheckbox: St,
  VCheckboxGroup: $a,
  VCol: Kt,
  VContainer: Rt,
  VDatePicker: ra,
  VDescriptions: va,
  VDescriptionsItem: ma,
  VDivider: Wt,
  VDrawer: Va,
  VDropdown: xa,
  VEmpty: Da,
  VForm: Qt,
  VFormItem: ea,
  VIcon: ie,
  VInput: ta,
  VInputNumber: la,
  VLayer: wa,
  VLink: Oa,
  VLoading: Ea,
  VPagination: ha,
  VPopover: Ca,
  VProgress: Ut,
  VRadio: xt,
  VRadioGroup: sa,
  VRow: jt,
  VSelect: ia,
  VStatistic: ba,
  VSwitch: oa,
  VTable: fa,
  VTag: ua,
  VTagInput: ca,
  VTextarea: aa,
  VTimePicker: Ta,
  VTooltip: ka,
  VTree: ga,
  VUpload: Gt
}));
const Un = {
  install(e) {
    yn.forEach((t) => {
      t.name && e.component(t.name, t);
    });
  }
};
export {
  gn as AITemplateService,
  zn as ApiTemplateStorage,
  Ba as BREAKPOINTS_DESC,
  Ul as BREAKPOINT_MIN_WIDTH,
  dl as BUTTON_FRAME_WIDTH,
  fl as BUTTON_GAP,
  cl as BUTTON_MIN_WIDTH,
  vl as CELL_PADDING_X,
  bl as CHECK_COLUMN_WIDTH,
  Pa as COMPONENT_CATEGORIES,
  _a as COMPONENT_PROPS_CONFIG,
  Mn as CardTemplateRenderer,
  Wl as DEFAULT_CANVAS,
  xl as FLEXIBLE_COLUMN_MIN_WIDTH,
  Dn as FormTemplateRenderer,
  mn as LocalTemplateStorage,
  da as OPERATION_COLUMN_MIN_WIDTH,
  Xl as RESIZE_HANDLES,
  wl as TABLE_MIN_WIDTH,
  Yn as TEMPLATE_COMPONENT_NAMES,
  Jn as TEMPLATE_COMPONENT_TYPES,
  Ct as TemplateRenderer,
  _t as UIError,
  Aa as VAlert,
  qt as VAvatar,
  Qa as VAvatarGroup,
  Yt as VBadge,
  Xa as VBody,
  el as VBreadcrumb,
  tl as VBreadcrumbItem,
  wt as VButton,
  zt as VButtonGroup,
  Ht as VCard,
  St as VCheckbox,
  $a as VCheckboxGroup,
  Kt as VCol,
  El as VCollapse,
  Al as VCollapseItem,
  zl as VColumnSetting,
  Rt as VContainer,
  Nl as VCountdown,
  ra as VDatePicker,
  va as VDescriptions,
  ma as VDescriptionsItem,
  Wt as VDivider,
  Va as VDrawer,
  xa as VDropdown,
  Il as VDropdownMenu,
  Pl as VDropdownMenuItem,
  Da as VEmpty,
  Qt as VForm,
  ea as VFormItem,
  qa as VFullscreen,
  Ja as VHeader,
  ie as VIcon,
  ta as VInput,
  la as VInputNumber,
  wa as VLayer,
  Ya as VLayout,
  Oa as VLink,
  Ea as VLoading,
  ha as VPagination,
  Ca as VPopover,
  Ut as VProgress,
  xt as VRadio,
  sa as VRadioGroup,
  jt as VRow,
  ia as VSelect,
  il as VSelectOption,
  Za as VSide,
  _l as VSkeleton,
  ba as VStatistic,
  Ml as VStep,
  Dl as VSteps,
  oa as VSwitch,
  Cl as VTab,
  Vl as VTabItem,
  fa as VTable,
  ua as VTag,
  ca as VTagInput,
  rn as VTemplateEditor,
  aa as VTextarea,
  Ta as VTimePicker,
  ka as VTooltip,
  ga as VTree,
  Ye as VUI_FORM_ITEM_KEY,
  Jt as VUI_FORM_KEY,
  Xt as VUI_RADIO_KEY,
  Gt as VUpload,
  Un as VimaUiAdmin,
  Ot as applyResizeDelta,
  Me as assertValidTemplate,
  gl as buttonLabelWidth,
  pl as buttonWidth,
  Tt as clamp,
  qe as clampGeometry,
  L as classes,
  Rn as clearDebugHistory,
  Lt as cloneNode,
  Fe as colWidth,
  ut as collides,
  ql as compactGrid,
  yn as components,
  Nn as createEmptyTemplate,
  ht as createNode,
  Ln as createStandardState,
  Ga as createTemplateComponentMap,
  nn as createTemplateEditor,
  Un as default,
  Wn as defaultAIService,
  pn as defaultStorage,
  Ne as displayValue,
  $n as exportTemplate,
  kn as findCollisions,
  Ve as findNode,
  bt as findParentNode,
  In as generateFormCode,
  Pn as generateTableCode,
  Hn as getAveragePerformance,
  Fn as getDebugHistory,
  Xn as getIconNames,
  Kn as getPerformanceMetrics,
  Cn as gridHeight,
  La as gridToPixel,
  za as hasIcon,
  Re as iconSvgMarkup,
  Tn as importTemplate,
  yt as inferFieldConfig,
  _e as isEmptyValue,
  On as layer,
  _n as logComponentDebug,
  jn as measurePerformance,
  Be as mergeStyles,
  wn as message,
  xn as messageBox,
  Zn as normalizeIconName,
  yl as operationCellWidth,
  hl as operationColumnWidth,
  Sn as pickBreakpoint,
  Yl as pixelToGrid,
  Vn as pixelToGridDelta,
  An as registerComponent,
  ln as registerComponents,
  Qn as registerIcon,
  st as resolveCanvas,
  Gl as resolveGridCollisions,
  Ue as resolveGridGeometry,
  Ee as sizeToCss,
  Jl as snapPosition,
  En as snapResize,
  Sl as tableMinWidth,
  ei as templateComponentName,
  Bn as validateProp,
  lt as validateTemplate
};
