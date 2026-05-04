const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/proxy", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Referer": url,
        "Origin": url
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Stream error: " + response.status);
    }

    // Content-Type übernehmen (wichtig für Player)
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // HLS Support (m3u8 anpassen)
    if (contentType.includes("application/vnd.apple.mpegurl") || url.includes(".m3u8")) {
      const text = await response.text();

      // Alle relativen Pfade in absolute Proxy-Links umwandeln
      const base = url.substring(0, url.lastIndexOf("/") + 1);

      const modified = text.replace(/(?!#)(.*\.ts.*)/g, (match) => {
        const absolute = match.startsWith("http") ? match : base + match;
        return `/proxy?url=${encodeURIComponent(absolute)}`;
      });

      return res.send(modified);
    }

    // Normales Streaming (Live TV / TS / MP4)
    for await (const chunk of response.body) {
      res.write(chunk);
    }

    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Proxy running on port " + PORT);
});
