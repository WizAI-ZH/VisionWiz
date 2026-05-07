import argparse
import json
import os
import traceback

import numpy as np
import tensorflow as tf
from PIL import Image, ImageDraw, ImageFont
from tensorflow.keras.applications.mobilenet import preprocess_input
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing import image


def do_predict(model, img, input_shape):
    img = image.load_img(img, target_size=(input_shape[0], input_shape[1]))
    # 首先需要转换为向量的形式
    img_out = image.img_to_array(img)
    # 扩充维度
    img_out = np.expand_dims(img_out, axis=0)
    # 对输入图像进行预处理
    img_out = preprocess_input(img_out)
    preds = model.predict(img_out)
    label_index = np.argmax(preds)
    return label_index


def main(dir):
    # 数据生成器
    print(f'在路径 <<{dir}>> 的子文件夹中搜索预测图像: ')
    print('Search for prediction images in subfolders of path <<' + dir + '>>: ')
    img_dir = os.path.join(dir, 'sample_images')
    labels_file_name = None
    for root, dirs, files in os.walk(dir):
        for file in files:
            if 'labels.txt' in file:
                labels_file_name = file

    labels_dir = os.path.join(dir, 'result_root_dir', 'classifier_result', labels_file_name)
    with open(labels_dir, 'r', encoding='utf-8') as f:
        labels_txt = f.read()
    for token in ['[', ']', ' ', '\n', '\'']:
        labels_txt = labels_txt.replace(token, '')
    labels = labels_txt.split(',')
    classes = labels

    print('')
    print('类名(class names): ', classes)
    n_classes = len(classes)
    print('类别数量(number of classes): ', n_classes)
    print('')

    emodel_path = os.path.join(dir, 'mx.tflite.h5')
    info_dir = os.path.join(dir, 'info.json')
    with open(info_dir, 'r', encoding='utf-8') as f:
        info = json.loads(f.read())
    alpha = float(info['alpha'])
    input_shape = tuple(info.get('input_shape', [224, 224, 3]))

    # Transfer learning implementation of MobileNet model with freezed convolution layers
    # and a fully connected classifier
    ebase_model = tf.keras.applications.mobilenet.MobileNet(
        alpha=alpha,
        depth_multiplier=1,
        dropout=0.001,
        include_top=False,
        weights="imagenet",
        input_shape=input_shape
    )
    emodel = GlobalAveragePooling2D()(ebase_model.output)
    emodel = Dropout(0.001)(emodel)
    eoutput_layer = Dense(n_classes, activation='softmax')(emodel)
    emodel = Model(ebase_model.input, eoutput_layer)

    # Load saved weights
    emodel.load_weights(emodel_path, by_name=False)

    # Make predictions
    ewrite_dname = os.path.join(dir, 'test')
    if not os.path.exists(ewrite_dname):
        os.makedirs(ewrite_dname)
    for filename in os.listdir(img_dir):
        try:
            path = os.path.join(img_dir, filename)
            op = do_predict(emodel, path, input_shape)
            images = Image.open(path)  # 打开图像
            draw = ImageDraw.Draw(images)
            font = ImageFont.truetype(font='arial.ttf', size=int(images.height * 0.08))
            draw.rectangle([0, images.height, images.width, images.height - images.height * 0.1], fill='#00c27e', outline="#00c27e")
            draw.text(
                xy=(images.width / 2 - int(len(classes[int(op)]) / 2 * int(images.height * 0.08)), images.height - images.height * 0.102),
                text=classes[int(op)],
                fill='#fff',
                font=font
            )
            output_path = os.path.join(ewrite_dname, filename)
            images = images.convert('RGB')
            images.save(output_path)
            print(f"图片(Image): {filename}              标签(Label): {classes[int(op)]}")
        except Exception as e:
            traceback.print_exc()
            print(f"图片(Image): {filename}              错误(Error): {str(e)}")
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', help='model dir')
    args = parser.parse_args()
    main(args.dir)
