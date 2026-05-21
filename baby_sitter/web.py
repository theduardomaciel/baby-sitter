import cv2
from flask import Flask, Response, jsonify, render_template

from .camera_service import CameraService
from .motion_detector import MotionDetector


def create_app():
    app = Flask(__name__)
    camera = CameraService()
    detector = MotionDetector(frame_width=camera.width, frame_height=camera.height)

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

    @app.route("/")
    def index():
        return render_template(
            "index.html",
            video_url="/video_feed",
            motion_status_url="/motion-status",
        )

    @app.route("/video_feed")
    def video_feed():
        return Response(
            generate_frames(),
            mimetype="multipart/x-mixed-replace; boundary=frame",
        )

    @app.route("/motion-status")
    def motion_status():
        return jsonify({"active": detector.is_active()})

    return app
