import json
import os
import socket
import time
from pathlib import Path
from threading import Condition, Thread

import cv2
import qrcode
from flask import Flask, Response, render_template, stream_with_context

from .camera_service import CameraService
from .motion_detector import MotionDetector


DEFAULT_PUBLIC_PORT = 5000


def _detect_local_ip_address():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
        try:
            connection.connect(("8.8.8.8", 80))
            return connection.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def resolve_public_url(port=DEFAULT_PUBLIC_PORT):
    configured_public_url = os.environ.get("BABY_SITTER_PUBLIC_URL")

    if configured_public_url:
        return configured_public_url.rstrip("/") + "/"

    return f"http://{_detect_local_ip_address()}:{port}/"


def print_terminal_qr_code(target_url):
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        border=1,
    )
    qr.add_data(target_url)
    qr.make(fit=True)

    matrix = qr.get_matrix()
    lines = ["", f"Acesse o app em: {target_url}", ""]

    for row_index in range(0, len(matrix), 2):
        top_row = matrix[row_index]
        bottom_row = matrix[row_index + 1] if row_index + 1 < len(matrix) else [False] * len(top_row)
        rendered_row = []

        for column_index, top_cell in enumerate(top_row):
            bottom_cell = bottom_row[column_index]
            if top_cell and bottom_cell:
                rendered_row.append("█")
            elif top_cell:
                rendered_row.append("▀")
            elif bottom_cell:
                rendered_row.append("▄")
            else:
                rendered_row.append(" ")

        lines.append("".join(rendered_row))

    print("\n".join(lines))


def create_app():
    base_dir = Path(__file__).resolve().parent
    app = Flask(
        __name__,
        template_folder=str(base_dir / "templates"),
        static_folder=str(base_dir / "static"),
    )
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
