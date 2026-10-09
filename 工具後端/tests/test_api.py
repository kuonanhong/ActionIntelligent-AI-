import io
import time
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app import MockRunner, Settings, create_app


def _settings(tmp_path: Path, max_upload_bytes: int = 2 * 1024 * 1024) -> Settings:
    return Settings(
        data_dir=tmp_path,
        runner="mock",
        max_upload_bytes=max_upload_bytes,
        max_video_seconds=12,
        max_image_pixels=4_000_000,
        max_queued_jobs=4,
        allow_model_downloads=False,
        cors_origins=("https://kuonanhong.github.io",),
    )


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (64, 48), "#275d52").save(buffer, "PNG")
    return buffer.getvalue()


def test_health_and_cors(tmp_path: Path) -> None:
    with TestClient(create_app(_settings(tmp_path), MockRunner())) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["runner"] == "mock"
        assert response.json()["worker_alive"] is True

        response = client.options(
            "/jobs",
            headers={
                "Origin": "http://127.0.0.1:8765",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:8765"


def test_image_job_contract_and_output(tmp_path: Path) -> None:
    with TestClient(create_app(_settings(tmp_path), MockRunner())) as client:
        created = client.post(
            "/jobs",
            data={
                "prompt": "A calm, accessible movement demonstration",
                "model": "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers",
                "task": "image-to-video",
            },
            files={"file": ("frame.png", _png(), "image/png")},
        )
        assert created.status_code == 202, created.text
        body = created.json()
        assert body["id"] == body["job_id"]
        assert body["status"] in {"queued", "running"}
        assert body["runner"] == "mock"
        assert body["is_mock"] is True

        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            polled = client.get(f"/jobs/{body['id']}")
            assert polled.status_code == 200
            result = polled.json()
            if result["status"] in {"succeeded", "failed"}:
                break
            time.sleep(0.05)
        assert result["status"] == "succeeded", result
        assert result["progress"] == 100
        assert result["result_url"] == result["output_url"]
        output = client.get(result["result_url"])
        assert output.status_code == 200
        assert output.headers["content-type"].startswith("video/mp4")
        assert len(output.content) > 100

        second = client.post(
            "/jobs",
            data={
                "prompt": "A gentle visual restyling",
                "model": "THUDM/CogVideoX-5b",
                "task": "video-to-video",
            },
            files={"file": ("source.mp4", output.content, "video/mp4")},
        )
        assert second.status_code == 202, second.text
        second_id = second.json()["id"]
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            second_result = client.get(f"/jobs/{second_id}").json()
            if second_result["status"] in {"succeeded", "failed"}:
                break
            time.sleep(0.05)
        assert second_result["status"] == "succeeded", second_result


def test_rejects_wrong_suffix_and_oversized_upload(tmp_path: Path) -> None:
    with TestClient(create_app(_settings(tmp_path, max_upload_bytes=64), MockRunner())) as client:
        wrong = client.post(
            "/jobs",
            data={"prompt": "x", "model": "wan", "task": "image-to-video"},
            files={"file": ("frame.txt", b"not an image", "text/plain")},
        )
        assert wrong.status_code == 415

        oversized = client.post(
            "/jobs",
            data={"prompt": "x", "model": "wan", "task": "image-to-video"},
            files={"file": ("frame.png", _png(), "image/png")},
        )
        assert oversized.status_code == 413


def test_rejects_task_model_mismatch(tmp_path: Path) -> None:
    with TestClient(create_app(_settings(tmp_path), MockRunner())) as client:
        response = client.post(
            "/jobs",
            data={"prompt": "x", "model": "THUDM/CogVideoX-5b", "task": "image-to-video"},
            files={"file": ("frame.png", _png(), "image/png")},
        )
        assert response.status_code == 422
