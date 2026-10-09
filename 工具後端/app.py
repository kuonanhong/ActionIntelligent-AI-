"""Local-only job API for the SmartAction optional video generation tool."""

from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import threading
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
TASK_MODELS = {
    "image-to-video": {
        "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers",
        "Wan-AI/Wan2.1-I2V-14B-720P",
        "wan-2.1-i2v",
        "wan",
    },
    "video-to-video": {
        "THUDM/CogVideoX-5b",
        "THUDM/CogVideoX1.5-5B-I2V",  # accepted only as a UI compatibility alias
        "cogvideox-v2v",
        "cogvideox",
    },
}
CANONICAL_MODEL = {
    "image-to-video": "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers",
    "video-to-video": "THUDM/CogVideoX-5b",
}


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    runner: str
    max_upload_bytes: int
    max_video_seconds: int
    max_image_pixels: int
    max_queued_jobs: int
    allow_model_downloads: bool
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            item.strip()
            for item in os.getenv(
                "SMARTACTION_CORS_ORIGINS",
                "https://kuonanhong.github.io,http://localhost,http://127.0.0.1",
            ).split(",")
            if item.strip()
        )
        if "*" in origins:
            raise RuntimeError("SMARTACTION_CORS_ORIGINS must not contain '*'")
        data_dir = Path(os.getenv("SMARTACTION_DATA_DIR", BASE_DIR / "runtime")).resolve()
        return cls(
            data_dir=data_dir,
            runner=os.getenv("SMARTACTION_RUNNER", "mock").strip().lower(),
            max_upload_bytes=_env_int(
                "SMARTACTION_MAX_UPLOAD_BYTES", 100 * 1024 * 1024, 1 * 1024 * 1024, 500 * 1024 * 1024
            ),
            max_video_seconds=_env_int("SMARTACTION_MAX_VIDEO_SECONDS", 12, 1, 60),
            max_image_pixels=_env_int("SMARTACTION_MAX_IMAGE_PIXELS", 40_000_000, 1_000_000, 100_000_000),
            max_queued_jobs=_env_int("SMARTACTION_MAX_QUEUED_JOBS", 4, 1, 32),
            allow_model_downloads=os.getenv("SMARTACTION_ALLOW_MODEL_DOWNLOADS", "0") == "1",
            cors_origins=origins,
        )


@dataclass
class Job:
    id: str
    task: str
    model: str
    prompt: str
    input_path: str
    status: str = "queued"
    progress: int = 0
    output_name: str | None = None
    error: str | None = None
    created_at: str = ""
    started_at: str | None = None
    finished_at: str | None = None


class Runner(Protocol):
    mode: str
    ready: bool
    detail: str

    def run(self, job: Job, output_path: Path) -> None: ...


