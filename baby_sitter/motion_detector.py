import time
from threading import Lock

import cv2


class MotionDetector:
    def __init__(self, frame_width=1280, frame_height=720, pixel_threshold=5000, hold_seconds=1.2):
        self._frame_width = frame_width
        self._frame_height = frame_height
        self._pixel_threshold = pixel_threshold
        self._hold_seconds = hold_seconds
        self._previous_frame = None
        self._last_motion_at = 0.0
        self._lock = Lock()

    def process(self, frame):
        resized = cv2.resize(frame, (self._frame_width, self._frame_height))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        movement_detected = False

        with self._lock:
            if self._previous_frame is not None:
                diff = cv2.absdiff(self._previous_frame, gray)
                _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                movement = cv2.countNonZero(thresh)

                if movement > self._pixel_threshold:
                    movement_detected = True
                    self._last_motion_at = time.monotonic()

            self._previous_frame = gray

        if movement_detected:
            cv2.putText(
                resized,
                "MOVIMENTO DETECTADO",
                (24, 42),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2,
            )

        return resized, movement_detected

    def is_active(self):
        with self._lock:
            return (time.monotonic() - self._last_motion_at) < self._hold_seconds
