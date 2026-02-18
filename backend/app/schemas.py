from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)


class AnalyzeImage(BaseModel):
    source_path: str
    file_name: str
    category: str
    capture_date: str


class ProjectPreview(BaseModel):
    name: str
    category: str
    capture_date: str
    image_count: int
    images: List[AnalyzeImage]


class ScanResponse(BaseModel):
    folder_path: str
    image_count: int
    project_count: int
    projects: List[ProjectPreview]


class MoveOperation(BaseModel):
    source_path: str
    target_path: str
    status: str


class OrganizeResponse(BaseModel):
    folder_path: str
    image_count: int
    project_count: int
    operations: List[MoveOperation]

