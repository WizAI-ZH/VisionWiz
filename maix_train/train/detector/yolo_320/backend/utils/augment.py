# -*- coding: utf-8 -*-
from imgaug import augmenters as iaa
import cv2
import numpy as np
np.random.seed(1337)

SUPPORTED_AUGMENT_MODES = {"auto", "off", "geometry", "color", "blur_noise"}


def normalize_augment_mode(mode):
    if mode is True:
        return "auto"
    if mode is False or mode is None:
        return "off"
    text = str(mode).strip().lower()
    legacy_modes = {
        "1": "auto",
        "true": "auto",
        "open": "auto",
        "0": "off",
        "false": "off",
        "close": "off",
        "none": "off",
    }
    text = legacy_modes.get(text, text)
    return text if text in SUPPORTED_AUGMENT_MODES else "auto"


class ImgAugment(object):
    def __init__(self, w, h, jitter):
        """
        # Args
            desired_w : int
            desired_h : int
            jitter : bool
        """
        self._jitter = normalize_augment_mode(jitter)
        self._w = w
        self._h = h
        
    def imread(self, img_file, boxes):
        """
        # Args
            img_file : str
            boxes : array, shape of (N, 4)
        
        # Returns
            image : 3d-array, shape of (h, w, 3)
            boxes_ : array, same shape of boxes
                jittered & resized bounding box
        """
        # 1. read image file

        image = cv2.imread(img_file)

        if image is None:
            print("Image Path: " + img_file)
            raise ValueError
        # 2. make jitter on image
        boxes_ = np.copy(boxes)
    
        # 3. resize image     
        image, boxes_ = resize_image(image, boxes_, self._w, self._h)
        if self._jitter != "off":
            image, boxes_ = make_jitter_on_image(image, boxes_, self._jitter)   

        return image, boxes_
        
    def make_jitter(self, img, boxes):
        boxes_ = np.copy(boxes)
        if self._jitter != "off":
            img, boxes_ = make_jitter_on_image(img, boxes_, self._jitter)
        img, boxes_ = resize_image(img, boxes_, self._w, self._h)
        return img, boxes_

def make_jitter_on_image(image, boxes, mode="auto"):
    mode = normalize_augment_mode(mode)
    h, w, _ = image.shape

    if mode in ("auto", "geometry"):
        ### scale the image
        scale = np.random.uniform(low = 0.9, high = 1.2)
        image = cv2.resize(image, None, fx = scale, fy = scale, interpolation = cv2.INTER_AREA)

        ### translate the image
        max_offx = (scale-1.) * w
        max_offy = (scale-1.) * h
        offx = int(np.random.uniform(low =-1, high=1) * max_offx)
        offy = int(np.random.uniform(low =-1, high=1) * max_offy)
        T = np.float32([[1, 0, offx], [0, 1, offy]])
        image = cv2.warpAffine(image, T, (w, h))
    else:
        scale = 1.0
        offx = 0
        offy = 0

    ### flip the image
    #flip = np.random.binomial(1, .5)
    #if flip > 0.5:
    #    image = cv2.flip(image, 1)
    #    is_flip = True
    #else:
    #    is_flip = False

    if mode in ("auto", "color", "blur_noise"):
        aug_pipe = _create_augment_pipeline(mode)
        image = aug_pipe.augment_image(image)
    
    # fix object's position and size
    new_boxes = []
    for box in boxes:
        x1,y1,x2,y2 = box
        x1 = int(x1 * scale + offx)
        x2 = int(x2 * scale + offx)
        
        y1 = int(y1 * scale + offy)
        y2 = int(y2 * scale + offy)

    #    if is_flip:
    #        xmin = x1
    #        x1 = w - x2
    #        x2 = w - xmin
        new_boxes.append([x1,y1,x2,y2])
    return image, np.array(new_boxes)


def resize_image(image, boxes, desired_w, desired_h):
    h, w, _ = image.shape
    
    # resize the image to standard size
    image = cv2.resize(image, (desired_h, desired_w))
    #image = image[:,:,::-1]

    # fix object's position and size
    new_boxes = []
    for box in boxes:
        x1,y1,x2,y2 = box
        x1 = int(x1 * float(desired_w) / w)
        x1 = max(min(x1, desired_w), 0)
        x2 = int(x2 * float(desired_w) / w)
        x2 = max(min(x2, desired_w), 0)
        
        y1 = int(y1 * float(desired_h) / h)
        y1 = max(min(y1, desired_h), 0)
        y2 = int(y2 * float(desired_h) / h)
        y2 = max(min(y2, desired_h), 0)

        new_boxes.append([x1,y1,x2,y2])
    return image, np.array(new_boxes)


def _create_augment_pipeline(mode="auto"):
    mode = normalize_augment_mode(mode)
    
    ### augmentors by https://github.com/aleju/imgaug
    sometimes = lambda aug: iaa.Sometimes(0.5, aug)
    blur_noise_augmenters = [
        iaa.OneOf([
            iaa.GaussianBlur((0, 2.0)),
            iaa.AverageBlur(k=(2, 4)),
            iaa.MedianBlur(k=(3, 5)),
        ]),
        iaa.AdditiveGaussianNoise(loc=0, scale=(0.0, 0.05*255), per_channel=0.5),
        iaa.OneOf([
            iaa.Dropout((0.01, 0.1), per_channel=0.5),
        ]),
    ]
    color_augmenters = [
        iaa.Sharpen(alpha=(0, 1.0), lightness=(0.75, 1.5)),
        iaa.Add((-10, 10), per_channel=0.5),
        iaa.Multiply((0.5, 1.5), per_channel=0.5),
        iaa.ContrastNormalization((0.5, 2.0), per_channel=0.5),
    ]
    if mode == "color":
        selected_augmenters = color_augmenters
        aug_count = (1, 2)
    elif mode == "blur_noise":
        selected_augmenters = blur_noise_augmenters
        aug_count = (1, 2)
    else:
        selected_augmenters = blur_noise_augmenters + color_augmenters
        aug_count = (0, 2)

    # Define our sequence of augmentation steps that will be applied to every image
    # All augmenters with per_channel=0.5 will sample one value _per image_
    # in 50% of all cases. In all other cases they will sample new values
    # _per channel_.
    aug_pipe = iaa.Sequential(
        [
            # execute 0 to 2 of the following (less important) augmenters per image
            # don't execute all of them, as that would often be way too strong
            iaa.SomeOf(aug_count,
                selected_augmenters,
                random_order=True
            )
        ],
        random_order=True
    )
    return aug_pipe


if __name__ == '__main__':
    import os
    from annotation import PascalVocXmlParser
    import matplotlib.pyplot as plt
    parser = PascalVocXmlParser()
    for ann in sorted(os.listdir("anns")):
        annotation_file = os.path.join("anns", ann)
        fname = parser.get_fname(annotation_file)
        labels = parser.get_labels(annotation_file)
        boxes = parser.get_boxes(annotation_file)
        
        for i in range(5):
            img_file =  os.path.join("imgs", fname)
            #boxes = np.array([[1616,803,2771,1862]])
            
            desired_w = 224
            desired_h = 224
            jitter = True
            
            aug = ImgAugment(desired_w, desired_h, jitter)
            img, boxes_ = aug.imread(img_file, boxes)
            img = img.astype(np.uint8)
            
            for box in boxes_:
                x1, y1, x2, y2 = box
                cv2.rectangle(img, (x1,y1), (x2,y2), (0,255,0), 3)
            plt.imshow(img)
            plt.show(block=False)
            plt.pause(0.5)
            plt.close()
