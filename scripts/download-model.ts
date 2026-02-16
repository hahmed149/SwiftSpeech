import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const RESOURCES_DIR = join(__dirname, "..", "resources", "models");
const MODEL_PATH = join(RESOURCES_DIR, "ggml-base.en.bin");
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";

async function main() {
  if (existsSync(MODEL_PATH)) {
    console.log("Model already exists at", MODEL_PATH);
    return;
  }

  mkdirSync(RESOURCES_DIR, { recursive: true });

  console.log("Downloading ggml-base.en.bin (~148MB)...");
  execSync(`curl -L -o "${MODEL_PATH}" "${MODEL_URL}"`, {
    stdio: "inherit",
  });

  console.log("Done. Model saved to", MODEL_PATH);
}

main();
