import { ROBOT_FACE_TO_SIM } from "./robotFaceMap";

import { SOLVER_FACE_NAMES, VISUAL_FACE_HEX } from "./solverPalette";

const COLOR_NAME_TO_HEX = Object.fromEntries(
  SOLVER_FACE_NAMES.map((name, i) => [name, VISUAL_FACE_HEX[i]])
);
// Имена с viewer/робота (U,D,F,…) → hex центра грани по ROBOT_FACE_TO_SIM
const ROBOT_COLOR_ALIASES = {
  white: "#ffffff",
  grey: "#96938E",
  gray: "#96938E",
  green: "#3A7728",
  salad: "#BEF702",
  purple: "#930FA5",
  red: "#CC0C00",
  yellow: "#FFD816",
  blue: "#0038A8",
  pink: "#ED72AA",
  desert: "#FCCE87",
  lightblue: "#5ad0e2",
  light_blue: "#5ad0e2",
  orange: "#F96B07",
};
Object.assign(COLOR_NAME_TO_HEX, ROBOT_COLOR_ALIASES);

function resolveRobotColor(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (s.startsWith("#")) return s.length === 7 ? s : null;
  const key = s.toLowerCase().replace(/\s+/g, "_");
  return COLOR_NAME_TO_HEX[key] || COLOR_NAME_TO_HEX[s.toLowerCase()] || null;
}

function resolveSimFace(face) {
  if (face == null) return null;
  if (typeof face === "number" && face >= 1 && face <= 12) return face;
  const s = String(face).trim();
  if (/^(?:[1-9]|1[0-2])$/.test(s)) return parseInt(s, 10);
  const sim = ROBOT_FACE_TO_SIM[s.toUpperCase()];
  return sim ? parseInt(sim, 10) : null;
}

function coloredMeshIndex(piece) {
  if (piece === 0 || piece === "center") return 1;
  const p = typeof piece === "number" ? piece : parseInt(String(piece), 10);
  if (!Number.isFinite(p)) return null;
  return 2 * p + 1;
}

export function applyPieceColors(decaObject, payload) {
  if (!decaObject || !payload) return;

  const stickers = [];
  if (Array.isArray(payload.stickers)) stickers.push(...payload.stickers);
  if (payload.faces && typeof payload.faces === "object") {
    for (const [face, color] of Object.entries(payload.faces)) {
      stickers.push({ face, piece: 0, color });
    }
  }

  for (const s of stickers) {
    const face = resolveSimFace(s.face ?? s.f);
    const piece = s.piece ?? s.p ?? (s.slot === "center" ? 0 : s.slot);
    const idx = coloredMeshIndex(piece);
    const hex = resolveRobotColor(s.color ?? s.c);
    if (!face || idx == null || !hex) continue;
    const group = decaObject[`face${face}`];
    const mesh = group?.front?.[idx];
    if (mesh?.material?.color) mesh.material.color.set(hex);
  }
}
