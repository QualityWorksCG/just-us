/* @ds-bundle: {"format":4,"namespace":"JustUsFinancialDesignSystem_16316f","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Brandmark","sourcePath":"components/core/Brandmark.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"ICONS","sourcePath":"components/core/Icon.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Progress","sourcePath":"components/core/Progress.jsx"},{"name":"Spinner","sourcePath":"components/core/Spinner.jsx"},{"name":"Stat","sourcePath":"components/core/Stat.jsx"},{"name":"STATUS_STYLE","sourcePath":"components/core/StatusPill.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"AIBlock","sourcePath":"components/feedback/AIBlock.jsx"},{"name":"Empty","sourcePath":"components/feedback/Empty.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"ScoreGauge","sourcePath":"components/feedback/ScoreGauge.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"PageHead","sourcePath":"components/layout/PageHead.jsx"},{"name":"SectionTitle","sourcePath":"components/layout/SectionTitle.jsx"},{"name":"Stepper","sourcePath":"components/layout/Stepper.jsx"},{"name":"SubHead","sourcePath":"components/layout/SubHead.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"742832756a6b","components/core/Brandmark.jsx":"ff05aff7e204","components/core/Button.jsx":"d9569bba55aa","components/core/Card.jsx":"008ccba5bffe","components/core/Icon.jsx":"55514e69eef4","components/core/Progress.jsx":"e98e73986384","components/core/Spinner.jsx":"aa539514da55","components/core/Stat.jsx":"e38e36a37e52","components/core/StatusPill.jsx":"664800742137","components/core/Tag.jsx":"9c60b2a8f4ef","components/feedback/AIBlock.jsx":"b2a63c669b73","components/feedback/Empty.jsx":"ed66b25693da","components/feedback/Modal.jsx":"6c578de20b00","components/feedback/ScoreGauge.jsx":"42b4d289be36","components/forms/Field.jsx":"717f75260bd4","components/forms/Input.jsx":"8b358365e4ff","components/forms/Select.jsx":"f4bf433f4d49","components/forms/Textarea.jsx":"878d1e0592e9","components/layout/PageHead.jsx":"3f627cb054d2","components/layout/SectionTitle.jsx":"0eb6593e9331","components/layout/Stepper.jsx":"77288f80d149","components/layout/SubHead.jsx":"5ebb088e9818","ui_kits/platform/app.jsx":"735e5f264652","ui_kits/platform/data.js":"76d72cb8e48e","ui_kits/platform/investor.jsx":"18c93d018d53","ui_kits/platform/landing.jsx":"db8afa1aed16"},"inlinedExternals":[],"unexposedExports":[{"name":"inputBase","sourcePath":"components/forms/Input.jsx"}]} */

(() => {

const __ds_ns = (window.JustUsFinancialDesignSystem_16316f = window.JustUsFinancialDesignSystem_16316f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function Avatar({
  initials,
  size = 38,
  tone = "ink"
}) {
  const tones = {
    ink: {
      bg: "var(--ink)",
      fg: "var(--paper)"
    },
    accent: {
      bg: "var(--accent)",
      fg: "var(--accent-ink)"
    },
    soft: {
      bg: "var(--accent-wash)",
      fg: "var(--accent-deep)"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 999,
      background: tones.bg,
      color: tones.fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: size * 0.38,
      letterSpacing: "0.02em",
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  style,
  pad = 22,
  hover,
  onClick,
  className
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: pad,
      boxShadow: h && hover ? "0 12px 30px -16px rgba(40,30,10,0.28)" : "0 1px 2px rgba(40,30,10,0.04)",
      transition: "box-shadow .18s, transform .18s, border-color .18s",
      transform: h && hover ? "translateY(-2px)" : "none",
      borderColor: h && hover ? "var(--line-strong)" : "var(--line)",
      cursor: onClick ? "pointer" : "default",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/* JustUs line-icon set — 1.5–2.4px stroke, round caps, 24-box */
const ICONS = {
  scale: "M12 3v18M5 21h14M12 6l-7 2 3 5a3 3 0 0 0 6 0l-3-5m10 0l-7-2m7 2l-3 5a3 3 0 0 1-6 0",
  gavel: "M14 5l5 5-3 3-5-5 3-3zM9 10l-6 6 2 2 6-6M14 17h7",
  shield: "M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-3z",
  briefcase: "M3 8h18v11H3zM8 8V5h8v3M3 13h18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a4 4 0 0 0 0-8M22 21a7 7 0 0 0-5-6.7",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  check: "M5 13l4 4L19 7",
  checkCircle: "M22 11.5A10 10 0 1 1 12 2M9 12l2 2 6-6",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  dollar: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9.2 9.5 12 9.5s5 1.1 5 3-2.2 3-5 3-5-1.1-5-3",
  doc: "M6 2h8l4 4v16H6zM14 2v4h4M9 13h6M9 17h6",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  alert: "M12 3l9 16H3zM12 10v4M12 17h.01",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 4v3M20.5 5.5h-3",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  building: "M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01",
  flag: "M5 21V4M5 4c3-2 6 2 9 0s6 0 6 0v9c-3 2-6-2-9 0s-6 0-6 0",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  trending: "M3 17l6-6 4 4 7-7M14 8h6v6",
  megaphone: "M3 11l14-6v14L3 13zM3 11v2a3 3 0 0 0 3 3M17 9a3 3 0 0 1 0 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 5 13.4H4.9a2 2 0 0 1 0-4H5a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 12 4.9V4a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  toggle: "M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6z",
  external: "M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  home: "M3 11l9-8 9 8M5 9v11h14V9",
  pie: "M12 2a10 10 0 1 0 10 10H12z M12 2v10h10"
};
function Icon({
  name,
  size = 18,
  stroke = 2,
  style,
  className
}) {
  const d = ICONS[name];
  if (!d) return null;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    className: className,
    "aria-hidden": "true"
  }, d.split("M").filter(Boolean).map((seg, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: "M" + seg
  })));
}
Object.assign(__ds_scope, { ICONS, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Brandmark.jsx
try { (() => {
function Brandmark({
  size = 30
}) {
  // scales-of-justice glyph on a brass tile — the JustUs mark
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: 8,
      background: "var(--accent)",
      color: "var(--accent-ink)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "scale",
    size: size * 0.6,
    stroke: 2.1
  }));
}
Object.assign(__ds_scope, { Brandmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Brandmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "7px 12px",
      fontSize: 13,
      gap: 6
    },
    md: {
      padding: "10px 18px",
      fontSize: 14.5,
      gap: 8
    },
    lg: {
      padding: "14px 26px",
      fontSize: 16,
      gap: 9
    }
  }[size];
  const variants = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-ink)",
      border: "1px solid var(--accent)"
    },
    ink: {
      background: "var(--ink)",
      color: "var(--paper)",
      border: "1px solid var(--ink)"
    },
    outline: {
      background: "transparent",
      color: "var(--ink)",
      border: "1px solid var(--line-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--ink-soft)",
      border: "1px solid transparent"
    },
    danger: {
      background: "transparent",
      color: "var(--danger)",
      border: "1px solid color-mix(in oklch, var(--danger) 35%, transparent)"
    },
    soft: {
      background: "var(--accent-wash)",
      color: "var(--accent-deep)",
      border: "1px solid color-mix(in oklch, var(--accent) 22%, transparent)"
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: sizes.gap,
      ...sizes,
      ...variants,
      fontFamily: "var(--sans)",
      fontWeight: 600,
      borderRadius: 9,
      cursor: rest.disabled ? "not-allowed" : "pointer",
      opacity: rest.disabled ? 0.5 : 1,
      letterSpacing: "0.01em",
      lineHeight: 1.1,
      transition: "filter .15s, transform .05s, background .15s",
      whiteSpace: "nowrap",
      ...style
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = "translateY(1px)";
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = "translateY(0)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = "translateY(0)";
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === "lg" ? 18 : 16
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: size === "lg" ? 18 : 16
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Progress.jsx
try { (() => {
function Progress({
  value,
  max,
  height = 8,
  tone = "accent"
}) {
  const p = Math.min(100, max > 0 ? value / max * 100 : 0);
  const color = tone === "accent" ? "var(--accent)" : tone === "success" ? "var(--success)" : "var(--info)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--line)",
      borderRadius: 999,
      height,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: p + "%",
      height: "100%",
      background: color,
      borderRadius: 999,
      transition: "width .5s cubic-bezier(.4,0,.2,1)"
    }
  }));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Progress.jsx", error: String((e && e.message) || e) }); }

// components/core/Spinner.jsx
try { (() => {
function Spinner({
  size = 15
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: 999,
      border: "2px solid color-mix(in oklch, var(--accent) 30%, transparent)",
      borderTopColor: "var(--accent-deep)",
      display: "inline-block",
      animation: "ju-spin .7s linear infinite"
    }
  });
}
Object.assign(__ds_scope, { Spinner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Spinner.jsx", error: String((e && e.message) || e) }); }

// components/core/Stat.jsx
try { (() => {
function Stat({
  label,
  value,
  sub,
  tone,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      color: "var(--muted)",
      fontSize: 12.5,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      marginBottom: 8
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }), label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 27,
      fontWeight: 700,
      color: tone === "danger" ? "var(--danger)" : tone === "success" ? "var(--success)" : "var(--ink)",
      fontVariantNumeric: "tabular-nums",
      lineHeight: 1
    }
  }, value), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--muted)",
      fontSize: 13,
      marginTop: 6
    }
  }, sub));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Stat.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
const STATUS_STYLE = {
  funding: {
    bg: "var(--accent-wash)",
    fg: "var(--accent-deep)",
    label: "Funding"
  },
  published: {
    bg: "color-mix(in oklch, var(--info) 14%, transparent)",
    fg: "var(--info)",
    label: "Open"
  },
  "in-litigation": {
    bg: "color-mix(in oklch, var(--info) 14%, transparent)",
    fg: "var(--info)",
    label: "In litigation"
  },
  funded: {
    bg: "color-mix(in oklch, var(--success) 16%, transparent)",
    fg: "var(--success)",
    label: "Funded"
  },
  settled: {
    bg: "color-mix(in oklch, var(--success) 16%, transparent)",
    fg: "var(--success)",
    label: "Settled"
  },
  lost: {
    bg: "color-mix(in oklch, var(--danger) 12%, transparent)",
    fg: "var(--danger)",
    label: "Unsuccessful"
  },
  review: {
    bg: "color-mix(in oklch, var(--warn) 18%, transparent)",
    fg: "var(--warn-deep)",
    label: "In review"
  },
  draft: {
    bg: "var(--line)",
    fg: "var(--muted)",
    label: "Draft"
  }
};
function StatusPill({
  status,
  children
}) {
  const s = STATUS_STYLE[status] || {
    bg: "var(--line)",
    fg: "var(--muted)",
    label: status
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: s.bg,
      color: s.fg,
      fontSize: 12,
      fontWeight: 700,
      padding: "4px 10px",
      borderRadius: 999,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: "currentColor"
    }
  }), children || s.label);
}
Object.assign(__ds_scope, { STATUS_STYLE, StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function Tag({
  children,
  tone = "neutral",
  style
}) {
  const tones = {
    neutral: {
      bg: "var(--surface-2)",
      fg: "var(--ink-soft)"
    },
    accent: {
      bg: "var(--accent-wash)",
      fg: "var(--accent-deep)"
    },
    line: {
      bg: "transparent",
      fg: "var(--ink-soft)",
      border: "1px solid var(--line-strong)"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 12.5,
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: 6,
      whiteSpace: "nowrap",
      background: tones.bg,
      color: tones.fg,
      border: tones.border,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/AIBlock.jsx
try { (() => {
/* Visual wrapper marking AI-generated content (labelled + auditable, never gating). */
function AIBlock({
  title = "AI analysis",
  children,
  note,
  busy,
  style,
  compact
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
      background: "var(--accent-wash)",
      borderRadius: 12,
      padding: compact ? 14 : 18,
      position: "relative",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: children ? 12 : 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 24,
      height: 24,
      borderRadius: 7,
      background: "var(--accent)",
      color: "var(--accent-ink)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sparkle",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: "var(--accent-deep)",
      letterSpacing: "0.01em"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: "var(--accent-deep)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      border: "1px solid color-mix(in oklch, var(--accent) 40%, transparent)",
      padding: "2px 6px",
      borderRadius: 5,
      opacity: 0.75
    }
  }, "AI-generated"), busy && /*#__PURE__*/React.createElement(__ds_scope.Spinner, null)), children, note && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--accent-deep)",
      opacity: 0.7,
      marginTop: 12,
      lineHeight: 1.5
    }
  }, note));
}
Object.assign(__ds_scope, { AIBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/AIBlock.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Empty.jsx
try { (() => {
function Empty({
  icon = "doc",
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 24px",
      color: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      background: "var(--surface-2)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ink-soft)",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: "var(--ink)",
      fontSize: 16,
      marginBottom: 6
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      maxWidth: 380,
      margin: "0 auto",
      lineHeight: 1.5
    }
  }, children));
}
Object.assign(__ds_scope, { Empty });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Empty.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function Modal({
  open,
  onClose,
  children,
  width = 560,
  title,
  subtitle
}) {
  React.useEffect(() => {
    if (!open) return;
    const h = e => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "color-mix(in oklch, var(--ink) 42%, transparent)",
      backdropFilter: "blur(3px)",
      zIndex: 200,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "6vh 20px 40px",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      width: "100%",
      maxWidth: width,
      boxShadow: "0 40px 90px -30px rgba(30,20,5,0.55)",
      border: "1px solid var(--line)",
      animation: "ju-pop .22s cubic-bezier(.2,.8,.3,1)"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "22px 26px",
      borderBottom: "1px solid var(--line)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      fontFamily: "var(--display)",
      color: "var(--ink)"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--muted)",
      marginTop: 4
    }
  }, subtitle)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "var(--surface-2)",
      border: "none",
      borderRadius: 8,
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "var(--ink-soft)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 26
    }
  }, children)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ScoreGauge.jsx
