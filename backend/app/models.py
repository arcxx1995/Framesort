from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import List


@dataclass(frozen=True)
class ImageRecord:
    source_path: Path
    file_name: str
    category: str
    capture_date: date


@dataclass(frozen=True)
class ProjectRecord:
    name: str
    category: str
    capture_date: date
    images: List[ImageRecord]


@dataclass(frozen=True)
class MoveRecord:
    source_path: Path
    target_path: Path
    status: str

