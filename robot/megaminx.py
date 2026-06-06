import logging
import serial
import struct
import threading
import time
from typing import Iterable, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

HEAD = 0x3E
MAX_TORQUE = 90
ALL_MOTOR_IDS = tuple(range(1, 13))

POSITION_TOLERANCE_DEG = 0.1      # ±0.5° is considered "reached"
POSITION_TIMEOUT_S = 3.0           # maximum time to wait for movement
POSITION_POLL_INTERVAL_S = 0.02    # 20 ms between angle reads
ROTATION_SETTLE_S = 0.08           # 72° @ 8000 dps ≈ 9 ms + accel margin
ROTATE_MAX_SPEED_DPS = 30000.0
STALL_IQ_THRESHOLD = 790

# errorState bits from RS485 PROTOCOL V2.35 (read state1 / clear_error response)
ERROR_STATE_BITS = (
    "low_voltage",
    "high_voltage",
    "driver_overtemp",
    "motor_overtemp",
    "overcurrent",
    "short_circuit",
    "stall",
    "input_lost",
)

ERROR_STATE_LABELS_RU = (
    "низкое напряжение",
    "высокое напряжение",
    "перегрев драйвера",
    "перегрев мотора",
    "перегрузка по току",
    "короткое замыкание",
    "заклинивание",
    "потеря сигнала",
)

def sum8(b: bytes) -> int:
    return sum(b) & 0xFF

def decode_error_state(err: int) -> List[str]:
    return [name for bit, name in enumerate(ERROR_STATE_BITS) if err & (1 << bit)]

def decode_error_state_ru(err: int) -> List[str]:
    return [label for bit, label in enumerate(ERROR_STATE_LABELS_RU) if err & (1 << bit)]

def format_error_state(err: int, *, ru: bool = False) -> str:
    if not err:
        return "ok"
    flags = decode_error_state_ru(err) if ru else decode_error_state(err)
    label = ", ".join(flags) if flags else "unknown"
    return f"0x{err:02X} ({label})"

class LK485Error(Exception):
    pass

class MotorFault(LK485Error):
    """Ошибка конкретного мотора (шина, драйвер, заклинивание)."""

    def __init__(self, motor_id: int, reason: str, details: str = "", error_state: int = 0):
        self.motor_id = motor_id
        self.reason = reason
        self.details = details
        self.error_state = error_state
        self.error_flags = decode_error_state(error_state)
        self.error_flags_ru = decode_error_state_ru(error_state)

        msg = f"Motor {motor_id}: {reason}"
        if details:
            msg = f"{msg} ({details})"
        if error_state:
            msg = f"{msg} [errorState {format_error_state(error_state, ru=True)}]"
        super().__init__(msg)

