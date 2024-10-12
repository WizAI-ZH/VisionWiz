'''
    train detector

    @author neucrack@sipeed
    @license Apache 2.0 © 2020 Sipeed Ltd
        the sub directory yolo dirived from https://github.com/lemariva/MaixPy_YoloV2
        which is also Apache 2.0 licensed by lemariva
'''


from xml.dom import minidom
from typing import List
import sys, os,json
curr_file_dir = os.path.abspath(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(curr_file_dir)
# import os, sys
# root_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
# sys.path.append(root_path)
from xml.dom.minidom import parse
import xml.dom.minidom
import traceback
from utils import gpu_utils, isascii
from utils.logger import Logger, Fake_Logger
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import Element
import tempfile
import shutil
import zipfile
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix
import numpy as np
import itertools
import random
import re
import revoc
import kmeans

from train_base import Train_Base


class Detector(Train_Base):
    def __init__(self, input_shape=(224, 224, 3), datasets_img_dir=None,datasets_xml_dir=None, datasets_zip=None, unpack_dir=None, logger = None,
                max_classes_limit = 15, one_class_min_images_num=100, one_class_max_images_num=2000,
                allow_reshape=False,alpha=0.75,
                support_shapes=((240, 240, 3),(224, 224, 3),(224,320,3) )
                ):
        '''
            input_shape: input shape (height, width)
            min_images_num: min image number in one class
        '''
        import tensorflow as tf # for multiple process
        self.tf = tf
        self.alpha=alpha
        self.need_rm_datasets = False
        self.input_shape = input_shape
        self.support_shapes = support_shapes
        # print("-" * 10 + "after Detector init" + "-" * 10)

        if not self.input_shape in self.support_shapes:
            raise Exception("输入形状 {} 不支持，仅支持：{}。Input shape {} not supported, only supports: {}".format(self.input_shape, self.support_shapes, self.input_shape, self.support_shapes))        
        
        self.allow_reshape = allow_reshape # if dataset image's shape not the same as require's, reshape it
        self.config_max_classes_limit = max_classes_limit
        self.config_one_class_min_images_num = one_class_min_images_num
        self.config_one_class_max_images_num = one_class_max_images_num
        self.datasets_rm_dir = None
        self.model = None
        self.history = None
        self.warning_msg = [] # append warning message here
        if logger:
            self.log = logger
        else:
            self.log = Fake_Logger()
        # unzip datasets
        if datasets_zip:
            # print("-" * 10 + "before self._unpack_datasets" + "-" * 10)
            self.datasets_dir = self._unpack_datasets(datasets_zip, unpack_dir)
            # print("-" * 10 + "after self._unpack_datasets" + "-" * 10)
            if not self.datasets_dir:
                self.log.e("无法检测到数据集，请检查 ZIP 格式。Can't detect datasets, check zip format.")  
                raise Exception("无法检测到数据集，请检查 ZIP 格式。Can't detect datasets, check zip format.")
        elif datasets_img_dir:
            self.datasets_img_dir = datasets_img_dir
            self.datasets_xml_dir = datasets_xml_dir
        else:
            self.log.e("没有提供数据集参数。No datasets args.")  
            raise Exception("没有提供数据集参数。No datasets args.")
        # print("-" * 10 + "before self._load_datasets" + "-" * 10)
        # parse datasets
        print(f"训练集路径（Train dataset path）: {self.datasets_img_dir}")
        print(f"训练标签路径（Train annotations path）: {self.datasets_xml_dir}")
        ok, msg, self.labels, classes_data_counts, datasets_x, datasets_y = self._load_datasets(self.datasets_img_dir,self.datasets_xml_dir )
        # print("-" * 10 + "after self._load_datasets" + "-" * 10)
        if not ok:
            msg = f"数据集格式错误：{msg}。Datasets format error: {msg}"
            self.log.e(msg)
            traceback.print_exc()
            raise Exception(msg)
        # check datasets
        ok, err_msg = self._is_datasets_valid(self.labels, classes_data_counts, one_class_min_images_num=self.config_one_class_min_images_num, one_class_max_images_num=self.config_one_class_max_images_num)
        if not ok:
            self.log.e(err_msg)
            raise Exception(err_msg)
        self.log.i("加载数据集完成，检查通过，图像数量：{}，边界框数量：{}。Load datasets complete, check pass, images num: {}, bboxes num: {}.".format(len(datasets_x), sum(classes_data_counts), len(datasets_x), sum(classes_data_counts)))
        self.datasets_x = np.array(datasets_x, dtype='uint8')
        self.datasets_y = datasets_y
        

        class _Train_progress_cb(tf.keras.callbacks.Callback):#剩余训练时间回调
            def __init__(self, epochs, user_progress_callback, logger):
                self.epochs = epochs
                self.logger = logger
                self.user_progress_callback = user_progress_callback

            def on_epoch_begin(self, epoch, logs=None):
                print('')
                self.logger.i("第 {} 轮训练开始。Epoch {} start.".format(epoch, epoch))

            def on_epoch_end(self, epoch, logs=None):
                print('')
                self.logger.i("第 {} 轮训练结束：{}。Epoch {} end: {}.".format(epoch, logs, epoch, logs))
                if self.user_progress_callback:
                    self.user_progress_callback((epoch + 1) / self.epochs * 100, "训练轮次结束。Train epoch end.")

            def on_train_begin(self, logs=None):
                self.logger.i("训练开始。Train start")
                if self.user_progress_callback:
                    self.user_progress_callback(0, "训练开始。Train start")

            def on_train_end(self, logs=None):
                self.logger.i("训练结束。Train end")
                if self.user_progress_callback:
                    self.user_progress_callback(100, "训练结束。Train end")
        self.Train_progress_cb = _Train_progress_cb

    def __del__(self):
        if self.need_rm_datasets:
            try:
                shutil.rmtree(self.datasets_dir)
                self.log.i(f"清理临时数据集目录：{self.datasets_dir}。Clean temp dataset dir: {self.datasets_dir}.")
            except Exception as e:
                try:
                    self.log.e("清理临时文件错误：{}。Clean temp files error: {}.".format(e, e))
                except Exception:
                    print("日志对象无效，变量作用域使用错误，请检查代码。Log object invalid, var scope usage error, check code.")

    def _get_anchors(self, bboxes_in, input_shape=(224, 224), clusters = 5, strip_size = 32):
        '''
            @input_shape tuple (h, w)
            @bboxes_in format: [ [[xmin,ymin, xmax, ymax, label],], ]
                        value range: x [0, w], y [0, h]
            @return anchors, format: 10 value tuple
        '''
        w = input_shape[1]
        h = input_shape[0]
        # TODO: add position to iou, not only box size
        bboxes = []
        for items in bboxes_in:
            for bbox in items:
                bboxes.append(( (bbox[2] - bbox[0])/w, (bbox[3] - bbox[1])/h ))
        bboxes = np.array(bboxes)
        self.log.i(f"边界框数量（Bboxes num）: {len(bboxes)}, 第一个边界框（First bbox）: {bboxes[0]}")  
        out = kmeans.kmeans(bboxes, k=clusters)  
        iou = kmeans.avg_iou(bboxes, out) * 100  
        self.log.i("边界框准确率(IOU): {:.2f}% | Bbox accuracy (IOU): {:.2f}%".format(iou, iou))  
        self.log.i("边界框（Bound boxes）: {}".format(  
            ",".join("({:f},{:.2f})".format(item[0] * w, item[1] * h) for item in out)
        ))
        for i, wh in enumerate(out):
            out[i][0] = wh[0]*w/strip_size
            out[i][1] = wh[1]*h/strip_size
        anchors = list(out.flatten())
        #anchors=[28.0, 49.99, 53, 82.99, 95.71, 106.0, 129.0 ,152.85, 198.57, 247.14]
        self.log.i(f"anchors: {anchors}")
        ratios = np.around(out[:, 0] / out[:, 1], decimals=2).tolist()
        self.log.i("宽高比（w/h ratios）: {}".format(sorted(ratios)))
        
        return anchors

    def train(self, epochs= 100,
                    progress_cb=None,
                    weights="mobilenet_7_5_224_tf_no_top.h5",
                    batch_size = 5,
                    train_times = 5,
                    valid_times = 2,
                    learning_rate=1e-4,
                    jitter = False,
                    is_only_detect = False,
                    save_best_weights_path = "out/best_weights.h5",
                    save_final_weights_path = "out/final_weights.h5",
                    ):
        import tensorflow as tf
        from yolo.frontend import create_yolo
        weights=os.path.join(curr_file_dir, "weights", weights)
        self.log.i("train, labels:{}".format(self.labels))
        self.log.d("train, datasets image dir:{}".format(self.datasets_img_dir))
        self.log.d("train, datasets xml dir:{}".format(self.datasets_xml_dir))
        # param check
        # TODO: check more param
        if len(self.labels) == 1:
            is_only_detect = True
        self.save_best_weights_path = save_best_weights_path
        self.save_final_weights_path = save_final_weights_path

        # create yolo model
        strip_size = 32 if min(self.input_shape[:2])%32 == 0 else 16
        # get anchors
        print(self.input_shape)
        self.anchors = self._get_anchors(self.datasets_y, self.input_shape[:2], strip_size = strip_size)
        # create network
        yolo = create_yolo(
                            architecture = "MobileNet",
                            labels = self.labels,
                            alpha = float(self.alpha),
                            input_size = self.input_shape[:2],
                            anchors = self.anchors,
                            coord_scale=1.0,
                            class_scale=1.0,
                            object_scale=5.0,
                            no_object_scale=1.0,
                            weights = weights,
                            #alpha=float(self.alpha),
                            strip_size =  strip_size
                )

        # train
        self.history = yolo.train(
                                img_folder = None,
                                ann_folder = None,
                                img_in_mem = self.datasets_x,       # datasets in mem, format: list
                                ann_in_mem = self.datasets_y,       # datasets's annotation in mem, format: list
                                nb_epoch   = epochs,
                                save_best_weights_path = save_best_weights_path,
                                save_final_weights_path = save_final_weights_path,
                                batch_size=batch_size,
                                jitter=jitter,
                                learning_rate=learning_rate, 
                                train_times=train_times,
                                valid_times=valid_times,
                                valid_img_folder="",
                                valid_ann_folder="",
                                valid_img_in_mem = None,
                                valid_ann_in_mem = None,
                                first_trainable_layer=None,
                                is_only_detect = is_only_detect,
                                progress_callbacks = [self.Train_progress_cb(epochs, progress_cb, self.log)]
                        )

    
    def report(self, out_path, limit_y_range=None):
        '''
            generate result charts
        '''
        self.log.i("生成报告图像。Generate report image.")
        if not self.history:
            return
        history = self.history
        print(history)

        # set for server with no Tkagg GUI support, use agg(non-GUI backend)
        plt.switch_backend('agg')
        
        fig, axes = plt.subplots(1, 1, constrained_layout=True, figsize = (16, 10), dpi=100)
        if limit_y_range:
            plt.ylim(limit_y_range)

        # acc and val_acc
        # {'loss': [0.5860330664989357, 0.3398533443955177], 'accuracy': [0.70944744, 0.85026735], 'val_loss': [0.4948340670338699, 0.49342870752194096], 'val_accuracy': [0.7, 0.74285716]}
        if "acc" in history.history:
            kws = {
                "acc": "acc",
                "val_acc": "val_acc",
                "loss": "loss",
                "val_loss": "val_loss"
            }
        else:
            kws = {
                "acc": "accuracy",
                "val_acc": "val_accuracy",
                "loss": "loss",
                "val_loss": "val_loss"
            }
        # axes[0].plot( history.history[kws['acc']], color='#2886EA', label="train")
        # axes[0].plot( history.history[kws['val_acc']], color = '#3FCD6D', label="valid")
        # axes[0].set_title('model accuracy')
        # axes[0].set_ylabel('accuracy')
        # axes[0].set_xlabel('epoch')
        # axes[0].locator_params(integer=True)
        # axes[0].legend()

        # loss and val_loss
        train_data={
            'type':'yolo',
            'loss':history.history[kws['loss']],
            'val_loss':history.history[kws['val_loss']],
        }
        file = open(os.path.join(os.path.abspath(os.path.dirname(out_path)),'train_data.json'),'w', encoding='utf-8')
        json.dump(train_data, file)
        file.close()
        axes.plot( history.history[kws['loss']], color='#2886EA', label="train")
        axes.plot( history.history[kws['val_loss']], color = '#3FCD6D', label="valid")
        axes.set_title('model loss')
        axes.set_ylabel('loss')
        axes.set_xlabel('epoch')
        axes.locator_params(integer=True)
        axes.legend()

        # confusion matrix
        # cm, labels_idx = self._get_confusion_matrix()
        # axes[2].imshow(cm, interpolation='nearest', cmap = plt.cm.GnBu)
        # axes[2].set_title("confusion matrix")
        # # axes[2].colorbar()
        # num_local = np.array(range(len(labels_idx)))
        # axes[2].set_xticks(num_local)
        # axes[2].set_xticklabels(labels_idx.keys(), rotation=45)
        # axes[2].set_yticks(num_local)
        # axes[2].set_yticklabels(labels_idx.keys())

        # thresh = cm.max() / 2. # front color black or white according to the background color
        # for i, j in itertools.product(range(cm.shape[0]), range(cm.shape[1])):
        #     axes[2].text(j, i, format(cm[i, j], 'd'),
        #             horizontalalignment = 'center',
        #             color = 'white' if cm[i, j] > thresh else "black")
        # axes[2].set_ylabel('True label')
        # axes[2].set_xlabel('Predicted label')

        # save to fs
        fig.savefig(out_path)
        plt.close()
        self.log.i("生成报告图像结束。Generate report image end.")

    def save(self, h5_path=None, tflite_path=None):
        src_h5_path = self.save_final_weights_path
        if h5_path:
            shutil.copyfile(src_h5_path, h5_path)
        if tflite_path:
            print("保存 tflite 到：{}。Save tflite to: {}".format(tflite_path, tflite_path))
            import tensorflow as tf
            # converter = tf.lite.TFLiteConverter.from_keras_model(model)
            # tflite_model = converter.convert()
            # with open (tflite_path, "wb") as f:
            #     f.write(tflite_model)

            ## kpu V3 - nncase = 0.1.0rc5
            # model.save("weights.h5", include_optimizer=False)
            model = tf.keras.models.load_model(src_h5_path)
            tf.compat.v1.disable_eager_execution()
            converter = tf.compat.v1.lite.TFLiteConverter.from_keras_model_file(src_h5_path,
                                                output_arrays=['{}/BiasAdd'.format(model.get_layer(None, -2).name)])
            tfmodel = converter.convert()
            with open (tflite_path , "wb") as f:
                f.write(tfmodel)
        # if h5_path:
        #     self.log.i("save model as .h5 file")
        #     if not h5_path.endswith(".h5"):
        #         if os.path.isdir(h5_path):
        #             h5_path = os.path.join(h5_path, "classifier.h5")
        #         else:
        #             h5_path += ".h5"
        #     if not self.model:
        #         raise Exception("no model defined")
        #     self.model.save(h5_path)
        # if tflite_path:
        #     self.log.i("save model as .tflite file")
        #     if not tflite_path.endswith(".tflite"):
        #         if os.path.isdir(tflite_path):
        #             tflite_path = os.path.join(tflite_path, "classifier.tflite")
        #         else:
        #             tflite_path += ".tflite"
        #     import tensorflow as tf
        #     converter = tf.lite.TFLiteConverter.from_keras_model(self.model)
        #     tflite_model = converter.convert()
        #     with open (tflite_path, "wb") as f:
        #         f.write(tflite_model)
        print("-"*70)

    def infer(self, input):
        pass

    def get_sample_images(self, sample_num, copy_to_dir):
        from PIL import Image
        if self.datasets_x is None:
            raise Exception("数据集目录不存在。Datasets dir not exists.")
        indxes = np.random.choice(range(self.datasets_x.shape[0]), sample_num, replace=False)
        for i in indxes:
            img = self.datasets_x[i]
            path = os.path.join(copy_to_dir, f"image_{i}.jpg")
            img = Image.fromarray(img)
            img.save(path)
        # num_gen = self._get_sample_num(len(self.labels), sample_num)
        # for label in self.labels:
        #     num = num_gen.__next__()
        #     images = os.listdir(os.path.join(self.datasets_dir, label))
        #     images = random.sample(images, num)
        #     for image in images:
        #         shutil.copyfile(os.path.join(self.datasets_dir, label, image), os.path.join(copy_to_dir, image))


    def _get_confusion_matrix(self, ):
        batch_size = 5
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
        from tensorflow.keras.applications.mobilenet import preprocess_input
        valid_gen = ImageDataGenerator(preprocessing_function=preprocess_input)
        valid_data = valid_gen.flow_from_directory(self.datasets_dir,
                target_size=[self.input_shape[0], self.input_shape[1]],
                color_mode='rgb',
                batch_size=batch_size,
                class_mode='sparse',
                shuffle=False
            )
        prediction    = self.model.predict_generator(valid_data, steps=valid_data.samples//batch_size, verbose=1)
        predict_labels = np.argmax(prediction, axis=1)
        true_labels = valid_data.classes
        if len(predict_labels) != len(true_labels):
            true_labels = true_labels[0:len(predict_labels)]
        cm = confusion_matrix(true_labels, predict_labels)
        return cm, valid_data.class_indices
        

    def _unpack_datasets(self, datasets_zip, datasets_dir=None, rm_dataset=True):
        '''
            uppack zip datasets to /temp, make /temp as tmpfs is recommend
            zip should be: 
                            datasets
                                   |
                                    ---- tfrecord1
                                   |
                                    ---- tfrecord1
            or: 
                        ---- tfrecord1
                        ---- tfrecord1
        '''
        if not datasets_dir:
            datasets_dir = os.path.join(tempfile.gettempdir(), "detector_datasets")
            if rm_dataset:
                self.datasets_rm_dir = datasets_dir
                self.need_rm_datasets = True
        if not os.path.exists(datasets_dir):
            os.makedirs(datasets_dir)
        zip_file = zipfile.ZipFile(datasets_zip)
        for names in zip_file.namelist():
            zip_file.extract(names, datasets_dir)
        zip_file.close()
        dirs = []
        for d in os.listdir(datasets_dir):
            if d.startswith(".") or not os.path.isdir(os.path.join(datasets_dir, d)):
                continue
            dirs.append(d)
        if len(dirs) == 1: # sub dir
            root_dir = dirs[0]
            datasets_dir = os.path.join(datasets_dir, root_dir)
        elif len(dirs) == 0: # no sub dir
            pass
        else: # multiple folder, not support
            return None
        return datasets_dir

    def _check_update_input_shape(self, img_shape):
        '''
            this will change self.input_shape according to img_shape if suppport
        '''
        print(img_shape,self.support_shapes)
        if not img_shape in self.support_shapes:
            return False
        #self.input_shape = img_shape
        self.log.i(f"输入形状: {self.input_shape}。Input shape: {self.input_shape}.")
        return True

    def _load_datasets(self, datasets_img_dir ,datasets_xml_dir):
        '''
            load datasets, support format:
                TFRecord: tfrecord files and tf_label_map.pbtxt in datasets_dir
            @return ok, msg, labels, classes_data_counts, datasets_x, datasets_y
                    classes_data_counts: every class's dataset count, format list, index the same as label's
                    datasets_x: np.ndarray images, not normalize, RGB channel value: [0, 255]
                    datasets_y: np.ndarray bboxes and labels index for one image, format: [[xmin, ymin, xmax, ymax, label_index], ]
                                value range:[0, w] [0, h], not [0, 1]
            @attention self.input_shape can be modified in this function according to the datasets                        
        '''
        try:
            return self._load_datasets_pascal_voc(datasets_img_dir,datasets_xml_dir)
        except:
            traceback.print_exc()
            return False, "datasets error, not support format, please check", [], None, None, None


    def _load_datasets_tfrecord(self, datasets_dir):
        '''
            load tfrecord, param and return the same as _load_datasets's
        '''
        def decode_img(img_bytes):
            img = None
            msg = ""
            try:
                # TODO: remove this condition if vott fixed this issue: https://github.com/microsoft/VoTT/issues/1012
                if b'image/encoded' in img_bytes:
                    img_bytes = img_bytes[42:]
                # TODO: check image sha256
                img = self.tf.io.decode_jpeg(img_bytes).numpy()    
            except Exception as e:
                msg = "解码图像 {} 错误: {}。Decode image {} error: {}.".format(file_name, e, file_name, e)
                self.on_warning_message(msg)
            return img, msg
        labels = []
        datasets_x = []
        datasets_y = []
        # tfrecord
        # tf_label_map.pbtxt file
        label_file_name = "tf_label_map.pbtxt"
        label_file_path = os.path.join(datasets_dir, label_file_name)
        if not os.path.exists(label_file_path):
            return False, f"没有文件 {label_file_name} 存在。No file {label_file_name} exists.", [], None, None, None
        try:
            labels = self._decode_pbtxt_file(label_file_path)
            self.log.i(f"标签: {labels}。Labels: {labels}.")           
        except Exception as e:
            return False, str(e), [], None, None, None
        # check labels
        ok, msg = self._is_labels_valid(labels)
        if not ok:
            return False, msg, [], None, None, None
        labels_len = len(labels)
        if labels_len < 1:
            return False, '未找到类别。No classes found.', [], None, None, None
        if labels_len > self.config_max_classes_limit:
            return False, '类别过多，限制：{}，数据集：{}。Classes too many, limit: {}, datasets: {}'.format(self.config_max_classes_limit, len(labels), self.config_max_classes_limit, len(labels)), [], None, None, None
        
        # *.tfrecord file
        tfrecord_files = []
        classes_data_counts = [0] * labels_len
        for name in os.listdir(datasets_dir):
            path = os.path.join(datasets_dir, name)
            if (name.startswith(".") or name == "__pycache__"
                or os.path.isdir(path)
                or not path.endswith(".tfrecord")
            ):
                continue
            tfrecord_files.append(path)
        # parse tfrecord file
        self.log.i("检测到 {} 个 tfrecord 文件。Detected {} tfrecord files.".format(len(tfrecord_files), len(tfrecord_files)))
        raws = self.tf.data.TFRecordDataset(tfrecord_files)
        # for raw in raws:
        #     example = self.tf.train.Example()
        #     example.ParseFromString(raw.numpy())
        #     print(example)
        feature_description = {
            "image/encoded": self.tf.io.FixedLenFeature([], self.tf.string),
            "image/filename": self.tf.io.FixedLenFeature([], self.tf.string),
            # "image/format": self.tf.io.FixedLenFeature([], self.tf.string),
            "image/width": self.tf.io.FixedLenFeature([], self.tf.int64),
            "image/height": self.tf.io.FixedLenFeature([], self.tf.int64),
            "image/object/class/label": self.tf.io.VarLenFeature(self.tf.int64),
            "image/object/class/text": self.tf.io.VarLenFeature(self.tf.string),
            "image/object/bbox/xmin": self.tf.io.VarLenFeature(self.tf.float32),
            "image/object/bbox/ymin": self.tf.io.VarLenFeature(self.tf.float32),
            "image/object/bbox/xmax": self.tf.io.VarLenFeature(self.tf.float32),
            "image/object/bbox/ymax": self.tf.io.VarLenFeature(self.tf.float32),
        }
        def _parse_func(example_proto):
            # Parse the input tf.Example proto using the dictionary above.
            return self.tf.io.parse_single_example(example_proto, feature_description)
        parsed_dataset = raws.map(_parse_func)
        input_shape_checked = False
        for record in parsed_dataset:
            # print(record["image/width"].numpy())
            # print(record["image/object/class/label"].values)
            # print(record["image/object/bbox/xmin"].values)
            # print(record['image/filename'])
            # print(record['image/encoded'])
            file_name = record['image/filename'].numpy().decode()
            img_shape = (record["image/height"].numpy(), record["image/width"].numpy())
            y_labels = record["image/object/class/label"].values
            y_labels_txt = record["image/object/class/text"].values
            y_bboxes_xmin = record["image/object/bbox/xmin"].values * img_shape[1]  # range [0, 1] to [0, w], float32 dtype, no need convert to int
            y_bboxes_ymin = record["image/object/bbox/ymin"].values * img_shape[0]  # range [0, 1] to [0, h], float32 dtype
            y_bboxes_xmax = record["image/object/bbox/xmax"].values * img_shape[1]
            y_bboxes_ymax = record["image/object/bbox/ymax"].values * img_shape[0]
            shape_valid = True
            if not input_shape_checked:
                img, msg = decode_img(record['image/encoded'].numpy())
                if img is None:
                    continue
                if not self._check_update_input_shape(img.shape) and not self.allow_reshape:
                    return False, "不支持的输入大小: {}，支持的大小: {}。Not supported input size: {}, supported: {}".format(img.shape, self.support_shapes, img.shape, self.support_shapes), [], None, None, None
                input_shape_checked = True
            # check image shape
            if img_shape != self.input_shape[:2]:
                shape_valid = False
                msg = "图像 {} 的形状无效，输入：{}，要求：{}。Image {} shape not valid, input: {}, require: {}".format(file_name, img_shape, self.input_shape, file_name, img_shape, self.input_shape)
                self.on_warning_message(msg)
                if not self.allow_reshape:
                    # not allow reshape, drop this image
                    continue
            # bboxes, 
            y_bboxes = []
            for i in range(len(y_labels)):
                # check label in labels
                label_txt = y_labels_txt[i].numpy().decode()
                if (not label_txt in labels) or \
                    (labels.index(label_txt) != y_labels[i].numpy()) : # text in labels and index the same
                    msg = "图像 {} 的标签错误：标签 {}:{} 错误，如果使用 TFRecord，可能是 pbtxt 文件错误。Image {}'s label error: label {}:{} error, maybe pbtxt file error if use TFRecord".format(  
                        file_name, y_labels[i].numpy(), label_txt, file_name, y_labels[i].numpy(), label_txt  
                    )
                    self.on_warning_message(msg)
                    continue
                y_bboxes.append([ y_bboxes_xmin[i].numpy(), y_bboxes_ymin[i].numpy(),
                                 y_bboxes_xmax[i].numpy(), y_bboxes_ymax[i].numpy(), y_labels[i].numpy() ])
                classes_data_counts[y_labels[i].numpy()] += 1
            # no bbox, next
            if len(y_bboxes)  < 1:
                continue
            # image decode
            img, msg = decode_img(record['image/encoded'].numpy())
            if img is None:
                continue
            # check image shape again
            if img.shape != self.input_shape:
                if shape_valid: # only warn once
                    msg = "图像 {} 的形状无效，输入：{}，要求：{}。Image {} shape not valid, input: {}, require: {}".format(  
                            file_name, img.shape, self.input_shape, file_name, img.shape, self.input_shape  
                        )
                    self.on_warning_message(msg)
                if not self.allow_reshape:
                    # not allow reshape, drop this image
                    continue
                img, y_bboxes = self._reshape_image(img, self.input_shape, y_bboxes)
            datasets_x.append(img)
            datasets_y.append(y_bboxes)
        return True, "ok", labels, classes_data_counts, datasets_x, datasets_y

    def get_labels(self,path):
        labels=[]
        files=os.listdir(path)
        for file in files:
            try:
                try:
                    DOMTree = xml.dom.minidom.parse(os.path.join(path,file))
                except Exception as e:
                    print(e)
                collection = DOMTree.documentElement
                objects = collection.getElementsByTagName("object")
                for obj in objects:
                    name=obj.getElementsByTagName('name')[0].childNodes[0].data
                    if name not in labels:
                        labels.append(name)
            except Exception as e:
                print('错误文件: ' + os.path.join(path, file) + ' | Error File: ' + os.path.join(path, file))
                traceback.print_exc()
        return labels

    # def get_labels(self, path: str) -> List[str]:
    #     labels = set()
    #     files = os.listdir(path)
    #     for file in files:
    #         # 只处理XML文件
    #         if not file.endswith('.xml'):
    #             continue
    #         try:
    #             DOMTree = minidom.parse(os.path.join(path, file))
    #             collection = DOMTree.documentElement
    #             objects = collection.getElementsByTagName("object")
    #             for obj in objects:
    #                 name = obj.getElementsByTagName('name')[0].childNodes[0].data
    #                 labels.add(name)
    #         except Exception as e:
    #             print('Error processing file: ' + os.path.join(path, file))
    #             print(e)
    #             traceback.print_exc()
    #
    #     return list(labels)

    # def get_labels(self, path: str) -> List[str]:
    #     labels = set()
    #     files = os.listdir(path)
    #     for file in files:
    #         if not file.endswith('.xml'):
    #             continue
    #
    #         try:
    #             DOMTree = minidom.parse(os.path.join(path, file))
    #             collection = DOMTree.documentElement
    #             objects = collection.getElementsByTagName("object")
    #             for obj in objects:
    #                 name = obj.getElementsByTagName('name')[0].childNodes[0].data
    #                 labels.add(name)
    #         except Exception as e:
    #             print('Error processing file: ' + os.path.join(path, file))
    #             print(e)
    #             traceback.print_exc()
    #
    #     return list(labels)

    def _load_datasets_pascal_voc(self, datasets_img_dir ,datasets_xml_dir):
        '''
            load tfrecord, param and return the same as _load_datasets's
        '''
        from parse_pascal_voc_xml import decode_pascal_voc_xml
        from PIL import Image
        labels = []
        datasets_x = []
        datasets_y = []

        img_dir = os.path.join(datasets_img_dir)
        ann_dir = os.path.join(datasets_xml_dir)

        # print("-" * 10 + "before get_labels " + "-" * 10)
        # get labels from labels.txt
        labels = self.get_labels(datasets_xml_dir)
        # print("-" * 10 + "after get_labels " + "-" * 10)
        # check labels
        ok, msg = self._is_labels_valid(labels)
        if not ok:
            return False, msg, [], None, None, None
        labels_len = len(labels)
        if labels_len < 1:
            return False, '未找到类别，no classes found', [], None, None, None
        if labels_len > self.config_max_classes_limit:
            return False, '类别过多，限制：{}，数据集：{}。Classes too much, limit: {}, datasets: {}'.format(  
                self.config_max_classes_limit, len(labels), self.config_max_classes_limit, len(labels)  
            ), [], None, None, None
        classes_data_counts = [0] * labels_len
        # get xml path
        xmls = []
        for name in os.listdir(ann_dir):
            if name.endswith(".xml"):
                xmls.append(os.path.join(ann_dir, name))
                continue
            if os.path.isdir(os.path.join(ann_dir, name)):
                for sub_name in os.listdir(os.path.join(ann_dir, name)):
                    if sub_name.endswith(".xml"):
                        path = os.path.join(ann_dir, name, sub_name)
                        xmls.append(path)
        # decode xml
        input_shape_checked = False
        for xml_path in xmls:
            ok, result = decode_pascal_voc_xml(xml_path)
            if not ok:
                result = f"解码 XML (Decode XML) {xml_path} 失败(fail)，原因(reason): {result}"
                self.on_warning_message(result)
                continue
            # shape
            img_shape = (result['height'], result['width'], result['depth'])
            #  check first image shape, and switch to proper supported input_shape
            if not input_shape_checked:
                if not self._check_update_input_shape(img_shape) and not self.allow_reshape:
                    #return False, "not supported input size, supported: {}".format(self.support_shapes), [], None, None, None
                    self.log.i("不支持的输入大小，支持的尺寸: {} | Not supported input size, supported: {}".format(self.support_shapes, self.support_shapes), [], None, None, None)
                    self.log.i("开始调整图片尺寸..... | Start resizing VOC.....")
                    if revoc.re(img_dir,ann_dir):
                        self.log.i("调整图片尺寸成功。 | Resize VOC is OK.")
                    else:
                        self.log.e("错误：调整图片尺寸出错 | ERROR: Resize VOC error")
                input_shape_checked = True
            #if img_shape != self.input_shape:
                #msg = f"decode xml {xml_path} ok, but shape {img_shape} not the same as expected: {self.input_shape}"
                #if not self.allow_reshape:
                    #self.on_warning_message(msg)
                    #continue
                #else:
                    #msg += ", will automatically reshape"
                    #self.on_warning_message(msg)
            # load image
            dir_name = os.path.split(os.path.split(result['path'])[0])[-1] # class1 / images
            # images/class1/tututututut.jpg
            img_path = os.path.join(img_dir, dir_name, result['filename'])
            if os.path.exists(img_path):
                img = np.array(Image.open(img_path), dtype='uint8')
            else:
                # images/tututututut.jpg
                img_path = os.path.join(img_dir, result['filename'])
                if os.path.exists(img_path):
                    img = np.array(Image.open(img_path), dtype='uint8')
                else:
                    result = f"解码 XML 失败（Decode XML failed) {xml_path}，无法找到图像(cannot find image): {result['path']}"
                    self.on_warning_message(result)
                    continue
            # load bndboxes
            y = []
            for bbox in result['bboxes']:
                if not bbox[4] in labels:
                    f"解码 XML 失败（Decode XML failed) {xml_path}，无法找到图像(cannot find image): {result['path']}"
                    self.on_warning_message(result)
                    continue
                label_idx = labels.index(bbox[4])
                bbox[4] = label_idx # replace label text with label index
                classes_data_counts[label_idx] += 1
                # range to [0, 1]
                y.append( bbox[:5])
            if len(y) < 1:
                result = f"解码 XML (Decode XML failed) {xml_path}，没有对象，跳过(no object, skip)"
                self.on_warning_message(result)
                continue
            #if img_shape != self.input_shape:
                #img, y = self._reshape_image(img, self.input_shape, y)
            datasets_x.append(img)
            datasets_y.append(y)
        return True, "ok", labels, classes_data_counts, datasets_x, datasets_y

    def _decode_pbtxt_file(self, file_path):
        '''
            @return list, if error, will raise Exception
        '''
        res = []
        with open(file_path) as f:
            content = f.read()
            items = re.findall("id: ([0-9].?)\n.*name: '(.*)'", content, re.MULTILINE)
            for i, item in enumerate(items):
                id = int(item[0])
                name = item[1]
                if i != id - 1:
                    raise Exception(f"数据集 pbtxt 文件错误，标签: {name} 的 ID 应该是 {i+1}，但现在是 {id}，请勿手动编辑 pbtxt 文件 | Datasets pbtxt file error, label: {name}'s id should be {i+1}, but now {id}, don't manually edit pbtxt file")
                res.append(name)
        return res
    
    def on_warning_message(self, msg):
        self.log.w(msg)
        self.warning_msg.append(msg)

    def _is_labels_valid(self, labels):
        '''
            labels len should >= 1
            and should be ascii letters, no Chinese or special words
        '''
        if len(labels) < 1:
            err_msg = "标签错误：数据集类别不足 | Labels error: datasets not enough class"
            return False, err_msg
        if len(labels) > self.config_max_classes_limit:
            err_msg = "标签错误：类别过多，现在有 {}，但仅支持 {} | Labels error: too many classes, now {}, but only support {}".format(len(labels), self.config_max_classes_limit, len(labels), self.config_max_classes_limit)
            return False, err_msg
        for label in labels:
            if not isascii(label):
                return False, "标签错误：类名（标签）不应包含特殊字符 | Labels error: class name (label) should not contain special letters"
        return True, "ok"

    def _is_datasets_valid(self, labels, classes_dataset_count, one_class_min_images_num=100, one_class_max_images_num=2000):
        '''
            dataset number in every label should > one_class_min_images_num and < one_class_max_images_num
        '''
        for i, label in enumerate(labels):
            # check image number
            if classes_dataset_count[i] < one_class_min_images_num:
                return False, "某一类的训练图像不足，'{}' 仅有 {}，应大于 {}，当前所有数据集数量为 ({}) | Not enough train images in one class, '{}' only have {}, should > {}, now all datasets num({})".format(label, classes_dataset_count[i], one_class_min_images_num, sum(classes_dataset_count), label, classes_dataset_count[i], one_class_min_images_num, sum(classes_dataset_count))
            if classes_dataset_count[i] > one_class_max_images_num:
                return False, "某一类的训练图像过多，'{}' 共有 {}，应少于 {}，当前所有数据集数量为 ({}) | Too many train images in one class, '{}' have {}, should < {}, now all datasets num({})".format(label, classes_dataset_count[i], one_class_max_images_num, sum(classes_dataset_count), label, classes_dataset_count[i], one_class_max_images_num, sum(classes_dataset_count))
        return True, "ok"

    def _reshape_image(self, img, to_shape, bboxes):  
        raise Exception("未实现自动调整图像尺寸 | Not implemented")  # TODO: 自动调整图像形状 | TODO: auto reshape images  
        new_bboxes = []  
        return img, new_bboxes

def train_on_progress(progress, msg):
    print("\n==============")
    print("进度（progress）:{}%, 信息（msg）:{}".format(progress, msg))
    print("==============")

def test_main(datasets_zip, model_path, report_path, log, use_cpu=False):
    import os
    curr_file_dir = os.path.abspath(os.path.dirname(__file__))
    if not os.path.exists("out"):
        os.makedirs("out")
    try:
        gpu = gpu_utils.select_gpu(memory_require = 1*1024*1024*1024, tf_gpu_mem_growth=False)
    except Exception:
        gpu = None
    if gpu is None:
        if not use_cpu:
            log.e("没有空闲的 GPU。No free GPU.") 
            return 1
        log.i("没有 GPU，将使用 [CPU]。No GPU, will use [CPU].")  
    else:
        log.i("选择 GPU: {}。Selected GPU: {}".format(gpu, gpu))
    detector = Detector(input_shape=(224, 224, 3), datasets_zip=datasets_zip, logger=log, one_class_min_images_num=2)
    detector.train(epochs=2,
                    progress_cb=train_on_progress,
                    weights=os.path.abspath(f"{curr_file_dir}/weights/mobilenet_7_5_224_tf_no_top.h5"),
                    save_best_weights_path = "out/best_weights.h5",
                    save_final_weights_path = "out/final_weights.h5",
                )
    detector.report(report_path)
    detector.save(tflite_path = "out/best_weights.tflite")
    detector.get_sample_images(5, "out/sample_images")
    print("--------result---------")
    print("anchors: {}".format(detector.anchors))
    print("标签列表（labels）:{}".format(detector.labels))
    print("-----------------------")
    if len(detector.warning_msg) > 0:
        print("---------------------")
        print("警告信息（warining messages）:")
        for msg in detector.warning_msg:
            print(msg)
        print("---------------------")

def test():
    log = Logger(file_path="out/train.log")
    if len(sys.argv) >= 4:
        test_main(sys.argv[1], sys.argv[2], sys.argv[3], log, use_cpu=True)
    else:
        import os
        path = os.path.abspath(f"{curr_file_dir}/out")
        path = os.path.join(path, "sample_images")
        if not os.path.exists(path):
            os.makedirs(path)
        test_main(os.path.abspath("../../../../design/assets/test-TFRecords-export.zip"),
                f"{curr_file_dir}/out/classifier.h5",
                f"{curr_file_dir}/out/report.jpg",
                log,
                use_cpu=True)

if __name__ == "__main__":
    '''
        arg: datasets_zip_file out_h5_model_path out_report_image_path
    '''
    try:
        test()
        print("============")
        print("ok")
        print("============")
    except Exception as e:
        print("============")
        print("错误（error）:")
        print(f"      {e}")
        import traceback
        traceback.print_exc()
        print("============")

