# Rebuilding this studio on a fresh machine

The repo holds the studio's code, brand tokens (`src/design/tokens.ts`), fonts, house style and the
partners-intro video code. It does not hold installed packages, speech models, or raw footage.

1. Node 20+: `npm install`
2. Check: `npm run check`, then `npm run doctor`
3. Captions (optional, a few GB; needs Python 3.11 or 3.12, not 3.13+):
   ```
   python3.12 -m venv .venv
   echo "transformers<5" > constraints.txt
   .venv/bin/python -m pip install -r requirements.txt -c constraints.txt
   ```
   Without the `transformers<5` pin the dependency resolver can backtrack for a very long time.
4. First transcription downloads the speech models into `.models/` (about 0.5 GB for Whisper "small"
   plus the alignment model). The machine needs access to huggingface.co, its xet/cdn download
   hosts, and download.pytorch.org.
5. Footage: put clips in `assets/projects/<name>/footage/`. Phone HDR (HLG, BT.2020) clips must be
   tone-mapped to SDR first, or they look washed out. See `src/videos/partners-intro/beats.ts`.

The studio's MCP server (creator-editing-os) is added separately with `claude mcp add`; its access
URL contains a licence key, so it is deliberately not stored here.
