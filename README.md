# Swift Speech

A macOS dictation tool that converts spoken words into clean, ready-to-send messages instantly. Hold a key, speak, release — your words appear wherever your cursor is, with grammar fixed and filler words removed.

Swift Speech runs entirely on your machine. Speech-to-text is handled by [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with Metal GPU acceleration and grammar cleanup by a local LLM via [Ollama](https://ollama.com). Nothing leaves your device.

## Download

Grab the latest DMG from the [Releases](../../releases) page — no build step required. The app is signed and notarized with Apple.

## How It Works

1. **Hold** the Right Option key (configurable)
2. **Speak** — a waveform appears at the top of your screen
3. **Release** — your speech is transcribed by Whisper, cleaned up by an LLM, and pasted into the active input field

The full pipeline typically completes in under 2 seconds on Apple Silicon.

## Requirements

- macOS 12+ on Apple Silicon (M1/M2/M3/M4)
- [Ollama](https://ollama.com) — auto-installed on first launch if missing
- Accessibility permission (for the global hotkey)
- Microphone permission

### For development only

- [Node.js](https://nodejs.org) 18+
- [Homebrew](https://brew.sh) (to install whisper-cpp)

## Quick Start

```bash
# Install dependencies
npm install

# Download whisper binary and speech model
npm run setup

# Install Ollama + pull the LLM model
npm run setup:tools

# Run the app
npm run dev
```

On first launch, Swift Speech will auto-install Ollama and pull the `gemma3` model if they are not already present.

## Building for Distribution

```bash
# Prepare resources (resolve symlinks, copy dylibs)
npm run predist

# Build TypeScript and package DMG + ZIP
npm run dist
```

Output goes to `out/`. The DMG targets `arm64` only.

## Project Structure

```
src/
  main/                          # Electron main process
    transcription/
      whisper-runner.ts          # Whisper speech-to-text (Metal accelerated)
      llm-proofread.ts           # LLM grammar cleanup via Ollama
    ollama-setup.ts              # Auto-install Ollama + model on first launch
    ipc-handlers.ts              # Recording pipeline orchestration
    resource-paths.ts            # Resolves whisper binary, model, and dylib paths
    window.ts                    # Popover window (waveform UI)
    tray.ts                      # System tray menu
    settings.ts                  # Persisted user settings
  renderer/                      # Electron renderer process
    recorder.ts                  # Mic capture via Web Audio API
    waveform.ts                  # Waveform visualization
  preload/                       # Context bridge (IPC)
  shared/                        # Constants and types
scripts/
  download-whisper.ts            # Download/symlink whisper binary + dylibs
  download-model.ts              # Download ggml-base.en speech model
  prepare-dist.ts                # Resolve symlinks and copy dylibs for packaging
  setup-tools.ts                 # Install Ollama + pull LLM model
```

## Customization

### Changing the LLM Model

The default model is `gemma3` (4B parameters). To use a different Ollama model:

1. Pull the model: `ollama pull <model-name>`
2. Set the environment variable before launching:
   ```bash
   OLLAMA_MODEL=qwen2.5:3b npm run dev
   ```

Or change the defaults in `src/main/transcription/llm-proofread.ts`:

```typescript
const PRIMARY_MODEL = "gemma3";
const FALLBACK_MODELS = ["qwen2.5:3b", "phi4", "llama3.2"];
```

**Tested models on Apple Silicon (M2 Max, 32GB):**

| Model | Size | Speed | Notes |
|-------|------|-------|-------|
| `gemma3` | 4B | ~74 tok/s, ~1.2s | Best quality + speed balance (default) |
| `qwen2.5:3b` | 3B | ~101 tok/s, ~0.6s | Fastest, slightly more aggressive cleanup |
| `phi4` | 14B | ~30 tok/s, ~3.4s | Slow, tends to censor profanity |
| `llama3.2` | 3B | ~103 tok/s | Fast but may summarize or rephrase |

### Changing the Hotkey

Right-click the tray icon and select a different trigger key under **Hotkey**. The setting persists across restarts.

Default: **Right Option** (keycode 3640).

### Selecting a Microphone

Right-click the tray icon and choose a specific mic under **Microphone**. Pinning a mic prevents Bluetooth devices from hijacking audio input.

## Development

```bash
npm run dev          # Build + run
npm test             # Run tests
npm run test:watch   # Tests in watch mode
npm run build        # Build only (no launch)
```

Logs are written to `~/Library/Logs/swift-speech.log`.

## Releases

Releases are automated via GitHub Actions. To create a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the release workflow which builds the app, packages a DMG and ZIP, and uploads them to the GitHub release.

## License

This project is open source under the [MIT License](LICENSE).

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. See the LICENSE file for the full terms.
