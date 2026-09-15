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

const TARGETS = ["stroke", "fill", "text"];
const shadesPerBase = BASE_COLORS.map((e) => shadesOf(e.color));

function locate(hex) {
  for (let i = 0; i < BASE_COLORS.length; i++) {
    const idx = shadesPerBase[i].indexOf(hex);
    if (idx !== -1) return { base: i, intensity: idx };
  }
  return { base: -1, intensity: -1 };
}

function inkClass(hex) {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

const matrices = {};

TARGETS.forEach((target) => {
  const root = document.getElementById(`matrix-${target}`);
  const header = document.createElement("div");
  header.className = "matrix-header";
  header.innerHTML = "<span></span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>";
  root.append(header);

  const rows = BASE_COLORS.map((entry, i) => {
    const row = document.createElement("div");
    row.className = "matrix-row";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "base-chip";
    chip.style.background = entry.color;
    chip.title = `${entry.name} (base)`;
    chip.setAttribute("aria-label", `${entry.name} base`);

    const cells = Array.from({ length: 5 }, (_, j) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.style.background = shadesPerBase[i][j];
      cell.title = `${entry.name} ${j + 1} · ${shadesPerBase[i][j].toUpperCase()}`;
      cell.setAttribute("aria-label", `${entry.name} intensidade ${j + 1}`);
      row.append(cell);
      return cell;
    });

    row.prepend(chip);
    root.append(row);
    return { row, chip, cells };
  });

  matrices[target] = rows;
});

function applyPick(target, base, intensity) {
  state[target] = shadesPerBase[base][intensity];
  refreshScene();
  refreshHex();
  refreshMatrices();
}

function refreshMatrices() {
  TARGETS.forEach((target) => {
    const current = state[target];
    const loc = locate(current);
    matrices[target].forEach(({ row, chip, cells }, i) => {
      const isGroup = i === loc.base;
      chip.classList.toggle("active", isGroup);
      row.classList.toggle("dimmed", loc.base !== -1 && !isGroup);
      cells.forEach((cell, j) => {
        const selected = isGroup && j === loc.intensity;
        cell.classList.toggle("selected", selected);
        cell.classList.toggle("ink-dark", selected && inkClass(shadesPerBase[i][j]) === "ink-dark");
        cell.classList.toggle("ink-light", selected && inkClass(shadesPerBase[i][j]) === "ink-light");
      });
    });
  });
}

function refreshHex() {
  TARGETS.forEach((t) => {
    document.getElementById(`hex-${t}`).textContent = state[t].toUpperCase();
  });
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

TARGETS.forEach((target) => {
  const root = document.getElementById(`matrix-${target}`);
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const row = btn.closest(".matrix-row");
    const rows = Array.from(root.querySelectorAll(".matrix-row"));
    const i = rows.indexOf(row);
    if (i === -1) return;
    const j = btn.classList.contains("base-chip") ? 3 : Array.from(row.querySelectorAll(".cell")).indexOf(btn);
    applyPick(target, i, j);
  });
});

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
refreshMatrices();
refreshScene();
