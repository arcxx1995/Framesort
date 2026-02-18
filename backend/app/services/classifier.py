from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Dict, List, Tuple

from backend.app.models import ImageRecord, ProjectRecord


def _project_name(category: str, capture_date: date) -> str:
    return f"{category}_{capture_date.strftime('%Y%m%d')}"


def group_projects(images: List[ImageRecord]) -> List[ProjectRecord]:
    grouped: Dict[Tuple[str, date], List[ImageRecord]] = defaultdict(list)
    for image in images:
        grouped[(image.category, image.capture_date)].append(image)

    projects: List[ProjectRecord] = []
    for (category, capture_date), project_images in grouped.items():
        projects.append(
            ProjectRecord(
                name=_project_name(category, capture_date),
                category=category,
                capture_date=capture_date,
                images=sorted(project_images, key=lambda row: row.file_name.lower()),
            )
        )

    return sorted(projects, key=lambda project: (project.capture_date, project.category))

