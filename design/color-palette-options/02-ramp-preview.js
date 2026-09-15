const BASE_COLORS = [
  { name: "Grey", color: "#868e96" },
  { name: "Red", color: "#e03131" },
  { name: "Orange", color: "#f08c00" },
  { name: "Yellow", color: "#f5c518" },
  { name: "Green", color: "#2f9e44" },
  { name: "Blue", color: "#1971c2" },
  { name: "Purple", color: "#6741d9" },
  { name: "Pink", color: "#d6336c" },
];

function hexToHsl(hex) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function shadesOf(hex) {
  const [h, s] = hexToHsl(hex);
  const sat = Math.max(s, 8);
  return [
    hslToHex(h, sat * 0.55, 92),
    hslToHex(h, sat * 0.75, 78),
    hex,
    hslToHex(h, sat, 42),
    hslToHex(h, sat, 26),
  ];
}

const state = {
  stroke: shadesOf(BASE_COLORS[6].color)[3],
  fill: shadesOf(BASE_COLORS[3].color)[1],
  text: "auto",
  strokeOpacity: 100,
  fillOpacity: 100,
};

const AUTO = "auto";

function resolveText() {
  return state.text === AUTO ? state.stroke : state.text;
}

const TARGETS = ["stroke", "fill", "text"];

function locate(hex) {
  for (let i = 0; i < BASE_COLORS.length; i++) {
    const idx = shadesOf(BASE_COLORS[i].color).indexOf(hex);
    if (idx !== -1) return { base: i, intensity: idx };
  }
  return { base: -1, intensity: -1 };
}

function inkClass(hex) {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

function previewSvg(target, color) {
  if (target === "stroke") {
    return `<svg width="84" height="44" viewBox="0 0 84 44">
      <rect x="4" y="4" width="76" height="36" rx="5" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>
    </svg>`;
  }
  if (target === "fill") {
    return `<svg width="84" height="44" viewBox="0 0 84 44">
      <rect x="4" y="4" width="76" height="36" rx="5" fill="${color}" stroke="var(--element-stroke)" stroke-width="2"/>
    </svg>`;
  }
  return `<svg width="84" height="44" viewBox="0 0 84 44">
    <text x="42" y="29" text-anchor="middle" fill="${color}" font-family="var(--font-ui)" font-size="20" font-weight="600">Aa 01</text>
  </svg>`;
}

let openPopover = null;

function closePopover() {
  if (openPopover) {
    openPopover.el.remove();
    openPopover = null;
  }
}

function openRamp(target, anchorRect, forcedBase = null) {
  closePopover();
  const current = state[target];
  const loc = locate(target === "text" ? resolveText() : current);
  const candidate = {
    base: forcedBase ?? (loc.base === -1 ? 6 : loc.base),
    intensity: forcedBase === null ? Math.max(0, loc.intensity) : 3,
  };

  const el = document.createElement("div");
  el.className = "color-popover";
  el.setAttribute("role", "menu");

  const header = document.createElement("div");
  header.className = "pop-header";
  const title = document.createElement("span");
  title.className = "pop-title";
  const hex = document.createElement("span");
  hex.className = "pop-hex";
  header.append(title, hex);

  const preview = document.createElement("div");
  preview.className = "pop-preview";

  const ramp = document.createElement("div");
  ramp.className = "ramp";

  const hint = document.createElement("div");
  hint.className = "pop-hint";
  hint.innerHTML = "<kbd>esc</kbd> fecha";

  const cells = Array.from({ length: 5 }, (_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ramp-cell";
    btn.addEventListener("click", () => {
      state[target] = shadesOf(BASE_COLORS[candidate.base].color)[i];
      commit();
    });
    btn.addEventListener("mouseenter", () => paintCandidate(i));
    ramp.append(btn);
    return btn;
  });

  function paintCandidate(intensity) {
    const shades = shadesOf(BASE_COLORS[candidate.base].color);
    const c = shades[intensity];
    hex.textContent = c.toUpperCase();
    title.textContent = `${BASE_COLORS[candidate.base].name} · ${intensity + 1}`;
    preview.innerHTML = previewSvg(target, c);
    cells.forEach((cell, i) => {
      cell.style.background = shades[i];
      const selected = i === intensity;
      cell.classList.toggle("selected", selected);
      cell.classList.toggle("ink-light", selected && inkClass(shades[i]) === "ink-light");
    });
  }

  function commit() {
    refreshScene();
    refreshChips();
    paintBaseDots();
    closePopover();
  }

  const opacityWrap = document.createElement("div");
  opacityWrap.className = "pop-opacity";
  if (target !== "text") {
    const head = document.createElement("div");
    head.className = "panel-subtitle-row";
    const label = document.createElement("span");
    label.className = "panel-subtitle";
    label.textContent = "Opacity";
    const val = document.createElement("span");
    val.className = "slider-value";
    val.textContent = state[`${target}Opacity`];
    head.append(label, val);
    const slider = document.createElement("input");
    slider.className = "mini-slider";
    slider.type = "range";
    slider.min = 0;
    slider.max = 100;
    slider.step = 5;
    slider.value = state[`${target}Opacity`];
    slider.setAttribute("aria-label", "Opacity");
    slider.addEventListener("input", () => {
      state[`${target}Opacity`] = Number(slider.value);
      val.textContent = slider.value;
      refreshScene();
    });
    opacityWrap.append(head, slider);
  }

  el.append(header, preview, ramp);
  if (target !== "text") el.append(opacityWrap);
  el.append(hint);
  document.body.append(el);

  const popW = 232;
  let x = anchorRect.left;
  if (x + popW > window.innerWidth - 8) x = window.innerWidth - popW - 8;
  if (x < 8) x = 8;
  el.style.left = `${x}px`;
  el.style.top = `${anchorRect.bottom + 6}px`;

  paintCandidate(candidate.intensity);
  cells[candidate.intensity].focus();

  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(4, Math.max(0, candidate.intensity + dir));
      candidate.intensity = next;
      paintCandidate(next);
      cells[next].focus();
    }
    e.stopPropagation();
  });

  openPopover = { el };
}

