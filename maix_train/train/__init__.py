'''
    train main class

    @author neucrack@sipeed
    @license Apache 2.0 © 2020 Sipeed Ltd
'''

import os, sys

root_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.append(root_path)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from classifier import Classifier
from detector import Detector
import requests
import tempfile
import shutil
from utils import gpu_utils, isascii
from utils.logger import Logger, Fake_Logger
from train import config
import time
from datetime import datetime
import subprocess
import zipfile
import traceback
import json
from enum import Enum


class TrainType(Enum):
    CLASSIFIER = 0
    DETECTOR = 1


class TrainFailReason(Enum):
    ERROR_NONE = 0
    ERROR_INTERNAL = 1
    ERROR_DOWNLOAD_DATASETS = 2
    ERROR_NODE_BUSY = 3
    ERROR_PARAM = 4
    ERROR_CANCEL = 5


class Train():
    def __init__(self, train_type: TrainType,
                 datasets_zip,
                 datasets_cls_dir,
                 dataset_img_dir,
                 dataset_xml_dir,
                 alpha,
                 batch_size,
                 epoch,
                 out_dir):
        '''
            creat /temp/train_temp dir to train
        '''
        self.alpha = alpha
        self.batch_size = batch_size
        self.train_epochs = epoch
        self.train_type = train_type
        self.datasets_cls_dir = datasets_cls_dir
        self.datasets_zip_path = datasets_zip
        self.dataset_img_dir = dataset_img_dir
        self.dataset_xml_dir = dataset_xml_dir
        self.temp_dir = out_dir
        assert os.path.exists(datasets_zip) or os.path.exists(dataset_img_dir) or os.path.exists(
            dataset_xml_dir) or os.path.exists(self.datasets_cls_dir)
        if os.path.exists(dataset_img_dir) or os.path.exists(dataset_xml_dir):
            self.datasets_img_dir = dataset_img_dir
            self.datasets_xml_dir = dataset_xml_dir
        else:
            self.datasets_img_dir = ""
            self.datasets_img_dir = ""
        if os.path.exists(datasets_cls_dir):
            self.dataset_cls_dir = datasets_cls_dir
        else:
            self.datasets_cls_dir = ""
        self.temp_datasets_dir = os.path.join(self.temp_dir, "datasets")
        self.result_dir = os.path.join(self.temp_dir, "result")
        if os.path.exists(self.result_dir):
            shutil.rmtree(self.result_dir)
        os.makedirs(self.result_dir)
        self.dataset_sample_images_path = os.path.join(self.temp_dir, "sample_images")
        os.makedirs(self.dataset_sample_images_path)
        self.log_file_path = os.path.join(self.temp_dir, "train_log.log")
        self.result_report_img_path = os.path.join(self.result_dir, "report.jpg")

        model_name = self.get_main_folder_name(dataset_img_dir if train_type==TrainType.DETECTOR else datasets_cls_dir) + '_' +self.extract_after_out(out_dir)  # 提取out_dir中的文件名以及img_dir的父文件名合并成最终的模型名字
        self.result_kmodel_path = os.path.join(self.result_dir, model_name+".kmodel")
        self.result_labels_path = os.path.join(self.result_dir, model_name+"_labels.txt")
        self.result_anchors_path = os.path.join(self.result_dir, model_name+"_anchors.txt")
        self.result_boot_py_path = os.path.join(self.result_dir, "boot.py")
        self.tflite_path = os.path.join(self.temp_dir, "mx.tflite")
        self.final_h5_model_path = os.path.join(self.temp_dir, "mx.h5")
        self.best_h5_model_path = os.path.join(self.temp_dir, "mx_best.h5")
        self.log = Logger(file_path=self.log_file_path)

    # 提取out_dir中 \out\ 后的部分
    def extract_after_out(self,save_dir):
        # 获取 save_dir 的目录部分
        base_dir = os.path.basename(os.path.normpath(save_dir))

        # 找到 'out' 目录的位置
        out_dir_index = save_dir.find('out')

        import re
        if out_dir_index == -1:
            # 'out' 目录没有在路径中找到
            return None
        else:
            # 提取 \out\ 后的部分
            extracted_part = save_dir[out_dir_index + 4:].strip(os.sep)
            pattern = r'_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_'

            refined_part = re.sub(pattern, '_', extracted_part)

            return refined_part

    def get_main_folder_name(self,datasets_img_path):
        # 获取上一级目录
        parent_dir = os.path.dirname(datasets_img_path)
        # 获取主文件夹名字
        main_folder_name = os.path.basename(parent_dir)
        return main_folder_name


    def __del__(self):
        # self.clean_temp_files()
        pass

    def clean_temp_files(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def __on_progress(self, percent, msg):  # flag: progress
        self.log.i(f"进度（progress）: {percent}%, {msg}")
        

    def __on_success(self, result_url, warn):
        self.log.i(f"完成（success）: 输出路径（out_dir）: {result_url}")
        if warn:
            self.log.w(f"警告（warnings）:\n {warn}")

    def __on_fail(self, reson, msg, warn):
        self.log.e(f"失败（failed）: {reson}, {msg}")
        if warn:
            self.log.w(f"警告（warnings）:\n {warn}")

    def __on_train_progress(self, percent, msg):  # flag: progress
        percent = percent * 0.97 + 1
        self.log.i(f"进度（progress）: {percent}%, {msg}")

    def train(self):
        warning_msg = ""
        try:
            # print("-" * 10 + "before self.train_process" + "-" * 10)
            result_url, warning_msg = self.train_process(self.log)
            # print("-" * 10 + "after self.train_process" + "-" * 10)
            self.__on_success(result_url, warning_msg)
            return True
        except Exception as e:
            info = e.args[0]
            if type(info) == tuple and len(info) == 2:
                reason = info[0]
                msg = info[1]
                self.__on_fail(reason, msg, warning_msg)
            else:
                self.__on_fail(TrainFailReason.ERROR_INTERNAL, "训练错误（train error）:{}".format(e), warning_msg)
            return False

    def train_process(self, log):
        '''
            raise Exception if error occurred, a tuple: (TrainFailReason, error_message)
            @return result url
        '''
        self.__on_progress(0, "开始（start）")  # flag: progress
        self.__on_progress(1, "开始训练（start train）")  # flag: progress

        if self.train_type == TrainType.CLASSIFIER:
            obj, prefix = self.classifier_train(log=log)
        elif self.train_type == TrainType.DETECTOR:
            obj, prefix = self.detector_train(log=log)
        else:
            raise Exception(("错误的训练类型（error train type, not suport）"))

        # check warnings
        result_warning_msg = ""
        result_warning_msg_path = os.path.join(self.result_dir, "warning.txt")
        if len(obj.warning_msg) > 0:
            result_warning_msg += "=========================================================================\n"
            result_warning_msg += "train warnings: these warn info may lead train error(accuracy loss), please check carefully\n"
            result_warning_msg += "训练警告： 这些警告信息可能导致训练误差，请务必仔细检查\n"
            result_warning_msg += "訓練警告： 這些警告信息可能導致訓練誤差，請務必仔細檢查\n"
            result_warning_msg += "=========================================================================\n"
            
            for msg in obj.warning_msg:
                result_warning_msg += "{}\n\n".format(msg)
            with open(result_warning_msg_path, "w") as f:
                f.write(result_warning_msg)

        # pack zip
        log.i("打包结果到压缩包中（pack result to zip file）")
        time_now = datetime.now().strftime("%Y_%m_%d__%H_%M")
        result_dir_name = "{}".format(prefix)  # detector_result
        result_zip_name = "{}.zip".format(result_dir_name)  # detector_result.zip
        # self.temp_dir == .../Mx-yolo/out/yolo_20XX_../
        # self.result_dir == self.temp_dir + "/result"
        result_dir = os.path.join(os.path.dirname(self.result_dir), result_dir_name)
        os.rename(self.result_dir, result_dir)
        root_dir = os.path.join(self.temp_dir, "result_root_dir")
        os.mkdir(root_dir)
        shutil.move(result_dir, root_dir)  # 移动 result 文件夹, 到一个 root_dir下,用以压缩
        result_zip = os.path.join(self.temp_dir, result_zip_name) # .../Mx-yolo/out/yolo_20XX_../detector_result.zip
        try:
            # self.zip_dir(root_dir, result_zip)
            self.zip_dir(os.path.join(root_dir, result_dir_name), result_zip)
        except Exception:
            log.e("压缩失败（zip result fail）")
            raise Exception((TrainFailReason.ERROR_INTERNAL, "压缩错误（zip result error）"))

        # progress 99%
        self.__on_progress(99, "压缩完成（pack ok）")  # flag: progress

        # complete
        self.__on_progress(100, "任务完成（task complete）")  # flag: progress
        log.i("任务完成，结果生成在（OK, task complete, result uri）: {}".format(result_zip))
        return result_zip, result_warning_msg

    def classifier_train(self, log):
        # 检测 GPU 可用,选择一个可用的 GPU 使用
        try:
            gpu = gpu_utils.select_gpu(memory_require=config.classifier_train_gpu_mem_require, tf_gpu_mem_growth=False)
        except Exception:
            gpu = None
        if gpu is None:
            if not config.allow_cpu:
                log.e("没有可用的GPU（no free GPU）")
                raise Exception(  
                    (TrainFailReason.ERROR_NODE_BUSY, "节点没有足够的GPU或GPU内存，并且不支持CPU训练。Node has insufficient GPU or GPU memory and does not support CPU training.")  
                )
            log.i("没有GPU，将使用[CPU]。No GPU, will use [CPU].")
        else:
            log.i(f"选择的GPU: {gpu}. Selected GPU: {gpu}.")

        # 启动训练
        try:
            classifier = Classifier(datasets_zip=self.datasets_zip_path, datasets_cls_dir=self.datasets_cls_dir,
                                    unpack_dir=self.temp_datasets_dir,
                                    logger=log,
                                    max_classes_num=config.classifier_train_max_classes_num,
                                    min_images_num=config.classifier_train_one_class_min_img_num,
                                    max_images_num=config.classifier_train_one_class_max_img_num,
                                    allow_reshape=False)
        except Exception as e:
            log.e("数据集无效: {}. Train datasets not valid: {}".format(e, e))  
            raise Exception((TrainFailReason.ERROR_PARAM, "数据集无效: {}. Datasets not valid: {}".format(str(e), str(e))))
        try:
            classifier.train(epochs=self.train_epochs, alpha=float(self.alpha), batch_size=self.batch_size,
                             progress_cb=self.__on_train_progress)
        except Exception as e:
            log.e("训练错误: {}. Train error: {}".format(e, e))  
            traceback.print_exc()
            raise Exception((TrainFailReason.ERROR_INTERNAL, "训练时发生错误，错误信息: {}. Error occurred during training, error: {}".format(str(e), str(e))))
        # 训练结束, 生成报告
        log.i("训练完成，现在生成报告。Train completed, now generating report.")
        classifier.report(self.result_report_img_path)

        # 生成 kmodel
        log.i("现在生成 kmodel。Now generating kmodel.")
        classifier.save(self.tflite_path + ".h5", tflite_path=self.tflite_path)
        classifier.get_sample_images(config.sample_image_num, self.dataset_sample_images_path)
        ok, msg = self.convert_to_kmodel(self.tflite_path, self.result_kmodel_path, config.ncc_kmodel_v3,
                                         self.dataset_sample_images_path)
        if not ok:
            log.e("转换为 kmodel 失败。Convert to kmodel failed.")  
            raise Exception((TrainFailReason.ERROR_INTERNAL, "转换 kmodel 失败: {}. Convert kmodel failed: {}".format(msg, msg)))
        # 拷贝模板文件
        log.i("复制模板文件。Copying template files.")
        template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "classifier", "template")
        self.__copy_template_files(template_dir, self.result_dir)

        # 写入 label 文件
        replace = 'labels = ["{}"]'.format('", "'.join(classifier.labels))
        with open(self.result_labels_path, "w") as f:
            f.write(str(classifier.labels))
        # with open(self.result_anchors_path, "w") as f:
        #     f.write(str(detector.anchors))

        with open(self.result_boot_py_path) as f:
            boot_py = f.read()
        with open(self.result_boot_py_path, "w") as f:
            target = 'labels = [] # labels'
            boot_py = boot_py.replace(target, replace)
            target = 'sensor.set_windowing((224, 224))'
            replace = 'sensor.set_windowing(({}, {}))'.format(classifier.input_shape[1], classifier.input_shape[0])
            boot_py = boot_py.replace(target, replace)
            f.write(boot_py)

        return classifier, config.classifier_result_file_name_prefix

    def detector_train(self, log):
        # 检测 GPU 可用,选择一个可用的 GPU 使用
        try:
            gpu = gpu_utils.select_gpu(memory_require=config.detector_train_gpu_mem_require, tf_gpu_mem_growth=False)
        except Exception:
            gpu = None
        if gpu is None:
            if not config.allow_cpu:
                log.e("没有空闲的 GPU。No free GPU.")  
                raise Exception(  
                    (TrainFailReason.ERROR_NODE_BUSY, "节点没有足够的 GPU 或 GPU 内存，并且不支持 CPU 训练。Node has insufficient GPU or GPU memory and does not support CPU training.")  
                )  
            log.i("没有 GPU，将使用 [CPU]。No GPU, will use [CPU].")  
        else:
            log.i("选择 GPU: {}。Selected GPU: {}".format(gpu, gpu))
        # 启动训练
        print("-" * 10 + "训练开始前（before train start） " + "-" * 10)
        
        try:
            detector = Detector(input_shape=(224, 224, 3),
                                datasets_zip=self.datasets_zip_path,
                                datasets_img_dir=self.datasets_img_dir,
                                datasets_xml_dir=self.datasets_xml_dir,
                                unpack_dir=self.temp_datasets_dir,
                                logger=log,
                                alpha=self.alpha,
                                max_classes_limit=config.detector_train_max_classes_num,
                                one_class_min_images_num=config.detector_train_one_class_min_img_num,
                                one_class_max_images_num=config.detector_train_one_class_max_img_num,
                                allow_reshape=False)
        except Exception as e:
            # log.e("train datasets not valid: {}".format(e))
            log.e("数据集无效: {}. Train datasets not valid: {}".format(e, e))
            raise Exception((TrainFailReason.ERROR_PARAM, "数据集无效: {}. Datasets not valid: {}".format(str(e), str(e))))
        try:
            if self.alpha == '0.75':
                weights = 'mobilenet_7_5_224_tf_no_top.h5'
            elif self.alpha == '0.5':
                weights = 'mobilenet_5_0_224_tf_no_top.h5'
            elif self.alpha == '0.25':
                weights = 'mobilenet_2_5_224_tf_no_top.h5'
            else:
                weights = 'mobilenet_1_0_224_tf_no_top.h5'
            # print("-" * 10 + "before  detector.train" + "-" * 10)
            detector.train(epochs=self.train_epochs,
                           progress_cb=self.__on_train_progress,
                           weights=weights,
                           save_best_weights_path=self.best_h5_model_path,
                           save_final_weights_path=self.final_h5_model_path,
                           jitter=False,
                           is_only_detect=False,
                           batch_size=self.batch_size,
                           train_times=5,
                           valid_times=2,
                           learning_rate=config.detector_train_learn_rate,
                           )
        except Exception as e:
            log.e("训练错误: {}. Train error: {}".format(e, e))  
            traceback.print_exc()  
            raise Exception((TrainFailReason.ERROR_INTERNAL, "训练时发生错误，错误信息: {}. Error occurred during training, error: {}".format(str(e), str(e))))
        # 训练结束, 生成报告
        log.i("训练完成，现在生成报告。Train completed, now generating report.")
        detector.report(self.result_report_img_path)

        # 生成 kmodel
        log.i("现在生成 kmodel。Now generating kmodel.")
        detector.save(tflite_path=self.tflite_path)
        detector.get_sample_images(config.sample_image_num, self.dataset_sample_images_path)
        ok, msg = self.convert_to_kmodel(self.tflite_path, self.result_kmodel_path, config.ncc_kmodel_v3,
                                         self.dataset_sample_images_path)
        if not ok:
            log.e("转换为 kmodel 失败。Convert to kmodel failed.")  
            raise Exception((TrainFailReason.ERROR_INTERNAL, "转换 kmodel 失败: {}. Convert kmodel failed: {}".format(msg, msg)))
        # 拷贝模板文件
        log.i("复制模板文件。Copying template files.")
        template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detector", "template")
        self.__copy_template_files(template_dir, self.result_dir)

        # 写入 label 文件
        replace = 'labels = ["{}"]'.format('", "'.join(detector.labels))
        with open(self.result_labels_path, "w") as f:
            f.write(str(detector.labels))
        with open(self.result_anchors_path, "w") as f:
            f.write(str(detector.anchors))

        # 修改boot.py内容
        with open(self.result_boot_py_path) as f:
            boot_py = f.read()
        with open(self.result_boot_py_path, "w") as f:
            target = 'labels = [] # labels'
            boot_py = boot_py.replace(target, replace)
            target = 'anchors = [] # anchors'
            replace = 'anchors = [{}]'.format(', '.join(str(i) for i in detector.anchors))
            boot_py = boot_py.replace(target, replace)
            target = 'sensor.set_windowing((224, 224))'
            replace = 'sensor.set_windowing(({}, {}))'.format(detector.input_shape[1], detector.input_shape[0])
            boot_py = boot_py.replace(target, replace)
            f.write(boot_py)

        return detector, config.detector_result_file_name_prefix

    def __copy_template_files(self, src_dir, dst_dir):
        files = os.listdir(src_dir)
        for f in files:
            shutil.copyfile(os.path.join(src_dir, f), os.path.join(dst_dir, f))

    def zip_dir(self, dir_path, out_zip_file_path):
        '''
            将目录打包成zip, 注意传的目录是根目录,是不会被打包进压缩包的,如果需要文件夹,要在这个目录下建立一个子文件夹
            root_dir
                   |
                   -- data_dir
                            -- data1
                            -- data2
            zip: 
                name.zip
                    |
                    -- data_dir
                                -- data1
                                -- data2
        '''
        shutil.make_archive(os.path.splitext(out_zip_file_path)[0], "zip", dir_path)

    def convert_to_kmodel(self, tf_lite_path, kmodel_path, ncc_path, images_path):
        '''
            @ncc_path ncc 可执行程序路径
            @return (ok, msg) 是否出错 (bool, str)
        '''
        print([ncc_path, "-i", "tflite", "-o", "k210model", "--dataset", images_path, tf_lite_path, kmodel_path])
        p = subprocess.Popen(
            [ncc_path, "-i", "tflite", "-o", "k210model", "--dataset", images_path, tf_lite_path, kmodel_path],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            output, err = p.communicate()
            res = p.returncode
        except Exception as e:
            print("[错误ERROR] ", e)
            return False, str(e)
        res = p.returncode
        if res == 0:
            return True, "ok"
        else:
            print("[错误ERROR] ", res, output, err)
        return False, f"output:\n{output.encode('gpk')}\nerror:\n{err.encode('gpk')}"


if __name__ == "__main__":
    train_task = Train(TrainType.DETECTOR, "../datasets/test_detector_xml_format.zip", "", "../out")
    train_task.train()