try { (() => {
function ScoreGauge({
  value,
  label,
  size = 64
}) {
  const r = (size - 8) / 2,
    c = 2 * Math.PI * r;
  const tone = value >= 75 ? "var(--success)" : value >= 60 ? "var(--accent)" : "var(--warn-deep)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: "rotate(-90deg)"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--line)",
    strokeWidth: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: tone,
    strokeWidth: "6",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c - value / 100 * c,
    style: {
      transition: "stroke-dashoffset .8s cubic-bezier(.3,.8,.3,1)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: size * 0.28,
      color: "var(--ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, value)), label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink-soft)",
      fontWeight: 600,
      lineHeight: 1.35
    }
  }, label));
}
Object.assign(__ds_scope, { ScoreGauge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ScoreGauge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function Field({
  label,
  hint,
  children,
  required
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block"
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: "var(--ink)",
      marginBottom: 7
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-deep)"
    }
  }, " *")), children, hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted)",
      marginTop: 6
    }
  }, hint));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const inputBase = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--sans)",
  fontSize: 14.5,
  color: "var(--ink)",
  background: "var(--surface)",
  border: "1px solid var(--line-strong)",
  borderRadius: 9,
  padding: "11px 13px",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s"
};
function Input(props) {
  return /*#__PURE__*/React.createElement("input", _extends({}, props, {
    style: {
      ...inputBase,
      ...props.style
    },
    onFocus: e => {
      e.target.style.borderColor = "var(--accent)";
      e.target.style.boxShadow = "0 0 0 3px var(--accent-wash)";
      props.onFocus && props.onFocus(e);
    },
    onBlur: e => {
      e.target.style.borderColor = "var(--line-strong)";
      e.target.style.boxShadow = "none";
      props.onBlur && props.onBlur(e);
    }
  }));
}
Object.assign(__ds_scope, { inputBase, Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("select", _extends({}, props, {
    style: {
      ...__ds_scope.inputBase,
      cursor: "pointer",
      appearance: "none",
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23968a73' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 12px center",
      paddingRight: 36,
      ...props.style
    }
  }), children);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea(props) {
  return /*#__PURE__*/React.createElement("textarea", _extends({}, props, {
    style: {
      ...__ds_scope.inputBase,
      resize: "vertical",
      lineHeight: 1.55,
      ...props.style
    },
    onFocus: e => {
      e.target.style.borderColor = "var(--accent)";
      e.target.style.boxShadow = "0 0 0 3px var(--accent-wash)";
      props.onFocus && props.onFocus(e);
    },
    onBlur: e => {
      e.target.style.borderColor = "var(--line-strong)";
      e.target.style.boxShadow = "none";
      props.onBlur && props.onBlur(e);
    }
  }));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/layout/PageHead.jsx
try { (() => {
function PageHead({
  title,
  sub,
  pills
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, pills && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, pills), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--display)",
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--ink)",
      lineHeight: 1.15
    }
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "10px 0 0",
      color: "var(--muted)",
      fontSize: 15,
      lineHeight: 1.6,
      maxWidth: 760
    }
  }, sub));
}
Object.assign(__ds_scope, { PageHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/PageHead.jsx", error: String((e && e.message) || e) }); }

// components/layout/SectionTitle.jsx
try { (() => {
function SectionTitle({
  children,
  sub,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--display)",
      fontSize: 22,
      fontWeight: 700,
      color: "var(--ink)",
      letterSpacing: "-0.01em"
    }
  }, children), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--muted)",
      fontSize: 14,
      marginTop: 5
    }
  }, sub)), action);
}
Object.assign(__ds_scope, { SectionTitle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/SectionTitle.jsx", error: String((e && e.message) || e) }); }

// components/layout/Stepper.jsx
try { (() => {
function Stepper({
  steps,
  active
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 24,
      flexWrap: "wrap",
      gap: 4
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 700,
      flexShrink: 0,
      background: i < active ? "var(--accent)" : i === active ? "var(--ink)" : "var(--line)",
      color: i <= active ? "var(--paper)" : "var(--muted)"
    }
  }, i < active ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 14
  }) : i + 1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: i === active ? "var(--ink)" : "var(--muted)",
      whiteSpace: "nowrap"
    }
  }, s)), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 2,
      background: "var(--line)",
      margin: "0 8px"
    }
  }))));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/layout/SubHead.jsx
