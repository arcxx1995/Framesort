from __future__ import annotations

import shutil
from pathlib import Path
from typing import List

from backend.app.config import OUTPUT_DIR_NAME
from backend.app.models import MoveRecord, ProjectRecord


def _unique_target(target: Path, reserved: set[Path]) -> Path:
    if not target.exists() and target not in reserved:
        return target

    stem = target.stem
    suffix = target.suffix
    counter = 1
    while True:
        candidate = target.with_name(f"{stem}_{counter}{suffix}")
        if not candidate.exists() and candidate not in reserved:
            return candidate
        counter += 1


def build_move_plan(root_folder: Path, projects: List[ProjectRecord]) -> List[MoveRecord]:
    move_plan: List[MoveRecord] = []
    output_root = root_folder / OUTPUT_DIR_NAME
    reserved_targets: set[Path] = set()

    for project in projects:
        target_dir = output_root / project.name
        for image in project.images:
            target_path = _unique_target(target_dir / image.file_name, reserved_targets)
            reserved_targets.add(target_path)
            move_plan.append(
                MoveRecord(
                    source_path=image.source_path,
                    target_path=target_path,
                    status="planned",
                )
            )

    return move_plan


def execute_move_plan(move_plan: List[MoveRecord]) -> List[MoveRecord]:
    executed: List[MoveRecord] = []
    for move in move_plan:
        move.target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(move.source_path), str(move.target_path))
        executed.append(
            MoveRecord(
                source_path=move.source_path,
                target_path=move.target_path,
                status="moved",
            )
        )

    return executed
