import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";
import fs from "fs";
import path from "path";

const src = "C:\\Users\\faizi\\.gemini\\antigravity-ide\\brain\\782a56ce-581f-40fd-9e0a-ea5746a82eb4\\media__1781407175965.jpg";
const dest = path.join(process.cwd(), "public", "images", "hero-bg.jpg");

try {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log("Successfully copied hero background image to public/images/hero-bg.jpg");
  }
} catch (e) {
  console.error("Failed to copy hero background image:", e.message);
}

export default defineConfig({
  site: "https://kkrrppi.vercel.app",
  output: "server",
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