try { (() => {
function SubHead({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontSize: 16,
      fontWeight: 700,
      color: "var(--ink)",
      marginBottom: 14,
      letterSpacing: "-0.01em",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { SubHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/SubHead.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/app.jsx
try { (() => {
/* JustUs Financial UI kit — app shell (dark-ink sidebar + topbar) + router */
const {
  Icon,
  Button,
  Avatar,
  Brandmark
} = window.JustUsFinancialDesignSystem_16316f;
const {
  Landing,
  Marketplace,
  InvestorCase,
  Portfolio
} = window.JUKit;
function NotificationsBell({
  role
}) {
  const seed = JU.notifications && JU.notifications[role] || [];
  const [items, setItems] = React.useState(seed.map(x => Object.assign({}, x)));
  const [open, setOpen] = React.useState(false);
  const unread = items.filter(i => i.unread).length;
  React.useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [open]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(v => !v),
    style: {
      position: "relative",
      width: 38,
      height: 38,
      borderRadius: 9,
      border: "1px solid var(--line-strong)",
      background: "var(--surface)",
      cursor: "pointer",
      color: "var(--ink-soft)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  }), unread > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -5,
      right: -5,
      minWidth: 17,
      height: 17,
      padding: "0 4px",
      borderRadius: 999,
      background: "var(--accent)",
      color: "var(--accent-ink)",
      fontSize: 10.5,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid var(--surface)"
    }
  }, unread)), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 46,
      right: 0,
      width: 340,
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      boxShadow: "0 24px 60px -24px rgba(40,30,10,0.4)",
      zIndex: 120,
      overflow: "hidden",
      animation: "ju-pop .16s ease-out"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 16px",
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 14.5,
      color: "var(--ink)"
    }
  }, "Notifications"), unread > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setItems(p => p.map(i => Object.assign({}, i, {
      unread: false
    }))),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--accent-deep)",
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: "var(--sans)"
    }
  }, "Mark all read")), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 380,
      overflowY: "auto"
    }
  }, items.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setItems(p => p.map((x, j) => j === i ? Object.assign({}, x, {
      unread: false
    }) : x)),
    style: {
      display: "flex",
      gap: 12,
      padding: "13px 16px",
      borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none",
      background: n.unread ? "var(--accent-wash)" : "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: "var(--surface-2)",
      color: "var(--accent-deep)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: "var(--ink)"
    }
  }, n.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      lineHeight: 1.45,
      marginTop: 2
    }
  }, n.body), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--muted)",
      marginTop: 4
    }
  }, n.time)), n.unread && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: "var(--accent)",
      flexShrink: 0,
      marginTop: 5
    }
  }))))));
}
function Shell({
  role,
  user,
  nav,
  active,
  onNav,
  onExit,
  tagline,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "var(--paper)"
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 252,
      flexShrink: 0,
      background: "var(--ink)",
      color: "var(--paper)",
      display: "flex",
      flexDirection: "column",
      padding: "22px 16px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "4px 6px",
      marginBottom: 26,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(Brandmark, {
    size: 30
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 16,
      color: "var(--paper)",
      lineHeight: 1
    }
  }, "JustUs"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "color-mix(in oklch, var(--paper) 55%, transparent)",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginTop: 2
    }
  }, "Financial"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "9px 11px",
      borderRadius: 10,
      background: "color-mix(in oklch, var(--paper) 9%, transparent)",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: "var(--accent)",
      color: "var(--accent-ink)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trending",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: "var(--paper)"
    }
  }, "Investor"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "color-mix(in oklch, var(--paper) 55%, transparent)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, user.name)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 15,
    style: {
      color: "color-mix(in oklch, var(--paper) 60%, transparent)",
      flexShrink: 0
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
      flex: 1
    }
  }, nav.map(n => {
    const on = active === n.key;
    return /*#__PURE__*/React.createElement("button", {
      key: n.key,
      onClick: () => onNav(n.key),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 12px",
        borderRadius: 9,
        cursor: "pointer",
        border: "none",
        textAlign: "left",
        fontFamily: "var(--sans)",
        fontWeight: 600,
        fontSize: 14,
        transition: "background .15s",
        background: on ? "color-mix(in oklch, var(--paper) 13%, transparent)" : "transparent",
        color: on ? "var(--paper)" : "color-mix(in oklch, var(--paper) 62%, transparent)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 17
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, n.label), n.badge && /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 19,
        height: 19,
        padding: "0 5px",
        borderRadius: 999,
        background: "var(--accent)",
        color: "var(--accent-ink)",
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, n.badge));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 9,
      cursor: "pointer",
      border: "1px solid color-mix(in oklch, var(--paper) 18%, transparent)",
      background: "transparent",
      color: "color-mix(in oklch, var(--paper) 70%, transparent)",
      fontFamily: "var(--sans)",
      fontWeight: 600,
      fontSize: 13.5,
      marginTop: 12,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "logout",
    size: 16
  }), "Sign out")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "0 30px",
      height: 60,
      borderBottom: "1px solid var(--line)",
      background: "var(--surface)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13,
      color: "var(--muted)",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14,
    style: {
      color: "var(--accent-deep)"
    }
  }), tagline), /*#__PURE__*/React.createElement(NotificationsBell, {
    role: role
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "8px 13px",
      borderRadius: 9,
      border: "1px solid var(--line-strong)",
      background: "var(--surface)",
      cursor: "pointer",
      fontFamily: "var(--sans)",
      fontWeight: 600,
      fontSize: 13,
      color: "var(--ink-soft)",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkle",
    size: 15,
    style: {
      color: "var(--accent-deep)"
    }
  }), "Ask JustUs"), /*#__PURE__*/React.createElement(Avatar, {
    initials: user.initials,
    size: 34
  })), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "30px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto"
    }
  }, children))));
}
function App() {
  const me = JU.users.find(u => u.role === "investor");
  const [entered, setEntered] = React.useState(() => {
    try {
      return localStorage.getItem("jukit_view") === "app";
    } catch (e) {
      return false;
    }
  });
  const [view, setView] = React.useState("browse");
  const [openId, setOpenId] = React.useState(null);
  const [myCommits, setMyCommits] = React.useState(() => {
    const seed = [];
    JU.cases.forEach(c => (c.commitments || []).forEach(m => {
      if (m.investorId === "inv_diane") seed.push({
        caseId: c.id,
        amount: m.amount,
        fee: m.fee,
        principal: m.principal,
        status: m.status,
        date: "2026-05-31"
      });
    }));
    return seed;
  });
  React.useEffect(() => {
    try {
      localStorage.setItem("jukit_view", entered ? "app" : "landing");
    } catch (e) {}
  }, [entered]);
  function commit(caseId, amount) {
    const b = JU.commitmentBreakdown(amount);
    setMyCommits(p => [{
      caseId,
      amount: b.amount,
      fee: b.fee,
      principal: b.principal,
      status: "cool-off",
      date: new Date().toISOString().slice(0, 10)
    }].concat(p));
  }
  function withdraw(idx) {
    setMyCommits(p => p.filter((_, i) => i !== idx));
  }
  if (!entered) return /*#__PURE__*/React.createElement(Landing, {
    onEnter: () => setEntered(true)
  });
  const nav = [{
    key: "browse",
    label: "Browse cases",
    icon: "search"
  }, {
    key: "portfolio",
    label: "My portfolio",
    icon: "pie"
  }, {
    key: "verify",
    label: "Accreditation",
    icon: "shield"
  }];
  const interests = me.interests;
  let body;
  if (view === "browse") body = /*#__PURE__*/React.createElement(Marketplace, {
    interests: interests,
    onOpen: id => {
      setOpenId(id);
      setView("case");
    }
  });else if (view === "case") body = /*#__PURE__*/React.createElement(InvestorCase, {
    id: openId,
    interests: interests,
    onBack: () => setView("browse"),
    onCommit: commit,
    myCommits: myCommits
  });else if (view === "portfolio") body = /*#__PURE__*/React.createElement(Portfolio, {
    myCommits: myCommits,
    onWithdraw: withdraw,
    onBrowse: () => setView("browse")
  });else body = /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "Investor \xB7 Accreditation"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      marginBottom: 10
    }
  }, "Accreditation center"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--muted)",
      fontSize: 15,
      lineHeight: 1.6
    }
  }, "Recreated in the full prototype \u2014 this UI kit demonstrates the marketplace, case detail, commit flow and portfolio. See the source prototype for the 506(c) verification wizard.")));
  return /*#__PURE__*/React.createElement(Shell, {
    role: "investor",
    user: me,
    nav: nav,
    active: view === "case" ? "browse" : view,
    onNav: setView,
    onExit: () => setEntered(false),
    tagline: "Accredited investors only \xB7 Reg D 506(c)"
  }, body);
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/data.js
try { (() => {
/* ============================================================
   JustUs Financial — seed data + financial engine
   Litigation crowdfunding platform (Phase 1, Reg D 506(c))
   All money math here is verified against the proposal's
   worked examples.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Money helpers ---------- */
  const ENTRY_FEE = 0.03; // 3% platform entry fee (both sides)
  const CARRY = 0.10; // 10% carried interest on profit only

  const money = (n, dp) => {
    if (n == null || isNaN(n)) return "$0";
    const opts = dp != null ? {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp
    } : Math.abs(n) >= 1000 ? {
      maximumFractionDigits: 0
    } : {
      maximumFractionDigits: 2
    };
    return "$" + Number(n).toLocaleString("en-US", opts);
  };
  const moneyc = n => "$" + Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const pct = (n, dp = 1) => (n * 100).toFixed(dp) + "%";

  // A commitment: entry fee taken up front, 97% becomes principal.
  function commitmentBreakdown(amount) {
    const fee = amount * ENTRY_FEE;
    const principal = amount - fee;
    return {
      amount,
      fee,
      principal
    };
  }

  /* Settlement waterfall + per-investor disbursement.
     Verified against proposal Worked Example 1:
       settle 200,000 · pool 30% · A $1,000 (prin 970) · B $50,000 (prin 48,500)
       => A net 1,155.82, B net 57,791.18, carry total 1,053  ✓
  */
  function runDisbursement({
    settlement,
    legalFeesPct,
    poolPct,
    commitments
  }) {
    const legalFees = settlement * legalFeesPct;
    const afterLegal = settlement - legalFees;
    const poolEntitlement = settlement * poolPct; // pool taken from gross settlement
    const plaintiffShare = afterLegal - poolEntitlement;
    const totalPrincipal = commitments.reduce((s, c) => s + c.principal, 0);
    const investors = commitments.map(c => {
      const share = totalPrincipal > 0 ? c.principal / totalPrincipal : 0;
      const grossReturn = share * poolEntitlement;
      const profit = Math.max(0, grossReturn - c.principal);
      const carry = profit * CARRY;
      const net = grossReturn > c.principal ? c.principal + profit * (1 - CARRY) : grossReturn;
      const loss = c.principal - net;
      return {
        ...c,
        share,
        grossReturn,
        profit,
        carry,
        net,
        recoveredPrincipal: grossReturn >= c.principal,
        loss: loss > 0 ? loss : 0
      };
    });
    const carryTotal = investors.reduce((s, i) => s + i.carry, 0);
    const entryFeesTotal = commitments.reduce((s, c) => s + c.fee, 0);
    return {
      settlement,
      legalFees,
      poolEntitlement,
      plaintiffShare,
      totalPrincipal,
      investors,
      carryTotal,
      entryFeesTotal,
      platformRevenue: carryTotal + entryFeesTotal
    };
  }

  /* ---------- Categories & jurisdictions ---------- */
  const CATEGORIES = [{
    id: "police",
    label: "Police misconduct",
    blurb: "Excessive force, wrongful arrest, civil-rights violations"
  }, {
    id: "workplace",
    label: "Workplace discrimination",
    blurb: "Retaliation, wrongful termination, harassment"
  }, {
    id: "injury",
    label: "Personal injury",
    blurb: "Negligence, unsafe premises, product liability"
  }, {
    id: "housing",
    label: "Housing & tenant rights",
    blurb: "Unlawful eviction, habitability, discrimination"
  }, {
    id: "consumer",
    label: "Consumer protection",
    blurb: "Fraud, deceptive practices, predatory lending"
  }];
  const JURISDICTIONS = ["California", "New York", "Texas", "Illinois", "Florida", "Georgia", "Washington"];
  // Jurisdictions where the model is restricted (drives the sign-up compliance flag)
  const RESTRICTED_JURISDICTIONS = ["Texas"];

  /* ---------- Users ---------- */
  const users = [{
    id: "u_plaintiff",
    role: "plaintiff",
    name: "Marcus Webb",
    initials: "MW",
    jurisdiction: "California",
    joined: "2026-03-02",
    email: "m.webb@example.com"
  }, {
    id: "u_investor",
    role: "investor",
    name: "Diane Okafor",
    initials: "DO",
    jurisdiction: "New York",
    joined: "2026-02-18",
    email: "diane.o@example.com",
    accreditation: {
      status: "verified",
      method: "Third-party income verification",
      vendor: "Parallel Markets",
      verifiedOn: "2026-04-30",
      expiresOn: "2026-07-29"
    },
    interests: {
      categories: ["police", "workplace"],
      jurisdictions: ["California", "New York"]
    }
  }, {
    id: "u_attorney",
    role: "attorney",
    name: "Rosa Delgado",
    initials: "RD",
    firm: "Delgado Civil Rights LLP",
    jurisdiction: "California",
    bar: "CA #214882",
    practice: ["police", "workplace"],
    joined: "2026-01-20"
  }, {
    id: "u_admin",
    role: "admin",
    name: "Avery Chen",
    initials: "AC",
    title: "Platform Operations",
    joined: "2025-11-04"
  }];

  /* ---------- Investor roster (for admin + pool math) ---------- */
  const investorRoster = [{
    id: "inv_diane",
    name: "Diane Okafor",
    initials: "DO",
    status: "verified",
    expiresOn: "2026-07-29",
    committed: 73000
  }, {
    id: "inv_raj",
    name: "Raj Patel",
    initials: "RP",
    status: "verified",
    expiresOn: "2026-08-12",
    committed: 120000
  }, {
    id: "inv_lena",
    name: "Lena Brooks",
    initials: "LB",
    status: "verified",
    expiresOn: "2026-06-04",
    committed: 25000
  }, {
    id: "inv_sam",
    name: "Samuel Voss",
    initials: "SV",
    status: "pending",
    expiresOn: null,
    committed: 0
  }, {
    id: "inv_tara",
    name: "Tara N;guyen".replace(";", ""),
    initials: "TN",
    status: "expired",
    expiresOn: "2026-05-01",
    committed: 18000
  }, {
    id: "inv_owen",
    name: "Owen Fitzgerald",
    initials: "OF",
    status: "verified",
    expiresOn: "2026-09-01",
    committed: 200000
  }];

  /* ---------- Helper to build commitments ---------- */
  function mk(investorId, name, initials, amount, daysAgo, status) {
    const b = commitmentBreakdown(amount);
    return {
      investorId,
      name,
      initials,
      ...b,
      status: status || "deployed",
      daysAgo
    };
  }

  /* ---------- Cases (cover every status / flow) ---------- */
  const cases = [{
    id: "case_webb",
    title: "Wrongful arrest & excessive force during a traffic stop",
    category: "police",
    jurisdiction: "California",
    plaintiff: "Marcus Webb",
    plaintiffId: "u_plaintiff",
    status: "funding",
    // published & actively raising
    createdOn: "2026-04-12",
    fundingGoal: 90000,
    poolPct: 0.30,
    legalFeesPct: 0.33,
    summary: "Stopped for a broken tail light, Marcus was pulled from his vehicle, restrained, and held for 19 hours without charge. Dashcam and two independent witnesses corroborate the account.",
    story: "On the evening of March 4th I was driving home from my night shift when I was pulled over for what the officer said was a broken tail light. Before I could provide my license I was ordered out of the car. When I asked why, I was pulled through the window, restrained on the ground, and handcuffed. I was held for 19 hours and released without any charge being filed. I have a documented shoulder injury from the restraint and lost my job after missing three shifts. I am not looking for a fight — I am looking for accountability, and for the means to even the playing field against a city with a full legal department.",
    evidence: [{
      type: "Video",
      label: "Dashcam footage (4m 12s)",
      verified: true
    }, {
      type: "Document",
      label: "Medical report — shoulder injury",
      verified: true
    }, {
      type: "Witness",
      label: "2 independent witness statements",
      verified: false
    }, {
      type: "Document",
      label: "Booking & release record (no charge)",
      verified: true
    }],
    commitments: [mk("inv_diane", "Diane Okafor", "DO", 25000, 9), mk("inv_raj", "Raj Patel", "RP", 40000, 6), mk("inv_diane", "Diane Okafor", "DO", 8000, 1, "cool-off")],
    updates: [],
    attorney: null,
    moderation: {
      state: "clear",
      flags: []
    },
    ai: {
      strength: 78,
      completeness: 85,
      category: "police",
      risk: "Moderate",
      rr: "Moderate risk · Moderate–High return"
    }
  }, {
    id: "case_alvarez",
    title: "Retaliatory termination after reporting wage theft",
    category: "workplace",
    jurisdiction: "California",
    plaintiff: "Sofia Alvarez",
    plaintiffId: "p_sofia",
    status: "in-litigation",
    // funded + claimed by attorney + active
    createdOn: "2026-02-09",
    fundingGoal: 60000,
    poolPct: 0.30,
    legalFeesPct: 0.33,
    summary: "Terminated 11 days after filing an internal complaint about unpaid overtime affecting 40+ warehouse staff. Email trail and payroll records preserved.",
    story: "I reported that our shift leads were editing time records to erase overtime. Eleven days later I was let go for 'restructuring' — my role was reposted the same week. I kept every email.",
    evidence: [{
      type: "Document",
      label: "Internal complaint email + read receipt",
      verified: true
    }, {
      type: "Document",
      label: "Payroll records (40+ employees)",
      verified: true
    }, {
      type: "Document",
      label: "Termination letter",
      verified: true
    }],
    commitments: [mk("inv_raj", "Raj Patel", "RP", 30000, 41), mk("inv_lena", "Lena Brooks", "LB", 25000, 38), mk("inv_owen", "Owen Fitzgerald", "OF", 12000, 30)],
    updates: [{
      date: "2026-03-01",
      author: "Rosa Delgado",
      title: "Case accepted & filed",
      body: "I've reviewed the evidence and filed the complaint in the Superior Court of California, County of Alameda. Next we enter discovery."
    }, {
      date: "2026-04-15",
      author: "Rosa Delgado",
      title: "Discovery underway",
      body: "We've issued document requests to the employer. Payroll data is being independently audited. No action needed from backers — updates will continue here."
    }, {
      date: "2026-05-20",
      author: "Rosa Delgado",
      title: "Mediation scheduled",
      body: "The defendant has agreed to mediation on June 18. This is a positive signal but not a settlement. I'll post the outcome here."
    }],
    attorney: "Rosa Delgado",
    moderation: {
      state: "clear",
      flags: []
    },
    ai: {
      strength: 84,
      completeness: 92,
      category: "workplace",
      risk: "Low–Moderate",
      rr: "Low–Moderate risk · Moderate return"
    }
  }, {
    id: "case_okoro",
    title: "Warehouse forklift injury due to disabled safety sensor",
    category: "injury",
    jurisdiction: "Illinois",
    plaintiff: "Daniel Okoro",
    plaintiffId: "p_daniel",
    status: "settled",
    // SETTLED — drives the disbursement demo
    createdOn: "2025-12-01",
    fundingGoal: 50000,
    poolPct: 0.30,
    legalFeesPct: 0.33,
    summary: "A forklift with a deliberately bypassed proximity sensor struck the plaintiff, causing a fractured pelvis. OSHA citation issued.",
    story: "The proximity alarm had been taped over for months to speed up loading. I was struck from behind and spent six weeks unable to work.",
    evidence: [{
      type: "Document",
      label: "OSHA citation",
      verified: true
    }, {
      type: "Document",
      label: "Hospital records",
      verified: true
    }, {
      type: "Video",
      label: "Warehouse CCTV",
      verified: true
    }],
    commitments: [mk("inv_diane", "Diane Okafor", "DO", 1000, 180), mk("inv_owen", "Owen Fitzgerald", "OF", 50000, 175)],
    settlement: {
      amount: 200000,
      recordedOn: "2026-05-10",
      outcome: "win"
    },
    updates: [{
      date: "2026-01-10",
      author: "Priya Anand",
      title: "Case filed",
      body: "Complaint filed in Cook County. OSHA findings strengthen our position considerably."
    }, {
      date: "2026-05-10",
      author: "Priya Anand",
      title: "Settlement reached — $200,000",
      body: "The defendant settled for $200,000 ahead of trial. Disbursement will run per the platform waterfall: legal fees, then the investor pool, then the plaintiff. Backers will see their statements shortly."
    }],
    attorney: "Priya Anand",
    moderation: {
      state: "clear",
      flags: []
    },
    ai: {
      strength: 88,
      completeness: 95,
      category: "injury",
      risk: "Low",
      rr: "Low risk · Moderate return"
    }
  }, {
    id: "case_reyes",
    title: "Pregnancy discrimination & demotion after parental leave",
    category: "workplace",
    jurisdiction: "Florida",
    plaintiff: "Camila Reyes",
    plaintiffId: "p_camila",
    status: "review",
    // UNDER MODERATION — drives the admin queue
    createdOn: "2026-05-25",
    fundingGoal: 45000,
    poolPct: 0.30,
    legalFeesPct: 0.33,
    summary: "Returned from parental leave to find her management role reassigned and her pay band reduced.",
    story: "I came back from twelve weeks of leave and my team had been given to someone hired while I was out. I was offered a 'comparable' role two pay bands lower.",
    evidence: [{
      type: "Document",
      label: "Offer letter — reduced band",
      verified: false
    }, {
      type: "Document",
      label: "Org chart before/after",
      verified: false
    }],
    commitments: [],
    updates: [],
    attorney: null,
    moderation: {
      state: "flagged",
      flags: [{
        kind: "Content moderation",
        severity: "low",
        note: "Possible identifying detail of a third party in the narrative — review before publication."
      }, {
        kind: "Compliance",
        severity: "medium",
        note: "Category-fit check: jurisdiction (Florida) permitted, but evidence is currently unverified. Recommend verification before funding opens."
      }]
    },
    ai: {
      strength: 71,
      completeness: 64,
      category: "workplace",
      risk: "Moderate",
      rr: "Moderate risk · Moderate return"
    }
  }, {
    id: "case_hart",
    title: "Unlawful eviction & retaliation against a tenant organizer",
    category: "housing",
    jurisdiction: "New York",
    plaintiff: "Gregory Hart",
    plaintiffId: "p_gregory",
    status: "published",
    // published, fundable, NOT yet funded or claimed
    createdOn: "2026-05-18",
    fundingGoal: 35000,
    poolPct: 0.30,
    legalFeesPct: 0.33,
    summary: "Served with an eviction notice within a week of organizing a tenants' association in a rent-stabilized building.",
    story: "I helped neighbors form a tenants' association after years of ignored repair requests. Seven days later I had an eviction notice citing a lease clause that had never been enforced.",
    evidence: [{
      type: "Document",
      label: "Eviction notice",
      verified: true
    }, {
      type: "Document",
      label: "Tenants' association formation records",
      verified: true
    }, {
      type: "Document",
      label: "2 years of repair requests",
      verified: false
    }],
    commitments: [],
    updates: [],
    attorney: null,
    moderation: {
      state: "clear",
      flags: []
    },
    ai: {
      strength: 69,
      completeness: 78,
      category: "housing",
      risk: "Moderate",
      rr: "Moderate risk · Moderate return"
    }
  }, {
    id: "case_lost",
    title: "Premises liability slip-and-fall claim",
    category: "injury",
    jurisdiction: "Georgia",
    plaintiff: "Helen Park",
    plaintiffId: "p_helen",
    status: "lost",
    // LOST — drives the loss-scenario disbursement
    createdOn: "2025-10-15",
    fundingGoal: 30000,
    poolPct: 0.30,
    legalFeesPct: 0.30,
    summary: "Slip-and-fall claim in a retail premises. Surveillance ultimately undermined the timeline; the court found for the defendant.",
    story: "I slipped on an unmarked wet floor. We believed liability was clear, but the evidence at trial did not go our way.",
    evidence: [{
      type: "Document",
      label: "Incident report",
      verified: true
    }, {
      type: "Document",
      label: "Medical records",
      verified: true
    }],
    commitments: [mk("inv_lena", "Lena Brooks", "LB", 15000, 200), mk("inv_raj", "Raj Patel", "RP", 10000, 195)],
    settlement: {
      amount: 0,
      recordedOn: "2026-05-02",
      outcome: "loss"
    },
    updates: [{
      date: "2026-05-02",
      author: "Priya Anand",
      title: "Verdict — case unsuccessful",
      body: "The court found for the defendant. I'm sorry to share this outcome. Per the disclosed terms, backing a case is an investment that can lose; no carried interest is owed and the pooled principal is not recovered. Statements will reflect the loss."
    }],
    attorney: "Priya Anand",
    moderation: {
      state: "clear",
      flags: []
    },
    ai: {
      strength: 52,
      completeness: 70,
      category: "injury",
      risk: "High",
      rr: "High risk · uncertain return"
    }
  }];

  /* ---------- Platform-wide aggregates for admin ---------- */
  function platformStats() {
    let committed = 0,
      principal = 0,
      entryFees = 0,
      carry = 0,
      payouts = 0;
    let funded = 0,
      settled = 0,
      active = 0;
    cases.forEach(c => {
      const cms = c.commitments || [];
      cms.forEach(m => {
        committed += m.amount;
        principal += m.principal;
        entryFees += m.fee;
      });
      if (c.status === "settled" && c.settlement && c.settlement.outcome === "win") {
        const d = runDisbursement({
          settlement: c.settlement.amount,
          legalFeesPct: c.legalFeesPct,
          poolPct: c.poolPct,
          commitments: cms
        });
        carry += d.carryTotal;
        payouts += d.investors.reduce((s, i) => s + i.net, 0);
        settled++;
      } else if (c.status === "lost") {
        settled++;
      } else if (c.status === "in-litigation" || c.status === "funded") {
        funded++;
        active++;
      } else if (c.status === "funding" || c.status === "published") {
        active++;
      }
    });
    return {
      committed,
      principal,
      entryFees,
      carry,
      payouts,
      revenue: entryFees + carry,
      funded,
      settled,
      active,
      totalCases: cases.length
    };
  }

  /* ---------- Phase 2 feature flags ---------- */
  const featureFlags = [{
    id: "regcf_onboarding",
    label: "Reg CF public onboarding",
    desc: "Open registration to non-accredited investors under Regulation Crowdfunding.",
    phase: 2,
    on: false
  }, {
    id: "fractional_pooling",
    label: "Fractional-share pooling",
    desc: "Allow small pooled commitments from the general public.",
    phase: 2,
    on: false
  }, {
    id: "regcf_intermediary",
    label: "Reg CF intermediary integration",
    desc: "Route offerings through a registered funding portal / broker-dealer.",
    phase: 2,
    on: false
  }, {
    id: "lead_gen",
    label: "Court-record lead generation",
    desc: "AI scanning of public court records to surface outreach leads.",
    phase: 3,
    on: false
  }, {
    id: "baas_escrow",
    label: "BaaS / litigation escrow",
    desc: "Migrate fund custody from Stripe to a QSF / escrow structure.",
    phase: 4,
    on: false
  }, {
    id: "ai_update_drafting",
    label: "AI update-drafting for attorneys",
    desc: "Draft broadcast updates from case notes for attorney approval.",
    phase: 2,
    on: false
  }, {
    id: "plain_language",
    label: "Plain-language update translation",
    desc: "Translate attorney legal updates into plain English for plaintiffs.",
    phase: 2,
    on: false
  }];

  /* ---------- All users across roles (admin user management) ---------- */
  function allUsers() {
    const list = [];
    users.filter(u => u.role === "admin").forEach(u => list.push({
      id: u.id,
      name: u.name,
      initials: u.initials,
      role: "admin",
      jurisdiction: "—",
      status: "active",
      joined: u.joined,
      meta: u.title
    }));
    const attys = {};
    users.filter(u => u.role === "attorney").forEach(u => {
      attys[u.name] = {
        id: u.id,
        name: u.name,
        initials: u.initials,
        role: "attorney",
        jurisdiction: u.jurisdiction,
        status: "active",
        joined: u.joined,
        meta: u.firm
      };
    });
    cases.forEach(c => {
      if (c.attorney && !attys[c.attorney]) {
        const ini = c.attorney.split(" ").map(x => x[0]).join("");
        attys[c.attorney] = {
          id: "at_" + ini,
          name: c.attorney,
          initials: ini,
          role: "attorney",
          jurisdiction: c.jurisdiction,
          status: "active",
          joined: "2026-02-01",
          meta: "External counsel"
        };
      }
    });
    Object.values(attys).forEach(a => list.push(a));
    investorRoster.forEach(i => list.push({
      id: i.id,
      name: i.name,
      initials: i.initials,
      role: "investor",
      jurisdiction: "—",
      status: i.status,
      joined: "2026-03-01",
      meta: i.committed ? money(i.committed) + " committed" : "No commitments",
      expiresOn: i.expiresOn
    }));
    const seen = {};
    cases.forEach(c => {
      if (!seen[c.plaintiff]) {
        seen[c.plaintiff] = 1;
        const ini = c.plaintiff.split(" ").map(x => x[0]).join("");
        list.push({
          id: c.plaintiffId,
          name: c.plaintiff,
          initials: ini,
          role: "plaintiff",
          jurisdiction: c.jurisdiction,
          status: c.status === "review" ? "pending" : "active",
          joined: c.createdOn,
          meta: c.title
        });
      }
    });
    return list;
  }

  /* ---------- Audit trail ---------- */
  const auditLog = [{
    ts: "2026-05-29 14:22",
    actor: "Avery Chen",
    role: "admin",
    type: "moderation",
    action: "Approved case for publication",
    detail: "Unlawful eviction & retaliation against a tenant organizer"
  }, {
    ts: "2026-05-28 09:10",
    actor: "System",
    role: "system",
    type: "verify",
    action: "Accreditation verified",
    detail: "Owen Fitzgerald · vendor Parallel Markets · expires 2026-09-01"
  }, {
    ts: "2026-05-27 16:48",
    actor: "Diane Okafor",
    role: "investor",
    type: "commit",
    action: "Capital committed",
    detail: "$8,000 → Wrongful arrest & excessive force (cool-off)"
  }, {
    ts: "2026-05-20 11:30",
    actor: "Rosa Delgado",
    role: "attorney",
    type: "update",
    action: "Broadcast update posted",
    detail: "Mediation scheduled · Retaliatory termination case"
  }, {
    ts: "2026-05-10 10:05",
    actor: "Priya Anand",
    role: "attorney",
    type: "settlement",
    action: "Settlement recorded — $200,000",
    detail: "Warehouse forklift injury · disbursement waterfall executed"
  }, {
    ts: "2026-05-10 10:06",
    actor: "System",
    role: "system",
    type: "disburse",
    action: "Disbursement completed",
    detail: "2 backers paid · $1,053 carry · $1,530 entry fees recognised"
  }, {
    ts: "2026-05-02 15:20",
    actor: "Priya Anand",
    role: "attorney",
    type: "settlement",
    action: "Outcome recorded — unsuccessful",
    detail: "Premises liability slip-and-fall · no carry · principal not recovered"
  }, {
    ts: "2026-05-01 00:00",
    actor: "System",
    role: "system",
    type: "verify",
    action: "Accreditation expired",
    detail: "Tara Nguyen · re-verification required before committing"
  }, {
    ts: "2026-04-30 13:14",
    actor: "System",
    role: "system",
    type: "verify",
    action: "Accreditation verified",
    detail: "Diane Okafor · income method · expires 2026-07-29"
  }, {
    ts: "2026-04-12 08:40",
    actor: "Marcus Webb",
    role: "plaintiff",
    type: "case",
    action: "Case submitted",
    detail: "Wrongful arrest & excessive force during a traffic stop"
  }, {
    ts: "2026-04-12 08:41",
    actor: "AI moderation",
    role: "system",
    type: "flag",
    action: "Auto-review passed",
    detail: "No content or compliance flags raised"
  }, {
    ts: "2026-03-02 12:00",
    actor: "Avery Chen",
    role: "admin",
    type: "config",
    action: "Platform configuration changed",
    detail: "Default pool entitlement set to 30%"
  }];

  /* ---------- Notifications by role ---------- */
  const notifications = {
    plaintiff: [{
      icon: "trending",
      title: "New backing on your case",
      body: "Your case received an $8,000 commitment (in cool-off).",
      time: "2h ago",
      unread: true
    }, {
      icon: "sparkle",
      title: "AI suggests strengthening evidence",
      body: "Adding a verified witness statement could raise your completeness score.",
      time: "1d ago",
      unread: true
    }, {
      icon: "shield",
      title: "Case passed moderation",
      body: "Your submission is live and visible to verified investors.",
      time: "3d ago",
      unread: false
    }],
    investor: [{
      icon: "clock",
      title: "Cool-off ending soon",
      body: "Your $8,000 commitment deploys in ~22 hours unless withdrawn.",
      time: "1h ago",
      unread: true
    }, {
      icon: "sparkle",
      title: "3 new matches for you",
      body: "New cases match your interests in police misconduct.",
      time: "6h ago",
      unread: true
    }, {
      icon: "shield",
      title: "Verification expires in 60 days",
      body: "Re-verify before 2026-07-29 to keep committing capital.",
      time: "2d ago",
      unread: false
    }],
    attorney: [{
      icon: "briefcase",
      title: "New fundable case in California",
      body: "Wrongful arrest & excessive force — $73,000 backed.",
      time: "30m ago",
      unread: true
    }, {
      icon: "megaphone",
      title: "Backers awaiting an update",
      body: "It's been 10 days since your last update on the retaliation case.",
      time: "1d ago",
      unread: true
    }, {
      icon: "dollar",
      title: "Mediation scheduled",
      body: "Defendant agreed to mediation on June 18.",
      time: "5d ago",
      unread: false
    }],
    admin: [{
      icon: "flag",
      title: "1 case awaiting moderation",
      body: "Pregnancy discrimination case has 2 open flags.",
      time: "20m ago",
      unread: true
    }, {
      icon: "shield",
      title: "Verification expired",
      body: "Tara Nguyen must re-verify before committing.",
      time: "1d ago",
      unread: true
    }, {
      icon: "dollar",
      title: "Settlement disbursed",
      body: "Warehouse forklift case paid out to 2 backers.",
      time: "19d ago",
      unread: false
    }]
  };

  /* ---------- Platform configuration (admin-editable) ---------- */
  const platformConfig = {
    plaintiffFee: 3,
    investorFee: 3,
    carry: 10,
    defaultPoolPct: 30,
    coolOffHours: 48,
    verificationExpiryDays: 90,
    minCommitment: 1000,
    jurisdictions: JURISDICTIONS.map(j => ({
      name: j,
      allowed: !RESTRICTED_JURISDICTIONS.includes(j)
    }))
  };

  /* ---------- Attorney offers to represent (plaintiff engagement) ---------- */
  const attorneyOffers = {
    case_webb: [{
      id: "off_delgado",
      attorney: "Rosa Delgado",
      firm: "Delgado Civil Rights LLP",
      initials: "RD",
      bar: "CA #214882",
      jurisdiction: "California",
      practice: ["police", "workplace"],
      years: 14,
      wins: 38,
      rating: 4.9,
      legalFeesPct: 0.33,
      message: "I've handled dozens of wrongful-arrest and excessive-force cases against municipalities in California. Your dashcam footage and the no-charge release record are exactly the kind of corroboration that wins these. I'd be glad to represent you on a contingency basis.",
      respondedOn: "2026-05-28"
    }, {
      id: "off_okafor",
      attorney: "James Okafor",
      firm: "Bayline Trial Group",
      initials: "JO",
      bar: "CA #198440",
      jurisdiction: "California",
      practice: ["police", "injury"],
      years: 9,
      wins: 21,
      rating: 4.7,
      legalFeesPct: 0.30,
      message: "Strong case. I focus on civil-rights claims and would take this at a slightly lower fee. Happy to discuss strategy before you decide.",
      respondedOn: "2026-05-29"
    }]
  };

  /* ---------- Plaintiff verification / payout defaults ---------- */
  const plaintiffOnboarding = {
    identity: {
      status: "unverified"
    },
    // unverified | pending | verified
    payout: {
      status: "none",
      method: null,
      last4: null
    } // none | linked
  };

  /* ---------- Investor wallet / funding / documents (demo: Diane) ---------- */
  const investorWallet = {
    balance: 1155.82,
    // realized return from the okoro settlement, available to withdraw
    methods: [{
      id: "pm_bank",
      kind: "bank",
      label: "Chase ····4471",
      detail: "ACH · linked via Plaid",
      primary: true
    }, {
      id: "pm_card",
      kind: "card",
      label: "Visa ····8806",
      detail: "Debit · via Stripe",
      primary: false
    }],
    transactions: [{
      id: "tx1",
      date: "2025-12-03",
      type: "commitment",
      label: "Commitment · Warehouse forklift injury",
      amount: -1000,
      sub: "Includes $30.00 entry fee · $970.00 principal"
    }, {
      id: "tx2",
      date: "2026-04-15",
      type: "commitment",
      label: "Commitment · Wrongful arrest & excessive force",
      amount: -25000,
      sub: "Includes $750.00 entry fee · $24,250.00 principal"
    }, {
      id: "tx3",
      date: "2026-05-10",
      type: "payout",
      label: "Settlement payout · Warehouse forklift injury",
      amount: 1155.82,
      sub: "Principal $970.00 + profit $185.82 (net of 10% carry)"
    }, {
      id: "tx4",
      date: "2026-05-31",
      type: "commitment",
      label: "Commitment · Wrongful arrest & excessive force",
      amount: -8000,
      sub: "In 48-hour cool-off · withdrawable"
    }]
  };
  const investorDocuments = [{
    id: "d1",
    type: "Settlement statement",
    title: "Settlement statement — Warehouse forklift injury",
    date: "2026-05-10",
    size: "82 KB",
    tag: "settlement"
  }, {
    id: "d2",
    type: "Commitment receipt",
    title: "Commitment receipt — Wrongful arrest & excessive force",
    date: "2026-04-15",
    size: "44 KB",
    tag: "receipt"
  }, {
    id: "d3",
    type: "Commitment receipt",
    title: "Commitment receipt — Warehouse forklift injury",
    date: "2025-12-03",
    size: "44 KB",
    tag: "receipt"
  }, {
    id: "d4",
    type: "Tax document",
    title: "2025 Form 1099 — investment income summary",
    date: "2026-01-31",
    size: "61 KB",
    tag: "tax"
  }, {
    id: "d5",
    type: "Agreement",
    title: "Investor terms & risk disclosure (signed)",
    date: "2026-02-18",
    size: "120 KB",
    tag: "agreement"
  }];

  /* ---------- export ---------- */
  window.JU = {
    ENTRY_FEE,
    CARRY,
    money,
    moneyc,
    pct,
    commitmentBreakdown,
    runDisbursement,
    CATEGORIES,
    JURISDICTIONS,
    RESTRICTED_JURISDICTIONS,
    users,
    investorRoster,
    cases,
    featureFlags,
    platformStats,
    allUsers,
    auditLog,
    notifications,
    platformConfig,
    attorneyOffers,
    plaintiffOnboarding,
    investorWallet,
    investorDocuments,
    catLabel: id => (CATEGORIES.find(c => c.id === id) || {}).label || id
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/data.js", error: String((e && e.message) || e) }); }

// ui_kits/platform/investor.jsx
try { (() => {
/* JustUs Financial UI kit — INVESTOR app screens (faithful recreation)
   Marketplace · case detail (+ commit flow) · portfolio.
   AI outputs are static illustrative data — the source prototype calls the
   live model. */
const {
  Icon,
  Button,
  StatusPill,
  Tag,
  Card,
  Progress,
  Avatar,
  Stat,
  Field,
  Input,
  Select,
  Modal,
  AIBlock,
  ScoreGauge,
  PageHead,
  SubHead,
  Empty
} = window.JustUsFinancialDesignSystem_16316f;
const invUseState = React.useState;

/* ---------- Marketplace ---------- */
function InvCaseCard({
  c,
  match,
  onOpen
}) {
  const raised = (c.commitments || []).reduce((a, m) => a + (m.status !== "withdrawn" ? m.amount : 0), 0);
  return /*#__PURE__*/React.createElement(Card, {
    hover: true,
    onClick: onOpen,
    pad: 0,
    style: {
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 96,
      background: "repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 11px, color-mix(in oklch, var(--accent) 8%, var(--surface-2)) 11px, color-mix(in oklch, var(--accent) 8%, var(--surface-2)) 22px)",
      position: "relative",
      display: "flex",
      alignItems: "flex-end",
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: 12,
      display: "flex",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: c.status
  }), match && /*#__PURE__*/React.createElement(Tag, {
    tone: "accent"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkle",
    size: 12
  }), "Match")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--muted)",
      background: "var(--surface)",
      padding: "2px 7px",
      borderRadius: 5,
      position: "absolute",
      bottom: 10,
      right: 12
    }
  }, JU.catLabel(c.category))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      display: "flex",
      flexDirection: "column",
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 16.5,
      lineHeight: 1.3,
      color: "var(--ink)",
      marginBottom: 8
    }
  }, c.title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--muted)",
      fontSize: 13,
      lineHeight: 1.5,
      marginBottom: 16,
      flex: 1,
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, c.summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12.5,
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ink-soft)",
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums"
    }
  }, JU.money(raised)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "of ", JU.money(c.fundingGoal))), /*#__PURE__*/React.createElement(Progress, {
    value: raised,
    max: c.fundingGoal,
    height: 6
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    tone: "line"
  }, c.jurisdiction), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent-deep)"
    }
  }, "View case ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrowRight",
    size: 14
  })))));
}
function Marketplace({
  interests,
  onOpen
}) {
  const [q, setQ] = invUseState("");
  const [cat, setCat] = invUseState("");
  const [jur, setJur] = invUseState("");
  const [onlyMatch, setOnlyMatch] = invUseState(false);
  const open = JU.cases.filter(c => ["funding", "published"].includes(c.status));
  const isMatch = c => interests.categories.includes(c.category) || interests.jurisdictions.includes(c.jurisdiction);
  let list = open.filter(c => (!q || (c.title + c.summary).toLowerCase().includes(q.toLowerCase())) && (!cat || c.category === cat) && (!jur || c.jurisdiction === jur) && (!onlyMatch || isMatch(c)));
  list = [...list].sort((a, b) => (isMatch(b) ? 1 : 0) - (isMatch(a) ? 1 : 0));
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "Investor \xB7 Case marketplace"
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "Case marketplace",
    sub: "Browse open cases from verified plaintiffs. Personalised matches reflect the causes and jurisdictions in your interests."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 20,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      minWidth: 240
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 17,
    style: {
      position: "absolute",
      left: 13,
      top: 12,
      color: "var(--muted)"
    }
  }), /*#__PURE__*/React.createElement(Input, {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search cases\u2026",
    style: {
      paddingLeft: 38
    }
  })), /*#__PURE__*/React.createElement(Select, {
    value: cat,
    onChange: e => setCat(e.target.value),
    style: {
      width: 200
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All categories"), JU.CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label))), /*#__PURE__*/React.createElement(Select, {
    value: jur,
    onChange: e => setJur(e.target.value),
    style: {
      width: 160
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All jurisdictions"), JU.JURISDICTIONS.map(j => /*#__PURE__*/React.createElement("option", {
    key: j,
    value: j
  }, j))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOnlyMatch(v => !v),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "10px 14px",
      borderRadius: 9,
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: "var(--sans)",
      background: onlyMatch ? "var(--accent-wash)" : "var(--surface)",
      color: onlyMatch ? "var(--accent-deep)" : "var(--ink-soft)",
      border: "1px solid " + (onlyMatch ? "color-mix(in oklch, var(--accent) 40%, transparent)" : "var(--line-strong)")
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkle",
    size: 15
  }), "Matched for me")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
      gap: 16
    }
  }, list.map(c => /*#__PURE__*/React.createElement(InvCaseCard, {
    key: c.id,
    c: c,
    match: isMatch(c),
    onOpen: () => onOpen(c.id)
  }))), list.length === 0 && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Empty, {
    icon: "search",
    title: "No matching cases"
  }, "Try widening your filters.")));
}

