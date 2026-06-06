#!/usr/bin/env python3
"""
WebSocket сервер для управления Мегаминксом (12-гранник)
"""

import argparse
import asyncio
import os
import websockets
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Callable, Awaitable

MoveProgressCallback = Optional[Callable[[Dict], Awaitable[None]]]
from enum import Enum

import time
import base64
import uuid

import cv2
import numpy as np

# from scan import compose_scan_message

# Переопределяется в main() из аргументов командной строки
USE_ROBOT = False
# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
FRAME_RESPONSE_TIMEOUT_SEC = float(os.environ.get("FRAME_RESPONSE_TIMEOUT_SEC", "6.0"))
DEBUG_LOG_PATH = os.environ.get("MEGAMINX_DEBUG_LOG", "")


def _agent_dbg(hypothesis_id: str, location: str, message: str, data: Optional[Dict] = None) -> None:
    # #region agent log
    payload = {
        "sessionId": "6a9c52",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(time.time() * 1000),
    }
    # Видно на удалённом ПК в консоли online.py (без Cursor)
    logger.info("[ws-debug] %s %s %s", hypothesis_id, message, json.dumps(payload["data"], ensure_ascii=False))
    if DEBUG_LOG_PATH:
        try:
            with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass
    # #endregion

class Face(Enum):
    """Грани мегаминкса"""
    U = "U"    # Up (верхняя)
    D = "D"    # Down (нижняя)
    F = "F"    # Front (передняя)
    B = "B"    # Back (задняя)
    L = "L"    # Left (левая)
    R = "R"    # Right (правая)
    BL = "BL"  # Back-Left
    BR = "BR"  # Back-Right
    FL = "FL"  # Front-Left
    FR = "FR"  # Front-Right
    DL = "DL"  # Down-Left
    DR = "DR"  # Down-Right

class Direction(Enum):
    """Направление вращения"""
    CLOCKWISE = 1      # по часовой (+)
    COUNTERCLOCKWISE = -1  # против часовой (-)
    DOUBLE = 2         # двойной поворот (++)


motor_id = {
'U': 12,
'D': 1,
'F': 6,
'B': 7,
'L': 5,
'R': 2,
'BL': 4,
'BR': 3,
'FL': 10,
'FR': 9,
'DL': 11,
'DR': 8
}
# Имена цветов для скана/симулятора (привязка к U/D/F…, не к motor_id)
face_sim_color = {
    "U": "white",
    "D": "grey",
    "F": "green",
    "B": "salad",
    "L": "purple",
    "R": "red",
    "BL": "yellow",
    "BR": "blue",
    "FL": "lightblue",
    "FR": "desert",
    "DL": "orange",
    "DR": "pink",
}

color_face = {
    "white": "U",
    "grey": "D",
    "gray": "D",
    "green": "F",
    "salad": "B",
    "purple": "L",
    "red": "R",
    "yellow": "BL",
    "blue": "BR",
    "lightblue": "FL",
    "light_blue": "FL",
    "desert": "FR",
    "orange": "DL",
    "pink": "DR",
}


# red salad
# blue pink
#pink desert
#green blue
#yellow grey
#purple yellow
#lightpurple red
#lightblue purple
#lightgreen light_blue
#orange orange
#lightbrown green
#white white

