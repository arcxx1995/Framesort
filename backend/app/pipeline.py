from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

from backend.app.models import ImageRecord, MoveRecord, ProjectRecord
from backend.app.services.analysis import classify_image
from backend.app.services.classifier import group_projects
from backend.app.services.metadata import read_capture_date
from backend.app.services.organizer import build_move_plan, execute_move_plan
from backend.app.services.scanner import scan_images


def build_projects(folder_path: str) -> List[ProjectRecord]:
    image_paths = scan_images(folder_path)
    images: List[ImageRecord] = []
    for image_path in image_paths:
        images.append(
            ImageRecord(
                source_path=image_path,
                file_name=image_path.name,
                category=classify_image(image_path),
                capture_date=read_capture_date(image_path),
            )
        )

    return group_projects(images)


def organize_projects(folder_path: str, dry_run: bool = False) -> Tuple[List[ProjectRecord], List[MoveRecord]]:
    root = Path(folder_path).expanduser().resolve()
    projects = build_projects(folder_path)
    move_plan = build_move_plan(root, projects)

    if dry_run:
        return projects, move_plan

    return projects, execute_move_plan(move_plan)
