"""
HTTP-клиент для управления мегаминксом параллельно с viewer.

    pip install requests certifi

    from megaminx_client import MegaminxClient
    api = MegaminxClient("https://roborubiks.ru")
    api.health()
"""

from __future__ import annotations

import json
import os
import ssl
import warnings
from typing import Any, Dict, Optional, Union
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:
    certifi = None  # type: ignore

try:
    import requests

    HAS_REQUESTS = True
except ImportError:
    requests = None  # type: ignore
    HAS_REQUESTS = False


class MegaminxAPIError(RuntimeError):
    def __init__(self, message: str, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.payload = payload or {}


def _env_verify_ssl(default: bool) -> bool:
    raw = os.environ.get("MEGAMINX_VERIFY_SSL", "").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    return default


def _ssl_verify_param(verify_ssl: bool) -> Union[bool, str]:
    """Значение для requests.verify / urllib SSL."""
    if not verify_ssl:
        return False
    if certifi is not None:
        return certifi.where()
    return True


def build_ssl_context(verify: bool = True) -> ssl.SSLContext:
    if not verify:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


class MegaminxClient:
    def __init__(
        self,
        base_url: str = "https://roborubiks.ru",
        timeout: float = 30.0,
        verify_ssl: Optional[bool] = None,
        api_token: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.verify_ssl = _env_verify_ssl(True if verify_ssl is None else verify_ssl)
        self._verify = _ssl_verify_param(self.verify_ssl)
        self._ssl_context = build_ssl_context(self.verify_ssl)
        self.api_token = (
            api_token
            if api_token is not None
            else os.environ.get("API_SECRET")
            or os.environ.get("MEGAMINX_API_SECRET")
            or ""
        )

        if (
            self.base_url.startswith("https")
            and self.verify_ssl
            and certifi is None
            and not HAS_REQUESTS
        ):
            warnings.warn(
                "certifi не установлен — возможна ошибка SSL на macOS. "
                "Выполните: pip install requests certifi",
                stacklevel=2,
            )

    def _auth_headers(self) -> Dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        timeout_sec = timeout or self.timeout

        try:
            if HAS_REQUESTS:
                payload = self._request_requests(method, url, body, timeout_sec)
            else:
                payload = self._request_urllib(method, url, body, timeout_sec)
        except MegaminxAPIError:
            raise
        except Exception as e:
            self._raise_connection_error(url, e)

        if payload.get("status") == "error":
            raise MegaminxAPIError(
                payload.get("message") or payload.get("error") or "API error",
                payload,
            )
        return payload

    def _request_requests(
        self,
        method: str,
        url: str,
        body: Optional[Dict[str, Any]],
        timeout: float,
    ) -> Dict[str, Any]:
        assert requests is not None
        verify = self._verify if url.startswith("https") else True
        try:
            resp = requests.request(
                method,
                url,
                json=body,
                timeout=timeout,
                verify=verify,
                headers=self._auth_headers(),
            )
        except requests.exceptions.SSLError as e:
            raise MegaminxAPIError(
                f"SSL ошибка для {url}. Выполните: pip install certifi\n"
                "Или временно: MegaminxClient(..., verify_ssl=False)",
                {"ssl_error": str(e)},
            ) from e
        except requests.exceptions.RequestException as e:
            raise MegaminxAPIError(f"Не удалось подключиться к {url}: {e}") from e

        try:
            payload = resp.json()
        except ValueError:
            payload = {"status": "error", "message": resp.text or resp.reason}

        if resp.status_code == 404:
            raise MegaminxAPIError(
                f"HTTP 404: {url}. Обновите server.js на сервере и перезапустите Node.",
                {"status": "error", "http_status": 404},
            )

        if resp.status_code >= 400 and payload.get("status") != "error":
            payload = {
                "status": "error",
                "message": payload.get("message") or resp.reason or f"HTTP {resp.status_code}",
            }
            raise MegaminxAPIError(payload["message"], payload)
        return payload

    def _request_urllib(
        self,
        method: str,
        url: str,
        body: Optional[Dict[str, Any]],
        timeout: float,
    ) -> Dict[str, Any]:
        data = None
        headers = self._auth_headers()
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(
                req,
                timeout=timeout,
                context=self._ssl_context if url.startswith("https") else None,
            ) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            try:
                payload = json.loads(e.read().decode("utf-8"))
            except Exception:
                payload = {"status": "error", "message": str(e)}
            raise MegaminxAPIError(payload.get("message") or str(e), payload) from e
        except URLError as e:
            self._raise_connection_error(url, e)

    def _raise_connection_error(self, url: str, err: Exception) -> None:
        reason = getattr(err, "reason", err)
        text = str(reason if reason is not err else err)
        if self.verify_ssl and "CERTIFICATE_VERIFY_FAILED" in text:
            raise MegaminxAPIError(
                f"SSL: не удалось проверить сертификат {url}.\n"
                "Решение 1: pip install requests certifi\n"
                "Решение 2: MegaminxClient(..., verify_ssl=False)",
                {"ssl_error": text},
            ) from err
        raise MegaminxAPIError(f"Не удалось подключиться к {url}: {err}") from err

    def health(self) -> Dict[str, Any]:
        return self._request("GET", "/health", timeout=10)

    def features(self) -> Dict[str, Any]:
        """Проверка возможностей сервера (solve_state и т.д.)."""
        try:
            return self._request("GET", "/api/features", timeout=10)
        except MegaminxAPIError as e:
            if e.payload.get("http_status") == 404:
                health = self.health()
                if health.get("features", {}).get("solve_state"):
                    return {
                        "status": "ok",
                        "apiVersion": health.get("apiVersion", 2),
                        "features": health["features"],
                    }
                return {"status": "ok", "apiVersion": 1, "features": {"solve_state": False}}
            raise

    def command(
        self,
        command: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        if command in ("execute_path", "go_to_init") and timeout is None:
            timeout = 600.0
        return self._request(
            "POST",
            "/api/command",
            {"command": command, "params": params or {}},
            timeout=timeout,
        )

    def rotate(self, face: str, direction: str = "cw") -> Dict[str, Any]:
        return self.command("rotate", {"face": face, "direction": direction})

    def execute_path(self, path: str, timeout: float = 600.0) -> Dict[str, Any]:
        return self.command("execute_path", {"path": path}, timeout=timeout)

    def get_state(self) -> Dict[str, Any]:
        """Состояние робота (история ходов на моторах)."""
        return self._request("GET", "/api/state", timeout=30)

    def get_solve_state(self, timeout: float = 120.0) -> Dict[str, Any]:
        """
        Состояние симулятора — как кнопка «Состояние» в viewer.

        Returns:
            solve_path — путь решения (текущее → собрано)
            reverse_path — обратный путь (в поле ввода viewer)
            solved=True если уже собрано
        """
        try:
            payload = self._request("GET", "/api/solve-state", timeout=timeout)
        except MegaminxAPIError as e:
            if e.payload.get("http_status") == 404:
                raise MegaminxAPIError(
                    "GET /api/solve-state не найден. Перезапустите Node: node server.js",
                    e.payload,
                ) from e
            raise
        if payload.get("message") == "Таймаут ответа от симулятора":
            raise MegaminxAPIError(
                payload["message"]
                + ". Viewer должен быть открыт, вы — активный зритель (Ctrl+Shift+R).",
                payload,
            )
        if payload.get("message") == "Нет активного зрителя":
            raise MegaminxAPIError(
                payload["message"]
                + ". Откройте viewer и встаньте в очередь (первая позиция).",
                payload,
            )
        return payload

    def get_history(self) -> Dict[str, Any]:
        return self._request("GET", "/api/history", timeout=30)

    def get_path(self) -> Dict[str, Any]:
        return self.command("get_path")

    def get_reverse_path(self) -> Dict[str, Any]:
        """Обратный путь по истории ходов робота."""
        return self.command("get_reverse_path")

    def reset_history(self) -> Dict[str, Any]:
        """Сбросить историю ходов (без физического вращения)."""
        return self.command("reset_history")

    def get_available_faces(self) -> Dict[str, Any]:
        """Список доступных граней (U, D, F, …)."""
        return self.command("get_available_faces")

    def go_to_init(self, timeout: float = 600.0) -> Dict[str, Any]:
        return self.command("go_to_init", {}, timeout=timeout)

    def help(self) -> Dict[str, Any]:
        """Справка по командам (robot WS + get_solve_state через HTTP)."""
        info = self.command("help")
        commands = dict(info.get("commands") or {})
        commands.setdefault(
            "get_solve_state",
            "Состояние симулятора (solver): solve_path + reverse_path. "
            "MegaminxClient.get_solve_state() → GET /api/solve-state",
        )
        commands.pop("scan", None)
        info["commands"] = commands
        return info
