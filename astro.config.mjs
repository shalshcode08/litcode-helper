import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "site/src",
  publicDir: "site/public",
  outDir: "site-dist",
  site: "https://litcode-helper.vercel.app"
});
