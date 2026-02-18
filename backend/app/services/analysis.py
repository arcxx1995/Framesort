from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable

from PIL import Image

from backend.app.config import FLORENCE2_MODEL_REFERENCE, FLORENCE2_TASK_PROMPT
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

        try:
            self.processor = AutoProcessor.from_pretrained(
                self.model_reference,
                trust_remote_code=True,
                local_files_only=True,
            )
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_reference,
                trust_remote_code=True,
                local_files_only=True,
                torch_dtype=dtype,
            )
        except Exception as exc:
            raise VisionClassificationError(
                "Florence-2 local model is unavailable. Put model files in "
                f"'{self.model_reference}' or set FLORENCE2_MODEL_REFERENCE."
            ) from exc

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)
        self.model.eval()

    def describe_image(self, image_path: Path) -> str:
        image = _open_image(image_path)
        try:
            inputs = self.processor(text=self.prompt, images=image, return_tensors="pt")
            inputs = {key: value.to(self.device) for key, value in inputs.items()}
            generated_ids = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=64,
                num_beams=3,
                do_sample=False,
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
def _classifier() -> FlorenceVisionClassifier:
    return FlorenceVisionClassifier()


def classify_image(image_path: Path) -> str:
    return _classifier().classify(image_path)