function refreshChips() {
  TARGETS.forEach((t) => {
    const c = state[t];
    const resolved = t === "text" ? resolveText() : c;
    const loc = locate(resolved);
    document.getElementById(`hex-${t}`).textContent = resolved.toUpperCase();
    document.getElementById(`chip-swatch-${t}`).style.background = resolved;
    document.getElementById(`chip-name-${t}`).textContent =
      t === "text" && c === AUTO
        ? "Auto · stroke"
        : loc.base === -1
          ? resolved.toUpperCase()
          : `${BASE_COLORS[loc.base].name} · I${loc.intensity + 1}`;
  });
  paintAutoDot();
}

let autoDot = null;

function paintBaseDots() {
  TARGETS.forEach((t) => {
    const isAuto = t === "text" && state.text === AUTO;
    if (autoDot) autoDot.classList.toggle("active", isAuto);
    const loc2 = locate(t === "text" ? resolveText() : state[t]);
    dotBtns[t].forEach((dot, i) => dot.classList.toggle("active", !isAuto && i === loc2.base));
  });
}

function paintAutoDot() {
  if (!autoDot) return;
  autoDot.style.background = `linear-gradient(135deg, ${state.stroke} 50%, var(--bg-surface) 50%)`;
}

const dotBtns = {};
TARGETS.forEach((t) => {
  const wrap = document.getElementById(`dots-${t}`);

  if (t === "text") {
    const colorDots = BASE_COLORS.slice(0, BASE_COLORS.length - 1);
    autoDot = document.createElement("button");
    autoDot.type = "button";
    autoDot.className = "base-dot auto";
    autoDot.title = "Auto (segue o stroke)";
    autoDot.setAttribute("aria-label", "Auto - segue a cor do stroke");
    autoDot.addEventListener("click", () => {
      state.text = AUTO;
      refreshScene();
      refreshChips();
      paintBaseDots();
      closePopover();
    });
    wrap.append(autoDot);

    dotBtns[t] = colorDots.map((entry, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "base-dot";
      dot.style.background = entry.color;
      dot.title = entry.name;
      dot.setAttribute("aria-label", `${entry.name}`);
      dot.addEventListener("click", () => {
        const rect = dot.getBoundingClientRect();
        refreshScene();
        refreshChips();
        openRamp(t, rect, i);
      });
      wrap.append(dot);
      return dot;
    });
  } else {
    dotBtns[t] = BASE_COLORS.map((entry, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "base-dot";
      dot.style.background = entry.color;
      dot.title = entry.name;
      dot.setAttribute("aria-label", `${entry.name}`);
      dot.addEventListener("click", () => {
        const rect = dot.getBoundingClientRect();
        refreshScene();
        refreshChips();
        openRamp(t, rect, i);
      });
      wrap.append(dot);
      return dot;
    });
  }
  const chip = document.getElementById(`chip-${t}`);
  chip.addEventListener("click", () => {
    const rect = chip.getBoundingClientRect();
    openRamp(t, rect);
  });
});

function refreshScene() {
  const main = document.getElementById("el-main");
  const label = document.getElementById("el-label");
  main.style.stroke = state.stroke;
  main.style.strokeOpacity = state.strokeOpacity / 100;
  main.style.fill = state.fill;
  main.style.fillOpacity = state.fillOpacity / 100;
  label.style.fill = resolveText();
}

document.addEventListener("pointerdown", (e) => {
  if (!openPopover) return;
  const t = e.target;
  if (!openPopover.el.contains(t) && !t.closest(".current-color") && !t.closest(".base-dot")) {
    closePopover();
  }
});

document.querySelector(".theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
});

refreshChips();
paintBaseDots();
refreshScene();
