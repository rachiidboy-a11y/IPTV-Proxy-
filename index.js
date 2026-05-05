const express = require("express");
const http = require("http");
const https = require("https");
const cors = require("cors");
const { URL } = require("url");

const app = express();
app.use(cors());

// =======================
// 🔐 USER LOGIN
// =======================
const USERS = {
  "test": "1234"
};

// =======================
// ⚙️ CONFIG (DEINE M3U IST DRIN)
// =======================
const PLAYLIST_URL = "http://xaagk.teckndc.com/get.php?username=WV3MGNC&password=65E7T5L&output=hls&type=m3u";

// 👉 Domain aus deiner URL!
const ALLOWED_DOMAINS = [
  "xaagk.teckndc.com"
];

// =======================
// 🧠 CACHE
// =======================
let cache = null;
let lastFetch = 0;

// =======================
// 📺 CHANNELS API
// =======================
app.get("/channels", async (req, res) => {
  try {
    const { user, pass } = req.query;

    if (USERS[user] !== pass) {
      return res.status(403).send("Unauthorized");
    }

    const now = Date.now();

    if (cache && now - lastFetch < 5 * 60 * 1000) {
      return res.json(cache);
    }

    const response = await fetch(PLAYLIST_URL);
    const text = await response.text();

    const lines = text.split("\n");

    const channels = [];
    let current = {};

    lines.forEach(line => {
      if (line.startsWith("#EXTINF")) {
        const name = line.split(",")[1];

        const groupMatch = line.match(/group-title="(.*?)"/);
        const group = groupMatch ? groupMatch[1] : "Other";

        current = { name, group };
      } else if (line.startsWith("http")) {
        current.url = `/proxy?url=${encodeURIComponent(line)}`;
        channels.push(current);
      }
    });

    cache = channels;
    lastFetch = now;

    res.json(channels);

  } catch (err) {
    console.error(err);
    res.status(500).send("Channel error");
  }
});

// =======================
// 🔁 PROXY
// =======================
app.get("/proxy", (req, res) => {
  try {
    const streamUrl = req.query.url;
    if (!streamUrl) {
      return res.status(400).send("Missing URL");
    }

    const parsedUrl = new URL(streamUrl);

    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return res.status(403).send("Forbidden domain");
    }

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
      const contentType = response.headers["content-type"] || "";

      if (response.statusCode !== 200) {
        return res.status(response.statusCode).send("Stream error: " + response.statusCode);
      }

      // 📺 HLS
      if (contentType.includes("application/vnd.apple.mpegurl") || streamUrl.includes(".m3u8")) {
        let data = "";

        response.on("data", chunk => data += chunk);

        response.on("end", () => {
          const base = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);

          const modified = data.replace(/^(?!#)(.+)$/gm, (line) => {
            if (!line.trim()) return line;

            const absolute = line.startsWith("http") ? line : base + line;

            if (absolute.includes(".m3u8")) {
              return `/proxy?url=${encodeURIComponent(absolute)}`;
            }

            return absolute;
          });

          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          res.send(modified);
        });

        return;
      }

      // 📡 Direktstream
      res.writeHead(200, {
        "Content-Type": contentType || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Connection": "keep-alive"
      });

      response.pipe(res);

      req.on("close", () => {
        request.destroy();
      });
    });

    request.setTimeout(10000, () => {
      request.destroy();
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

// =======================
// 🚀 START
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 IPTV Backend läuft auf Port " + PORT);
});
