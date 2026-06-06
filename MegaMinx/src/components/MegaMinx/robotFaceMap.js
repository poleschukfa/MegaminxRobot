/** Какую грань робота показывать камерой при загрузке (F = передняя) */
export const DEFAULT_VIEW_ROBOT_FACE = "F";

/**
 * Коды робота (U, F, …) → номер грани симулятора ("1".."12").
 * Должно совпадать с подписями в solverPalette.js VISUAL_FACE_HEX.
 */
export const ROBOT_FACE_TO_SIM = {
  U: "12",
  D: "3",
  F: "6",
  B: "10",
  L: "8",
  R: "5",
  BL: "7",
  BR: "11",
  FL: "2",
  FR: "1",
  DL: "9",
  DR: "4",
};

export const robotFaceToSimMove = (face, direction) => {
  const simFace = ROBOT_FACE_TO_SIM[String(face || "").toUpperCase()];
  if (!simFace) return null;
  return direction === "cw" ? simFace : `${simFace}'`;
};

export const parseRobotPathMove = (token) => {
  const trimmed = String(token || "").trim();
  if (!trimmed) return null;
  const ccw = trimmed.endsWith("'");
  const faceCode = ccw ? trimmed.slice(0, -1) : trimmed;
  return robotFaceToSimMove(faceCode, ccw ? "ccw" : "cw");
};

/** sim face "6" / "6'" → robot "F" / "F'" */
export const SIM_TO_ROBOT_FACE = Object.fromEntries(
  Object.entries(ROBOT_FACE_TO_SIM).map(([robot, sim]) => [String(sim), robot])
);

export function simMoveToRobotMove(simMove) {
  const trimmed = String(simMove || "").trim();
  if (!trimmed) return "";
  const ccw = trimmed.endsWith("'");
  const simNum = ccw ? trimmed.slice(0, -1) : trimmed;
  const robot = SIM_TO_ROBOT_FACE[simNum];
  if (!robot) return trimmed;
  return ccw ? `${robot}'` : robot;
}

/** "6.6'.12" → "F.F'.U" */
export function simPathToRobotPath(simPath) {
  return String(simPath || "")
    .split(".")
    .map((t) => t.trim())
    .filter(Boolean)
    .map(simMoveToRobotMove)
    .join(".");
}

export const isAllowedParentOrigin = (origin) => {
  if (!origin || origin === "null") return false;
  try {
    const parent = new URL(origin);
    const here = new URL(window.location.href);
    if (parent.origin === here.origin) return true;
    if (parent.hostname === here.hostname) return true;
  } catch (_) {
    /* ignore */
  }
  return /^https?:\/\/([\w-]+\.)?roborubiks\.ru$/i.test(origin);
};
