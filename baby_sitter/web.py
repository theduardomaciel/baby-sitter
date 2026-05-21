import json
import time
from threading import Condition, Thread

import cv2
from flask import Flask, Response, render_template, stream_with_context

from .camera_service import CameraService
from .motion_detector import MotionDetector


def create_app():
    app = Flask(__name__)
    camera = CameraService()
    detector = MotionDetector(frame_width=camera.width, frame_height=camera.height)
    state_condition = Condition()
    app_state = {"active": detector.current_state()}
    motion_sound_interval_ms = 1200

    def publish_state(active):
        with state_condition:
            if app_state["active"] != active:
                app_state["active"] = active
                state_condition.notify_all()

    def motion_state_monitor():
        while True:
            active = detector.refresh_active_state()
            publish_state(active)
            time.sleep(0.1)

    Thread(target=motion_state_monitor, daemon=True).start()

    def generate_frames():
        while True:
            success, frame = camera.read()

            if not success:
                break

            processed_frame, _ = detector.process(frame)
            success, buffer = cv2.imencode(".jpg", processed_frame)

            if not success:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" +
                buffer.tobytes() +
                b"\r\n"
            )

    def event_stream():
        last_sent = None

        while True:
            with state_condition:
                state_condition.wait_for(lambda: app_state["active"] != last_sent, timeout=15)
                active = app_state["active"]

            last_sent = active
            yield f"event: motion\ndata: {json.dumps({'active': active})}\n\n"

    @app.route("/")
    def index():
        return render_template(
            "index.html",
            video_url="/video_feed",
            motion_events_url="/motion-events",
            motion_sound_interval_ms=motion_sound_interval_ms,
        )

    @app.route("/video_feed")
    def video_feed():
        return Response(
            generate_frames(),
            mimetype="multipart/x-mixed-replace; boundary=frame",
        )

    @app.route("/motion-events")
    def motion_events():
        return Response(
            stream_with_context(event_stream()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return app
