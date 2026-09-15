const BASE_COLORS = [
  { name: "Grey", color: "#868e96" },
  { name: "Red", color: "#e03131" },
  { name: "Orange", color: "#f08c00" },
  { name: "Yellow", color: "#f5c518" },
  { name: "Green", color: "#2f9e44" },
  { name: "Cyan", color: "#0c8599" },
  { name: "Blue", color: "#1971c2" },
  { name: "Purple", color: "#6741d9" },
  { name: "Pink", color: "#d6336c" },
  { name: "Brown", color: "#a65e3f" },
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
  text: shadesOf(BASE_COLORS[0].color)[4],
  strokeOpacity: 100,
  fillOpacity: 100,
};

function inkClass(hex) {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

function createInlinePalette(root, { label, getKey, setKey }) {
  const grid = document.createElement("div");
  grid.className = "base-grid";
  const trayWrap = document.createElement("div");
  trayWrap.className = "tray-wrap";
  const trayClip = document.createElement("div");
  trayClip.className = "tray-clip";
  const tray = document.createElement("div");
  tray.className = "shade-tray";
  const shadeRow = document.createElement("div");
  shadeRow.className = "shade-row";
  const meta = document.createElement("div");
  meta.className = "shade-meta";
  const steps = document.createElement("div");
  steps.className = "shade-steps";
  steps.innerHTML = "<span>suave</span><span>claro</span><span>base</span><span>forte</span><span>sólido</span>";

  const baseBtns = BASE_COLORS.map((entry, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.title = entry.name;
    btn.setAttribute("aria-label", `${label} ${entry.name}`);
    btn.addEventListener("click", () => {
      trayWrap.classList.toggle("open", expanded !== i);
      expanded = expanded === i ? null : i;
      update();
    });
    grid.append(btn);
    return btn;
  });

  const shadeBtns = Array.from({ length: 5 }, (_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.addEventListener("click", () => {
      const shade = shadesOf(BASE_COLORS[expanded].color)[i];
      setKey(shade);
      refreshScene();
      refreshHex();
      expanded = null;
      trayWrap.classList.remove("open");
      update();
    });
    shadeRow.append(btn);
    return btn;
  });

  tray.append(shadeRow, meta, steps);
  trayClip.append(tray);
  trayWrap.append(trayClip);
  root.append(grid, trayWrap);

  let expanded = null;

  function update() {
    const current = getKey();
    const shadesPerBase = BASE_COLORS.map((e) => shadesOf(e.color));

    baseBtns.forEach((btn, i) => {
      const shades = shadesPerBase[i];
      const inGroup = shades.includes(current);
      btn.style.background = inGroup ? current : BASE_COLORS[i].color;
      btn.classList.toggle("active", inGroup);
      btn.classList.toggle("ink-dark", inGroup && inkClass(current) === "ink-dark");
      btn.classList.toggle("ink-light", inGroup && inkClass(current) === "ink-light");
    });

    if (expanded !== null) {
      const shades = shadesPerBase[expanded];
      shadeBtns.forEach((btn, i) => {
        btn.style.background = shades[i];
        const selected = current === shades[i];
        btn.classList.toggle("active", selected);
        btn.classList.toggle("ink-dark", selected && inkClass(shades[i]) === "ink-dark");
        btn.classList.toggle("ink-light", selected && inkClass(shades[i]) === "ink-light");
        btn.title = `${BASE_COLORS[expanded].name} ${i + 1} · ${shades[i].toUpperCase()}`;
      });
      meta.innerHTML = `<b>${BASE_COLORS[expanded].name}</b><span>intensidade</span>`;
    }
  }

  update();
  return { update };
}

function refreshScene() {
  const main = document.getElementById("el-main");
  const label = document.getElementById("el-label");
  main.style.stroke = state.stroke;
  main.style.strokeOpacity = state.strokeOpacity / 100;
  main.style.fill = state.fill;
  main.style.fillOpacity = state.fillOpacity / 100;
  label.style.fill = state.text;
}

const _palettes = [
  createInlinePalette(document.getElementById("palette-stroke"), {
    label: "Stroke",
    getKey: () => state.stroke,
    setKey: (v) => (state.stroke = v),
  }),
  createInlinePalette(document.getElementById("palette-fill"), {
    label: "Fill",
    getKey: () => state.fill,
    setKey: (v) => (state.fill = v),
  }),
  createInlinePalette(document.getElementById("palette-text"), {
    label: "Text",
    getKey: () => state.text,
    setKey: (v) => (state.text = v),
  }),
];

function refreshHex() {
  document.getElementById("hex-stroke").textContent = state.stroke.toUpperCase();
  document.getElementById("hex-fill").textContent = state.fill.toUpperCase();
  document.getElementById("hex-text").textContent = state.text.toUpperCase();
}

for (const id of ["stroke", "fill"]) {
  const slider = document.getElementById(`slider-${id}-opacity`);
  slider.addEventListener("input", () => {
    state[`${id}Opacity`] = Number(slider.value);
    document.getElementById(`val-${id}-opacity`).textContent = slider.value;
    refreshScene();
  });
}

document.querySelector(".theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
});

refreshHex();
refreshScene();
