import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import { join, relative, parse, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, "..", "public");
const IMAGE_EXTS = [".jpg", ".jpeg", ".png"];
const WEBP_QUALITY = 80;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function optimize() {
  const results = { converted: 0, skipped: 0, bytesSaved: 0 };
  for await (const file of walk(SRC_DIR)) {
    const ext = parse(file).ext.toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;
    const webpPath = parse(file).name + ".webp";
    const outDir = parse(file).dir;
    const webpFile = join(outDir, webpPath);
    if (existsSync(webpFile)) {
      results.skipped++;
      continue;
    }
    const beforeBytes = (await stat(file)).size;
    const img = sharp(file);
    const metadata = await img.metadata();
    await img
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(webpFile);
    const afterBytes = (await stat(webpFile)).size;
    results.converted++;
    results.bytesSaved += beforeBytes - afterBytes;
    const pct = (((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1);
    console.log(`  ${relative(SRC_DIR, file)} → ${webpPath}  (${pct}% smaller, ${(beforeBytes/1024).toFixed(1)}K → ${(afterBytes/1024).toFixed(1)}K)`);
  }
  const totalBeforeMb = (results.bytesSaved / 1024 / 1024).toFixed(2);
  console.log(`\nDone: ${results.converted} converted, ${results.skipped} skipped, ~${totalBeforeMb} MB saved`);
}

optimize().catch(e => { console.error(e); process.exit(1); });