/* ---------- Case detail ---------- */
function KV({
  k,
  v
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ink)",
      fontWeight: 600,
      fontVariantNumeric: "tabular-nums"
    }
  }, v));
}
function ProfileChip({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid color-mix(in oklch, var(--accent) 25%, transparent)",
      borderRadius: 9,
      padding: "8px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--muted)",
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--accent-deep)"
    }
  }, value));
}
function InvestorCase({
  id,
  interests,
  onBack,
  onCommit,
  myCommits
}) {
  const c = JU.cases.find(x => x.id === id);
  const [showCommit, setShowCommit] = invUseState(false);
  if (!c) return null;
  const raised = (c.commitments || []).reduce((a, m) => a + (m.status !== "withdrawn" ? m.amount : 0), 0);
  const myHere = myCommits.filter(m => m.caseId === c.id);
  const matched = interests.categories.includes(c.category) || interests.jurisdictions.includes(c.jurisdiction);
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "Investor \xB7 Case detail"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    icon: "chevronLeft",
    onClick: onBack,
    style: {
      marginLeft: -6
    }
  }, "All cases"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    icon: "eye"
  }, "Add to watchlist")), /*#__PURE__*/React.createElement(PageHead, {
    title: c.title,
    pills: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusPill, {
      status: c.status
    }), /*#__PURE__*/React.createElement(Tag, {
      tone: "line"
    }, JU.catLabel(c.category)), /*#__PURE__*/React.createElement(Tag, {
      tone: "line"
    }, c.jurisdiction))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 340px",
      gap: 22,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 18
    }
  }, matched && /*#__PURE__*/React.createElement(AIBlock, {
    title: "Why this matches you",
    compact: true,
    note: "Based on your saved interests. Informational only \u2014 not investment advice."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      flexWrap: "wrap"
    }
  }, interests.categories.includes(c.category) && /*#__PURE__*/React.createElement(Tag, {
    tone: "accent",
    style: {
      textTransform: "capitalize"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), JU.catLabel(c.category).toLowerCase()), interests.jurisdictions.includes(c.jurisdiction) && /*#__PURE__*/React.createElement(Tag, {
    tone: "accent"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), c.jurisdiction))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SubHead, null, "The case"), /*#__PURE__*/React.createElement("p", {
    style: {
      lineHeight: 1.7,
      color: "var(--ink-soft)",
      fontSize: 15,
      margin: 0,
      whiteSpace: "pre-wrap"
    }
  }, c.story)), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SubHead, null, "Evidence on file"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, c.evidence.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      background: "var(--surface-2)",
      borderRadius: 9
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: e.type === "Video" ? "video" : e.type === "Witness" ? "users" : "doc",
    size: 17,
    style: {
      color: "var(--accent-deep)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: "var(--ink)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, e.label)), e.verified && /*#__PURE__*/React.createElement(Icon, {
    name: "checkCircle",
    size: 15,
    style: {
      color: "var(--success)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      marginTop: 12
    }
  }, "Evidence is summarised for backers. Raw files are never exposed through the platform.")), /*#__PURE__*/React.createElement(AIBlock, {
    title: "Case risk & return profile",
    note: "Informational only \u2014 not investment advice. Generated from case data and comparable patterns; outcomes are never guaranteed."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(ProfileChip, {
    label: "Risk",
    value: c.ai.risk
  }), /*#__PURE__*/React.createElement(ProfileChip, {
    label: "Return outlook",
    value: c.ai.rr.split("·")[1]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 20,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    value: c.ai.strength,
    size: 52,
    label: "Case strength"
  }), /*#__PURE__*/React.createElement(ScoreGauge, {
    value: c.ai.completeness,
    size: 52,
    label: "Completeness"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "soft",
    size: "sm",
    icon: "sparkle",
    style: {
      marginTop: 14
    }
  }, "Regenerate"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SubHead, null, "Funding"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      color: "var(--ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, JU.money(raised)), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--muted)",
      fontSize: 13,
      marginBottom: 12
    }
  }, "committed of ", JU.money(c.fundingGoal), " goal"), /*#__PURE__*/React.createElement(Progress, {
    value: raised,
    max: c.fundingGoal,
    height: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 9,
      margin: "16px 0",
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement(KV, {
    k: "Pool entitlement",
    v: JU.pct(c.poolPct, 0)
  }), /*#__PURE__*/React.createElement(KV, {
    k: "Investor entry fee",
    v: "3%"
  }), /*#__PURE__*/React.createElement(KV, {
    k: "Success fee (carry)",
    v: "10% of profit"
  })), myHere.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--accent-wash)",
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: "var(--accent-deep)",
      marginBottom: 4
    }
  }, "You've backed this case"), myHere.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      color: "var(--accent-deep)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, JU.money(m.amount), " committed"), /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: "capitalize"
    }
  }, m.status)))), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    icon: "dollar",
    onClick: () => setShowCommit(true),
    style: {
      width: "100%"
    }
  }, "Commit capital")), /*#__PURE__*/React.createElement(Card, {
    style: {
      background: "var(--surface-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert",
    size: 17,
    style: {
      color: "var(--warn-deep)",
      flexShrink: 0,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      lineHeight: 1.55
    }
  }, "Backing a case is an investment that can lose. If the case loses or the pool doesn't cover your principal, you are not made whole. This is not investment advice."))))), /*#__PURE__*/React.createElement(CommitModal, {
    open: showCommit,
    onClose: () => setShowCommit(false),
    c: c,
    onConfirm: amt => {
      onCommit(c.id, amt);
      setShowCommit(false);
    }
  }));
}

