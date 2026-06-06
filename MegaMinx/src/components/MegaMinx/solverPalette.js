/**
 * Палитра и имена граней для solver (должны совпадать с Solver/pieces.js).
 * face1..face12 — геометрия симулятора; цвета через robotFaceMap.js (U, F, …).
 */
export const SOLVER_FACE_NAMES = [
    "blue",
    "pink",
    "yellow",
    "red",
    "green",
    "lightpurple",
    "lightblue",
    "lightbrown",
    "lightgreen",
    "orange",
    "purple",
    "white",
];

/** Стандартные hex оригинального MegaMinx (запасной вариант) */
export const SOLVER_FACE_HEX = [
    "#0000ff",
    "#ff80ce",
    "#ffff00",
    "#ff0000",
    "#008000",
    "#c585f7",
    "#4fc3f7",
    "#c39b77",
    "#64dd17",
    "#ffa500",
    "#800080",
    "#ffffff",
];

/**
 * Цвет центра грани face1..face12 (индекс = геометрия симулятора).
 * Соответствие кодов робота — ROBOT_FACE_TO_SIM.
 */
export const VISUAL_FACE_HEX = [
    "#FCCE87", // face1  FR — бежевый
    "#5ad0e2", // face2  FL — голубой
    "#96938E", // face3  D  — серый
    "#ED72AA", // face4  DR — розовый
    "#CC0C00", // face5  R  — красный
    "#3A7728", // face6  F  — зелёный
    "#FFD816", // face7  BL — жёлтый
    "#930FA5", // face8  L  — фиолетовый
    "#F96B07", // face9  DL — оранжевый
    "#BEF702", // face10 B  — салатовый
    "#0038A8", // face11 BR — синий
    "#ffffff", // face12 U  — белый
];

export function buildHexToColor(faceHex = VISUAL_FACE_HEX) {
    const map = {};
    SOLVER_FACE_NAMES.forEach((name, i) => {
        const key = String(faceHex[i]).replace("#", "").toLowerCase();
        map[key] = name;
    });
    return map;
}
