"""
VisionWiz image sync library for CanMV / MicroPython.

After the controller finishes the initial VisionWiz authentication,
this library reuses the same UARTHS serial link to:
1. receive plain-text preview control commands from VisionWiz, and
2. send JPEG frames back with the VisionWiz packet header.
"""

import json
import lcd
import sensor
import struct
import time
import usys
import utime
from machine import UART


DEFAULT_WIDTH = 320
DEFAULT_HEIGHT = 240
DEFAULT_QUALITY = 35
DEFAULT_FPS = 2
DISPLAY_WIDTH = 320
DISPLAY_HEIGHT = 240
PREVIEW_MAGIC = b"VWJP"
READ_CHUNK = 64


class VisionWizImageSync(object):
    def __init__(
        self,
        width=DEFAULT_WIDTH,
        height=DEFAULT_HEIGHT,
        quality=DEFAULT_QUALITY,
        fps=DEFAULT_FPS,
        show_lcd=True,
        display_width=DISPLAY_WIDTH,
        display_height=DISPLAY_HEIGHT,
    ):
        self.usys = usys
        self.uart = UART(UART.UARTHS, 115200, timeout=100, read_buf_len=4096)
        self.streaming = False
        self.frame_id = 0
        self.frame_interval_ms = int(1000 / max(1, int(fps)))
        self.last_frame_at = 0
        self.current_width = int(width)
        self.current_height = int(height)
        self.current_quality = int(quality)
        self.show_lcd = bool(show_lcd)
        self.display_width = int(display_width)
        self.display_height = int(display_height)
        self._line_buffer = b""
        self.init_sensor(self.display_width, self.display_height)

    def init_sensor(self, width, height):
        lcd.init(freq=15000000, color=0)
        sensor.reset()
        sensor.set_pixformat(sensor.RGB565)
        sensor.set_framesize(sensor.QVGA)
        sensor.run(1)
        sensor.skip_frames(10)
        sensor.set_windowing((int(width), int(height)))
        sensor.set_hmirror(0)
        sensor.set_vflip(0)
        sensor.set_auto_gain(False)
        sensor.set_auto_whitebal(False)

    def _send_message(self, data):
        try:
            json_str = json.dumps(data)
            payload = json_str.encode("utf-8") + b"\r\n"
            for i in range(0, len(payload), READ_CHUNK):
                self.uart.write(payload[i:i + READ_CHUNK])
                utime.sleep_ms(2)
        except Exception as e:
            print("send_message failed:", e)
            try:
                self.uart.write(b'{"type":"error","reason":"json_encode"}\r\n')
            except Exception:
                pass

    def send_frame(self):
        img = sensor.snapshot()
        if self.show_lcd:
            lcd.display(img)
        tx_img = img
        if self.current_width != self.display_width or self.current_height != self.display_height:
            try:
                tx_img = img.resize(self.current_width, self.current_height)
            except Exception as e:
                print("resize failed, fallback to full frame:", e)
                tx_img = img

        jpeg = tx_img.compress(quality=int(self.current_quality))
        payload_len = 0
        try:
            payload_len = jpeg.size()
        except Exception:
            try:
                payload_len = len(jpeg)
            except Exception:
                payload_len = 0

        if payload_len <= 0:
            print("invalid jpeg payload length", payload_len)
            return

        header = PREVIEW_MAGIC + struct.pack("<II", payload_len, self.frame_id)
        if self.frame_id < 5 or self.frame_id % 10 == 0:
            print("preview frame", self.frame_id, "bytes", payload_len)
        self.uart.write(header)
        self.uart.write(jpeg)
        self.frame_id += 1

    def start_preview(
        self,
        width=DEFAULT_WIDTH,
        height=DEFAULT_HEIGHT,
        quality=DEFAULT_QUALITY,
        fps=DEFAULT_FPS,
        show_lcd=None,
    ):
        self.current_width = int(width)
        self.current_height = int(height)
        self.current_quality = int(quality)
        if show_lcd is not None:
            self.show_lcd = bool(show_lcd)
        fps = max(1, int(fps))
        self.frame_interval_ms = int(1000 / fps)
        self.frame_id = 0
        self.last_frame_at = 0
        self.init_sensor(self.display_width, self.display_height)
        self.streaming = True
        print("preview started", self.current_width, self.current_height, self.current_quality, fps, self.show_lcd)

    def stop_preview(self):
        self.streaming = False
        print("preview stopped")

    def is_streaming(self):
        return self.streaming

    def _handle_preview_text_command(self, line):
        parts = line.strip().split()
        if not parts:
            return False

        if parts[0] == "VW_CAM:START":
            print("recv text cmd", line)
            width = parts[1] if len(parts) > 1 else DEFAULT_WIDTH
            height = parts[2] if len(parts) > 2 else DEFAULT_HEIGHT
            quality = parts[3] if len(parts) > 3 else DEFAULT_QUALITY
            fps = parts[4] if len(parts) > 4 else DEFAULT_FPS
            self.start_preview(width, height, quality, fps)
            return True

        if parts[0] == "VW_CAM:STOP":
            print("recv text cmd", line)
            self.stop_preview()
            return True

        return False

    def _handle_command_packet(self, msg_data, sender):
        target = msg_data.get("t", "")
        action = msg_data.get("a", "")
        values = msg_data.get("v", {}) or {}

        if target == "visionwiz_preview" and action == "start":
            self.start_preview(
                values.get("width", DEFAULT_WIDTH),
                values.get("height", DEFAULT_HEIGHT),
                values.get("quality", DEFAULT_QUALITY),
                values.get("fps", DEFAULT_FPS),
                values.get("show_lcd", True),
            )
            return True

        if target == "visionwiz_preview" and action == "stop":
            self.stop_preview()
            return True

        print("Unhandled plain command from {}: {}".format(sender, msg_data))
        return False

    def receive_message(self, timeout_ms=1000):
        start_time = utime.ticks_ms()
        while utime.ticks_diff(utime.ticks_ms(), start_time) <= timeout_ms or timeout_ms == 0:
            if self.uart.any():
                try:
                    raw = self.uart.read()
                    if not raw:
                        utime.sleep_ms(10)
                        continue

                    self._line_buffer += raw
                    while b"\r\n" in self._line_buffer:
                        line_bytes, self._line_buffer = self._line_buffer.split(b"\r\n", 1)
                        try:
                            data = line_bytes.decode("utf-8").strip()
                        except Exception as e:
                            print("Receive decode error:", e)
                            continue

                        if not data:
                            continue

                        if self._handle_preview_text_command(data):
                            return {"type": "preview_command", "raw": data}

                        if data.startswith("{") and data.endswith("}"):
                            msg = json.loads(data)
                            sender = msg.get("sender", msg.get("device_id", "electron_app"))

                            if "cid" in msg and "t" in msg and "a" in msg:
                                self._handle_command_packet(msg, sender)
                                return msg

                            print("Unhandled plain JSON from {}: {}".format(sender, msg))
                            return msg

                except Exception as e:
                    print("Receive error: " + str(e))
            utime.sleep_ms(10)
            if timeout_ms == 0:
                break

        return None

    def tick(self):
        self.receive_message(timeout_ms=1)
        now = time.ticks_ms()
        if self.streaming and time.ticks_diff(now, self.last_frame_at) >= self.frame_interval_ms:
            self.send_frame()
            self.last_frame_at = now

    def run_forever(self):
        while True:
            self.tick()


VisionWizPreviewBridge = VisionWizImageSync
