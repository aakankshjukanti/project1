"""
Shared tool resolution for the Python helpers.

The Node side has lib/media.mjs; this is its twin, and it exists for the same reason:
every script that shells out to ffmpeg must ask *here* where ffmpeg is, never hardcode a
path. Seven scripts once carried `D:\\Tools\\ffmpeg\\bin\\ffmpeg.exe`, which meant the
whole Python half of the studio was dead on any machine that was not one specific Windows
desktop. A studio that only runs on its author's computer is not a product.

Resolution order, most explicit first:
  1. $FFMPEG / $FFPROBE, for anyone who knows exactly what they want
  2. the ffmpeg-static / ffprobe-static binaries that arrive with `npm install`
  3. whatever is on PATH
  4. the usual install locations per platform
"""

import os
import platform
import shutil
from pathlib import Path

_IS_WIN = platform.system() == "Windows"
_EXE = ".exe" if _IS_WIN else ""

# Repo root, from scripts/lib/media.py
_ROOT = Path(__file__).resolve().parent.parent.parent


def _from_node_modules(tool: str):
    """The per-platform binary npm installs. Present in every studio after setup."""
    pkg = _ROOT / "node_modules" / f"{tool}-static"
    if not pkg.is_dir():
        return None
    # ffmpeg-static puts the binary at the package root; ffprobe-static nests it per platform.
    direct = pkg / f"{tool}{_EXE}"
    if direct.is_file():
        return str(direct)
    for found in pkg.rglob(f"{tool}{_EXE}"):
        if found.is_file():
            return str(found)
    return None


def _candidates(tool: str):
    if _IS_WIN:
        return [
            rf"C:\ffmpeg\bin\{tool}{_EXE}",
            rf"D:\Tools\ffmpeg\bin\{tool}{_EXE}",
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "ffmpeg", "bin", f"{tool}{_EXE}"),
        ]
    return [
        f"/opt/homebrew/bin/{tool}",
        f"/usr/local/bin/{tool}",
        f"/usr/bin/{tool}",
        os.path.expanduser(f"~/.local/bin/{tool}"),
    ]


def locate(tool: str) -> str:
    from_env = os.environ.get(tool.upper())
    if from_env:
        return from_env

    packaged = _from_node_modules(tool)
    if packaged:
        return packaged

    on_path = shutil.which(tool)
    if on_path:
        return on_path

    for candidate in _candidates(tool):
        if candidate and Path(candidate).is_file():
            return candidate

    # Fall back to the bare name so the error reads "not found" rather than a wrong path.
    return tool


FFMPEG = locate("ffmpeg")
FFPROBE = locate("ffprobe")


def use_certifi() -> None:
    """
    Point urllib at certifi's root certificates.

    torch.hub downloads model weights with urllib, which on a python.org macOS build has
    no root certificates at all — so transcription dies with CERTIFICATE_VERIFY_FAILED
    partway through, after the slow part has already succeeded. Call this before importing
    torch in any script that downloads a model.
    """
    try:
        import certifi
    except ImportError:
        return
    bundle = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", bundle)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", bundle)