/* ---------- Commit modal ---------- */
function BreakRow({
  k,
  v,
  muted,
  bold
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "5px 0",
      fontSize: bold ? 16 : 14,
      fontWeight: bold ? 700 : 500,
      color: muted ? "var(--muted)" : "var(--ink)"
    }
  }, /*#__PURE__*/React.createElement("span", null, k), /*#__PURE__*/React.createElement("span", null, v));
}
function CommitModal({
  open,
  onClose,
  c,
  onConfirm
}) {
  const [amt, setAmt] = invUseState("");
  const [step, setStep] = invUseState(0);
  React.useEffect(() => {
    if (open) {
      setAmt("");
      setStep(0);
    }
  }, [open]);
  const n = Number(amt) || 0;
  const b = JU.commitmentBreakdown(n);
  const valid = n >= 1000;
  const methods = JU.investorWallet.methods;
  const [methodId, setMethodId] = invUseState(methods[0].id);
  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: onClose,
    title: step === 0 ? "Commit capital" : "Confirm your commitment",
    subtitle: c.title,
    width: 520
  }, step === 0 ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Field, {
    label: "Amount you wish to commit",
    hint: "Minimum $1,000. A 3% platform entry fee is deducted; 97% becomes your principal in the case."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 14,
      top: 12,
      color: "var(--muted)",
      fontSize: 15
    }
  }, "$"), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    value: amt,
    onChange: e => setAmt(e.target.value),
    placeholder: "50,000",
    style: {
      paddingLeft: 26,
      fontSize: 17,
      fontWeight: 600
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      margin: "14px 0"
    }
  }, [5000, 10000, 25000, 50000].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setAmt(String(v)),
    style: {
      flex: 1,
      padding: "8px 0",
      borderRadius: 8,
      border: "1px solid var(--line-strong)",
      background: "var(--surface)",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
      color: "var(--ink-soft)",
      fontFamily: "var(--sans)"
    }
  }, JU.money(v)))), n > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-2)",
      borderRadius: 12,
      padding: 16,
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement(BreakRow, {
    k: "You commit",
    v: JU.moneyc(n)
  }), /*#__PURE__*/React.createElement(BreakRow, {
    k: "Platform entry fee (3%)",
    v: "– " + JU.moneyc(b.fee),
    muted: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      margin: "10px 0"
    }
  }), /*#__PURE__*/React.createElement(BreakRow, {
    k: "Your principal in the case",
    v: JU.moneyc(b.principal),
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: "flex",
      justifyContent: "flex-end",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !valid,
    iconRight: "chevronRight",
    onClick: () => setStep(1)
  }, "Review"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-2)",
      borderRadius: 12,
      padding: 18,
      fontVariantNumeric: "tabular-nums",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(BreakRow, {
    k: "Commitment",
    v: JU.moneyc(n)
  }), /*#__PURE__*/React.createElement(BreakRow, {
    k: "Entry fee (3%)",
    v: "– " + JU.moneyc(b.fee),
    muted: true
  }), /*#__PURE__*/React.createElement(BreakRow, {
    k: "Principal deployed",
    v: JU.moneyc(b.principal),
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: "var(--ink)",
      marginBottom: 8
    }
  }, "Pay from"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, methods.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => setMethodId(m.id),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 10,
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "var(--sans)",
      border: "1px solid " + (methodId === m.id ? "var(--accent)" : "var(--line-strong)"),
      background: methodId === m.id ? "var(--accent-wash)" : "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: m.kind === "card" ? "dollar" : "building",
    size: 18,
    style: {
      color: "var(--accent-deep)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14,
      color: "var(--ink)"
    }
  }, m.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)"
    }
  }, m.detail)), methodId === m.id && /*#__PURE__*/React.createElement(Icon, {
    name: "checkCircle",
    size: 17,
    style: {
      color: "var(--accent-deep)"
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      padding: 14,
      borderRadius: 10,
      background: "var(--accent-wash)",
      color: "var(--accent-deep)",
      fontSize: 13,
      lineHeight: 1.55,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 18,
    style: {
      flexShrink: 0,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "48-hour cool-off."), " Your commitment is held \u2014 not yet deployed \u2014 for 48 hours. You can withdraw it in full from your portfolio during this window, no questions asked.")), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      fontSize: 13,
      color: "var(--ink-soft)",
      lineHeight: 1.5,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    style: {
      marginTop: 2
    },
    defaultChecked: true
  }), /*#__PURE__*/React.createElement("span", null, "I understand this is an investment that can lose, that no carried interest is owed on losses, and that this is not investment advice.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    icon: "chevronLeft",
    onClick: () => setStep(0)
  }, "Back"), /*#__PURE__*/React.createElement(Button, {
    icon: "check",
    onClick: () => onConfirm(n)
  }, "Commit ", JU.money(n)))));
}

