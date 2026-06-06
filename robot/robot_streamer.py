#!/usr/bin/env python3
"""
Roborubiks: 3 камеры (OpenCV) → склейка → WebRTC + Socket.IO + мост на Python WS.
Заменяет broadcast.html. Сервер Node.js не меняем.

Установка:
  python3 -m venv .venv-streamer && source .venv-streamer/bin/activate
  pip install -r scripts/requirements-streamer.txt

Запуск (из каталога robot/):
  export ROBORUBIKS_URL=https://roborubiks.ru
  export PYTHON_WS_URL=ws://127.0.0.1:8765
  export CAMERA_IDS=0,1,2
  python3 robot_streamer.py

Mac SSL: если CERTIFICATE_VERIFY_FAILED — pip install certifi (уже в requirements)
  или один раз: /Applications/Python\\ 3.13/Install\\ Certificates.command
  или только для отладки: export ROBORUBIKS_SSL_VERIFY=0

Не запускайте broadcast.html одновременно (один broadcaster на сервер).
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROBOT_DIR = Path(__file__).resolve().parent
if str(_ROBOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROBOT_DIR))

import asyncio
import json
import logging
import os
import ssl
import threading
import time
from typing import Any, Dict, List, Optional

import certifi
import base64
import cv2
import numpy as np
import socketio
import websockets
from aiohttp import ClientSession, TCPConnector
from aiortc import (
    RTCIceCandidate,
    RTCIceServer,
    RTCConfiguration,
    RTCPeerConnection,
    RTCSessionDescription,
    VideoStreamTrack,
)
from aiortc.sdp import candidate_from_sdp
from av import VideoFrame
try:
    from scan import compose_scan_message
except ImportError:
    compose_scan_message = None  # опционально: локальный модуль scan.py на ПК робота

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("robot_streamer")

ROBORUBIKS_URL = "https://roborubiks.ru"
PYTHON_WS_URL = "ws://127.0.0.1:8765"
CAMERA_IDS = [0,1,2,3]
OUTPUT_WIDTH = int(720*3)
OUTPUT_HEIGHT = int(1080)
TARGET_FPS = float(os.environ.get("TARGET_FPS", "60"))
SSL_VERIFY = os.environ.get("ROBORUBIKS_SSL_VERIFY", "1").lower() not in ("0", "false", "no")
SCAN_INTERVAL = float(os.environ.get("SCAN_INTERVAL", "0"))  # seconds, 0 = disabled


def _build_ice_servers() -> List[RTCIceServer]:
    servers: List[RTCIceServer] = [
        RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
    ]
    password = os.environ.get("TURN_PASSWORD", "").strip()
    if not password:
        print("⚠️ TURN_PASSWORD не задан — WebRTC может не работать за NAT")
        return servers

    username = os.environ.get("TURN_USER", "roborubiks")
    urls_raw = os.environ.get(
        "TURN_URLS",
        "turn:roborubiks.ru:3478,turn:130.49.143.78:3478",
    )
    for turn_url in (part.strip() for part in urls_raw.split(",") if part.strip()):
        servers.append(
            RTCIceServer(
                urls=turn_url,
                username=username,
                credential=password,
            )
        )
    return servers


ICE_SERVERS = _build_ice_servers()


def parse_camera_params(env_var: str, default: List[Optional[float]]) -> List[Optional[float]]:
    value = os.environ.get(env_var, "")
    if not value:
        return default
    parts = [p.strip() for p in value.split(",")]
    # Преобразуем в float, если возможно, иначе None
    result = []
    for p in parts:
        try:
            result.append(float(p))
        except ValueError:
            log.warning("Некорректное значение для %s: '%s', пропускаем", env_var, p)
            result.append(None)
    # Дополняем до длины CAMERA_IDS значениями None
    while len(result) < len(CAMERA_IDS):
        result.append(None)
    return result[:len(CAMERA_IDS)]


CAMERA_BRIGHTNESS = [100,100,100]
CAMERA_CONTRAST   = [100,100,100]
CAMERA_SATURATION = [100,100,100]


class CameraStitcher:
    def __init__(self, camera_ids: List[int], out_w: int, out_h: int, fps: float):
        self.camera_ids = camera_ids
        self.out_w = out_w
        self.out_h = out_h
        self.fps = fps
        self._lock = threading.Lock()
        self._latest: Optional[np.ndarray] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._caps: List[cv2.VideoCapture] = []

    def start(self) -> None:
        for idx, cid in enumerate(self.camera_ids):
            cap = cv2.VideoCapture(cid)
            if not cap.isOpened():
                raise RuntimeError(f"Не удалось открыть камеру {cid}")
            
            # brightness = CAMERA_BRIGHTNESS[idx] 
            # contrast   = CAMERA_CONTRAST[idx]  
            # saturation = CAMERA_SATURATION[idx]
            
            # if brightness is not None:
            #     cap.set(cv2.CAP_PROP_BRIGHTNESS, brightness)
            #     log.info("Камера %d: яркость = %.1f", cid, brightness)
            # if contrast is not None:
            #     cap.set(cv2.CAP_PROP_CONTRAST, contrast)
            #     log.info("Камера %d: контраст = %.1f", cid, contrast)
            # if saturation is not None:
            #     cap.set(cv2.CAP_PROP_SATURATION, saturation)
            #     log.info("Камера %d: насыщенность = %.1f", cid, saturation)
            

            # cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            # cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self._caps.append(cap)
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        log.info("Камеры %s запущены", self.camera_ids)

    def _rotate_frame(self, frame: np.ndarray) -> np.ndarray:
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
        

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        for cap in self._caps:
            cap.release()
        self._caps.clear()

    def get_latest(self) -> np.ndarray:
        with self._lock:
            if self._latest is not None:
                return self._latest.copy()
        return np.zeros((self.out_h, self.out_w, 3), dtype=np.uint8)

    def _stitch(self, frames: List[np.ndarray]) -> np.ndarray:
        # Поворачиваем каждый кадр на 90 градусов
        rotated_frames = [self._rotate_frame(f) for f in frames]

        if len(rotated_frames) == 1:
            stitched = rotated_frames[0]
        else:
            h = min(f.shape[0] for f in rotated_frames)
            # resized = []
            # for f in rotated_frames:
            #     scale = h / f.shape[0]
            #     w = int(f.shape[1] * scale)
            #     resized.append(cv2.resize(f, (w, h), interpolation=cv2.INTER_AREA))
            stitched = cv2.hconcat(rotated_frames)

        return stitched

    def _loop(self) -> None:
        interval = 1.0 / max(self.fps, 1.0)
        while not self._stop.is_set():
            t0 = time.monotonic()
            frames: List[np.ndarray] = []
            for cap in self._caps:
                ok, frame = cap.read()
                if ok and frame is not None:
                    frames.append(frame)
            if frames:
                with self._lock:
                    self._latest = self._stitch(frames)
            time.sleep(max(0.0, interval - (time.monotonic() - t0)))


class StitchVideoTrack(VideoStreamTrack):
    kind = "video"

    def __init__(self, stitcher: CameraStitcher):
        super().__init__()
        self.stitcher = stitcher

    async def recv(self) -> VideoFrame:
        pts, time_base = await self.next_timestamp()
        frame = VideoFrame.from_ndarray(self.stitcher.get_latest(), format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


def make_http_session() -> ClientSession:
    if SSL_VERIFY:
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        connector = TCPConnector(ssl=ssl_ctx)
        log.info("SSL: проверка сертификата (certifi)")
    else:
        connector = TCPConnector(ssl=False)
        log.warning("SSL: проверка отключена (ROBORUBIKS_SSL_VERIFY=0)")
    log.info(connector)
    return ClientSession(connector=connector)


async def main() -> None:
    stitcher = CameraStitcher(CAMERA_IDS, OUTPUT_WIDTH, OUTPUT_HEIGHT, TARGET_FPS)
    stitcher.start()

    http_session = make_http_session()
    broadcaster_secret = os.environ.get("BROADCASTER_SECRET", "")
    sio = socketio.AsyncClient(
        http_session=http_session,
        logger=True,
        engineio_logger=True,
    )
    pc: Optional[RTCPeerConnection] = None
    python_ws: Optional[websockets.WebSocketClientProtocol] = None
    python_ws_lock = asyncio.Lock()

    async def close_pc() -> None:
        nonlocal pc
        if pc is not None:
            await pc.close()
            pc = None

    async def emit_command_response(data: Dict[str, Any]) -> None:
        if not sio.connected:
            return
        await sio.emit("command_response", data)

    async def emit_scan_result(data: Dict[str, Any]) -> None:
        if not sio.connected:
            return
        await sio.emit("scan_result", data)

    async def connect_python_ws() -> None:
        nonlocal python_ws
        while True:
            try:
                async with websockets.connect(
                    PYTHON_WS_URL,
                    ping_interval=20,
                    ping_timeout=120,
                ) as ws:
                    async with python_ws_lock:
                        python_ws = ws
                    log.info("Python WS подключен: %s", PYTHON_WS_URL)

                    # register as streamer so server can identify us
                    try:
                        await ws.send(json.dumps({"type": "register", "role": "streamer"}))
                    except Exception:
                        log.warning("Не удалось отправить регистрацию streamera")

                    async for raw in ws:
                        # raw may be text or binary; we expect text JSON
                        try:
                            data = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            continue

                        # Handle request for a frame from server
                        action = data.get("action")
                        if action == "request_frame":
                            request_id = data.get("request_id")
                            face = data.get("face", "front")
                            fmt = data.get("format", "jpg")
                            try:
                                img = stitcher.get_latest()
                                if fmt.lower() in ("jpg", "jpeg"):
                                    ok, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                                else:
                                    ok, buf = cv2.imencode('.png', img)
                                if ok:
                                    b64 = base64.b64encode(buf.tobytes()).decode('ascii')
                                    resp = {
                                        "type": "frame_response",
                                        "request_id": request_id,
                                        "face": face,
                                        "format": fmt,
                                        "image_b64": b64,
                                        "ts": time.time(),
                                    }
                                    await ws.send(json.dumps(resp))
                                else:
                                    await ws.send(json.dumps({"type": "frame_response", "request_id": request_id, "error": "encode_failed"}))
                            except Exception as e:
                                log.exception("Ошибка при сборе кадра для запроса: %s", e)
                                try:
                                    await ws.send(json.dumps({"type": "frame_response", "request_id": request_id, "error": str(e)}))
                                except Exception:
                                    pass
                            continue

                        # default: forward as command response to Socket.IO
                        await emit_command_response(data)
            except websockets.exceptions.ConnectionClosed as e:
                log.warning(
                    "Python WS закрыт сервером/сетью code=%s reason=%r — переподключение через 5 с",
                    e.code,
                    e.reason,
                )
                async with python_ws_lock:
                    python_ws = None
                await asyncio.sleep(5)
            except Exception as e:
                log.warning(
                    "Python WS: %s (%s) — переподключение через 5 с",
                    e,
                    type(e).__name__,
                )
                async with python_ws_lock:
                    python_ws = None
                await asyncio.sleep(5)

    @sio.event
    async def connect() -> None:
        log.info("Socket.IO подключен, регистрация broadcaster")
        payload = {"secret": broadcaster_secret} if broadcaster_secret else {}
        await sio.emit("register as broadcaster", payload)

    @sio.on("registered as broadcaster")
    async def on_registered() -> None:
        log.info("Зарегистрирован как broadcaster. Ждём зрителя.")

    @sio.on("viewer connected")
    async def on_viewer_connected(viewer_id: str) -> None:
        nonlocal pc
        log.info("Зритель подключился: %s", viewer_id)
        await close_pc()

        pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=ICE_SERVERS))
        pc.addTrack(StitchVideoTrack(stitcher))

        @pc.on("icecandidate")
        async def on_ice(candidate) -> None:
            if candidate is None:
                return
            await sio.emit(
                "ice-candidate",
                {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex,
                },
            )

        @pc.on("connectionstatechange")
        async def on_state() -> None:
            log.info("WebRTC state: %s", pc.connectionState)

        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sio.emit(
            "offer",
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type},
        )
        log.info("Offer отправлен зрителю")

    @sio.on("answer")
    async def on_answer(answer: Dict[str, str]) -> None:
        if pc is None:
            return
        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=answer["sdp"], type=answer["type"])
        )
        log.info("Answer применён")

    @sio.on("ice-candidate")
    async def on_remote_ice(candidate: Dict[str, Any]) -> None:
        if pc is None or not candidate:
            return
        raw_candidate = candidate.get("candidate")
        if not raw_candidate:
            return
        try:
            # aiortc expects parsed candidate fields, not the raw SDP line.
            sdp_candidate = (
                raw_candidate[len("candidate:") :]
                if raw_candidate.startswith("candidate:")
                else raw_candidate
            )
            ice = candidate_from_sdp(sdp_candidate)
            ice.sdpMid = candidate.get("sdpMid")
            ice.sdpMLineIndex = candidate.get("sdpMLineIndex")
            await pc.addIceCandidate(ice)
        except Exception as e:
            log.warning("Не удалось применить удалённый ICE-кандидат: %s", e)

    @sio.on("command")
    async def on_command(data: Dict[str, Any]) -> None:
        log.info("Команда от зрителя: %s", data.get("command"))
        async with python_ws_lock:
            ws = python_ws
        if ws is None:
            await emit_command_response(
                {"status": "error", "message": "Python сервер недоступен"}
            )
            return
        try:
            if data.get("command") == "scan":
                # Avoid deadlock: scan command and frame_response share same websocket channel.
                img = stitcher.get_latest()
                ok, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ok:
                    data = dict(data)
                    params = data.get("params")
                    if not isinstance(params, dict):
                        params = {}
                    params["image_b64"] = base64.b64encode(buf.tobytes()).decode('ascii')
                    data["params"] = params
            await ws.send(json.dumps(data))
        except Exception as e:
            log.error("Ошибка отправки в Python: %s", e)
            await emit_command_response({"status": "error", "message": str(e)})


    async def perform_scan_and_send(face: str = "front") -> None:
        """Compose scan message from latest stitched frame and send it to Python WS and Socket.IO."""
        if compose_scan_message is None:
            log.warning("scan: модуль scan.py не найден, пропуск")
            return
        try:
            img = stitcher.get_latest()
            msg = compose_scan_message(img, face=face)
        except Exception as e:
            log.exception("Ошибка при составлении сообщения сканирования: %s", e)
            return

        # send to Python WS if connected
        async with python_ws_lock:
            ws = python_ws
        if ws is not None:
            try:
                await ws.send(json.dumps({"type": "scan", "payload": msg}))
            except Exception as e:
                log.warning("Ошибка отправки scan в Python WS: %s", e)

        # also emit to Socket.IO listeners
        try:
            await emit_scan_result(msg)
        except Exception as e:
            log.warning("Не удалось отправить результат сканирования в Socket.IO: %s", e)


    @sio.on("request_scan")
    async def on_request_scan(face: str = "front") -> None:
        """Socket.IO handler to trigger immediate scan from viewers or server."""
        log.info("Запрошено сканирование граней: %s", face)
        await perform_scan_and_send(face=face)

    @sio.event
    async def disconnect() -> None:
        log.info("Socket.IO отключён")
        await close_pc()

    ws_task = asyncio.create_task(connect_python_ws())
    scan_task: Optional[asyncio.Task] = None
    if SCAN_INTERVAL > 0:
        async def _scan_loop() -> None:
            while True:
                await perform_scan_and_send()
                await asyncio.sleep(SCAN_INTERVAL)

        scan_task = asyncio.create_task(_scan_loop())

    try:
        while True:
            try:
                connect_auth = (
                    {"broadcasterSecret": broadcaster_secret}
                    if broadcaster_secret
                    else None
                )
                await sio.connect(
                    ROBORUBIKS_URL,
                    transports=["websocket", "polling"],
                    wait_timeout=30,
                    auth=connect_auth,
                )
                await sio.wait()
            except (socketio.exceptions.ConnectionError, OSError) as e:
                log.warning("Socket.IO: %s — переподключение через 5 с", e)
                if sio.connected:
                    await sio.disconnect()
                await asyncio.sleep(5)
    finally:
        ws_task.cancel()
        if scan_task is not None:
            scan_task.cancel()
        stitcher.stop()
        await close_pc()
        if sio.connected:
            await sio.disconnect()
        await http_session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
