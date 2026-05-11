#!python3

import argparse, os, sys, shutil
import json
import time
import train.detector.test as test
import train.classifier.predict_batch as clsstest


def parse_input_size(value):
    text = str(value or "224x224").lower().replace(" ", "")
    if "x" not in text:
        raise argparse.ArgumentTypeError("input size must be in WIDTHxHEIGHT format")
    width_text, height_text = text.split("x", 1)
    try:
        width = int(width_text)
        height = int(height_text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("input size must be in WIDTHxHEIGHT format") from exc
    supported = {(224, 224), (240, 240), (320, 224), (320, 240)}
    if (width, height) not in supported:
        raise argparse.ArgumentTypeError("unsupported input size: {}".format(value))
    return width, height


def parse_data_aug_mode(value):
    text = str(value or "auto").strip().lower()
    legacy_map = {
        "1": "auto",
        "true": "auto",
        "open": "auto",
        "0": "off",
        "false": "off",
        "close": "off",
        "closed": "off",
        "none": "off",
    }
    text = legacy_map.get(text, text)
    supported = {"auto", "off", "geometry", "color", "blur_noise"}
    if text not in supported:
        raise argparse.ArgumentTypeError("unsupported data augmentation mode: {}".format(value))
    return text


def main():
    default_output_dir_name = 'trainOutput'
    supported_types = ["classifier", "detector"]
    curr_dir = os.path.abspath(os.path.dirname(__file__))
    parser = argparse.ArgumentParser(description="train model", usage='''
        python3 main.py -z "datasets zip file" init
    then
        python3 main.py -z "datasets zip file" train
        or  python3 main.py -d "datasets directory" train
''')
    parser.add_argument("-t", "--type", type=str, help="train type, classifier or detector", choices=supported_types, default="classifier")
    parser.add_argument("-z", "--zip", type=str, help="datasets zip file path", default="")
    parser.add_argument("-di", "--datasets_img", type=str, help="datasets directory", default="")
    parser.add_argument("-dx", "--datasets_xml", type=str, help="datasets directory", default="")
    parser.add_argument("-dc", "--datasets_cls", type=str, help="datasets directory", default="")
    parser.add_argument("-ep", "--train_epochs", type=str, help="train_epochs", default=30)
    parser.add_argument("-ap", "--alpha", type=str, help="train_epochs", default='0.75')
    parser.add_argument("-bz", "--batch_size", type=str, help="batch_size", default='8')
    parser.add_argument("-is", "--input_size", type=parse_input_size, help="detector input size WIDTHxHEIGHT", default=(224, 224))
    parser.add_argument("--data_aug", type=parse_data_aug_mode, help="data augmentation mode", default="auto")
    parser.add_argument("-c", "--config", type=str, help="config file", default=os.path.join(curr_dir, "train", "config.py"))
    parser.add_argument("cmd", help="command", choices=["train", "init"])
    args = parser.parse_args()
    timess = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime())

    # 去掉 alpha 的小数点
    alpha_no_dot = str(args.alpha).replace('.', '')
    # 动态生成的训练参数数据
    train_param_data = '_epoch{}_alpha{}_bz{}'.format(args.train_epochs, alpha_no_dot, args.batch_size)

    if args.type == "classifier":
        save_dir = os.path.join(os.getcwd(), default_output_dir_name, 'classifer_' + timess + train_param_data)
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
    else:
        save_dir = os.path.join(os.getcwd(), default_output_dir_name, 'yolo_' + timess + train_param_data)
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)

    info = {
        'type': args.type,
        'epochs': args.train_epochs,
        'alpha': args.alpha,
        'batch_size': args.batch_size,
        'input_width': args.input_size[0],
        'input_height': args.input_size[1],
        'input_shape': [args.input_size[1], args.input_size[0], 3],
        'data_aug': args.data_aug,
    }
    print('训练参数信息(Train info): ' + os.path.join(save_dir, 'info.json'))
    file = open(os.path.join(save_dir, 'info.json'), 'w', encoding='utf-8')
    json.dump(info, file)
    file.close()

    dst_config_path = args.config
    if args.cmd == "init":
        instance_dir = os.path.join(curr_dir, "instance")
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)
        copy_config = True
        if os.path.exists(dst_config_path):
            print("[WARNING] instance/config.py already exists, sure to rewrite it? [yes/no]")
            print("[警告] 配置文件 config.py 已经存在，确定重写吗？[yes/no]")
            ensure = input()
            if ensure != "yes":
                copy_config = False
        if copy_config:
            shutil.copyfile(os.path.join(curr_dir, "train", "config_template.py"), dst_config_path)
        print("init done, please edit instance/config.py")
        print("初始化完成，请编辑配置文件 config.py")
        return 0

    print(dst_config_path)
    if not os.path.exists(dst_config_path):
        print("config.py not find!")
        print("没有找到 Python 配置文件")
        return -1

    from train import Train, TrainType

    if args.type == "classifier":
        train_task = Train(TrainType.CLASSIFIER, args.zip, args.datasets_cls, args.datasets_img, args.datasets_xml, args.alpha, int(args.batch_size), int(args.train_epochs), save_dir, input_shape=(args.input_size[1], args.input_size[0], 3), data_aug_mode=args.data_aug)
    elif args.type == "detector":
        train_task = Train(TrainType.DETECTOR, args.zip, args.datasets_cls, args.datasets_img, args.datasets_xml, args.alpha, int(args.batch_size), int(args.train_epochs), save_dir, input_shape=(args.input_size[1], args.input_size[0], 3), data_aug_mode=args.data_aug)
    else:
        print("[ERROR] train type not support only support: {}".format(", ".join(supported_types)))
        print("[错误] 当前训练类型不受支持，仅支持: {}".format(", ".join(supported_types)))
        return -1

    T = train_task.train()
    if T:
        if args.type == "detector":
            R = test.main(save_dir)
        if args.type == "classifier":
            R = clsstest.main(save_dir)
        if R:
            print('Training and testing success!')
            print('完成训练及测试模型')
            file = open(os.path.join(save_dir, 'success'), 'w', encoding='utf-8')
            file.close()
    return 0


if __name__ == "__main__":
    main()
