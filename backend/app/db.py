from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Iterable, List

from backend.app.config import DATABASE_DIR, DATABASE_PATH
from backend.app.models import MoveRecord, ProjectRecord


def _connect() -> sqlite3.Connection:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                mode TEXT NOT NULL,
                image_count INTEGER NOT NULL,
                project_count INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                capture_date TEXT NOT NULL,
                image_count INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES runs(id)
            );

            CREATE TABLE IF NOT EXISTS moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                source_path TEXT NOT NULL,
                target_path TEXT NOT NULL,
                status TEXT NOT NULL,
                FOREIGN KEY(run_id) REFERENCES runs(id)
            );
            """
        )


def save_run(
    folder_path: str,
    mode: str,
    projects: List[ProjectRecord],
    moves: Iterable[MoveRecord],
) -> None:
    timestamp = datetime.utcnow().isoformat(timespec="seconds")
    image_count = sum(len(project.images) for project in projects)
    project_count = len(projects)

    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO runs (created_at, folder_path, mode, image_count, project_count)
            VALUES (?, ?, ?, ?, ?)
            """,
            (timestamp, folder_path, mode, image_count, project_count),
        )
        run_id = cursor.lastrowid

        for project in projects:
            conn.execute(
                """
                INSERT INTO projects (run_id, name, category, capture_date, image_count)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    project.name,
                    project.category,
                    project.capture_date.isoformat(),
                    len(project.images),
                ),
            )

        for move in moves:
            conn.execute(
                """
                INSERT INTO moves (run_id, source_path, target_path, status)
                VALUES (?, ?, ?, ?)
                """,
                (run_id, str(move.source_path), str(move.target_path), move.status),
            )
