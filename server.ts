import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch metadata and content from a URL
  app.post("/api/fetch-content", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 10000,
      });

      const contentType = response.headers["content-type"];
      
      res.json({
        url,
        contentType,
        data: response.data,
        status: response.status,
      });
    } catch (error: any) {
      console.error("Error fetching URL:", error.message);
      
      let errorMessage = "Failed to fetch content.";
      let statusCode = 500;

      if (error.response) {
        // The request was made and the server responded with a status code
        statusCode = error.response.status;
        if (statusCode === 404) {
          errorMessage = "The requested URL was not found (404).";
        } else if (statusCode === 403 || statusCode === 401) {
          errorMessage = "Access denied. The content might be private or require authentication.";
        } else {
          errorMessage = `The server responded with an error: ${statusCode}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = "No response received from the server. Check the URL or your network connection.";
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message;
      }

      res.status(statusCode).json({ error: errorMessage });
    }
  });

  // Proxy route for direct downloads to bypass CORS
  app.get("/api/proxy-download", async (req, res) => {
    const { url, filename } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }
      });

      const contentType = response.headers['content-type'];
      if (contentType) res.setHeader('Content-Type', contentType);
      
      const contentLength = response.headers['content-length'];
      if (contentLength) res.setHeader('Content-Length', contentLength);
      
      if (filename) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      response.data.pipe(res);
    } catch (error: any) {
      console.error("Proxy download error:", error.message);
      if (error.response) {
        res.status(error.response.status).send(`Download failed: ${error.response.statusText}`);
      } else {
        res.status(500).send("Failed to proxy download due to a network error.");
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
