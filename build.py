from __future__ import annotations

import os
from pathlib import Path

from PyInstaller.__main__ import run


ROOT = Path(__file__).resolve().parent
DATA_SEPARATOR = ";" if os.name == "nt" else ":"


def data_argument(source: Path, destination: str) -> str:
    return f"{source}{DATA_SEPARATOR}{destination}"


def main() -> None:
    arguments = [
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        "baby-sitter",
        "--collect-all",
        "cv2",
        "--add-data",
        data_argument(ROOT / "baby_sitter" / "templates", "baby_sitter/templates"),
        "--add-data",
        data_argument(ROOT / "baby_sitter" / "static", "baby_sitter/static"),
        str(ROOT / "main.py"),
    ]
    run(arguments)


if __name__ == "__main__":
    main()