from __future__ import annotations

from pathlib import Path
from typing import List

from backend.app.config import OUTPUT_DIR_NAME, SUPPORTED_EXTENSIONS


def scan_images(folder_path: str) -> List[Path]:
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"Folder does not exist: {root}")

    image_paths: List[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if OUTPUT_DIR_NAME in path.parts:
            continue

        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
            image_paths.append(path)

    return sorted(image_paths)

