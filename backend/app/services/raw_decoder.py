from __future__ import annotations

from pathlib import Path
from typing import Tuple

from backend.app.config import RAW_EXTENSIONS
from PIL import Image

try:
    import rawpy
except ImportError:  # pragma: no cover
    rawpy = None  # type: ignore[assignment]


class RawDecodeError(RuntimeError):
    """Raised when a RAW file cannot be decoded."""


def is_raw_file(image_path: Path) -> bool:
    return image_path.suffix.lower() in RAW_EXTENSIONS


def _require_rawpy() -> None:
    if rawpy is None:
        raise RawDecodeError(
            "RAW image support requires rawpy. Install dependencies with: pip install -r requirements.txt"
        )


def decode_raw_rgb(image_path: Path, half_size: bool = True):
    _require_rawpy()

    try:
        with rawpy.imread(str(image_path)) as raw:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=half_size,
                no_auto_bright=True,
                output_bps=8,
            )
            if rgb is None or len(rgb.shape) < 2:
                raise RawDecodeError(f"Decoded RAW output is empty for {image_path.name}")
            return rgb
    except RawDecodeError:
        raise
    except Exception as exc:
        raise RawDecodeError(f"Failed to decode RAW file {image_path.name}: {exc}") from exc


def decode_raw_image(image_path: Path, half_size: bool = True) -> Image.Image:
    rgb = decode_raw_rgb(image_path, half_size=half_size)
    return Image.fromarray(rgb).convert("RGB")


def decode_raw_dimensions(image_path: Path) -> Tuple[int, int]:
    """
    Decode RAW content and return decoded RGB dimensions (width, height).
    The decode is used as a validation step to ensure RAW files are readable.
    """
    rgb = decode_raw_rgb(image_path, half_size=True)
    return int(rgb.shape[1]), int(rgb.shape[0])
