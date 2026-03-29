import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  
  // Load local .env only in development
  if (!isProd) {
    try {
      const dotenv = await import("dotenv");
      // Use override: true to allow local .env to take precedence for debugging
      dotenv.config({ override: true });
    } catch (e) {
      // dotenv package not installed or .env missing, which is fine
    }
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' })); // Increased limit for larger file uploads

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      mode: process.env.NODE_ENV || "development",
    });
  });

  // Vite middleware for development
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
