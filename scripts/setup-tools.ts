import { execSync, spawnSync } from "child_process";

const LLAMA_MODEL = "gemma3";

function run(cmd: string, inherit = false): string {
  try {
    if (inherit) {
      execSync(cmd, { stdio: "inherit" });
      return "";
    }
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function commandExists(cmd: string): boolean {
  return run(`which ${cmd} 2>/dev/null`) !== "";
}

function section(title: string) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(50)}\n`);
}

function installOllama() {
  section("Installing Ollama (local LLM runtime)");

  if (commandExists("ollama")) {
    console.log("Ollama is already installed.");
    return;
  }

  console.log("Ollama is not installed. Installing now...");
  console.log("This installs a local AI inference engine for proofreading transcriptions.\n");

  const result = spawnSync("bash", ["-c", "curl -fsSL https://ollama.com/install.sh | sh"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error("\nFailed to install Ollama automatically.");
    console.error("Please install manually from: https://ollama.com/download");
    console.error("Then re-run: npm run setup:tools");
    process.exit(1);
  }

  console.log("Ollama installed successfully.");
}

function pullModel() {
  section(`Pulling ${LLAMA_MODEL} model (4B parameters, ~3GB)`);

  console.log("This downloads a small, fast language model for proofreading your transcriptions.");
  console.log("The model runs entirely on your machine — no data is sent to the cloud.\n");

  // Ensure Ollama service is running
  try {
    execSync("curl -sf http://localhost:11434/api/tags > /dev/null 2>&1");
  } catch {
    console.log("Starting Ollama service...");
    spawnSync("ollama", ["serve"], { stdio: "ignore", detached: true });
    // Wait for it to come up
    for (let i = 0; i < 10; i++) {
      try {
        execSync("sleep 1 && curl -sf http://localhost:11434/api/tags > /dev/null 2>&1");
        break;
      } catch {
        if (i === 9) {
          console.error("Could not start Ollama. Please run 'ollama serve' manually, then re-run this script.");
          process.exit(1);
        }
      }
    }
  }

  // Check if model already pulled
  const tags = run("curl -s http://localhost:11434/api/tags");
  if (tags.includes(LLAMA_MODEL)) {
    console.log(`${LLAMA_MODEL} model is already available.`);
    return;
  }

  const result = spawnSync("ollama", ["pull", LLAMA_MODEL], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nFailed to pull ${LLAMA_MODEL}. Please run manually:`);
    console.error(`  ollama pull ${LLAMA_MODEL}`);
    process.exit(1);
  }

  console.log(`${LLAMA_MODEL} model ready.`);
}

function installWhisper() {
  section("Installing whisper-cpp (local speech-to-text engine)");

  if (commandExists("whisper-cli") || commandExists("whisper-cpp")) {
    console.log("whisper-cpp is already installed.");
    return;
  }

  console.log("whisper-cpp is not installed. Installing via Homebrew...");
  console.log("This installs a fast, local speech recognition engine.\n");

  if (!commandExists("brew")) {
    console.error("Homebrew is required but not installed.");
    console.error("Install it from: https://brew.sh");
    console.error("Then re-run: npm run setup:tools");
    process.exit(1);
  }

  const result = spawnSync("brew", ["install", "whisper-cpp"], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("\nFailed to install whisper-cpp.");
    console.error("Please install manually: brew install whisper-cpp");
    process.exit(1);
  }

  console.log("whisper-cpp installed successfully.");
}

function main() {
  console.log("Swift Speech — Tool Setup");
  console.log("This script installs the tools needed for local speech-to-text with proofreading.");
  console.log("Everything runs on your machine — no cloud services required.\n");
  console.log("Tools to install:");
  console.log("  1. whisper-cpp  — speech-to-text engine (via Homebrew)");
  console.log(`  2. Ollama       — local LLM runtime`);
  console.log(`  3. ${LLAMA_MODEL}        — language model for proofreading (~3GB)`);

  installWhisper();
  installOllama();
  pullModel();

  section("Setup Complete");
  console.log("All tools are installed and ready.");
  console.log("Run the app with: npm run dev\n");
}

main();