# Три тестовые детали для перекраски симулятора
SCAN_TEST_STICKERS = [
    {"face": "F", "piece": 0, "color": face_sim_color[color_face['red']]},
    {"face": "F", "piece": 1, "color": face_sim_color[color_face['salad']]},
    {"face": "F", "piece": 2, "color": face_sim_color[color_face['blue']]},
    {"face": "F", "piece": 3, "color": face_sim_color[color_face['pink']]},
    {"face": "F", "piece": 4, "color": face_sim_color[color_face['desert']]},
    {"face": "F", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    {"face": "F", "piece": 6, "color": face_sim_color[color_face['purple']]},
    {"face": "F", "piece": 7, "color": face_sim_color[color_face['grey']]},
    {"face": "F", "piece": 8, "color": face_sim_color[color_face['white']]},
    {"face": "F", "piece": 9, "color": face_sim_color[color_face['orange']]},
    {"face": "F", "piece": 10, "color": face_sim_color[color_face['green']]},
    {"face": "F", "piece": 11, "color": face_sim_color[color_face['lightblue']]},

    {"face": "L", "piece": 0, "color": face_sim_color[color_face['red']]},
    {"face": "L", "piece": 5, "color": face_sim_color[color_face['salad']]},
    {"face": "L", "piece": 1, "color": face_sim_color[color_face['blue']]},
    {"face": "L", "piece": 2, "color": face_sim_color[color_face['pink']]},
    {"face": "L", "piece": 3, "color": face_sim_color[color_face['desert']]},
    {"face": "L", "piece": 4, "color": face_sim_color[color_face['yellow']]},
    {"face": "L", "piece": 10, "color": face_sim_color[color_face['purple']]},
    {"face": "L", "piece": 6, "color": face_sim_color[color_face['grey']]},
    {"face": "L", "piece": 7, "color": face_sim_color[color_face['white']]},
    {"face": "L", "piece": 8, "color": face_sim_color[color_face['orange']]},
    {"face": "L", "piece": 9, "color": face_sim_color[color_face['green']]},

    # {"face": "U", "piece": 0, "color": face_sim_color[color_face['red']]},
    # {"face": "U", "piece": 1, "color": face_sim_color[color_face['salad']]},
    # {"face": "U", "piece": 2, "color": face_sim_color[color_face['blue']]},
    # {"face": "U", "piece": 3, "color": face_sim_color[color_face['pink']]},
    # {"face": "U", "piece": 4, "color": face_sim_color[color_face['desert']]},
    # {"face": "U", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    # {"face": "U", "piece": 6, "color": face_sim_color[color_face['purple']]},
    # {"face": "U", "piece": 7, "color": face_sim_color[color_face['grey']]},
    # {"face": "U", "piece": 8, "color": face_sim_color[color_face['white']]},
    # {"face": "U", "piece": 9, "color": face_sim_color[color_face['orange']]},
    # {"face": "U", "piece": 10, "color": face_sim_color[color_face['green']]},
    # {"face": "U", "piece": 11, "color": face_sim_color[color_face['lightblue']]},

    #  {"face": "L", "piece": 0, "color": face_sim_color[color_face['red']]},
    # {"face": "L", "piece": 1, "color": face_sim_color[color_face['salad']]},
    # {"face": "L", "piece": 2, "color": face_sim_color[color_face['blue']]},
    # {"face": "L", "piece": 3, "color": face_sim_color[color_face['pink']]},
    # {"face": "L", "piece": 4, "color": face_sim_color[color_face['desert']]},
    # {"face": "L", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    # {"face": "L", "piece": 6, "color": face_sim_color[color_face['purple']]},
    # {"face": "L", "piece": 7, "color": face_sim_color[color_face['grey']]},
    # {"face": "L", "piece": 8, "color": face_sim_color[color_face['white']]},
    # {"face": "L", "piece": 9, "color": face_sim_color[color_face['orange']]},
    # {"face": "L", "piece": 10, "color": face_sim_color[color_face['green']]},
    # {"face": "L", "piece": 11, "color": face_sim_color[color_face['lightblue']]},

    #  {"face": "BL", "piece": 0, "color": face_sim_color[color_face['red']]},
    # {"face": "BL", "piece": 1, "color": face_sim_color[color_face['salad']]},
    # {"face": "BL", "piece": 2, "color": face_sim_color[color_face['blue']]},
    # {"face": "BL", "piece": 3, "color": face_sim_color[color_face['pink']]},
    # {"face": "BL", "piece": 4, "color": face_sim_color[color_face['desert']]},
    # {"face": "BL", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    # {"face": "BL", "piece": 6, "color": face_sim_color[color_face['purple']]},
    # {"face": "BL", "piece": 7, "color": face_sim_color[color_face['grey']]},
    # {"face": "BL", "piece": 8, "color": face_sim_color[color_face['white']]},
    # {"face": "BL", "piece": 9, "color": face_sim_color[color_face['orange']]},
    # {"face": "BL", "piece": 10, "color": face_sim_color[color_face['green']]},
    # {"face": "BL", "piece": 11, "color": face_sim_color[color_face['lightblue']]},

    #  {"face": "R", "piece": 0, "color": face_sim_color[color_face['red']]},
    # {"face": "R", "piece": 1, "color": face_sim_color[color_face['salad']]},
    # {"face": "R", "piece": 2, "color": face_sim_color[color_face['blue']]},
    # {"face": "R", "piece": 3, "color": face_sim_color[color_face['pink']]},
    # {"face": "R", "piece": 4, "color": face_sim_color[color_face['desert']]},
    # {"face": "R", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    # {"face": "R", "piece": 6, "color": face_sim_color[color_face['purple']]},
    # {"face": "R", "piece": 7, "color": face_sim_color[color_face['grey']]},
    # {"face": "R", "piece": 8, "color": face_sim_color[color_face['white']]},
    # {"face": "R", "piece": 9, "color": face_sim_color[color_face['orange']]},
    # {"face": "R", "piece": 10, "color": face_sim_color[color_face['green']]},
    # {"face": "R", "piece": 11, "color": face_sim_color[color_face['lightblue']]},

    #   {"face": "BR", "piece": 0, "color": face_sim_color[color_face['red']]},
    # {"face": "BR", "piece": 1, "color": face_sim_color[color_face['salad']]},
    # {"face": "BR", "piece": 2, "color": face_sim_color[color_face['blue']]},
    # {"face": "BR", "piece": 3, "color": face_sim_color[color_face['pink']]},
    # {"face": "BR", "piece": 4, "color": face_sim_color[color_face['desert']]},
    # {"face": "BR", "piece": 5, "color": face_sim_color[color_face['yellow']]},
    # {"face": "BR", "piece": 6, "color": face_sim_color[color_face['purple']]},
    # {"face": "BR", "piece": 7, "color": face_sim_color[color_face['grey']]},
    # {"face": "BR", "piece": 8, "color": face_sim_color[color_face['white']]},
    # {"face": "BR", "piece": 9, "color": face_sim_color[color_face['orange']]},
    # {"face": "BR", "piece": 10, "color": face_sim_color[color_face['green']]},
    # {"face": "BR", "piece": 11, "color": face_sim_color[color_face['lightblue']]},



]


class SimulatedMG4005:
    """Заглушка без USB — только логика ходов и WebSocket."""

    def set_zero_rom(self, motor_id: int) -> None:
        pass

    def set_zero_ram(self, motor_id: int) -> None:
        pass

    def motor_off(self, motor_id: int) -> None:
        logger.debug("sim: motor_off(%s)", motor_id)

    def side_rotate(self, motor_id: int, direction: int):
        return None

    def side_rotate2(self, motor_id1: int, direction1: int, motor_id2: int, direction2: int):
        return None

    def side_rotate3(
        self,
        motor_id1: int, direction1: int,
        motor_id2: int, direction2: int,
        motor_id3: int, direction3: int,
    ):
        return None

    def test_motor(self, motor_id: int) -> Dict:
        return {
            "msg": f"Симуляция: мотор {motor_id} (без USB)",
            "status": "ok",
        }


class MegaminxController:
    """Контроллер мегаминкса"""
    
    def __init__(self, use_robot: bool = False):
        # История ходов: список выполненных вращений
        self.history: List[Dict] = []
        # Текущее состояние (упрощённо - просто счётчик поворотов)
        self.state = {face.value: 0 for face in Face}
        # Имена граней для отображения
        self.face_names = {face.value: face.name for face in Face}
        self.test_id = 1
        self.use_robot = use_robot

        if use_robot:
            from megaminx import MG4005
            port = os.environ.get("MEGAMINX_PORT", "/dev/tty.usbserial-A50285BI")
            baud = int(os.environ.get("MEGAMINX_BAUD", "115200"))
            logger.info("Подключение к роботу: %s @ %s", port, baud)
            self.m = MG4005(port=port, baud=baud)
            for i in range(12):
                self.m.set_zero_rom(i + 1)
                self.m.set_zero_ram(i + 1)
        else:
            logger.info("Режим симуляции — моторы не подключаются")
            self.m = SimulatedMG4005()


        
    def rotate(self, face: str, direction: Direction) -> Dict:
        """Вращение грани"""
        if face not in self.state:
            return {"error": f"Неизвестная грань: {face}"}
        
        # Записываем ход в историю
        move = {
            "face": face,
            "direction": direction.value,
            "direction_name": self._get_direction_name(direction),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face, direction)
        }
        self.history.append(move)
        
        # Обновляем состояние
        self.state[face] = (self.state[face] + direction.value) % 4
        
        # Здесь должен быть код для физического управления роботом
        self._execute_physical_rotation(face, direction)
        
        # logger.info(f"🔄 Вращение: {move['notation']}")
        
        return {
            "status": "ok",
            "move": move,
            "state": self.get_state()
        }


    def rotate2(self, face1: str, direction1: Direction,face2: str, direction2: Direction) -> Dict:
        """Вращение грани"""
        if face1 not in self.state:
            return {"error": f"Неизвестная грань: {face1}"}
        if face2 not in self.state:
            return {"error": f"Неизвестная грань: {face2}"}
        
        # Записываем ход в историю
        move1 = {
            "face": face1,
            "direction": direction1.value,
            "direction_name": self._get_direction_name(direction1),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face1, direction1)
        }
        move2 = {
            "face": face2,
            "direction": direction2.value,
            "direction_name": self._get_direction_name(direction2),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face2, direction2)
        }
        self.history.append(move1)
        self.history.append(move2)

        
        # Обновляем состояние
        self.state[face1] = (self.state[face1] + direction1.value) % 4
        self.state[face2] = (self.state[face2] + direction2.value) % 4

        
        # Здесь должен быть код для физического управления роботом
        self._execute_physical_rotation2(face1, direction1,face2, direction2)
        
        # logger.info(f"🔄 Вращение: {move['notation']}")
        
        return {
            "status": "ok",
            "move": [move1,move2],
            "state": self.get_state()
        }
    
    def rotate3(self, face1: str, direction1: Direction,face2: str, direction2: Direction,face3: str, direction3: Direction) -> Dict:
        """Вращение грани"""
        if face1 not in self.state:
            return {"error": f"Неизвестная грань: {face1}"}
        if face2 not in self.state:
            return {"error": f"Неизвестная грань: {face2}"}
        if face3 not in self.state:
            return {"error": f"Неизвестная грань: {face3}"}
        
        # Записываем ход в историю
        move1 = {
            "face": face1,
            "direction": direction1.value,
            "direction_name": self._get_direction_name(direction1),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face1, direction1)
        }
        move2 = {
            "face": face2,
            "direction": direction2.value,
            "direction_name": self._get_direction_name(direction2),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face2, direction2)
        }
        move3 = {
            "face": face3,
            "direction": direction3.value,
            "direction_name": self._get_direction_name(direction3),
            "timestamp": datetime.now().isoformat(),
            "notation": self._to_notation(face3, direction3)
        }
        self.history.append(move1)
        self.history.append(move2)
        self.history.append(move3)

        
        # Обновляем состояние
        self.state[face1] = (self.state[face1] + direction1.value) % 4
        self.state[face2] = (self.state[face2] + direction2.value) % 4
        self.state[face3] = (self.state[face3] + direction3.value) % 4


        
        # Здесь должен быть код для физического управления роботом
        self._execute_physical_rotation3(face1, direction1,face2, direction2,face3, direction3)
        
        # logger.info(f"🔄 Вращение: {move['notation']}")
        
        return {
            "status": "ok",
            "move": [move1,move2,move3],
            "state": self.get_state()
        }

    

    def stop_motor(self,id):
        self.m.motor_off(id)


    def test_motors(self):
        r = self.m.test_motor(self.test_id)
        # print('r:',r[msg])
        self.test_id +=1
        if self.test_id>12:
            self.test_id=1
        # if r['status'] !='ok':
        #     status="error"
        # else: 
        #     status="ok"    
        
        # msg = r['msg']
       
        return{
            'msg': r['msg'],
            'status': r['status']
        }


    
    def _print_moves_and_raise_stuck(self, hist: str) -> None:
        print()
        print()
        print()
        print()
        print()
        print()
        print()
        print('Ходы')
        print()
        print(hist)
        raise RuntimeError("Мотор заклинил")

    def _history_excluding_index(self, exclude_index: int) -> str:
        return '.'.join(
            step['notation']
            for i, step in enumerate(self.history)
            if i != exclude_index
        )

    def _raise_parallel_motor_stuck(self, failed_slot: int, group_size: int) -> None:
        """failed_slot: 1..group_size — какой мотор в группе не сработал."""
        exclude_index = len(self.history) - group_size + failed_slot - 1
        hist = self._history_excluding_index(exclude_index)
        self._print_moves_and_raise_stuck(hist)

    def _side_rotate_one(self, face: str, direction: Direction) -> None:
        r = self.m.side_rotate(motor_id[face], direction.value)
        if r is False:
            hist = '.'.join(step['notation'] for step in self.history[:-1])
            self._print_moves_and_raise_stuck(hist)

    def _execute_physical_rotation(self, face: str, direction: Direction):
        """Физическое вращение грани роботом"""
        print(f"🤖 РОБОТ: вращаю грань {face} {self._get_direction_name(direction)}")
        self._side_rotate_one(face, direction)

    def _execute_physical_rotation2(self, face1: str, direction1: Direction, face2: str, direction2: Direction):
        """Физическое вращение двух несмежных граней"""
        print(f"🤖 РОБОТ: вращаю грань {face1} {self._get_direction_name(direction1)}")
        print(f"🤖 РОБОТ: вращаю грань {face2} {self._get_direction_name(direction2)}")

        r = self.m.side_rotate2(
            motor_id[face1], direction1.value,
            motor_id[face2], direction2.value,
        )
        if r in (1, 2):
            self._raise_parallel_motor_stuck(r, 2)

    def _execute_physical_rotation3(
        self,
        face1: str, direction1: Direction,
        face2: str, direction2: Direction,
        face3: str, direction3: Direction,
    ):
        """Физическое вращение трёх несмежных граней"""
        print(f"🤖 РОБОТ: вращаю грань {face1} {self._get_direction_name(direction1)}")
        print(f"🤖 РОБОТ: вращаю грань {face2} {self._get_direction_name(direction2)}")
        print(f"🤖 РОБОТ: вращаю грань {face3} {self._get_direction_name(direction3)}")

        r = self.m.side_rotate3(
            motor_id[face1], direction1.value,
            motor_id[face2], direction2.value,
            motor_id[face3], direction3.value,
        )
        if r in (1, 2, 3):
            self._raise_parallel_motor_stuck(r, 3)
   
   
   
    
    def _get_direction_name(self, direction: Direction) -> str:
        """Получить название направления"""
        if direction == Direction.CLOCKWISE:
            return "по часовой"
        elif direction == Direction.COUNTERCLOCKWISE:
            return "против часовой"
        else:
            return "двойной поворот"
    
    def _to_notation(self, face: str, direction: Direction) -> str:
        """Преобразовать в стандартную нотацию"""
        if direction == Direction.CLOCKWISE:
            return face
        elif direction == Direction.COUNTERCLOCKWISE:
            return f"{face}'"  # или face- как у вас
        else:
            return f"{face}2"
    
    def parse_notation(self, notation: str) -> tuple:
        """Распарсить нотацию вида 'U', 'U'', 'U2', 'U-', '-BR'"""
        notation = notation.strip()
        if not notation:
            raise ValueError("Пустой ход")

        if notation.endswith("'"):
            face = notation[:-1]
            direction = Direction.COUNTERCLOCKWISE
        elif notation.endswith("2"):
            face = notation[:-1]
            direction = Direction.DOUBLE
        elif notation.endswith("-"):
            face = notation[:-1]
            direction = Direction.COUNTERCLOCKWISE
        elif notation.startswith("-"):
            face = notation[1:]
            direction = Direction.COUNTERCLOCKWISE
        else:
            face = notation
            direction = Direction.CLOCKWISE

        face = face.upper()
        print(face, direction)
        return face, direction
    
    def get_state(self) -> Dict:
        """Получить текущее состояние"""
        print( len(self.history))
        return {
            "history_length": len(self.history),
            "faces": self.state.copy(),
            "last_move": self.history[-1] if self.history else None
        }
    
    def get_history(self) -> List[Dict]:
        """Получить историю ходов"""
        return self.history.copy()
    
    def get_path_string(self) -> str:
        """Получить историю в виде строки (например: U.F.R'.BL.D2)"""
        return ".".join([move["notation"] for move in self.history])
    

    def bracket_non_adjacent_moves(self, sequence: str) -> str:
        adjacency = {
            'F':  ['F','FL', 'FR', 'R', 'L', 'U'],
            'FL': ['FL', 'F',  'FR', 'D', 'L', 'DL'],
            'FR': ['FR', 'F',  'FL', 'R', 'D', 'DR'],
            'R':  ['R', 'F',  'FR', 'U', 'BR', 'DR'],
            'D':  ['D','FL', 'FR', 'B', 'DL', 'DR'],
            'L':  ['L','F',  'FL', 'DL', 'BL', 'U'],
            'B':  ['B','D',  'DL', 'BL', 'DR', 'BR'],
            'DL': ['DL','FL', 'D',  'L', 'B', 'BL'],
            'BL': ['BL','L',  'B',  'DL', 'U', 'BR'],
            'U':  ['U','F',  'R',  'L', 'BL', 'BR'],
            'BR': ['BR','R',  'B',  'BL', 'U', 'DR'],
            'DR': ['DR','FR', 'R',  'D', 'B', 'BR']
        }
        
        moves = [m for m in sequence.split('.') if m]
        if not moves:
            return sequence

        def get_face(move: str) -> str:
            if move.startswith('-'):
                return move[1:].upper()
            elif move.endswith("'"):
                return move[:-1].upper()
            return move.upper()
            
            
        
        def are_adjacent(m1: str, m2: str) -> bool:
            f1, f2 = get_face(m1), get_face(m2)
            return f1 == f2 or f2 in adjacency.get(f1, [])
        
        result = []
        i = 0
        n = len(moves)
        
        while i < n:
            # Пробуем взять 3 хода
            if i + 2 < n:
                a, b, c = moves[i], moves[i+1], moves[i+2]
                if (not are_adjacent(a, b) and 
                    not are_adjacent(b, c) and 
                    not are_adjacent(a, c)):
                    result.append(f"({a}.{b}.{c})")
                    i += 3
                    continue
            
            # Пробуем взять 2 хода
            if i + 1 < n:
                a, b = moves[i], moves[i+1]
                if not are_adjacent(a, b):
                    result.append(f"({a}.{b})")
                    i += 2
                    continue
            
            # Берём один ход
            result.append(moves[i])
            i += 1
        
        return '.'.join(result)
    # seq = "B.-BR.B.FL.-L.DL.B.FR.-DR.-BR.-F.-L.-FL.-FL.DL.FL.FR.FL.-FR.DR.-FR.U.-L.-F.-R.-F.FR.-BR.R.BR.-R.DL.B.BR.-L.-L.FR.DR.-R.-FR.B.U.R.BR.L.U.BR.-R.L.F.FR.-BR.-FL.-F.-U.-F.-FL.-L.-BL.FL.L.-U.-L.-B.-U.BL.-B.-BL.DL.B.U.-L.F.FL.-L.DL.D.B.L.-DL.-B.DL.FL.DL.-FL.-DL.-FL.L.L.FL.-L"
    # print(bracket_non_adjacent_moves(seq))


    def _tokenize_bracketed_path(self, bracketed_path: str) -> List[tuple]:
        """Разбить путь со скобками на токены: ('single', 'U') или ('pair', ['F','BL'])."""
        tokens: List[tuple] = []
        i = 0
        n = len(bracketed_path)

        while i < n:
            if bracketed_path[i] == '.':
                i += 1
                continue
            if bracketed_path[i] == '(':
                j = bracketed_path.find(')', i)
                if j == -1:
                    raise ValueError("Незакрытая скобка")
                moves_in_group = [m for m in bracketed_path[i + 1:j].split('.') if m]
                if len(moves_in_group) == 2:
                    tokens.append(('pair', moves_in_group))
                elif len(moves_in_group) == 3:
                    tokens.append(('triple', moves_in_group))
                else:
                    raise ValueError(
                        f"Неподдерживаемый размер группы: {len(moves_in_group)} ходов в скобках"
                    )
                i = j + 1
            else:
                j = i
                while j < n and bracketed_path[j] not in '.(':
                    j += 1
                move_str = bracketed_path[i:j]
                if move_str:
                    tokens.append(('single', move_str))
                i = j

        return tokens

    async def execute_path(self, path: str, on_move: MoveProgressCallback = None) -> Dict:
        """Выполнить последовательность ходов. on_move — после каждого физического шага (для симулятора)."""
        started = time.time()
        self.path_start_time = started
        results: List[Dict] = []

        bracketed_path = self.bracket_non_adjacent_moves(path)

        print('original path:', path)
        print('path with brackets:', bracketed_path)

        try:
            tokens = self._tokenize_bracketed_path(bracketed_path)
        except ValueError as e:
            return {
                "status": "error",
                "command": "execute_path",
                "error": str(e),
                "path": path,
                "time": round(time.time() - started, 3),
            }

        for token in tokens:
            kind = token[0]
            try:
                print(kind)
                if kind == 'single':
                    face, direction = self.parse_notation(token[1])
                    result = await asyncio.to_thread(self.rotate, face, direction)
                elif kind == 'pair':
                    move1_str, move2_str = token[1]
                    face1, direction1 = self.parse_notation(move1_str)
                    face2, direction2 = self.parse_notation(move2_str)
                    result = await asyncio.to_thread(
                        self.rotate2, face1, direction1, face2, direction2
                    )
                else:
                    move1_str, move2_str, move3_str = token[1]
                    face1, direction1 = self.parse_notation(move1_str)
                    face2, direction2 = self.parse_notation(move2_str)
                    face3, direction3 = self.parse_notation(move3_str)
                    result = await asyncio.to_thread(
                        self.rotate3,
                        face1,
                        direction1,
                        face2,
                        direction2,
                        face3,
                        direction3,
                    )
            except Exception as e:
                label = token[1] if kind == 'single' else '.'.join(token[1])
                return {
                    "status": "error",
                    "command": "execute_path",
                    "error": f"Ошибка в ходе {label}: {e}",
                    "path": path,
                    "executed": len(results),
                    "results": results,
                    "time": round(time.time() - started, 3),
                }

            if result.get("error"):
                return {
                    "status": "error",
                    "command": "execute_path",
                    "error": result["error"],
                    "path": path,
                    "executed": len(results),
                    "results": results,
                    "time": round(time.time() - started, 3),
                }

            results.append(result)
            if on_move:
                await on_move(result)

        self.path_end_time = time.time()
        duration = round(self.path_end_time - self.path_start_time, 3)

        return {
            "status": "ok",
            "command": "execute_path",
            "path": path,
            "executed": len(results),
            "time": duration,
            "duration_sec": duration,
            "results": results,
        }
    
    def reverse_path(self) -> List[Dict]:
        """Получить обратную последовательность ходов"""
        reversed_moves = []
        for move in reversed(self.history):
            # Инвертируем направление
            if move["direction"] == Direction.CLOCKWISE.value:
                rev_dir = Direction.COUNTERCLOCKWISE
            elif move["direction"] == Direction.COUNTERCLOCKWISE.value:
                rev_dir = Direction.CLOCKWISE
            else:
                rev_dir = Direction.DOUBLE  # двойной остаётся двойным
                
            reversed_moves.append({
                "face": move["face"],
                "direction": rev_dir.value,
                "notation": self._to_notation(move["face"], rev_dir)
            })
        return reversed_moves
    
    def get_reverse_path_string(self) -> str:
        """Получить обратный путь в виде строки"""
        reversed_moves = self.reverse_path()
        return ".".join([m["notation"] for m in reversed_moves])
    
    async def go_to_init(self, on_move: MoveProgressCallback = None) -> Dict:
        """Вернуться в начальное состояние (выполнить обратные ходы)."""
        reversed_moves = self.reverse_path()

        if not reversed_moves:
            for id in range(12):
                self.stop_motor(id + 1)
            return {"status": "ok", "message": "Уже в начальном состоянии"}

        logger.info(f"🔙 Возврат в начальное состояние: {len(reversed_moves)} ходов")

        results = []
        for move in reversed_moves:
            face = move["face"]
            direction = Direction(move["direction"])
            result = await asyncio.to_thread(self.rotate, face, direction)
            results.append(result)
            if on_move:
                await on_move(result)

        return {
            "status": "ok",
            "executed": len(results),
            "message": "Возврат в начальное состояние выполнен",
        }
    
    def reset_history(self):
        """Сбросить историю (после возврата в начальное состояние)"""
        self.history = []
        self.state = {face.value: 0 for face in Face}
        logger.info("📝 История сброшена")
    
    def get_available_faces(self) -> List[str]:
        """Получить список доступных граней"""
        return list(self.state.keys())

    def get_scan_test(self) -> Dict:
        """Тестовый пакет: 3 детали для перекраски симулятора."""
        return {"status": "ok", "stickers": list(SCAN_TEST_STICKERS)}

