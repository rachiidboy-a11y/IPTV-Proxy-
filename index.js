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

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send("Stream error");
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );

    response.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
});

app.listen(3000, () => {
  console.log("Proxy running");
});
