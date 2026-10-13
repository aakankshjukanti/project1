"""Word-level transcript for a clip: WhisperX transcription + wav2vec2 forced alignment.

Usage (from the project root):
    python scripts/transcribe.py <media> [--language en] [--model small]

Writes work/<clip-name>/words.json. Models are cached under the studio's .models folder.
Words the aligner cannot place (often digits like "186%") keep start/end = null and must be
fixed against the script before building the spine.
"""

import argparse
import json
import os
import time
from pathlib import Path

import sys as _sys  # noqa: E402
_sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from media import FFMPEG, use_certifi  # noqa: E402

# Models are large; cache them inside the studio so they survive and are easy to find.
_MODELS = Path(__file__).resolve().parent.parent / ".models"
os.environ.setdefault("HF_HOME", str(_MODELS / "huggingface"))
os.environ.setdefault("TORCH_HOME", str(_MODELS / "torch"))
os.environ["PATH"] = str(Path(FFMPEG).parent) + os.pathsep + os.environ["PATH"]

# torch.hub fetches the word-alignment model with urllib, which on a python.org macOS
# build has no root certificates — transcription then dies with CERTIFICATE_VERIFY_FAILED
# after the slow part has already succeeded. Must run before torch is imported.
use_certifi()

try:
    import whisperx  # noqa: E402  (must import after the cache/PATH/cert setup above)
except ModuleNotFoundError as exc:  # pragma: no cover
    # Run with the wrong interpreter and the bare error reads as "never installed", which
    # sends you off to fix the wrong thing. Say which python is running and what to do.
    _venv = Path(__file__).resolve().parent.parent / ".venv"
    _venv_py = _venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python3")
    print(f"Cannot import {exc.name}.", file=_sys.stderr)
    print(f"  running: {_sys.executable}  (python {_sys.version.split()[0]})", file=_sys.stderr)
    if _venv_py.exists():
        print(f"  the studio's environment is at {_venv_py}", file=_sys.stderr)
        print("  run the transcriber with that python, or use: npm run prep", file=_sys.stderr)
    else:
        print("  the studio has no .venv yet. Build one with python 3.11 or 3.12:", file=_sys.stderr)
        print("    py -3.12 -m venv .venv", file=_sys.stderr)
        print("    .venv/Scripts/python.exe -m pip install -r requirements.txt", file=_sys.stderr)
    print("  see what you have with: npm run doctor", file=_sys.stderr)
    raise SystemExit(2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("media")
    parser.add_argument("--language", default=None, help="e.g. en, hi. Detected when omitted.")
    parser.add_argument("--project", default=None, help="Video project name: writes to work/<project>/<clip>/")
    parser.add_argument("--model", default="small", help="Whisper size: small (fast on CPU) or medium (more accurate)")
    args = parser.parse_args()

    media = Path(args.media)
    out_dir = (Path("work") / args.project / media.stem) if args.project else (Path("work") / media.stem)
    out_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()

    audio = whisperx.load_audio(str(media))
    model = whisperx.load_model(args.model, device="cpu", compute_type="int8", language=args.language)
    result = model.transcribe(audio, batch_size=4, language=args.language)
    language = result["language"]

    align_model, metadata = whisperx.load_align_model(language_code=language, device="cpu")
    aligned = whisperx.align(result["segments"], align_model, metadata, audio, device="cpu", return_char_alignments=False)

    words = []
    for segment in aligned["segments"]:
        for w in segment.get("words", []):
            words.append(
                {
                    "word": w["word"],
                    "start": round(w["start"], 3) if "start" in w else None,
                    "end": round(w["end"], 3) if "end" in w else None,
                    "score": round(w["score"], 3) if "score" in w else None,
                }
            )

    output = {
        "source": str(media),
        "language": language,
        "model": args.model,
        "durationSec": round(len(audio) / 16000, 3),
        "text": " ".join(s["text"].strip() for s in aligned["segments"]),
        "words": words,
    }
    out_file = out_dir / "words.json"
    out_file.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    unplaced = [w["word"] for w in words if w["start"] is None]
    print(f"language: {language} | words: {len(words)} | unplaced: {len(unplaced)} {unplaced if unplaced else ''}")
    print(f"text: {output['text']}")
    print(f"wrote {out_file} in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