class MockRunner:
    """Produces a short preview locally; it is deliberately not an AI generator."""

    mode = "mock"
    ready = True
    detail = "Mock preview runner (no model weights)"

    def run(self, job: Job, output_path: Path) -> None:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("ffmpeg is required by the mock preview runner")
        source = job.input_path
        common = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
        vf = (
            "scale=512:512:force_original_aspect_ratio=decrease,"
            "pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p"
        )
        if job.task == "image-to-video":
            command = common + [
                "-loop", "1", "-i", source, "-t", "1", "-r", "8", "-vf", vf,
                "-an", "-c:v", "libx264", "-movflags", "+faststart", str(output_path),
            ]
        else:
            command = common + [
                "-i", source, "-t", "1", "-vf", vf, "-an", "-c:v", "libx264",
                "-movflags", "+faststart", str(output_path),
            ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
        if completed.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {completed.stderr.strip()[-400:]}")


class DisabledRunner:
    mode = "disabled"
    ready = False

    def __init__(self, detail: str) -> None:
        self.detail = detail

    def run(self, job: Job, output_path: Path) -> None:
        raise RuntimeError(self.detail)


class DiffusersRunner:
    """Lazy, opt-in CUDA runner using official Diffusers pipeline classes."""

    mode = "diffusers"
    ready = True
    detail = "CUDA Diffusers runner; model inference has not been exercised in this repository"

    def __init__(self) -> None:
        import torch

        if not torch.cuda.is_available():
            raise RuntimeError("SMARTACTION_RUNNER=diffusers requires a CUDA-capable PyTorch installation")
        self.torch = torch
        self.pipelines: dict[str, Any] = {}

    def _wan(self) -> Any:
        key = "wan"
        if key not in self.pipelines:
            from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
            from transformers import CLIPVisionModel

            model_id = os.getenv(
                "SMARTACTION_WAN_MODEL_ID", "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers"
            )
            image_encoder = CLIPVisionModel.from_pretrained(
                model_id, subfolder="image_encoder", torch_dtype=self.torch.float32
            )
            vae = AutoencoderKLWan.from_pretrained(
                model_id, subfolder="vae", torch_dtype=self.torch.float32
            )
            pipe = WanImageToVideoPipeline.from_pretrained(
                model_id,
                vae=vae,
                image_encoder=image_encoder,
                torch_dtype=self.torch.bfloat16,
            )
            pipe.enable_model_cpu_offload()
            self.pipelines[key] = pipe
        return self.pipelines[key]

    def _cogvideox(self) -> Any:
        key = "cogvideox"
        if key not in self.pipelines:
            from diffusers import CogVideoXDPMScheduler, CogVideoXVideoToVideoPipeline

            model_id = os.getenv("SMARTACTION_COGVIDEOX_MODEL_ID", "THUDM/CogVideoX-5b")
            pipe = CogVideoXVideoToVideoPipeline.from_pretrained(
                model_id, torch_dtype=self.torch.bfloat16
            )
            pipe.scheduler = CogVideoXDPMScheduler.from_config(pipe.scheduler.config)
            pipe.enable_model_cpu_offload()
            pipe.vae.enable_tiling()
            self.pipelines[key] = pipe
        return self.pipelines[key]

    def run(self, job: Job, output_path: Path) -> None:
        from diffusers.utils import export_to_video, load_video

        generator = self.torch.Generator(device="cuda").manual_seed(42)
        if job.task == "image-to-video":
            import math

            pipe = self._wan()
            with Image.open(job.input_path) as opened:
                image = opened.convert("RGB")
            max_area = 720 * 1280
            aspect_ratio = image.height / image.width
            mod_value = pipe.vae_scale_factor_spatial * pipe.transformer.config.patch_size[1]
            height = max(mod_value, round(math.sqrt(max_area * aspect_ratio)) // mod_value * mod_value)
            width = max(mod_value, round(math.sqrt(max_area / aspect_ratio)) // mod_value * mod_value)
            image = image.resize((width, height))
            frames = pipe(
                image=image,
                prompt=job.prompt,
                height=height,
                width=width,
                num_frames=81,
                guidance_scale=5.0,
                generator=generator,
            ).frames[0]
            export_to_video(frames, str(output_path), fps=16)
            return

        pipe = self._cogvideox()
        input_frames = load_video(job.input_path)
        if len(input_frames) > 49:
            indices = [round(index * (len(input_frames) - 1) / 48) for index in range(49)]
            input_frames = [input_frames[index] for index in indices]
        frames = pipe(
            video=input_frames,
            prompt=job.prompt,
            strength=0.8,
            guidance_scale=6,
            num_inference_steps=50,
            generator=generator,
        ).frames[0]
        export_to_video(frames, str(output_path), fps=8)


def _build_runner(settings: Settings) -> Runner:
    if settings.runner == "mock":
        return MockRunner()
    if settings.runner != "diffusers":
        return DisabledRunner("SMARTACTION_RUNNER must be 'mock' or 'diffusers'")
    if not settings.allow_model_downloads:
        return DisabledRunner(
            "Set SMARTACTION_ALLOW_MODEL_DOWNLOADS=1 to explicitly permit loading/downloading large model weights"
        )
    try:
        return DiffusersRunner()
    except Exception as exc:  # keep /health available for setup diagnostics
        return DisabledRunner(f"Diffusers runner unavailable: {type(exc).__name__}: {exc}")


class JobService:
    def __init__(self, settings: Settings, runner: Runner) -> None:
        self.settings = settings
        self.runner = runner
        self.uploads = settings.data_dir / "uploads"
        self.outputs = settings.data_dir / "outputs"
        self.uploads.mkdir(parents=True, exist_ok=True)
        self.outputs.mkdir(parents=True, exist_ok=True)
        self.jobs: dict[str, Job] = {}
        self.lock = threading.RLock()
        self.queue: queue.Queue[str | None] = queue.Queue(maxsize=settings.max_queued_jobs)
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None

    def start(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        self.worker = threading.Thread(target=self._work, name="smartaction-video-worker", daemon=True)
        self.worker.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.queue.put(None)
        if self.worker:
            self.worker.join(timeout=5)

    def enqueue(self, job: Job) -> bool:
        with self.lock:
            self.jobs[job.id] = job
        try:
            self.queue.put_nowait(job.id)
        except queue.Full:
            with self.lock:
                self.jobs.pop(job.id, None)
            return False
        return True

    def get(self, job_id: str) -> Job | None:
        with self.lock:
            return self.jobs.get(job_id)

    def _work(self) -> None:
        while not self.stop_event.is_set():
            job_id = self.queue.get()
            if job_id is None:
                self.queue.task_done()
                return
            job = self.get(job_id)
            if job is None:
                self.queue.task_done()
                continue
            output_path = self.outputs / f"{job.id}.mp4"
            try:
                with self.lock:
                    job.status = "running"
                    job.progress = 10
                    job.started_at = _utcnow()
                self.runner.run(job, output_path)
                if not output_path.is_file() or output_path.stat().st_size == 0:
                    raise RuntimeError("runner did not create a non-empty output")
                with self.lock:
                    job.status = "succeeded"
                    job.progress = 100
                    job.output_name = output_path.name
                    job.finished_at = _utcnow()
            except Exception as exc:
                output_path.unlink(missing_ok=True)
                with self.lock:
                    job.status = "failed"
                    job.progress = 100
                    message = str(exc).replace(str(self.settings.data_dir), "<data>")
                    job.error = f"{type(exc).__name__}: {message[:500]}"
                    job.finished_at = _utcnow()
            finally:
                Path(job.input_path).unlink(missing_ok=True)
                self.queue.task_done()


def _probe_duration(path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise HTTPException(status_code=503, detail="ffprobe is required to validate video duration")
    completed = subprocess.run(
        [
            ffprobe,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    if completed.returncode != 0:
        raise HTTPException(status_code=422, detail="Uploaded video could not be decoded")
    try:
        duration = float(json.loads(completed.stdout)["format"]["duration"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail="Uploaded video has no readable duration") from exc
    if duration <= 0:
        raise HTTPException(status_code=422, detail="Uploaded video duration must be positive")
    return duration


async def _save_limited(upload: UploadFile, destination: Path, limit: int) -> int:
    written = 0
    try:
        with destination.open("wb") as stream:
            while chunk := await upload.read(1024 * 1024):
                written += len(chunk)
                if written > limit:
                    raise HTTPException(status_code=413, detail=f"Upload exceeds {limit} bytes")
                stream.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()
    if written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Uploaded file is empty")
    return written


def _public_job(job: Job, request: Request) -> dict[str, Any]:
    payload = asdict(job)
    payload.pop("input_path", None)
    result_url = None
    if job.output_name:
        result_url = str(request.url_for("download_output", name=job.output_name))
    payload["job_id"] = job.id
    payload["result_url"] = result_url
    payload["output_url"] = result_url
    runner_mode = request.app.state.service.runner.mode
    payload["runner"] = runner_mode
    payload["is_mock"] = runner_mode == "mock"
    return payload


def create_app(settings: Settings | None = None, runner: Runner | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    runner = runner or _build_runner(settings)
    service = JobService(settings, runner)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        service.start()
        yield
        service.stop()

    api = FastAPI(title="SmartAction Local Video Jobs", version="1.0.0", lifespan=lifespan)
    api.state.settings = settings
    api.state.service = service
    api.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @api.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok" if runner.ready else "degraded",
            "runner": runner.mode,
            "runner_ready": runner.ready,
            "detail": runner.detail,
            "worker_alive": bool(service.worker and service.worker.is_alive()),
            "models": CANONICAL_MODEL,
            "limits": {
                "max_upload_bytes": settings.max_upload_bytes,
                "max_video_seconds": settings.max_video_seconds,
                "max_image_pixels": settings.max_image_pixels,
                "max_queued_jobs": settings.max_queued_jobs,
            },
            "queued_jobs": service.queue.qsize(),
        }

    @api.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
    async def create_job(
        request: Request,
        file: UploadFile | None = File(default=None),
        prompt: str = Form(...),
        model: str = Form(...),
        task: str = Form(...),
    ) -> dict[str, Any]:
        if not runner.ready:
            raise HTTPException(status_code=503, detail=runner.detail)
        task = task.strip().lower()
        prompt = prompt.strip()
        model = model.strip()
        if task not in TASK_MODELS:
            raise HTTPException(status_code=422, detail="task must be image-to-video or video-to-video")
        if not 1 <= len(prompt) <= 4000:
            raise HTTPException(status_code=422, detail="prompt must contain 1 to 4000 characters")
        if model not in TASK_MODELS[task]:
            raise HTTPException(
                status_code=422,
                detail=f"model is not supported for {task}; use {CANONICAL_MODEL[task]}",
            )
        if file is None or not file.filename:
            raise HTTPException(status_code=422, detail=f"file is required for {task}")

        suffix = Path(file.filename).suffix.lower()
        allowed = IMAGE_SUFFIXES if task == "image-to-video" else VIDEO_SUFFIXES
        if suffix not in allowed:
            raise HTTPException(status_code=415, detail=f"Unsupported {task} file suffix")

        job_id = uuid.uuid4().hex
        upload_path = service.uploads / f"{job_id}{suffix}"
        await _save_limited(file, upload_path, settings.max_upload_bytes)
        try:
            if task == "image-to-video":
                try:
                    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
                    with Image.open(upload_path) as image:
                        image.verify()
                        if image.width * image.height > settings.max_image_pixels:
                            raise HTTPException(status_code=413, detail="Image dimensions are too large")
                except Image.DecompressionBombError as exc:
                    raise HTTPException(status_code=413, detail="Image dimensions are too large") from exc
                except (UnidentifiedImageError, OSError) as exc:
                    raise HTTPException(status_code=422, detail="Uploaded image could not be decoded") from exc
            else:
                duration = _probe_duration(upload_path)
                if duration > settings.max_video_seconds:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {settings.max_video_seconds}-second limit",
                    )
        except Exception:
            upload_path.unlink(missing_ok=True)
            raise

        canonical_model = CANONICAL_MODEL[task]
        job = Job(
            id=job_id,
            task=task,
            model=canonical_model,
            prompt=prompt,
            input_path=str(upload_path),
            created_at=_utcnow(),
        )
        if not service.enqueue(job):
            upload_path.unlink(missing_ok=True)
            raise HTTPException(status_code=429, detail="Job queue is full; try again later")
        response = _public_job(job, request)
        response["status_url"] = str(request.url_for("get_job", job_id=job.id))
        return response

    @api.get("/jobs/{job_id}", name="get_job")
    def get_job(job_id: str, request: Request) -> dict[str, Any]:
        if not re.fullmatch(r"[0-9a-f]{32}", job_id):
            raise HTTPException(status_code=404, detail="Job not found")
        job = service.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        return _public_job(job, request)

    @api.get("/outputs/{name}", name="download_output")
    def download_output(name: str) -> FileResponse:
        if not re.fullmatch(r"[0-9a-f]{32}\.mp4", name):
            raise HTTPException(status_code=404, detail="Output not found")
        output_path = service.outputs / name
        if not output_path.is_file():
            raise HTTPException(status_code=404, detail="Output not found")
        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=name,
            headers={"Cache-Control": "private, no-store"},
        )

    @api.exception_handler(413)
    async def payload_too_large(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=413, content={"detail": exc.detail})

    return api


app = create_app()
