from __future__ import annotations

from fastapi import FastAPI, HTTPException

from backend.app.db import initialize_db, save_run
from backend.app.models import MoveRecord, ProjectRecord
from backend.app.pipeline import build_projects, organize_projects
from backend.app.schemas import (
    AnalyzeImage,
    MoveOperation,
    OrganizeResponse,
    ScanRequest,
    ScanResponse,
    ProjectPreview,
)

app = FastAPI(title="FrameSort Backend", version="0.1.0")


@app.on_event("startup")
def startup() -> None:
    initialize_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _project_preview(project: ProjectRecord) -> ProjectPreview:
    return ProjectPreview(
        name=project.name,
        category=project.category,
        capture_date=project.capture_date.isoformat(),
        image_count=len(project.images),
        images=[
            AnalyzeImage(
                source_path=str(image.source_path),
                file_name=image.file_name,
                category=image.category,
                capture_date=image.capture_date.isoformat(),
            )
            for image in project.images
        ],
    )


def _move_preview(move: MoveRecord) -> MoveOperation:
    return MoveOperation(
        source_path=str(move.source_path),
        target_path=str(move.target_path),
        status=move.status,
    )


@app.post("/scan", response_model=ScanResponse)
def scan(payload: ScanRequest) -> ScanResponse:
    try:
        projects = build_projects(payload.folder_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    save_run(payload.folder_path, mode="scan", projects=projects, moves=[])
    return ScanResponse(
        folder_path=payload.folder_path,
        image_count=sum(len(project.images) for project in projects),
        project_count=len(projects),
        projects=[_project_preview(project) for project in projects],
    )


@app.post("/organize", response_model=OrganizeResponse)
def organize(payload: ScanRequest) -> OrganizeResponse:
    try:
        projects, moves = organize_projects(payload.folder_path, dry_run=False)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    save_run(payload.folder_path, mode="organize", projects=projects, moves=moves)
    return OrganizeResponse(
        folder_path=payload.folder_path,
        image_count=sum(len(project.images) for project in projects),
        project_count=len(projects),
        operations=[_move_preview(move) for move in moves],
    )

