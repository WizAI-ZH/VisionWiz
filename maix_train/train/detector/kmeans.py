import numpy as np


def iou(box, clusters):
    """
    Calculates the Intersection over Union (IoU) between a box and k clusters.
    :param box: tuple or array, shifted to the origin (i. e. width and height)
    :param clusters: numpy array of shape (k, 2) where k is the number of clusters
    :return: numpy array of shape (k, 0) where k is the number of clusters
    """
    x = np.minimum(clusters[:, 0], box[0])
    y = np.minimum(clusters[:, 1], box[1])
    if np.count_nonzero(x == 0) > 0 or np.count_nonzero(y == 0) > 0:
        raise ValueError("Box has no area")

    intersection = x * y
    box_area = box[0] * box[1]
    cluster_area = clusters[:, 0] * clusters[:, 1]

    iou_ = intersection / (box_area + cluster_area - intersection)

    return iou_


def avg_iou(boxes, clusters):
    """
    Calculates the average Intersection over Union (IoU) between a numpy array of boxes and k clusters.
    :param boxes: numpy array of shape (r, 2), where r is the number of rows
    :param clusters: numpy array of shape (k, 2) where k is the number of clusters
    :return: average IoU as a single float
    """
    return np.mean([np.max(iou(boxes[i], clusters)) for i in range(boxes.shape[0])])


def translate_boxes(boxes):
    """
    Translates all the boxes to the origin.
    :param boxes: numpy array of shape (r, 4)
    :return: numpy array of shape (r, 2)
    """
    new_boxes = boxes.copy()
    for row in range(new_boxes.shape[0]):
        new_boxes[row][2] = np.abs(new_boxes[row][2] - new_boxes[row][0])
        new_boxes[row][3] = np.abs(new_boxes[row][3] - new_boxes[row][1])
    return np.delete(new_boxes, [0, 1], axis=1)


def _run_kmeans(boxes, k, dist, initial_clusters):
    rows = boxes.shape[0]
    distances = np.empty((rows, k))
    last_clusters = np.full((rows,), -1)
    clusters = initial_clusters.copy()

    while True:
        for row in range(rows):
            distances[row] = 1 - iou(boxes[row], clusters)

        nearest_clusters = np.argmin(distances, axis=1)

        if (last_clusters == nearest_clusters).all():
            break

        for cluster in range(k):
            d = boxes[nearest_clusters == cluster]
            if len(d) == 0:
                continue
            clusters[cluster] = dist(d, axis=0)
        last_clusters = nearest_clusters

    return clusters


def kmeans(boxes, k, dist=np.median, seed=1337, attempts=20):
    """
    Calculates k-means clustering with the Intersection over Union (IoU) metric.
    :param boxes: numpy array of shape (r, 2), where r is the number of rows
    :param k: number of clusters
    :param dist: distance function
    :return: numpy array of shape (k, 2)
    """
    rows = boxes.shape[0]
    if rows < k:
        raise ValueError("Number of boxes must be greater than or equal to k")

    rng = np.random.RandomState(seed)
    best_clusters = None
    best_iou = -1

    for _ in range(max(1, attempts)):
        # the Forgy method will fail if the whole array contains the same rows
        initial_clusters = boxes[rng.choice(rows, k, replace=False)]
        clusters = _run_kmeans(boxes, k, dist, initial_clusters)
        current_iou = avg_iou(boxes, clusters)
        if current_iou > best_iou:
            best_iou = current_iou
            best_clusters = clusters

    return np.array(sorted(best_clusters, key=lambda item: (item[0] * item[1], item[0], item[1])))