class MegaminxAPI:
    """API для управления мегаминксом"""

    def __init__(self, use_robot: bool = False):
        self.controller = MegaminxController(use_robot=use_robot)
        self._websocket = None
        self.commands = {
            "rotate": self.cmd_rotate,
            "get_state": self.cmd_get_state,
            "get_history": self.cmd_get_history,
            "get_path": self.cmd_get_path,
            "execute_path": self.cmd_execute_path,
            "get_reverse_path": self.cmd_get_reverse_path,
            "go_to_init": self.cmd_go_to_init,
            "reset_history": self.cmd_reset_history,
            "get_available_faces": self.cmd_get_available_faces,
            "scan": self.cmd_scan,
            "help": self.cmd_help,
            "test": self.cmd_motor_test
        }

    def bind_websocket(self, websocket) -> None:
        self._websocket = websocket

    async def _emit_move_result(self, result: Dict) -> None:
        """Промежуточный ответ: один или несколько ходов (симулятор крутится по ним)."""
        if not self._websocket or not result or result.get("error"):
            return
        move = result.get("move")
        if not move:
            return
        moves = move if isinstance(move, list) else [move]
        for m in moves:
            if not m or not m.get("face"):
                continue
            try:
                await self._websocket.send(
                    json.dumps(
                        {
                            "type": "response",
                            "status": "ok",
                            "progress": True,
                            "move": {
                                "face": m["face"],
                                "direction": m["direction"],
                                "notation": m.get("notation", m["face"]),
                            },
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                )
            except Exception as e:
                _agent_dbg(
                    "H4",
                    "online.py:_emit_move_result",
                    "progress_send_failed",
                    {"error": str(e), "face": m.get("face")},
                )
                return

    async def handle_command(self, data: Dict) -> Dict:
        """Обработка команды от клиента"""
        command = data.get("command")
        params = data.get("params", {})
        
        if command in self.commands:
            return await self.commands[command](params)
        else:
            return {
                "status": "error",
                "message": f"Неизвестная команда: {command}",
                "available_commands": list(self.commands.keys())
            }
    
    async def cmd_rotate(self, params: Dict) -> Dict:
        """Вращение грани"""
        face = params.get("face")
        direction_str = params.get("direction", "clockwise")
        
        if not face:
            return {"status": "error", "message": "Не указана грань"}
        
        # Преобразование строки в Direction
        direction_map = {
            "clockwise": Direction.CLOCKWISE,
            "cw": Direction.CLOCKWISE,
            "+": Direction.CLOCKWISE,
            "counterclockwise": Direction.COUNTERCLOCKWISE,
            "ccw": Direction.COUNTERCLOCKWISE,
            "-": Direction.COUNTERCLOCKWISE,
            "double": Direction.DOUBLE,
            "2": Direction.DOUBLE
        }
        
        direction = direction_map.get(direction_str.lower())
        if not direction:
            return {"status": "error", "message": f"Неизвестное направление: {direction_str}"}
        
        return await asyncio.to_thread(
            self.controller.rotate, face.upper(), direction
        )
    
    async def cmd_get_state(self, params: Dict) -> Dict:
        """Получить состояние"""

        # result = self.controller.test_motors()
        # return {
        #     "status": result['status'],
        #     "message": f"Тест мотора: {result['msg']}",
        #     # "faces": self.controller.get_available_faces()
        # }
        
        return {
            "status": "ok",
            "state": self.controller.get_state()
        }
    
    async def cmd_get_history(self, params: Dict) -> Dict:
        """Получить историю"""
        return {
            "status": "ok",
            "history": self.controller.get_history()
        }
    
    async def cmd_get_path(self, params: Dict) -> Dict:
        """Получить путь в виде строки"""
        return {
            "status": "ok",
            "path": self.controller.get_path_string(),
            "reverse_path": self.controller.get_reverse_path_string()
        }
    
    async def cmd_execute_path(self, params: Dict) -> Dict:
        """Выполнить путь"""
        path = params.get("path", "")
        if not path:
            return {"status": "error", "message": "Путь не указан"}
        return await self.controller.execute_path(path, on_move=self._emit_move_result)
    
    async def cmd_get_reverse_path(self, params: Dict) -> Dict:
        """Получить обратный путь"""
        return {
            "status": "ok",
            "reverse_path": self.controller.get_reverse_path_string(),
            "moves": self.controller.reverse_path()
        }
    
    async def cmd_go_to_init(self, params: Dict) -> Dict:
        """Вернуться в начальное состояние"""
        result = await self.controller.go_to_init(on_move=self._emit_move_result)
        self.controller.reset_history()
        return result
    
    async def cmd_reset_history(self, params: Dict) -> Dict:
        """Сбросить историю"""
        self.controller.reset_history()
        return {"status": "ok", "message": "История сброшена"}
    
    async def cmd_get_available_faces(self, params: Dict) -> Dict:
        """Получить список граней"""
        return {
            "status": "ok",
            "faces": self.controller.get_available_faces()
        }

    async def cmd_motor_test(self, params: Dict) -> Dict:
        result = self.controller.test_motors()
        return {
            "status": result['status'],
            "message": f"Тест мотора: {result['msg']}",
            # "faces": self.controller.get_available_faces()
        }

    async def cmd_scan(self, params: Dict) -> Dict:
        """Если подключён streamer, запросить кадр и выполнить сканирование.

        Параметры: face (строка)
        """
        face = params.get("face", "front")
        inline_b64 = params.get("image_b64")

        if inline_b64:
            b64 = inline_b64
        else:
            # check streamer availability
            streamer = None
            async with handle_connection.pending_lock:
                streamer = handle_connection.streamer_ws
            if streamer is None:
                # fallback to simulated scan
                return self.controller.get_scan_test()

            # perform request-response with streamer
            req_id = str(uuid.uuid4())
            fut = asyncio.get_event_loop().create_future()
            async with handle_connection.pending_lock:
                handle_connection.pending_requests[req_id] = fut

            try:
                await streamer.send(json.dumps({"action": "request_frame", "request_id": req_id, "face": face, "format": "jpg"}))
            except Exception as e:
                async with handle_connection.pending_lock:
                    handle_connection.pending_requests.pop(req_id, None)
                return {"status": "error", "message": f"Failed to send request to streamer: {e}"}

            try:
                data = await asyncio.wait_for(fut, timeout=FRAME_RESPONSE_TIMEOUT_SEC)
            except asyncio.TimeoutError:
                async with handle_connection.pending_lock:
                    handle_connection.pending_requests.pop(req_id, None)
                return {"status": "error", "message": "Timeout waiting for frame from streamer"}

            if data.get("error"):
                return {"status": "error", "message": data.get("error")}

            b64 = data.get("image_b64")
        if not b64:
            return {"status": "error", "message": "No image in response"}

        try:
            img_bytes = base64.b64decode(b64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            cv2.imwrite(f"img_{face}.jpg", img)
            if img is None:
                raise ValueError("cv2.imdecode returned None")
        except Exception as e:
            return {"status": "error", "message": f"Failed to decode image: {e}"}

        # call scan logic
        try:
            scan_msg = compose_scan_message(img, face=face)
        except Exception as e:
            return {"status": "error", "message": f"Scan processing failed: {e}"}

        return {"status": "ok", "scan": scan_msg}
    
    async def cmd_help(self, params: Dict) -> Dict:
        """Помощь по командам"""
        return {
            "status": "ok",
            "commands": {
                "rotate": "Вращение грани. Параметры: face, direction (cw/ccw/double)",
                "get_state": "Получить текущее состояние",
                "get_history": "Получить историю ходов",
                "get_path": "Получить путь в виде строки",
                "execute_path": "Выполнить путь. Параметры: path (строка вида U.F.R')",
                "get_reverse_path": "Получить обратный путь",
                "go_to_init": "Вернуться в начальное состояние",
                "reset_history": "Сбросить историю",
                "get_available_faces": "Список доступных граней",
                "get_solve_state": "Состояние симулятора (solver): solve_path + reverse_path. HTTP GET /api/solve-state",
            },
            "notation": "Пример нотации: U (по часовой), U' или U- (против), U2 (двойной)"
        }

async def handle_connection(websocket, use_robot: bool = False):
    """Обработка WebSocket соединения"""
    client_id = id(websocket)
    opened_at = time.time()
    remote = getattr(websocket, "remote_address", None)
    _agent_dbg(
        "H5",
        "online.py:handle_connection",
        "ws_open",
        {"client_id": client_id, "remote": str(remote)},
    )
    logger.info(f"✅ Новое соединение от стримера (ID: {client_id})")
    
    api = MegaminxAPI(use_robot=use_robot)
    api.bind_websocket(websocket)

    # registration / request-response helpers (shared across connections)
    if not hasattr(handle_connection, "streamer_ws"):
        handle_connection.streamer_ws = None
        handle_connection.pending_requests = {}
        handle_connection.pending_lock = asyncio.Lock()
    
    try:
        # Отправляем приветствие
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "Megaminx Controller API v1.0",
            "simulation": not use_robot,
            "available_faces": api.controller.get_available_faces()
        }))
        
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                logger.error(f"❌ Ошибка парсинга JSON: {message}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "status": "error",
                    "message": "Invalid JSON"
                }))
                continue

            # Registration from robot-streamer
            if data.get("type") == "register" and data.get("role") == "streamer":
                async with handle_connection.pending_lock:
                    handle_connection.streamer_ws = websocket
                _agent_dbg(
                    "H5",
                    "online.py:handle_connection",
                    "streamer_registered",
                    {"client_id": client_id, "since_open_sec": round(time.time() - opened_at, 2)},
                )
                logger.info("📡 Streamer registered (ID: %s)", client_id)
                await websocket.send(json.dumps({"type": "registered", "role": "streamer"}))
                continue

            # Frame response handling (fulfill pending future)
            if data.get("type") == "frame_response" and data.get("request_id"):
                req_id = data.get("request_id")
                fut = None
                async with handle_connection.pending_lock:
                    fut = handle_connection.pending_requests.pop(req_id, None)
                if fut is not None and not fut.done():
                    fut.set_result(data)
                else:
                    logger.warning("Нет ожидающего запроса для request_id=%s", req_id)
                continue

            logger.info(f"📨 Получена команда: {data.get('command')}")
            _agent_dbg(
                "H2",
                "online.py:handle_connection",
                "command_received",
                {"client_id": client_id, "command": data.get("command")},
            )
            # Обрабатываем команду
            response = await api.handle_command(data)
            response["type"] = "response"
            response["timestamp"] = datetime.now().isoformat()
            await websocket.send(json.dumps(response))
                
    except websockets.exceptions.ConnectionClosed as e:
        _agent_dbg(
            "H1",
            "online.py:handle_connection",
            "ws_closed",
            {
                "client_id": client_id,
                "code": e.code,
                "reason": str(e.reason),
                "duration_sec": round(time.time() - opened_at, 2),
            },
        )
        logger.info(
            f"🔌 Соединение закрыто (ID: {client_id}) code={e.code} reason={e.reason!r}"
        )
    except Exception as e:
        _agent_dbg(
            "H2",
            "online.py:handle_connection",
            "handler_exception",
            {
                "client_id": client_id,
                "type": type(e).__name__,
                "error": str(e),
                "duration_sec": round(time.time() - opened_at, 2),
            },
        )
        logger.error(f"❌ Ошибка в обработчике: {e}")

