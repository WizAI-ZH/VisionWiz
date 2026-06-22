import board
import lcd
import usys
import sensor
import KPU as kpu
import image
import time
import button


#程序目的：测试AI目标检测模型
lcd.init(freq=15000000,color=0)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.run(1)
sensor.skip_frames(10)
sensor.set_windowing((224,224))
sensor.set_hmirror(0)
sensor.set_vflip(0)

anchor= (2.09375, 2.34375, 3.8124999999999996, 6.5, 3.5625, 3.421875, 2.15625, 3.875, 2.90625, 5.28125)
KPU = kpu.load('/sd/dj2026gf.kmodel')
kpu.init_yolo2(KPU,0.5,0.3,5,anchor)
goods= ['Watcher', 'Infiltrator', 'Intruder', '1', '2', '3']
button9=board.pin(9,board.GPIO.IN,board.GPIO.PULL_UP)
while True:
    img = sensor.snapshot()
    output = kpu.run_yolo2(KPU,img)
    if output:
        for i in output:
            img = img.draw_rectangle(i.rect(),200,2,0)
            img = img.draw_string(i.x(),(i.y() - 18),goods[i.classid()],color=65535,scale=1,x_spacing=2,mono_space=1)
        time.sleep_ms(10)
    #测试完没问题就按下A键结束测试，防止关闭程序后SD卡的读取口被占用而导致不能在电脑上读取SD卡资料
    if button.isPressedAndReleased(button9):
        break
    lcd.display(img)
kpu.deinit(KPU)
