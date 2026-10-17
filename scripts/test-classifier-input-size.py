import os
import sys
import ast
import tempfile
from unittest import mock


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "maix_train"))

import train as train_package


class _Log:
    def i(self, *args):
        pass

    def e(self, *args):
        pass


def main():
    expected_shape = (224, 320, 3)
    captured = {}

    class CaptureClassifier:
        def __init__(self, **kwargs):
            captured.update(kwargs)
            self.input_shape = kwargs.get('input_shape', (224, 224, 3))
            self.labels = ['cat', 'dog']

        def train(self, **kwargs):
            pass

        def report(self, *args):
            pass

        def save(self, *args, **kwargs):
            pass

        def get_sample_images(self, *args):
            pass

    task = train_package.Train.__new__(train_package.Train)
    task.input_shape = expected_shape
    task.datasets_zip_path = None
    task.datasets_cls_dir = "unused"
    task.temp_datasets_dir = "unused"
    task.data_aug_mode = "off"
    task.log = _Log()
    task.train_epochs = 1
    task.alpha = '0.75'
    task.batch_size = 4
    task.convert_to_kmodel = lambda *args: (True, '')

    with tempfile.TemporaryDirectory(prefix='visionwiz-cls-size-') as output, \
            mock.patch.object(train_package, "Classifier", CaptureClassifier), \
            mock.patch.object(train_package.gpu_utils, "select_gpu", return_value=None), \
            mock.patch.object(train_package.config, "allow_cpu", True):
        task.result_dir = output
        task.result_report_img_path = os.path.join(output, 'report.png')
        task.tflite_path = os.path.join(output, 'mx.tflite')
        task.dataset_sample_images_path = os.path.join(output, 'samples')
        task.result_kmodel_path = os.path.join(output, 'mx.kmodel')
        task.result_labels_path = os.path.join(output, 'labels.txt')
        task.result_boot_py_path = os.path.join(output, 'boot.py')
        task.classifier_train(task.log)
        with open(task.result_boot_py_path, encoding='utf-8') as script:
            boot_ast = ast.parse(script.read())
        main_func = next(node for node in boot_ast.body
                         if isinstance(node, ast.FunctionDef) and node.name == 'main')
        defaults = dict(zip((arg.arg for arg in main_func.args.args[-len(main_func.args.defaults):]),
                            main_func.args.defaults))
        assert ast.literal_eval(defaults['sensor_window']) == (320, 224), \
            'Exported boot.py must use the selected camera window'

    actual_shape = captured.get("input_shape")
    assert actual_shape == expected_shape, (
        "Classifier input shape mismatch: expected {}, got {}".format(
            expected_shape, actual_shape
        )
    )
    print("classifier input size propagation and exported boot window: PASS")


if __name__ == "__main__":
    main()