class MG4005:
    """
    Lingkong MG series (e.g., MG4005) RS-485 driver.

    Bus: RS-485 (A/H, B/L, GND). Default 115200 8N1. ID = 1..32.
    Protocol: HEAD(0x3E) + CMD + ID + LEN + CMD_SUM [+ DATA... + DATA_SUM if LEN>0]
    Replies use the same format and arrive within ~0.25 ms.

    NOTE: This version does NOT store a motor id on the instance.
          You must pass motor_id to each call.
    """

    # --- Commands (from RS485 PROTOCOL V2.35) ---
    CMD_MOTOR_OFF     = 0x80
    CMD_STOP          = 0x81
    CMD_MOTOR_ON      = 0x88
    CMD_READ_STATE1   = 0x9A
    CMD_CLEAR_ERROR   = 0x9B
    CMD_READ_STATE2   = 0x9C
    CMD_READ_STATE3   = 0x9D

    CMD_OPEN_MS       = 0xA0
    CMD_TORQUE_MFMG   = 0xA1
    CMD_SPEED         = 0xA2
    CMD_POS_MULTI_1   = 0xA3
    CMD_POS_MULTI_2   = 0xA4
    CMD_POS_SINGLE_1  = 0xA5
    CMD_POS_SINGLE_2  = 0xA6
    CMD_INC_1         = 0xA7
    CMD_INC_2         = 0xA8

    CMD_READ_ENCODER  = 0x90
    CMD_READ_ML_ANGLE = 0x92
    CMD_CLR_ML_ANGLE  = 0x93
    CMD_READ_SL_ANGLE = 0x94
    CMD_SET_ZERO_RAM  = 0x95
    CMD_SET_ZERO_ROM  = 0x19

    CMD_BRAKE         = 0x8C

    def __init__(self, port: str, baud: int = 115200, timeout: float = 0.05):
        self.ser = serial.Serial(
            port=port,
            baudrate=baud,
            bytesize=8,
            parity=serial.PARITY_NONE,
            stopbits=1,
            timeout=timeout,
            write_timeout=timeout,
        )
        self._bus_lock = threading.Lock()
        self.side = {
            'white':1,
            'yellow':2,
            'blue':3,
            'red':4,
            'green':5,
            'purple':6,
            'grey':7,
            'azure':8,
            'orange':9,
            'leaf':10,
            'pink':11,
            'beige':12
        }

        self._step_target = {i: 0 for i in range(1, 13)}
        self._motors_on: set[int] = set()
        self._max_speed_payload = self._u32(int(round(ROTATE_MAX_SPEED_DPS * 100)))
        self._last_fault: Optional[MotorFault] = None
        self._error_state: dict[int, int] = {i: 0 for i in range(1, 13)}

        # self._last_dir = {}

        # self._pid_target = {}          # target angle per motor
        # self._pid_integral = {}        # integral term per motor
        # self._pid_prev_error = {}      # previous error for derivative
        # PID gains – tune these
        # self.kp = 203
        # self.ki = 0#2
        # self.kd = 2
        # 0000000001

        # for i in range(12):
        #     self.motor_on(i+1)
        #     self.set_zero_rom(i+1)
        #     self.set_zero_ram(i+1)
        
        

    # ---------------- Low-level framing ----------------
    @staticmethod
    def _check_id(motor_id: int):
        if not (1 <= motor_id <= 32):
            raise ValueError("motor_id must be 1..32")

    def _build(self, cmd: int, motor_id: int, data: bytes = b"") -> bytes:
        self._check_id(motor_id)
        # Frame command (5 bytes total): HEAD, CMD, ID, LEN, CMD_SUM
        cmd_bytes = bytes([HEAD, cmd & 0xFF, motor_id & 0xFF, len(data) & 0xFF])
        cmd_sum = bytes([sum8(cmd_bytes)])
        return cmd_bytes + cmd_sum + (data + bytes([sum8(data)]) if data else b"")

    def _read_exact(self, n: int) -> bytes:
        buf = bytearray()
        while len(buf) < n:
            chunk = self.ser.read(n - len(buf))
            if not chunk:
                break
            buf.extend(chunk)
        return bytes(buf)

    def _drain_stale_input(self) -> None:
        if self.ser.in_waiting:
            self.ser.reset_input_buffer()

    def _recv(self, motor_id: int, expect_cmd: Optional[int] = None) -> Tuple[int, bytes]:
        hdr = self._read_exact(5)
        if len(hdr) != 5 or hdr[0] != HEAD:
            raise LK485Error("Bad header or timeout")
        head, rcmd, rid, rlen, csum = hdr
        if sum8(hdr[:4]) != csum:
            raise LK485Error("CMD checksum mismatch")
        if rid != (motor_id & 0xFF):
            raise LK485Error(f"Unexpected ID {rid} (expected {motor_id})")
        data = b""
        if rlen > 0:
            data_full = self._read_exact(rlen + 1)
            if len(data_full) != rlen + 1:
                raise LK485Error("DATA timeout")
            data, dsum = data_full[:-1], data_full[-1]
            if sum8(data) != dsum:
                raise LK485Error("DATA checksum mismatch")
        if expect_cmd is not None and rcmd != expect_cmd:
            raise LK485Error(f"Unexpected reply CMD 0x{rcmd:02X}, expected 0x{expect_cmd:02X}")
        return rcmd, data

    def _xfer(self, cmd: int, motor_id: int, payload: bytes = b"", expect_cmd: Optional[int] = None, reply: bool = True) -> bytes:
        pkt = self._build(cmd, motor_id, payload)
        with self._bus_lock:
            self._drain_stale_input()
            self.ser.write(pkt)
            self.ser.flush()
            if not reply:
                return b""
            return self._recv(motor_id, expect_cmd if expect_cmd is not None else cmd)[1]

    # ---------------- Helpers to pack values ----------------
    @staticmethod
    def _i16(v: int) -> bytes: return struct.pack("<h", v)
    @staticmethod
    def _u16(v: int) -> bytes: return struct.pack("<H", v & 0xFFFF)
    @staticmethod
    def _i32(v: int) -> bytes: return struct.pack("<i", v)
    @staticmethod
    def _u32(v: int) -> bytes: return struct.pack("<I", v & 0xFFFFFFFF)
    @staticmethod
    def _i64(v: int) -> bytes: return struct.pack("<q", v)

    @staticmethod
    def decode_error_state(err: int) -> List[str]:
        return decode_error_state(err)

    @staticmethod
    def format_error_state(err: int, *, ru: bool = False) -> str:
        return format_error_state(err, ru=ru)

    def get_last_fault(self) -> Optional[MotorFault]:
        return self._last_fault

    def get_cached_error_state(self, motor_id: int) -> int:
        self._check_id(motor_id)
        return self._error_state.get(motor_id, 0)

    def _remember_error_state(self, motor_id: int, err: int) -> int:
        self._error_state[motor_id] = err
        return err

    def _set_fault(
        self,
        motor_id: int,
        reason: str,
        details: str = "",
        *,
        error_state: Optional[int] = None,
    ) -> MotorFault:
        if error_state is None:
            error_state = self._error_state.get(motor_id, 0)
        fault = MotorFault(motor_id, reason, details, error_state=error_state)
        self._last_fault = fault
        logger.warning("%s", fault)
        return fault

    @staticmethod
    def _parse_state1(data: bytes) -> Tuple[int, float, bool, int]:
        if len(data) != 7:
            raise LK485Error("STATE1 length")
        temp = struct.unpack("<b", data[0:1])[0]
        voltage = struct.unpack("<H", data[1:3])[0] * 0.01
        motor_on = (data[5] == 0x00)
        err = data[6]
        return temp, voltage, motor_on, err

    def _check_driver_error(self, motor_id: int, err: int, *, phase: str) -> None:
        self._remember_error_state(motor_id, err)
        if not err:
            return
        faults = decode_error_state_ru(err)
        raise self._set_fault(
            motor_id,
            phase,
            ", ".join(faults) if faults else f"errorState=0x{err:02X}",
            error_state=err,
        )
    @staticmethod
    def _parse_state2_iq(data: bytes) -> int:
        if len(data) != 7:
            raise LK485Error("STATE2 length")
        return struct.unpack("<h", data[1:3])[0]

    def _bus_error(self, motor_id: int, exc: Exception, phase: str) -> MotorFault:
        if isinstance(exc, MotorFault):
            self._last_fault = exc
            logger.warning("%s", exc)
            return exc
        return self._set_fault(motor_id, phase, str(exc))

    def _ensure_on(self, motor_id: int) -> None:
        if motor_id in self._motors_on:
            return
        try:
            self._xfer(self.CMD_MOTOR_ON, motor_id, b"", expect_cmd=self.CMD_MOTOR_ON)
        except (LK485Error, serial.SerialException) as exc:
            raise self._bus_error(motor_id, exc, "motor_on") from exc
        self._motors_on.add(motor_id)

    def _prepare_motor(self, motor_id: int) -> None:
        self._ensure_on(motor_id)
        err = self.clear_error(motor_id)
        self._check_driver_error(motor_id, err, phase="driver_error")

    def _prepare_motors(self, motor_ids: Iterable[int]) -> None:
        for motor_id in motor_ids:
            self._prepare_motor(motor_id)

    def motors_on_all(self, motor_ids: Iterable[int] = ALL_MOTOR_IDS) -> None:
        self._prepare_motors(motor_ids)

    def invalidate_motor_on_cache(self, motor_id: Optional[int] = None) -> None:
        if motor_id is None:
            self._motors_on.clear()
        else:
            self._motors_on.discard(motor_id)

    # ---------------- High-level API (pass motor_id to every call) ----------------
    def motor_on(self, motor_id: int):
        self._xfer(self.CMD_MOTOR_ON, motor_id, b"", expect_cmd=self.CMD_MOTOR_ON)
        self._motors_on.add(motor_id)

    def motor_off(self, motor_id: int):
        self._xfer(self.CMD_MOTOR_OFF, motor_id, b"", expect_cmd=self.CMD_MOTOR_OFF)
        self._motors_on.discard(motor_id)
    def stop(self, motor_id: int):          self._xfer(self.CMD_STOP, motor_id, b"", expect_cmd=self.CMD_STOP)
    def clear_error(self, motor_id: int) -> int:
        data = self._xfer(self.CMD_CLEAR_ERROR, motor_id, b"", expect_cmd=self.CMD_CLEAR_ERROR)
        _, _, _, err = self._parse_state1(data)
        return self._remember_error_state(motor_id, err)

    def torque_iq(self, motor_id: int, iq: int):
        iq = max(-2048, min(2048, int(iq)))
        self._xfer(self.CMD_TORQUE_MFMG, motor_id, self._i16(iq), expect_cmd=self.CMD_TORQUE_MFMG)

    def speed_dps(self, motor_id: int, dps: float):
        sp = int(round(dps * 100))
        self._xfer(self.CMD_SPEED, motor_id, self._i32(sp), expect_cmd=self.CMD_SPEED)

    def move_multi_deg(self, motor_id: int, deg: float):
        angle = int(round(deg * 1000))  # keep your original scaling
        self._xfer(self.CMD_POS_MULTI_1, motor_id, self._i64(angle), expect_cmd=self.CMD_POS_MULTI_1)

    def move_multi_deg_limited(self, motor_id: int, deg: float, max_speed_dps: float = ROTATE_MAX_SPEED_DPS) -> bytes:
        angle = int(round(deg * 1000))  # keep your original scaling
        if max_speed_dps == ROTATE_MAX_SPEED_DPS:
            payload = self._i64(angle) + self._max_speed_payload
        else:
            payload = self._i64(angle) + self._u32(int(round(max_speed_dps * 100)))
        return self._xfer(self.CMD_POS_MULTI_2, motor_id, payload, expect_cmd=self.CMD_POS_MULTI_2)

    def move_single_deg(self, motor_id: int, deg_0_35999: float, clockwise: bool = True):
        angle = int(round(max(0.0, min(359.99, deg_0_35999)) * 1000))  # keep original scaling
        spin_dir = 0x00 if clockwise else 0x01
        payload = bytes([spin_dir]) + self._u16(angle) + b"\x00"
        self._xfer(self.CMD_POS_SINGLE_1, motor_id, payload, expect_cmd=self.CMD_POS_SINGLE_1)

    def move_single_deg_limited(self, motor_id: int, deg_0_35999: float, clockwise: bool, max_speed_dps: float):
        angle = int(round(max(0.0, min(359.99, deg_0_35999)) * 1000))  # keep original scaling
        spin_dir = 0x00 if clockwise else 0x01
        max_sp = int(round(max_speed_dps * 100))
        payload = bytes([spin_dir]) + self._u16(angle) + b"\x00" + self._u32(max_sp)
        self._xfer(self.CMD_POS_SINGLE_2, motor_id, payload, expect_cmd=self.CMD_POS_SINGLE_2)

    def move_increment_deg(self, motor_id: int, delta_deg: float):
        inc = int(round(delta_deg * 1000))  # keep original scaling
        self._xfer(self.CMD_INC_1, motor_id, self._i32(inc), expect_cmd=self.CMD_INC_1)

    def move_increment_deg_limited(self, motor_id: int, delta_deg: float, max_speed_dps: float):
        inc = int(round(delta_deg * 1000))  # keep original scaling
        max_sp = int(round(max_speed_dps * 100))
        payload = self._i32(inc) + self._u32(max_sp)
        self._xfer(self.CMD_INC_2, motor_id, payload, expect_cmd=self.CMD_INC_2)

    def brake(self, motor_id: int, enable: Optional[bool] = None) -> int:
        if enable is None:
            data = bytes([0x10])
        else:
            data = bytes([0x01 if enable else 0x00])
        resp = self._xfer(self.CMD_BRAKE, motor_id, data, expect_cmd=self.CMD_BRAKE)
        return resp[0] if resp else 0

    # ----------- Reads / telemetry -----------
    def read_state1(self, motor_id: int):
        data = self._xfer(self.CMD_READ_STATE1, motor_id, b"", expect_cmd=self.CMD_READ_STATE1)
        temp, voltage, motor_on, err = self._parse_state1(data)
        self._remember_error_state(motor_id, err)
        return temp, voltage, motor_on, err

    def read_error_state(self, motor_id: int) -> dict:
        """Прочитать errorState (CMD 0x9A) и вернуть расшифровку битов."""
        temp, voltage, motor_on, err = self.read_state1(motor_id)
        return {
            "motor_id": motor_id,
            "raw": err,
            "hex": f"0x{err:02X}",
            "flags": decode_error_state(err),
            "flags_ru": decode_error_state_ru(err),
            "formatted": format_error_state(err, ru=True),
            "ok": err == 0,
            "temp_c": temp,
            "voltage_v": voltage,
            "motor_on": motor_on,
        }

    def read_all_error_states(
        self,
        motor_ids: Iterable[int] = ALL_MOTOR_IDS,
    ) -> dict[int, dict]:
        return {motor_id: self.read_error_state(motor_id) for motor_id in motor_ids}

    def _verify_error_state(self, motor_id: int, *, phase: str) -> None:
        state = self.read_error_state(motor_id)
        if not state["ok"]:
            raise self._set_fault(
                motor_id,
                phase,
                ", ".join(state["flags_ru"]),
                error_state=state["raw"],
            )

    def read_state2(self, motor_id: int, is_mg=True):
        data = self._xfer(self.CMD_READ_STATE2, motor_id, b"", expect_cmd=self.CMD_READ_STATE2)
        if len(data) != 7:
            raise LK485Error("STATE2 length")
        temp = struct.unpack("<b", data[0:1])[0]
        val = struct.unpack("<h", data[1:3])[0]
        speed = struct.unpack("<h", data[3:5])[0]
        enc = struct.unpack("<H", data[5:7])[0]
        if is_mg:
            iq = val
            return temp, iq, speed, enc
        else:
            power = val
            return temp, power, speed, enc

    def read_state3(self, motor_id: int):
        data = self._xfer(self.CMD_READ_STATE3, motor_id, b"", expect_cmd=self.CMD_READ_STATE3)
        if len(data) != 7:
            raise LK485Error("STATE3 length")
        temp = struct.unpack("<b", data[0:1])[0]
        iA, iB, iC = struct.unpack("<hhh", data[1:7])
        return temp, iA, iB, iC

    def read_encoder(self, motor_id: int):
        data = self._xfer(self.CMD_READ_ENCODER, motor_id, b"", expect_cmd=self.CMD_READ_ENCODER)
        if len(data) != 6:
            raise LK485Error("ENC length")
        enc, enc_raw, enc_off = struct.unpack("<HHH", data)
        return enc, enc_raw, enc_off

    def read_multi_angle_deg(self, motor_id: int) -> float:
        data = self._xfer(self.CMD_READ_ML_ANGLE, motor_id, b"", expect_cmd=self.CMD_READ_ML_ANGLE)
        if len(data) != 8:
            raise LK485Error("ML angle length")
        ang01 = struct.unpack("<q", data)[0]
        return ang01 / 100.0

    def clear_multi_angle(self, motor_id: int):
        self._xfer(self.CMD_CLR_ML_ANGLE, motor_id, b"", expect_cmd=self.CMD_CLR_ML_ANGLE)

    def read_single_angle_deg(self, motor_id: int) -> float:
        data = self._xfer(self.CMD_READ_SL_ANGLE, motor_id, b"", expect_cmd=self.CMD_READ_SL_ANGLE)
        if len(data) != 4:
            raise LK485Error("SL angle length")
        val = struct.unpack("<I", data)[0]
        return val / 100.0

    def set_zero_ram(self, motor_id: int):
        self._xfer(self.CMD_SET_ZERO_RAM, motor_id, b"", expect_cmd=self.CMD_SET_ZERO_RAM)

    def set_zero_rom(self, motor_id: int):
        self._xfer(self.CMD_SET_ZERO_ROM, motor_id, b"", expect_cmd=self.CMD_SET_ZERO_ROM)

    def close(self):
        try:
            self.ser.close()
        except Exception:
            pass



    def _rotate_group(self, moves: List[Tuple[int, int]]) -> Optional[int]:
        """
        Подготовить и отправить команды поворота для группы моторов подряд по RS-485.
        Возвращает номер неудачного мотора (1..N) или None.
        """
        id_to_slot = {motor_id: slot for slot, (motor_id, _) in enumerate(moves, start=1)}
        try:
            self._prepare_motors(motor_id for motor_id, _ in moves)
        except MotorFault as fault:
            return id_to_slot.get(fault.motor_id, 1)

        for slot, (motor_id, direction) in enumerate(moves, start=1):
            if self._do_rotate(motor_id, direction) is False:
                return slot
        time.sleep(ROTATION_SETTLE_S)
        for slot, (motor_id, _) in enumerate(moves, start=1):
            try:
                self._verify_error_state(motor_id, phase="driver_error")
            except MotorFault:
                return slot
        return None

    def side_rotate3(self, id1, dir1, id2, dir2, id3, dir3):
        return self._rotate_group([(id1, dir1), (id2, dir2), (id3, dir3)])

    def side_rotate2(self, id1, dir1, id2, dir2):
        return self._rotate_group([(id1, dir1), (id2, dir2)])

    def side_rotate(self, id1, dir1):
        failed = self._rotate_group([(id1, dir1)])
        if failed is not None:
            return False





    def test_motor(self,id):
        self.motor_on(id)
        self.clear_error(id)
        self.set_zero_rom(id)
        self.set_zero_ram(id)
        status="ok"
        msg = f" {id}\n"
        sum_err = 0
        for i in range(5):
            delta_deg = 1 * 72       
            start_angle = self.read_multi_angle_deg(id)/10
            target_angle = start_angle + delta_deg
            target_angle=round(target_angle / 72) * 72
            self.move_multi_deg_limited(id, target_angle, max_speed_dps=8000)
            time.sleep(0.07)
            err = abs(self.read_multi_angle_deg(id)/10-(72*(i+1)))
            sum_err +=err 
            # print()
            print(err, err<0.5)

            if err>0.5:
                status="error"
                msg = msg + f" fail: не вышел на позицию {72*(i+1)} ошибка {err:.2f}\n"

      
        
        for i in range(5):
            delta_deg = -1 * 72       
            start_angle = self.read_multi_angle_deg(id)/10
            target_angle = start_angle + delta_deg
            target_angle=round(target_angle / 72) * 72
            self.move_multi_deg_limited(id, target_angle, max_speed_dps=8000)
            time.sleep(0.07)
            err = abs(self.read_multi_angle_deg(id)/10-(72*(4-i)))
            sum_err +=err 
            print(err, err<0.5)
            if err>0.5:
                print('asas')
                print(err, err<0.5)

                status="error"
                msg = msg + f"fail: не вышел на позицию {72*(4-i)} ошибка {err:.2f} \n"
        if msg == "":
            msg = f"Мотор {id} в порядке"
        msg += f"\n средняя ошибка {sum_err/10:.2f}град"
        return {'msg': msg, "status":status}
       


    def _do_rotate(self, motor_id: int, direction: int) -> Union[bool, None]:
        """Отправить команду поворота; ответ 0xA4 уже содержит state2 (см. протокол LK)."""
        self._step_target[motor_id] += direction
        try:
            data = self.move_multi_deg_limited(motor_id, self._step_target[motor_id] * 72)
            iq = self._parse_state2_iq(data)
            if abs(iq) > STALL_IQ_THRESHOLD:
                self._step_target[motor_id] -= direction
                err = 1 << 6  # stall bit per protocol, if state1 not read yet
                try:
                    err = self.read_error_state(motor_id)["raw"] or err
                except (LK485Error, serial.SerialException):
                    pass
                self._set_fault(motor_id, "stall", f"iq={iq}", error_state=err)
                return False
        except (LK485Error, serial.SerialException) as exc:
            self._step_target[motor_id] -= direction
            self._bus_error(motor_id, exc, "move")
            return False

    def _rotate(self, motor_id: int, direction: int) -> Union[bool, None]:
        self._prepare_motor(motor_id)
        return self._do_rotate(motor_id, direction)


# --------------- Example usage ---------------
if __name__ == "__main__":
    m = MG4005(port="/dev/tty.usbserial-A50285BI", baud=115200)
  

    for i in range(12):
        m.motor_off(i+1)
        m.motor_on(i+1)
        m.set_zero_rom(i+1)
        m.set_zero_ram(i+1)


    t = time.time()
    for i in range(12):
        for j in range(5):
            result = (m.side_rotate(i+1,1))
            time.sleep(0.51)
        
