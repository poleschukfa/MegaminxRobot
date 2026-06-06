import { robotFaceToSimMove, parseRobotPathMove } from "./robotFaceMap";

/** Wall-clock duration of one face turn in the embed (viewer) simulator. */
export const EMBED_TURN_DURATION_MS = 80;

/** Degrees of rotation per millisecond for embed turns (72° per turn). */
export const embedDegreesPerMs = () => 72 / EMBED_TURN_DURATION_MS;

/** Shared sim state — survives React re-renders. */
export const megaminxBridge = {
  moveQueue: [],
  faceToRotate: "face0",
  counter: 0,
  speed: 12,
  speedHolder: 12,
  speedChanged: false,
  animateStarted: false,
  pendingColors: null,
  embedPaintEnabled: false,
  embedLang: null,
  embedUi: null,
};

export function isSimulatorIdle() {
  const b = megaminxBridge;
  return b.moveQueue.length === 0 && b.faceToRotate === "face0" && b.counter === 0;
}

export function simulatorPendingMoves() {
  const b = megaminxBridge;
  const inTurn = b.faceToRotate !== "face0" || b.counter !== 0;
  return b.moveQueue.length + (inTurn ? 1 : 0);
}

export function applyRobotCommand(data) {
  if (!data || !data.command) return;
  const q = megaminxBridge.moveQueue;

  if (data.command === "rotate") {
    const { face, direction } = data.params || {};
    const simMove = robotFaceToSimMove(face, direction);
    if (simMove) q.push(simMove);
    return;
  }

  if (data.command === "execute_path") {
    const path = data.params?.path || "";
    for (const token of String(path).split(".")) {
      const simMove = parseRobotPathMove(token);
      if (simMove) q.push(simMove);
    }
    return;
  }

  if (data.command === "go_to_init") {
    q.length = 0;
    megaminxBridge.faceToRotate = "face0";
    megaminxBridge.counter = 0;
    return;
  }

  if (data.command === "set_stickers" || data.command === "set_face_colors") {
    const params = data.params || data;
    if (typeof window.roborubiksApplyFaceColors === "function") {
      window.roborubiksApplyFaceColors(params);
    } else {
      megaminxBridge.pendingColors = params;
    }
  }
}

export function installMegaminxBridge() {
  if (typeof window === "undefined") return;

  window.roborubiksReceiveCommand = (payload) => {
    if (!payload) return;
    if (payload.type === "megaminx_command") {
      applyRobotCommand({ command: payload.command, params: payload.params || {} });
      return;
    }
    if (payload.command) {
      applyRobotCommand(payload);
      return;
    }
    if (payload.stickers || payload.faces) {
      if (typeof window.roborubiksApplyFaceColors === "function") {
        window.roborubiksApplyFaceColors(payload);
      } else {
        megaminxBridge.pendingColors = payload;
      }
    }
  };
}

installMegaminxBridge();
