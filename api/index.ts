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

  // Add CORS
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '20mb' })); // Increased limit for larger file uploads

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      mode: process.env.NODE_ENV || "development",
    });
  });

  // Aggregated Real World News parser endpoints from authoritative RSS Feeds (BBC)
  app.get("/api/news", async (req, res) => {
    const feeds = [
      { category: "WORLD", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { category: "BUSINESS", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
      { category: "TECHNOLOGY", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
      { category: "ENTERTAINMENT", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
      { category: "SCIENCE", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" }
    ];

    function parseRSS(xmlText: string, category: string): any[] {
      const items: any[] = [];
      const itemMatches = xmlText.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
      for (const match of itemMatches) {
        const itemContent = match[1];
        
        // Extract title
        const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || itemContent.match(/<title>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        // Extract link
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : "";
        
        // Extract pubDate
        const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
        
        // Extract description
        const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemContent.match(/<description>([\s\S]*?)<\/description>/i);
        let desc = descMatch ? descMatch[1].trim() : "";
        desc = desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<\/?[^>]+(>|$)/g, "");

        if (!title) continue;

        items.push({
          id: link || `${category}-${Math.random()}`,
          title: title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/&amp;/g, '&'),
          url: link,
          description: desc.replace(/&amp;/g, '&'),
          time: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
          type: "real",
          category: category,
          by: "BBC INTEL"
        });
      }
      return items;
    }

    try {
      const responses = await Promise.all(
        feeds.map(async (feed) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per feed
            const res = await fetch(feed.url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) return [];
            const text = await res.text();
            return parseRSS(text, feed.category);
          } catch (e) {
            console.error(`Failed to fetch ${feed.category} news feed:`, e);
            return [];
          }
        })
      );

      // Flatten and sort news items by time in descending order (newest first)
      const allNews = responses.flat().sort((a, b) => b.time - a.time);
      
      // Limit to max 40 items to prevent huge payload sizes
      res.json(allNews.slice(0, 40));
    } catch (err: any) {
      res.status(500).json({ error: "Failed to compile news feed stream.", details: err.message });
    }
  });

  // Vite middleware for development
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../dist/index.html"));
    });
  }

  if (!isProd) {
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
