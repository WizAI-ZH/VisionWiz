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

def main(dir):
    # Data generators
    print(f'在路径 <<{dir}>> 的子文件夹中搜索预测图像: ')  
    print('Search for prediction images in subfolders of path <<' + dir + '>>: ')
    img_dir=os.path.join(dir,'sample_images')
    for root, dirs, files in os.walk(dir):
        for file in files:
            if 'labels.txt' in file:
                labels_file_name = file
        # 输出符合条件的文件名
    # labels_file_name = '_'+os.path.basename(dir)+'_labels.txt'
    labels_dir=os.path.join(dir,'result_root_dir','classifier_result',labels_file_name)
    f=open(labels_dir,'r',encoding='utf-8')
    labels_txt=f.read()
    f.close()
    il=['[',']',' ','\n','\'']
    for i in il:
        labels_txt=labels_txt.replace(i,'')
    labels=labels_txt.split(',')
    classes = labels

    # Print class labels and indices
    print('')
    print('类名(class names): ', classes)
    n_classes = len(classes)
    print('类别数量(number of classes): ', n_classes)
    print('')
    emodel_path=os.path.join(dir,'mx.tflite.h5')
    info_dir=os.path.join(dir,'info.json')
    f=open(info_dir,'r',encoding='utf-8')
    info=json.loads(f.read())
    alpha=float(info['alpha'])
    # Transfer learning implementation of MobileNet model with freezed convolution layers
    # and a fully connected classifier
    ebase_model=tf.keras.applications.mobilenet.MobileNet(alpha = alpha,depth_multiplier = 1, dropout = 0.001,include_top = False, weights = "imagenet", input_shape=(224,224,3))
    emodel = GlobalAveragePooling2D()(ebase_model.output)
    emodel = Dropout(0.001)(emodel)
    eoutput_layer = Dense(n_classes, activation='softmax')(emodel)
    emodel = Model(ebase_model.input, eoutput_layer)
    # Load saved weights
    emodel.load_weights(emodel_path, by_name=False)
    # Make predictions
    ewrite_dname = os.path.join(dir,'test')
    if not os.path.exists(ewrite_dname): os.makedirs(ewrite_dname)
    for i in os.listdir(img_dir):
        try:
            path=os.path.join(img_dir,i)
            op=do_predict(emodel,path)
            images = Image.open(path) # 打开一张图片
            draw = ImageDraw.Draw(images)
            font = ImageFont.truetype(font='arial.ttf', size=int(images.height*0.08))
            draw.rectangle([0,images.height,images.width,images.height-images.height*0.1], fill='#00c27e', outline="#00c27e")
            draw.text(xy=(images.width/2-int(len(classes[int(op)])/2*int(images.height*0.08)), images.height-images.height*0.102), text=classes[int(op)], fill='#fff', font=font)
            output_path = os.path.join(ewrite_dname,i)
            images = images.convert('RGB')
            images.save(output_path)
            print(f"图片(Image): {i}              (标签)Label: {classes[int(op)]}")  # 打印结果  
        except Exception as e:
            traceback.print_exc()
            print(f"图片(Image): {i}              错误(Error): {str(e)}")  # 打印错误信息  
    return True
    

if __name__=='__main__':
    parse = argparse.ArgumentParser()
    parse.add_argument('--dir', help='model dir')
    args = parse.parse_args()
    main(args.dir)



#print(results)

#main(r'I:\Mx-yolo-win32-x64\out\classifer_2023-03-27_17-49-08')