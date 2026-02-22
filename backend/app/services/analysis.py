from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Dict, Iterable

from PIL import Image

from backend.app.config import (
    FLORENCE2_MAX_NEW_TOKENS,
    FLORENCE2_MODEL_REFERENCE,
    FLORENCE2_NUM_BEAMS,
    FLORENCE2_STRICT,
    FLORENCE2_TASK_PROMPT,
)
from backend.app.services.raw_decoder import RawDecodeError, decode_raw_image, is_raw_file

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoProcessor
except ImportError:  # pragma: no cover
    torch = None  # type: ignore[assignment]
    AutoModelForCausalLM = None  # type: ignore[assignment]
    AutoProcessor = None  # type: ignore[assignment]


class VisionClassificationError(RuntimeError):
    """Raised when the Florence-2 classifier cannot run."""


CATEGORY_KEYWORDS: Dict[str, Iterable[str]] = {
    "wedding": ("wedding", "bride", "groom", "ceremony", "engagement"),
    "portrait": ("portrait", "headshot", "close-up", "person"),
    "product": ("product", "catalog", "packshot", "ecommerce", "item"),
    "event": ("event", "conference", "party", "concert", "crowd", "stage"),
}
DEFAULT_CATEGORY = "general"
_RUNTIME_LOCK = Lock()
_GPU_ACCELERATION_ENABLED = True


def _is_cuda_available() -> bool:
    return bool(torch is not None and torch.cuda.is_available())


def get_runtime_device_status() -> dict[str, object]:
    gpu_available = _is_cuda_available()
    gpu_device = None
    if gpu_available and torch is not None:
        try:
            gpu_device = torch.cuda.get_device_name(0)
        except Exception:
            gpu_device = None

    with _RUNTIME_LOCK:
        gpu_enabled = _GPU_ACCELERATION_ENABLED

    return {
        "gpu_available": gpu_available,
        "gpu_enabled": gpu_enabled,
        "gpu_active": gpu_available and gpu_enabled,
        "gpu_device": gpu_device,
    }


def set_gpu_acceleration_enabled(enabled: bool) -> dict[str, object]:
    with _RUNTIME_LOCK:
        global _GPU_ACCELERATION_ENABLED
        _GPU_ACCELERATION_ENABLED = bool(enabled)
        _classifier.cache_clear()
    return get_runtime_device_status()


def _extract_caption(post_processed, prompt: str) -> str:
    if isinstance(post_processed, dict):
        if prompt in post_processed and isinstance(post_processed[prompt], str):
            return post_processed[prompt]
        for value in post_processed.values():
            if isinstance(value, str):
                return value
    if isinstance(post_processed, str):
        return post_processed
    return str(post_processed)


def _caption_to_category(caption: str) -> str:
    normalized = caption.lower()
    for category in ("wedding", "product", "portrait", "event"):
        if any(keyword in normalized for keyword in CATEGORY_KEYWORDS[category]):
            return category
    return DEFAULT_CATEGORY


def _open_image(image_path: Path) -> Image.Image:
    if is_raw_file(image_path):
        try:
            return decode_raw_image(image_path, half_size=True)
        except RawDecodeError as exc:
            raise VisionClassificationError(str(exc)) from exc

    try:
        with Image.open(image_path) as image:
            return image.convert("RGB")
    except OSError as exc:
        raise VisionClassificationError(f"Unable to read image {image_path.name}: {exc}") from exc


class FlorenceVisionClassifier:
    def __init__(self) -> None:
        if torch is None or AutoModelForCausalLM is None or AutoProcessor is None:
            raise VisionClassificationError(
                "Florence-2 dependencies missing. Install requirements and ensure torch/transformers are available."
            )

        self.prompt = FLORENCE2_TASK_PROMPT
        self.model_reference = FLORENCE2_MODEL_REFERENCE
        self.max_new_tokens = FLORENCE2_MAX_NEW_TOKENS
        self.num_beams = FLORENCE2_NUM_BEAMS
        runtime_status = get_runtime_device_status()
        use_cuda = bool(runtime_status["gpu_active"])

        try:
            self.processor = AutoProcessor.from_pretrained(
                self.model_reference,
                trust_remote_code=True,
                local_files_only=True,
            )
            dtype = torch.float16 if use_cuda else torch.float32
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_reference,
                trust_remote_code=True,
                local_files_only=True,
                torch_dtype=dtype,
            )
        except Exception as exc:
            reference_path = Path(self.model_reference)
            missing_files = []
            if reference_path.exists() and reference_path.is_dir():
                required_candidates = [
                    reference_path / "config.json",
                ]
                weights_candidates = [
                    reference_path / "model.safetensors",
                    reference_path / "pytorch_model.bin",
                ]
                missing_files.extend(
                    str(candidate.name) for candidate in required_candidates if not candidate.exists()
                )
                if not any(candidate.exists() for candidate in weights_candidates):
                    missing_files.append("model.safetensors or pytorch_model.bin")
            missing_detail = ""
            if missing_files:
                missing_detail = f" Missing: {', '.join(missing_files)}."
            raise VisionClassificationError(
                "Florence-2 local model failed to load. Put model files in "
                f"'{self.model_reference}' or set FLORENCE2_MODEL_REFERENCE."
                f"{missing_detail} Cause: {type(exc).__name__}: {exc}"
            ) from exc

        self.device = "cuda" if use_cuda else "cpu"
        self.model.to(self.device)
        self.model.eval()

    def describe_image(self, image_path: Path) -> str:
        image = _open_image(image_path)
        try:
            inputs = self.processor(text=self.prompt, images=image, return_tensors="pt")
            inputs = {key: value.to(self.device) for key, value in inputs.items()}
            if "pixel_values" in inputs:
                model_dtype = getattr(self.model, "dtype", None)
                if model_dtype is not None and inputs["pixel_values"].dtype != model_dtype:
                    inputs["pixel_values"] = inputs["pixel_values"].to(dtype=model_dtype)
            with torch.inference_mode():
                generated_ids = self.model.generate(
                    input_ids=inputs["input_ids"],
                    pixel_values=inputs["pixel_values"],
                    max_new_tokens=self.max_new_tokens,
                    num_beams=self.num_beams,
                    do_sample=False,
                    use_cache=False,
                )
            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
            post_processed = self.processor.post_process_generation(
                generated_text,
                task=self.prompt,
                image_size=(image.width, image.height),
            )
        except Exception as exc:
            raise VisionClassificationError(
                f"Florence-2 inference failed for {image_path.name}: {exc}"
            ) from exc

        return _extract_caption(post_processed, self.prompt)

    def classify(self, image_path: Path) -> str:
        caption = self.describe_image(image_path)
        return _caption_to_category(caption)


@lru_cache(maxsize=1)
def _classifier() -> FlorenceVisionClassifier | None:
    try:
        return FlorenceVisionClassifier()
    except VisionClassificationError:
        if FLORENCE2_STRICT:
            raise
        return None


def classify_image(image_path: Path) -> str:
    classifier = _classifier()
    if classifier is None:
        return DEFAULT_CATEGORY
    return classifier.classify(image_path)
