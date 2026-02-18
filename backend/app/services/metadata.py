from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Optional

from PIL import Image, UnidentifiedImageError
from PIL.ExifTags import TAGS

EXIF_DATE_FORMAT = "%Y:%m:%d %H:%M:%S"
EXIF_DATE_KEYS = ("DateTimeOriginal", "DateTimeDigitized", "DateTime")


def _parse_exif_date(raw: str) -> Optional[date]:
    try:
        return datetime.strptime(raw, EXIF_DATE_FORMAT).date()
    except ValueError:
        return None


def read_capture_date(image_path: Path) -> date:
    try:
        with Image.open(image_path) as img:
            exif = img.getexif()
            if exif:
                named = {TAGS.get(tag_id, tag_id): value for tag_id, value in exif.items()}
                for key in EXIF_DATE_KEYS:
                    raw = named.get(key)
                    if isinstance(raw, str):
                        parsed = _parse_exif_date(raw)
                        if parsed:
                            return parsed
    except (UnidentifiedImageError, OSError):
        pass

    modified = datetime.fromtimestamp(image_path.stat().st_mtime)
    return modified.date()
