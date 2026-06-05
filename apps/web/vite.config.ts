import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-portfolio-state',
      configureServer(server) {
        server.middlewares.use('/dev-portfolio-state.json', (_req, res) => {
          const file = path.resolve(__dirname, '../../data/portfolio-state.json');
          try {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(file, 'utf-8'));
          } catch {
            res.statusCode = 404;
            res.end('{}');
          }
        });
      },
    },
  ],
  base: "/ETFReturns/"
});
