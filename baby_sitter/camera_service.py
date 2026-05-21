import atexit
import os
from threading import Lock

import cv2


class CameraService:
    def __init__(self, camera_index=0, width=1280, height=720):
        self._width = width
        self._height = height
        self._lock = Lock()
        backend = cv2.CAP_DSHOW if os.name == "nt" else cv2.CAP_ANY
        self._capture = cv2.VideoCapture(camera_index, backend)

        if self._capture.isOpened():
            self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        atexit.register(self.close)

    @property
    def width(self):
        return self._width

    @property
    def height(self):
        return self._height

    def read(self):
        with self._lock:
            return self._capture.read()

    def close(self):
        if self._capture.isOpened():
            self._capture.release()
