import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.get("/manus-storage/*", async (req, res) => {
    const key = req.path.slice("/manus-storage/".length);
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
    const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
    if (!forgeBaseUrl || !forgeKey) {
      res.status(503).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL("v1/storage/presign/get", `${forgeBaseUrl}/`);
      forgeUrl.searchParams.set("path", key);
      const forgeResponse = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${forgeKey}` },
      });

      if (!forgeResponse.ok) {
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResponse.json()) as { url?: string };
      if (!url) {
        res.status(502).send("Empty signed URL");
        return;
      }

      res.setHeader("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      res.status(502).send("Storage proxy error");
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
