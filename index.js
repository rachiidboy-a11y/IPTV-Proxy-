const express = require("express");
const http = require("http");
const https = require("https");
const cors = require("cors");
const { URL } = require("url");

const app = express();
app.use(cors());

app.get("/proxy", (req, res) => {
  try {
    const streamUrl = req.query.url;
    if (!streamUrl) {
      return res.status(400).send("Missing URL");
    }

    const parsedUrl = new URL(streamUrl);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Referer": parsedUrl.origin,
        "Origin": parsedUrl.origin
      }
    };

    const request = client.get(streamUrl, options, (response) => {

      // Fehler abfangen
      if (response.statusCode !== 200) {
        return res.status(response.statusCode).send("Stream error: " + response.statusCode);
      }

      const contentType = response.headers["content-type"] || "";

      // =========================
      // 📺 HLS (m3u8)
      // =========================
      if (contentType.includes("application/vnd.apple.mpegurl") || streamUrl.includes(".m3u8")) {
        let data = "";

        response.on("data", chunk => data += chunk);

        response.on("end", () => {
          const base = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);

          const modified = data.replace(/^(?!#)(.+)$/gm, (line) => {
            if (!line.trim()) return line;

            const absolute = line.startsWith("http") ? line : base + line;
            return `/proxy?url=${encodeURIComponent(absolute)}`;
          });

          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          res.send(modified);
        });

        return;
      }

      // =========================
      // 📡 MPEG-TS / Live / MP4
      // =========================
      res.writeHead(200, {
        "Content-Type": contentType || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Connection": "keep-alive"
      });

      response.pipe(res);

      // Verbindung sauber schließen
      req.on("close", () => {
        request.destroy();
      });

    });

    request.on("error", (err) => {
      console.error(err);
      res.status(500).send("Proxy error");
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Universal IPTV Proxy running on port " + PORT);
});
