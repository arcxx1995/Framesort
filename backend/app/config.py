import os
from pathlib import Path

OUTPUT_DIR_NAME = "Organized_Projects"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_DIR = Path(__file__).resolve().parent.parent / "data"
DATABASE_PATH = DATABASE_DIR / "projects.db"
RAW_EXTENSIONS = {".arw", ".nef", ".cr2", ".cr3", ".dng"}
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tiff"} | RAW_EXTENSIONS
FLORENCE2_MODEL_DIR = PROJECT_ROOT / "models" / "florence2"
FLORENCE2_MODEL_REFERENCE = os.getenv("FLORENCE2_MODEL_REFERENCE", str(FLORENCE2_MODEL_DIR))
FLORENCE2_TASK_PROMPT = os.getenv("FLORENCE2_TASK_PROMPT", "<MORE_DETAILED_CAPTION>")
FLORENCE2_MAX_NEW_TOKENS = max(8, int(os.getenv("FLORENCE2_MAX_NEW_TOKENS", "24")))
FLORENCE2_NUM_BEAMS = max(1, int(os.getenv("FLORENCE2_NUM_BEAMS", "1")))
FLORENCE2_STRICT = os.getenv("FLORENCE2_STRICT", "1").lower() not in {"0", "false", "no"}
