'''
    parse Pascal VOC compatible XML annotations

    @author neucrack
    @license MIT 2020 neucrack
'''

import os
import re


def _text_or_empty(elem):
    if elem is None or elem.text is None:
        return ""
    return elem.text.strip()


def _int_text(elem, default=-1):
    text = _text_or_empty(elem)
    if not text:
        return default
    return int(float(text))


def _local_name(tag):
    return str(tag or "").split("}", 1)[-1].lower()


def _children_by_name(elem, name):
    name = name.lower()
    return [child for child in list(elem) if _local_name(child.tag) == name]


def _first_child(elem, name):
    items = _children_by_name(elem, name)
    return items[0] if items else None


def _first_text(elem, name):
    return _text_or_empty(_first_child(elem, name))


def _float_attr(elem, name, default=-1):
    text = elem.attrib.get(name, "")
    if text == "":
        return default
    return float(text)


def _int_attr(elem, name, default=-1):
    text = elem.attrib.get(name, "")
    if text == "":
        return default
    return int(float(text))


def _parse_pascal_voc_root(root):
    filename = _first_text(root, "filename")
    path_text = _first_text(root, "path")
    if not filename and path_text:
        filename = os.path.basename(path_text)
    if not filename:
        return False, "missing filename"

    width = -1
    height = -1
    depth = -1
    size_tag = _first_child(root, "size")
    if size_tag is not None:
        width = _int_text(_first_child(size_tag, "width"))
        height = _int_text(_first_child(size_tag, "height"))
        depth = _int_text(_first_child(size_tag, "depth"))

    res = {
        "filename": filename.replace("\\", "/"),
        "path": (path_text or filename).replace("\\", "/"),
        "width": width,
        "height": height,
        "depth": depth,
        "bboxes": []
    }

    for obj_tag in _children_by_name(root, "object"):
        name = _first_text(obj_tag, "name")
        if not name:
            continue
        box_tag = _first_child(obj_tag, "bndbox")
        if box_tag is None:
            continue
        difficult = _int_text(_first_child(obj_tag, "difficult"), 0)
        x1 = _int_text(_first_child(box_tag, "xmin"))
        y1 = _int_text(_first_child(box_tag, "ymin"))
        x2 = _int_text(_first_child(box_tag, "xmax"))
        y2 = _int_text(_first_child(box_tag, "ymax"))
        if min(x1, y1, x2, y2) < 0:
            continue
        res["bboxes"].append([x1, y1, x2, y2, name, difficult])
    return True, res


def _parse_cvat_root(root):
    images = []
    for image_tag in root.iter():
        if _local_name(image_tag.tag) != "image":
            continue
        filename = (image_tag.attrib.get("name") or image_tag.attrib.get("file") or "").strip()
        if not filename:
            continue
        res = {
            "filename": filename.replace("\\", "/"),
            "path": filename.replace("\\", "/"),
            "width": _int_attr(image_tag, "width"),
            "height": _int_attr(image_tag, "height"),
            "depth": 3,
            "bboxes": []
        }
        for box_tag in list(image_tag):
            if _local_name(box_tag.tag) != "box":
                continue
            label = (box_tag.attrib.get("label") or "").strip()
            if not label:
                continue
            x1 = _float_attr(box_tag, "xtl")
            y1 = _float_attr(box_tag, "ytl")
            x2 = _float_attr(box_tag, "xbr")
            y2 = _float_attr(box_tag, "ybr")
            if min(x1, y1, x2, y2) < 0:
                continue
            difficult = _int_attr(box_tag, "occluded", 0)
            res["bboxes"].append([x1, y1, x2, y2, label, difficult])
        if res["bboxes"]:
            images.append(res)
    if not images:
        return False, "no CVAT image box"
    return True, images[0] if len(images) == 1 else images


def decode_pascal_voc_xml(xml_path, ordered=False):
    '''
        @ordered parse labelimg ordered xml by RE, or will use xml parser
        @return bool, info
                    res = {
                            "filename": ,
                            "path": ,
                            "width": ,
                            "height": ,
                            "depth": ,
                            "bboxes": [(xmin, ymin, xmax, ymax, label, difficult)]
                        }
                    CVAT XML with multiple images returns a list of res.
    '''
    if ordered:
        with open(xml_path) as f:
            xml = f.read()
        try:
            rule = "<filename>(.*)</filename>.*<path>(.*)</path>.*<size>.*<width>(.*)</width>.*<height>(.*)</height>.*<depth>(.*)</depth>.*</size>"
            match = re.findall(rule, xml, re.MULTILINE | re.DOTALL)
            if len(match) < 1:
                return False, "decode error"
            res = {
                "filename": match[0][0].replace("\\", "/"),
                "path": match[0][1].replace("\\", "/"),
                "width": int(match[0][2]),
                "height": int(match[0][3]),
                "depth": int(match[0][4]),
                "bboxes": []
            }
            rule = "<object>.*?<name>(.*?)</name>.*?<difficult>(.*?)</difficult>.*?<bndbox>.*?<xmin>(.*?)</xmin>.*?<ymin>(.*?)</ymin>.*?<xmax>(.*?)</xmax>.*?<ymax>(.*?)</ymax>.*?</bndbox>.*?</object>"
            match = re.findall(rule, xml, re.MULTILINE | re.DOTALL)
            if len(match) < 1:
                return False, "no object in this image"
            for bbox in match:
                bbox = [int(bbox[2]), int(bbox[3]), int(bbox[4]), int(bbox[5]), bbox[0], int(bbox[1])]
                res["bboxes"].append(bbox)
        except Exception as e:
            return False, "decode error: {}".format(e)
        return True, res
    try:
        from xml.etree.ElementTree import parse
        tree = parse(xml_path)
        root = tree.getroot()
        if _local_name(root.tag) == "annotations":
            return _parse_cvat_root(root)
        return _parse_pascal_voc_root(root)
    except Exception as e:
        return False, "decode error: {}".format(e)