async def main(use_robot: bool = False):
    """Запуск WebSocket сервера"""
    host = "localhost"
    port = 8765
    
    mode = "робот (USB)" if use_robot else "симуляция (без моторов)"
    logger.info(f"🚀 Запуск Megaminx WebSocket сервера на {host}:{port} — {mode}")
    logger.info("📋 Доступные грани: U, D, F, B, L, R, BL, BR, FL, FR, DL, DR")
    logger.info("💡 Для остановки нажмите Ctrl+C")

    # Длинные повороты моторов идут в to_thread; ping держит WS живым при простое
    ws_ping_interval = float(os.environ.get("MEGAMINX_WS_PING_INTERVAL", "20"))
    ws_ping_timeout = float(os.environ.get("MEGAMINX_WS_PING_TIMEOUT", "120"))

    async with websockets.serve(
        lambda ws: handle_connection(ws, use_robot=use_robot),
        host,
        port,
        ping_interval=ws_ping_interval,
        ping_timeout=ws_ping_timeout,
    ):
        await asyncio.Future()


def parse_args():
    parser = argparse.ArgumentParser(description="WebSocket-сервер мегаминкса")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--robot", "-r",
        action="store_true",
        help="Подключить реальный робот (/dev/ttyUSB0)",
    )
    group.add_argument(
        "--sim",
        action="store_true",
        help="Симуляция без USB (по умолчанию, если не указан --robot)",
    )
    return parser.parse_args()


def resolve_use_robot(args) -> bool:
    if args.robot:
        return True
    if args.sim:
        return False
    env = os.environ.get("MEGAMINX_USE_ROBOT", "").strip().lower()
    return env in ("1", "true", "yes", "on")


if __name__ == "__main__":
    args = parse_args()
    use_robot = resolve_use_robot(args)
    try:
        asyncio.run(main(use_robot=use_robot))
    except KeyboardInterrupt:
        logger.info("⏹️ Сервер остановлен")