/* ---------- Portfolio ---------- */
function Mini({
  k,
  v,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontWeight: 700
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums",
      color: tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--ink)"
    }
  }, v));
}
function Portfolio({
  myCommits,
  onWithdraw,
  onBrowse
}) {
  const rows = myCommits.map((m, idx) => {
    const c = JU.cases.find(x => x.id === m.caseId) || {
      title: "Case",
      status: "funding",
      poolPct: 0.3,
      legalFeesPct: 0.33
    };
    let net = null,
      profit = null,
      state = m.status;
    if (c.status === "settled" && c.settlement && c.settlement.outcome === "win") {
      const dis = JU.runDisbursement({
        settlement: c.settlement.amount,
        legalFeesPct: c.legalFeesPct,
        poolPct: c.poolPct,
        commitments: c.commitments
      });
      const mine = dis.investors.find(i => Math.abs(i.principal - m.principal) < 1);
      if (mine) {
        net = mine.net;
        profit = mine.net - mine.principal;
        state = "settled";
      }
    } else if (c.status === "lost") {
      net = 0;
      profit = -m.principal;
      state = "lost";
    }
    return Object.assign({}, m, {
      c,
      net,
      profit,
      state,
      idx
    });
  });
  const totalCommitted = myCommits.reduce((s, m) => s + m.amount, 0);
  const totalPrincipal = myCommits.reduce((s, m) => s + m.principal, 0);
  const realized = rows.reduce((s, r) => s + (r.net != null ? r.net : 0), 0);
  const active = rows.filter(r => r.net == null);
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "Investor \xB7 Portfolio"
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "My portfolio",
    sub: "Your commitments across all cases, their status, and realised outcomes."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      marginBottom: 24,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 170
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Total committed",
    value: JU.money(totalCommitted),
    icon: "dollar"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 170
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Principal deployed",
    value: JU.money(totalPrincipal),
    sub: "After 3% entry fees"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 170
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Active positions",
    value: active.length
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 170
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Realised returns",
    value: JU.money(realized),
    tone: realized > 0 ? "success" : undefined
  }))), rows.length === 0 ? /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Empty, {
    icon: "pie",
    title: "No positions yet"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: onBrowse,
    icon: "search",
    style: {
      marginTop: 12
    }
  }, "Browse cases"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, rows.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.idx,
    pad: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 9,
      alignItems: "center",
      marginBottom: 7,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: r.c.status
  }), r.state === "cool-off" && /*#__PURE__*/React.createElement(Tag, {
    tone: "accent"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 12
  }), "In cool-off")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 16.5,
      color: "var(--ink)"
    }
  }, r.c.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)"
    }
  }, "Committed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: "var(--ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, JU.money(r.amount)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 24,
      marginTop: 16,
      paddingTop: 16,
      borderTop: "1px solid var(--line)",
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Mini, {
    k: "Principal",
    v: JU.moneyc(r.principal)
  }), /*#__PURE__*/React.createElement(Mini, {
    k: "Entry fee",
    v: JU.moneyc(r.fee)
  }), r.net != null && /*#__PURE__*/React.createElement(Mini, {
    k: "Net return",
    v: JU.moneyc(r.net),
    tone: r.net >= r.principal ? "success" : "danger"
  }), r.profit != null && /*#__PURE__*/React.createElement(Mini, {
    k: r.profit >= 0 ? "Profit" : "Loss",
    v: (r.profit >= 0 ? "+" : "") + JU.moneyc(r.profit),
    tone: r.profit >= 0 ? "success" : "danger"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), r.state === "cool-off" && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "danger",
    onClick: () => onWithdraw(r.idx)
  }, "Withdraw (cool-off)"))))));
}
window.JUKit = window.JUKit || {};
Object.assign(window.JUKit, {
  Marketplace,
  InvestorCase,
  Portfolio
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/investor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/landing.jsx
try { (() => {
/* JustUs Financial UI kit — marketing landing page (faithful recreation)
   Composes design-system components from the compiled bundle. */
const {
  Icon,
  Button,
  StatusPill,
  Tag,
  Card,
  Progress,
  ScoreGauge,
  Brandmark
} = window.JustUsFinancialDesignSystem_16316f;
function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - 68,
    behavior: "smooth"
  });
}
const LANDING_PERSONAS = [{
  role: "plaintiff",
  title: "Plaintiff",
  icon: "user",
  desc: "Publish your case, tell your story with AI help, and attract the funding and representation to pursue it.",
  points: ["Free to publish", "AI strength analysis", "Protected from contact"]
}, {
  role: "investor",
  title: "Investor",
  icon: "trending",
  desc: "Browse verified cases, get AI risk/return profiles, and commit capital for a share of any settlement.",
  points: ["Accredited-only (506c)", "AI case matching", "48-hour cool-off"]
}, {
  role: "attorney",
  title: "Attorney",
  icon: "gavel",
  desc: "Review fundable cases in your jurisdiction with an attorney-lens AI triage, take them on, and update backers.",
  points: ["Jurisdiction-matched", "AI case triage", "Broadcast updates"]
}, {
  role: "admin",
  title: "Administrator",
  icon: "settings",
  desc: "Oversee users, cases and money. Moderate submissions, run disbursements, and manage the Phase 2 roadmap.",
  points: ["Moderation queue", "Disbursement waterfall", "Feature flags"]
}];
function LandingNav({
  scrolled,
  onEnter
}) {
  const links = [["how", "How it works"], ["fees", "The model"], ["roles", "Roles"]];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      transition: "background .2s, box-shadow .2s, border-color .2s",
      background: scrolled ? "color-mix(in oklch, var(--paper) 88%, transparent)" : "transparent",
      backdropFilter: scrolled ? "blur(10px)" : "none",
      borderBottom: "1px solid " + (scrolled ? "var(--line)" : "transparent")
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "0 28px",
      height: 64,
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => scrollToId("top"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Brandmark, {
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 17,
      color: "var(--ink)",
      lineHeight: 1
    }
  }, "JustUs Financial"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "var(--muted)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      marginTop: 2
    }
  }, "Litigation crowdfunding"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 4,
      marginLeft: "auto"
    }
  }, links.map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => scrollToId(id),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--sans)",
      fontWeight: 600,
      fontSize: 14,
      color: "var(--ink-soft)",
      padding: "8px 12px",
      borderRadius: 8,
      whiteSpace: "nowrap"
    }
  }, label))), /*#__PURE__*/React.createElement(Button, {
    onClick: onEnter,
    iconRight: "arrowRight",
    style: {
      marginLeft: 8
    }
  }, "Enter platform")));
}
function HeroVisual() {
  const c = JU.cases.find(x => x.id === "case_webb");
  const raised = c.commitments.reduce((a, m) => a + m.amount, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      minHeight: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 18,
      boxShadow: "0 30px 70px -36px rgba(50,38,12,0.4)",
      overflow: "hidden",
      maxWidth: 380,
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 86,
      background: "repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 11px, color-mix(in oklch, var(--accent) 9%, var(--surface-2)) 11px, color-mix(in oklch, var(--accent) 9%, var(--surface-2)) 22px)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: 14,
      display: "flex",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: "funding"
  }), /*#__PURE__*/React.createElement(Tag, {
    tone: "accent"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkle",
    size: 12
  }), "Match"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 17,
      color: "var(--ink)",
      lineHeight: 1.3,
      marginBottom: 8
    }
  }, c.title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--muted)",
      fontSize: 13,
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, c.summary.slice(0, 96), "\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12.5,
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, JU.money(raised)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "of ", JU.money(c.fundingGoal))), /*#__PURE__*/React.createElement(Progress, {
    value: raised,
    max: c.fundingGoal,
    height: 7
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    tone: "line"
  }, c.jurisdiction), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--muted)"
    }
  }, "2 backers \xB7 ", JU.catLabel(c.category))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 8,
      left: 0,
      background: "var(--surface)",
      border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
      borderRadius: 13,
      padding: "12px 15px",
      boxShadow: "0 18px 40px -22px rgba(50,38,12,0.45)",
      display: "flex",
      alignItems: "center",
      gap: 11,
      maxWidth: 250
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    value: 78,
    size: 46
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--accent-deep)",
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, "AI case strength"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      lineHeight: 1.4,
      marginTop: 2
    }
  }, "Strong evidence; corroborated."))));
}
function SectionLabel({
  children,
  center,
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--mono)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: dark ? "var(--accent)" : "var(--accent-deep)",
      justifyContent: center ? "center" : "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 1.5,
      background: "currentColor"
    }
  }), children);
}
function HowItWorks() {
  const steps = [{
    icon: "doc",
    t: "A case is published",
    d: "A plaintiff posts their case and evidence — for free. AI surfaces ways to strengthen it before it goes live, after a moderation review.",
    who: "Plaintiff"
  }, {
    icon: "trending",
    t: "Investors commit capital",
    d: "Verified accredited investors browse cases, review AI risk/return profiles, and back the ones they believe in — with a 48-hour cool-off.",
    who: "Investor"
  }, {
    icon: "gavel",
    t: "An attorney takes it on",
    d: "An attorney in the right jurisdiction reviews an AI triage summary, claims the case, and posts broadcast updates to all backers.",
    who: "Attorney"
  }, {
    icon: "dollar",
    t: "Settlement is disbursed",
    d: "On a win, the platform runs the waterfall: legal fees, then the investor pool, then the plaintiff — each backer's principal returned before any profit split.",
    who: "Everyone"
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "how",
    style: {
      background: "var(--surface)",
      borderTop: "1px solid var(--line)",
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "clamp(56px, 8vh, 96px) 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 52
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, {
    center: true
  }, "How it works"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--display)",
      fontSize: "clamp(28px, 3.6vw, 40px)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--ink)",
      margin: "16px 0 0"
    }
  }, "One loop. Four parties. One outcome.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
      gap: 22
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 13,
      background: "var(--accent-wash)",
      color: "var(--accent-deep)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 23
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 13,
      color: "var(--muted)"
    }
  }, "0", i + 1)), /*#__PURE__*/React.createElement(Tag, {
    tone: "line",
    style: {
      marginBottom: 10
    }
  }, s.who), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 18,
      color: "var(--ink)",
      marginBottom: 8
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--muted)",
      lineHeight: 1.6
    }
  }, s.d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      padding: "16px 20px",
      borderRadius: 12,
      background: "var(--accent-wash)",
      display: "flex",
      gap: 12,
      alignItems: "center",
      maxWidth: 760,
      marginLeft: "auto",
      marginRight: "auto",
      color: "var(--accent-deep)",
      fontSize: 13.5,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 18,
    style: {
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "A core safeguard:"), " investors never communicate directly with attorneys or plaintiffs. Attorneys update all backers through one open, broadcast-style channel \u2014 so no investor can steer a case."))));
}
function ExRow({
  k,
  v,
  muted,
  bold,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: bold ? 17 : 14.5,
      fontWeight: bold ? 700 : 500,
      color: tone === "success" ? "var(--success)" : muted ? "var(--muted)" : "var(--ink)"
    }
  }, /*#__PURE__*/React.createElement("span", null, k), /*#__PURE__*/React.createElement("span", null, v));
}
function FeeModel() {
  const commit = 50000;
  const b = JU.commitmentBreakdown(commit);
  const profitExample = 9291.18;
  const fees = [{
    pct: "3%",
    who: "Plaintiff entry fee",
    when: "Deducted from the plaintiff's share at case execution — never to publish or raise."
  }, {
    pct: "3%",
    who: "Investor entry fee",
    when: "Deducted at commitment. A $50,000 commitment puts $48,500 of principal to work."
  }, {
    pct: "10%",
    who: "Carried interest",
    when: "Taken only from investor profit, only after principal is returned in full, only on a win."
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "fees",
    style: {
      background: "var(--ink)",
      color: "var(--paper)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "clamp(56px, 9vh, 100px) 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 56,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, {
    dark: true
  }, "Transparent by design"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--display)",
      fontSize: "clamp(28px, 3.6vw, 42px)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      margin: "16px 0 18px",
      lineHeight: 1.1
    }
  }, "The platform wins only when investors do."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16.5,
      lineHeight: 1.65,
      color: "color-mix(in oklch, var(--paper) 78%, transparent)",
      marginBottom: 32
    }
  }, "Flat entry fees keep the platform running; the success fee is purely upside-aligned. It's the same structure venture and private-equity funds use \u2014 carry is paid only on profit, after the investor is made whole."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, fees.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 16,
      padding: "16px 18px",
      borderRadius: 13,
      background: "color-mix(in oklch, var(--paper) 7%, transparent)",
      border: "1px solid color-mix(in oklch, var(--paper) 12%, transparent)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontSize: 28,
      fontWeight: 800,
      color: "var(--accent)",
      lineHeight: 1,
      minWidth: 56,
      fontVariantNumeric: "tabular-nums"
    }
  }, f.pct), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15
    }
  }, f.who), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "color-mix(in oklch, var(--paper) 65%, transparent)",
      marginTop: 4,
      lineHeight: 1.5
    }
  }, f.when)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      color: "var(--ink)",
      borderRadius: 18,
      padding: 28,
      boxShadow: "0 30px 80px -30px rgba(0,0,0,0.5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 16
    }
  }, "Worked example \xB7 one investor"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 11,
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement(ExRow, {
    k: "You commit",
    v: JU.moneyc(commit)
  }), /*#__PURE__*/React.createElement(ExRow, {
    k: "Platform entry fee (3%)",
    v: "– " + JU.moneyc(b.fee),
    muted: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      margin: "3px 0"
    }
  }), /*#__PURE__*/React.createElement(ExRow, {
    k: "Principal working in the case",
    v: JU.moneyc(b.principal),
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "20px 0",
      padding: "14px 16px",
      borderRadius: 11,
      background: "var(--accent-wash)",
      fontSize: 13,
      color: "var(--accent-deep)",
      lineHeight: 1.55
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrowRight",
    size: 14,
    style: {
      verticalAlign: "-2px"
    }
  }), " If the case settles successfully, you get your ", /*#__PURE__*/React.createElement("b", null, JU.moneyc(b.principal)), " principal back ", /*#__PURE__*/React.createElement("b", null, "first"), ". Only the profit above it is split \u2014 you keep 90%, the platform takes 10% carry."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 11,
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement(ExRow, {
    k: "Principal returned",
    v: JU.moneyc(b.principal)
  }), /*#__PURE__*/React.createElement(ExRow, {
    k: "Your profit (90% of upside)",
    v: "+ " + JU.moneyc(profitExample),
    tone: "success"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      margin: "3px 0"
    }
  }), /*#__PURE__*/React.createElement(ExRow, {
    k: "You receive",
    v: JU.moneyc(b.principal + profitExample),
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 9,
      marginTop: 18,
      padding: "11px 13px",
      borderRadius: 10,
      background: "color-mix(in oklch, var(--warn) 13%, transparent)",
      color: "var(--warn-deep)",
      fontSize: 12,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert",
    size: 15,
    style: {
      flexShrink: 0,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, "Illustrative only. Backing a case is an investment that can lose \u2014 if a case loses, no carry is owed and principal is not recovered. Not investment advice."))))));
}
function Roles({
  onEnter
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: "roles",
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "clamp(56px, 9vh, 100px) 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, {
    center: true
  }, "Step into the platform"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--display)",
      fontSize: "clamp(28px, 3.6vw, 42px)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--ink)",
      margin: "16px 0 12px"
    }
  }, "Choose your role to begin."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: "var(--muted)",
      maxWidth: 560,
      margin: "0 auto",
      lineHeight: 1.6
    }
  }, "This is a working prototype with illustrative data \u2014 this UI kit demonstrates the investor experience.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: 18
    }
  }, LANDING_PERSONAS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.role,
    onClick: onEnter,
    className: "ju-persona",
    style: {
      textAlign: "left",
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 24,
      cursor: "pointer",
      fontFamily: "var(--sans)",
      display: "flex",
      flexDirection: "column",
      transition: "transform .18s, box-shadow .18s, border-color .18s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 12,
      background: "var(--accent-wash)",
      color: "var(--accent-deep)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: p.icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 20,
      color: "var(--ink)",
      marginBottom: 8
    }
  }, p.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--muted)",
      lineHeight: 1.55,
      marginBottom: 16,
      flex: 1
    }
  }, p.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginBottom: 18
    }
  }, p.points.map((pt, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12.5,
      color: "var(--ink-soft)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13,
    style: {
      color: "var(--accent-deep)"
    }
  }), pt))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontWeight: 700,
      fontSize: 13.5,
      color: "var(--accent-deep)",
      whiteSpace: "nowrap"
    }
  }, "Enter as ", p.title, " ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrowRight",
    size: 15
  }))))));
}
function LandingFooter() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--ink)",
      color: "var(--paper)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "56px 28px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 40,
      flexWrap: "wrap",
      alignItems: "flex-start",
      paddingBottom: 36,
      borderBottom: "1px solid color-mix(in oklch, var(--paper) 14%, transparent)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Brandmark, {
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 18
    }
  }, "JustUs Financial"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "color-mix(in oklch, var(--paper) 55%, transparent)",
      letterSpacing: "0.1em",
      textTransform: "uppercase"
    }
  }, "Litigation crowdfunding"))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13.5,
      color: "color-mix(in oklch, var(--paper) 62%, transparent)",
      lineHeight: 1.6
    }
  }, "Aligning plaintiffs, investors and attorneys around a single outcome \u2014 so the merit of a case decides who gets justice."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 20,
      flexWrap: "wrap",
      marginTop: 26,
      fontSize: 12,
      color: "color-mix(in oklch, var(--paper) 48%, transparent)",
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("span", null, "Prototype with illustrative data \xB7 not investment, legal, or financial advice."), /*#__PURE__*/React.createElement("span", null, "\xA9 2026 JustUs Financial \xB7 Phase 1 \xB7 Reg D 506(c)"))));
}
function Landing({
  onEnter
}) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "Landing page",
    style: {
      background: "var(--paper)",
      minHeight: "100vh"
    }
  }, /*#__PURE__*/React.createElement(LandingNav, {
    scrolled: scrolled,
    onEnter: onEnter
  }), /*#__PURE__*/React.createElement("section", {
    id: "top",
    style: {
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--ink) 6%, transparent) 1px, transparent 0)",
      backgroundSize: "26px 26px",
      opacity: 0.5,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "clamp(50px, 8vh, 96px) 28px 70px",
      display: "grid",
      gridTemplateColumns: "1.05fr 0.95fr",
      gap: 48,
      alignItems: "center",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 13px",
      borderRadius: 999,
      background: "var(--accent-wash)",
      color: "var(--accent-deep)",
      fontSize: 12.5,
      fontWeight: 700,
      marginBottom: 24,
      border: "1px solid color-mix(in oklch, var(--accent) 22%, transparent)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "Phase 1 \xB7 Accredited investors only \xB7 Reg D 506(c)"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--display)",
      fontSize: "clamp(36px, 5vw, 60px)",
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1.04,
      color: "var(--ink)",
      margin: 0,
      textWrap: "balance"
    }
  }, "When merit, not money, decides who gets justice."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      color: "var(--ink-soft)",
      lineHeight: 1.6,
      marginTop: 22,
      maxWidth: 540
    }
  }, "JustUs Financial lets people who've been wronged publish their case and receive backing from verified investors \u2014 so a well-resourced opponent no longer means an unwinnable fight. Plaintiffs, investors and attorneys, aligned around a single outcome."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 32,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: () => scrollToId("roles"),
    iconRight: "arrowRight"
  }, "Choose your role"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "outline",
    onClick: () => scrollToId("how")
  }, "See how it works"))), /*#__PURE__*/React.createElement(HeroVisual, null))), /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: "1px solid var(--line)",
      borderBottom: "1px solid var(--line)",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "0 28px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
    }
  }, [["scale", "Aligned by design", "The platform only profits when investors do."], ["shield", "Verified investors", "Independent third-party accreditation."], ["lock", "Funds you can trust", "Stripe-processed; raw bank details never stored."], ["sparkle", "AI assists, never decides", "Every output is labelled and auditable."]].map(([icon, t, d], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 13,
      padding: "26px 22px",
      borderLeft: i ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-deep)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14.5,
      color: "var(--ink)"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      marginTop: 3,
      lineHeight: 1.5
    }
  }, d)))))), /*#__PURE__*/React.createElement(HowItWorks, null), /*#__PURE__*/React.createElement(FeeModel, null), /*#__PURE__*/React.createElement(Roles, {
    onEnter: onEnter
  }), /*#__PURE__*/React.createElement(LandingFooter, null));
}
window.JUKit = window.JUKit || {};
window.JUKit.Landing = Landing;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/landing.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Brandmark = __ds_scope.Brandmark;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ICONS = __ds_scope.ICONS;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.Spinner = __ds_scope.Spinner;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.STATUS_STYLE = __ds_scope.STATUS_STYLE;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.AIBlock = __ds_scope.AIBlock;

__ds_ns.Empty = __ds_scope.Empty;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.ScoreGauge = __ds_scope.ScoreGauge;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.PageHead = __ds_scope.PageHead;

__ds_ns.SectionTitle = __ds_scope.SectionTitle;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.SubHead = __ds_scope.SubHead;

})();
