import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://kkrppi.kediritechnopark.com",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  security: {
    checkOrigin: false,
  },
});
