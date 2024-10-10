# 原始版权所有 (C) [2020] [Sipeed]
# 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
# 根据GPLv3或更高版本的条款进行许可  
# 请参阅LICENSE文件以获取详细信息 
import tensorflow as tf
from tensorflow import keras
from PIL import Image
import numpy as np
import tensorflow as tf
import numpy as np
import pandas as pd
import json
from PIL import Image,ImageDraw,ImageFont
from tensorflow.keras.applications.mobilenet import preprocess_input
from tensorflow.keras.applications.mobilenet import MobileNet
from tensorflow.keras.layers import GlobalAveragePooling2D
from tensorflow.keras.layers import Dense, Activation, Input, Dropout, Conv2D, MaxPooling2D, Flatten, BatchNormalization, GaussianNoise
from tensorflow.keras.models import Model
from tensorflow.keras.applications.inception_v3 import preprocess_input,decode_predictions
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.preprocessing import image
import argparse
import os
import time
import cv2
import traceback



def do_predict(model, img):
    img=image.load_img(img,target_size=(224,224))
    #首先需要转换为向量的形式
    img_out=image.img_to_array(img)
    #扩充维度
    img_out=np.expand_dims(img_out,axis=0)
    #对输入的图像进行处理
    img_out=preprocess_input(img_out)
    preds=model.predict(img_out)
    lable_index = np.argmax(preds)
    return lable_index

def main(dir, custom_img_dir):  
    # 数据生成器  
    print(f'在路径 <<{dir}>> 的子文件夹中搜索预测图像: ')  
    print('Search for prediction images in subfolders of path <<' + dir + '>>: ')
    img_dir = custom_img_dir or os.path.join(dir, 'sample_images')  # 使用自定义路径，如果提供  

    for root, dirs, files in os.walk(dir):  # 遍历指定目录下所有文件和文件夹  
        for file in files:  
            if 'labels.txt' in file:  # 查找包含 'labels.txt' 的文件名  
                labels_file_name = file  # 保存符合条件的文件名  

    labels_dir = os.path.join(dir, 'result_root_dir', 'classifier_result', labels_file_name)  # 构建标签文件路径  
    with open(labels_dir, 'r', encoding='utf-8') as f:  # 打开标签文件  
        labels_txt = f.read()  # 读取标签文件中的内容  

    # 清除标签文本中的多余字符  
    il = ['[', ']', ' ', '\n', '\'']  
    for i in il:  
        labels_txt = labels_txt.replace(i, '')  # 去除不必要的字符  
    labels = labels_txt.split(',')  # 将标签文本分割成标签列表  
    classes = labels  # 定义类名列表  

    # 打印类名和索引  
    print('\n类名（class names）:', classes)  
    n_classes = len(classes)  # 计算类别数量  
    print('类别数量（number of classes）:', n_classes, '\n')  

    # 定义模型路径和信息文件路径  
    emodel_path = os.path.join(dir, 'mx.tflite.h5')  
    info_dir = os.path.join(dir, 'info.json')  

    # 读取模型参数信息  
    with open(info_dir, 'r', encoding='utf-8') as f:  
        info = json.loads(f.read())  # 加载 JSON 格式的模型信息  
    alpha = float(info['alpha'])  # 提取 alpha 参数  

    # 移动网络模型的迁移学习实现（冻结卷积层和全连接分类器）  
    ebase_model = tf.keras.applications.mobilenet.MobileNet(  
        alpha=alpha,  
        depth_multiplier=1,  
        dropout=0.001,  
        include_top=False,  
        weights="imagenet",  
        input_shape=(224, 224, 3)  
    )  
    emodel = GlobalAveragePooling2D()(ebase_model.output)  # 添加全局平均池化层  
    emodel = Dropout(0.001)(emodel)  # 添加 Dropout 层以防止过拟合  
    eoutput_layer = Dense(n_classes, activation='softmax')(emodel)  # 定义输出层  

    emodel = Model(ebase_model.input, eoutput_layer)  # 创建完整的模型  
    # 加载保存的模型权重  
    emodel.load_weights(emodel_path, by_name=False)  

    # 预测结果输出目录  
    ewrite_dname = os.path.join(dir, 'test')  
    if not os.path.exists(ewrite_dname):  
        os.makedirs(ewrite_dname)  # 创建目录  

    # 遍历图像目录中的所有文件  
    for i in os.listdir(img_dir):  
        try:  
            path = os.path.join(img_dir, i)  # 获取图像路径  
            op = do_predict(emodel, path)  # 调用预测函数进行图像分类  
            images = Image.open(path)  # 打开图像  
            draw = ImageDraw.Draw(images)  
            font = ImageFont.truetype(font='arial.ttf', size=int(images.height * 0.08))  # 设置字体大小  
            draw.rectangle([0, images.height, images.width, images.height - images.height * 0.1],  
                           fill='#00c27e', outline="#00c27e")  # 在图像底部绘制矩形  
            draw.text(xy=(images.width / 2 - int(len(classes[int(op)]) / 2 * int(images.height * 0.08)),  
                          images.height - images.height * 0.102),  
                      text=classes[int(op)], fill='#fff', font=font)  # 在矩形上绘制预测的类别名称  

            output_path = os.path.join(ewrite_dname, i)  # 定义输出路径  
            images = images.convert('RGB')  # 将图像转换为 RGB 格式  
            images.save(output_path)  # 保存标注后的图像  
            print(f"图片（Image）: {i}              （标签）Label: {classes[int(op)]}")  # 打印结果  
        except Exception as e:  
            traceback.print_exc()  # 打印异常堆栈跟踪  
            print(f"图片（Image）: {i}              错误（Error）: {str(e)}")  # 打印错误信息  
    print("Test succeed!")
    print("测试完成!")
    return True  # 返回成功标志  

if __name__ == '__main__':  
    parser = argparse.ArgumentParser()  
    parser.add_argument('--dir', help='model dir', required=True)  
    parser.add_argument('--img_dir', help='image directory for testing', default=None)  
    args = parser.parse_args()  
    main(args.dir, args.img_dir)