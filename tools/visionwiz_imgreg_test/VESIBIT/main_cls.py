import board
import lcd
import usys
import sensor
import KPU as kpu
import image
import math
import time
import button

#程序目的：测试AI图像分类模型
lcd.init(freq=15000000,color=0)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.run(1)
sensor.skip_frames(10)
sensor.set_windowing((224,224))
sensor.set_hmirror(0)
sensor.set_vflip(0)
KPU = kpu.load('/sd/classifier.kmodel')
goods= ['cat','dog']
button9=board.pin(9,board.GPIO.IN,board.GPIO.PULL_UP)
while True:
    img = sensor.snapshot()
    output = kpu.forward(KPU,img)[:]
    if output:
        img = img.draw_string(0,0,goods[output.index(max(output))],color=248,scale=2,x_spacing=2,mono_space=1)
        time.sleep_ms(10)
        #测试完没问题就按下A键结束测试，防止关闭程序后SD卡的读取口被占用而导致不能在电脑上读取SD卡资料
    if button.isPressedAndReleased(button9):
        break
    lcd.display(img)
kpu.deinit(KPU)