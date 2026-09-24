import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
export default defineConfig({build:{outDir:"dist",emptyOutDir:true,rollupOptions:{input:{content:"src/content.ts",background:"src/background.ts"},output:{entryFileNames:"[name].js"}}},plugins:[viteStaticCopy({targets:[{src:"manifest.json",dest:"."},{src:"src/styles.css",dest:"."}]})]});