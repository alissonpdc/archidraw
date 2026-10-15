// Build do servidor Node (bundle SSR) → dist-server/server.js.
// Separado do build do cliente: empacota só o servidor e a lógica pura de
// validação, externalizando os builtins de Node. O resultado roda com
// `node dist-server/server.js` sem node_modules (zero dependências externas).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "server/index.ts",
    outDir: "dist-server",
    emptyOutDir: true,
    copyPublicDir: false,
    target: "node22",
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "server.js" },
    },
  },
});
