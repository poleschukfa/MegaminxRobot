# ПК робота — Python

Код, который запускается **на компьютере рядом с механикой** (не на VPS).

| Файл | Назначение |
|------|------------|
| `online.py` | WebSocket API моторов, история ходов (`ws://127.0.0.1:8765`) |
| `robot_streamer.py` | Камеры → WebRTC + мост команд на `online.py` |
| `megaminx.py` | Драйвер MG4005 (USB serial) |

## Быстрый старт

```bash
cd robot
python3 -m venv ../.venv-robot
source ../.venv-robot/bin/activate
pip install websockets opencv-python numpy pyserial
pip install -r ../scripts/requirements-streamer.txt

# 1. Контроллер (симуляция без USB):
python3 online.py --sim

# 2. Стример (в другом терминале):
export ROBORUBIKS_URL=https://roborubiks.ru
export PYTHON_WS_URL=ws://127.0.0.1:8765
export CAMERA_IDS=0,1,2
python3 robot_streamer.py
```

Реальный робот: `python3 online.py --robot` (порт USB — `MEGAMINX_PORT`, по умолчанию в `megaminx.py`).

Подробнее: [README.md](../README.md) — раздел «ПК робота».
