# 原始版权所有 (C) [2020] [Sipeed]
# 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
# 根据GPLv3或更高版本的条款进行许可  
# 请参阅LICENSE文件以获取详细信息
import argparse
import json
import cv2
import numpy as np
from yolo.frontend import create_yolo
from yolo.backend.utils.box import draw_scaled_boxes
from yolo.backend.utils.annotation import parse_annotation
from yolo.backend.utils.eval.fscore import count_true_positives, calc_score
from pascal_voc_writer import Writer
from shutil import copyfile
import os
import yolo
from pathlib import Path
import imageio.v3 as iio

curr_dir = os.getcwd()
evaluation_object = "test"
DEFAULT_THRESHOLD = 0.4


def file_name(file_dir):
    L = []
    for root, dirs, files in os.walk(file_dir):
        for file in files:
            if os.path.splitext(file)[1] == '.jpg':
                L.append(os.path.join(root, file))
    return L


def getanchors(file_dir):
    dir = os.path.join(curr_dir, 'out', file_dir, 'train_log.log')
    f = open(dir, 'r', encoding='utf-8')
    data = f.readlines()
    for d in data:
        if 'train, labels:' in d:
            str1 = d[d.index('labels:'):].replace('labels:', '')
            io = ['[', ']', '\'', ' ', '\n']
            for i in io:
                str1 = str1.replace(i, '')
            label = str1.split(',')
        if 'anchors: ' in d:
            str2 = d[d.index('anchors: '):].replace('anchors: ', '')
            io = ['[', ']', '\'', ' ', '\n']
            for i in io:
                str2 = str2.replace(i, '')
            lis = str2.split(',')
            for i, value in enumerate(lis):
                lis[i] = float(value)
            anchors = lis
    return label, anchors


import os
import json
import numpy as np
from pathlib import Path
import imageio.v3 as iio
import cv2


# Assuming these methods are imported or defined elsewhere in your code:
# from your_module import getanchors, create_yolo, DEFAULT_THRESHOLD, draw_scaled_boxes

def main(file_dirs):
    curr_dir = Path(__file__).parent.absolute()  # 定义 `curr_dir` 如果还未定义

    info_dir = curr_dir / 'out' / file_dirs / 'info.json'
    with open(info_dir, 'r', encoding='utf-8') as f:
        data = json.loads(f.read())

    ty = getanchors(file_dirs)
    data['anchors'] = ty
    #将anchors参数写入info.json中  
    with open(info_dir, 'w', encoding='utf-8') as file:  
        json.dump(data, file) 

    yolo = create_yolo('MobileNet',
                       ty[0],
                       alpha=float(data['alpha']),
                       input_size=[224, 224, 3],
                       anchors=ty[1])

    yolo.load_weights(curr_dir / 'out' / file_dirs / 'mx_best.h5', by_name=True)

    # 创建保存测试结果的目录
    write_dname = curr_dir / 'out' / file_dirs / 'test'
    if not write_dname.exists():
        write_dname.mkdir(parents=True)

    img_dir = curr_dir / 'out' / file_dirs / 'sample_images'

    for filename in os.listdir(img_dir):
        img_path = img_dir / filename
        img_fname = filename

        print(f"处理文件: {img_fname}，文件路径: {img_path}. Processing file: {img_fname} from path: {img_path}")

        # 使用 imageio 读取图像
        try:
            image = iio.imread(str(img_path))
        except Exception as e:
            print(f"读取图像时出错: {e}. Error reading image: {e}")
            continue  # 跳过这个文件，继续下一个

        # print(f"Type of image read (imageio): {type(image)}")
        # print(f"Image shape: {image.shape}")
        # print(f"Image data type: {image.dtype}")

        if not isinstance(image, np.ndarray):
            image = np.asarray(image)

        # print(f"Type after conversion to np.ndarray: {type(image)}")
        # print(f"Image shape: {image.shape}")
        # print(f"Image data type: {image.dtype}")

        if image is None or image.size == 0:
            print(f"警告: 无法从路径读取图像: {img_path}. Warning: Failed to read image from path: {img_path}")
            continue  # 跳过这个文件，继续下一个

        # 转换 RGB 到 BGR 以便使用 OpenCV 处理
        try:
            image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"转换为 BGR 时出错: {e}. Error converting to BGR: {e}")
            continue  # 跳过这个文件，继续下一个

        boxes, probs = yolo.predict(image_bgr, float(DEFAULT_THRESHOLD))
        labels = np.argmax(probs, axis=1) if len(probs) > 0 else []

        # 保存检测结果
        result_image_bgr = draw_scaled_boxes(image_bgr, boxes, probs, ty[0])
        output_path = write_dname / img_fname
        label_list = ty[0]

        # 强制转换为 np.ndarray 类型
        if not isinstance(result_image_bgr, np.ndarray):
            result_image_bgr = np.asarray(result_image_bgr)

        # 使用 imageio 保存图像
        try:
            iio.imwrite(str(output_path), result_image_bgr)
            print("{} 个框被检测到。{} 已保存。{} boxes are detected. {} saved.".format(len(boxes), output_path, len(boxes), output_path))  
        except Exception as e:  
            print(f"保存图像时出错: {e}. Error during saving image: {e}")

    return True
