import board
import lcd
import usys
import sensor
from visionwiz_image_sync import VisionWizImageSync


lcd.init(freq=15000000,color=0)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.run(1)
sensor.skip_frames(10)
sync = VisionWizImageSync(width=320, height=240, quality=35, fps=2, show_lcd=True)
sync.start_preview(320, 240, 35, 2, True)
while True:
    sync.handle_control_commands(timeout_ms=1)
    sync.tick()