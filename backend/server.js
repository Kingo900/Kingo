const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "kingo-admin-secret-change-me";

app.use(cors());
app.use(express.json());

// ── Auto-detect node path for yt-dlp ─────────────────────────────────────────
let NODE_PATH = "node";
try {
  NODE_PATH = execSync("which node || command -v node").toString().trim();
  console.log("✅ Node path detected:", NODE_PATH);
} catch (e) {
  console.log("⚠️ Could not detect node path, using default");
}

// ── Cookies path ──────────────────────────────────────────────────────────────
const COOKIES = path.join(__dirname, "cookies.txt");
const cookieArg = fs.existsSync(COOKIES) ? `--cookies "${COOKIES}"` : "";
const getCookieArgs = () => fs.existsSync(COOKIES) ? ["--cookies", COOKIES] : [];

// ── In-memory store ───────────────────────────────────────────────────────────
const store = {
  downloads: [],
  errors: [],
  blocked: new Set(),
  settings: {
    maxConcurrent: 5,
    allowedFormats: ["mp4", "mkv", "webm", "mp3", "aac", "opus", "flac", "wav", "m4a"],
    maxDuration: 7200,
    rateLimitPerHour: 20,
    maintenanceMode: false,
    bannerMessage: "",
  },
  rateLimits: {},
  activeJobs: 0,
};

// ── Video info cache (key: url, value: { data, timestamp }) ───────────────────
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(url) {
  const entry = infoCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { infoCache.delete(url); return null; }
  return entry.data;
}

function setCache(url, data) {
  infoCache.set(url, { data, timestamp: Date.now() });
  // Keep cache size reasonable
  if (infoCache.size > 100) {
    const firstKey = infoCache.keys().next().value;
    infoCache.delete(firstKey);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return crypto.randomBytes(6).toString("hex"); }
function getIp(req) { return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "unknown"; }

function logError(url, message, ip = "unknown") {
  const entry = { id: uid(), url, message, ip, timestamp: new Date().toISOString() };
  store.errors.unshift(entry);
  if (store.errors.length > 500) store.errors = store.errors.slice(0, 500);
  console.error(`[ERROR] ${message}`);
  return entry;
}

function logDownload(data) {
  const entry = { id: uid(), ...data, timestamp: new Date().toISOString() };
  store.downloads.unshift(entry);
  if (store.downloads.length > 1000) store.downloads = store.downloads.slice(0, 1000);
  return entry;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 3600000;
  if (!store.rateLimits[ip]) store.rateLimits[ip] = [];
  store.rateLimits[ip] = store.rateLimits[ip].filter(t => now - t < window);
  if (store.rateLimits[ip].length >= store.settings.rateLimitPerHour) return false;
  store.rateLimits[ip].push(now);
  return true;
}

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  if (key !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function buildYtdlpBaseArgs() {
  return [
    ...getCookieArgs(),
    "--js-runtimes", `node:${NODE_PATH}`,
    "--remote-components", "ejs:github",
  ];
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.0.0", app: "Kingo YT Downloader", uptime: process.uptime() });
});

// ── Banner ────────────────────────────────────────────────────────────────────
app.get("/api/banner", (req, res) => {
  res.json({ message: store.settings.bannerMessage, maintenance: store.settings.maintenanceMode });
});

// ── Info (with caching) ───────────────────────────────────────────────────────
app.get("/api/info", (req, res) => {
  const { url } = req.query;
  const ip = getIp(req);

  if (!url) return res.status(400).json({ error: "URL is required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error: "Your IP has been blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error: "Kingo is under maintenance." });

  // ── Return from cache if available ──
  const cached = getCached(url);
  if (cached) {
    console.log("✅ Cache hit for:", url);
    return res.json({ ...cached, cached: true });
  }

  const baseArgs = buildYtdlpBaseArgs().join(" ");
  const cmd = `yt-dlp --dump-json --no-playlist ${baseArgs} "${url}"`;

  exec(cmd, { timeout: 40000 }, (err, stdout, stderr) => {
    if (err) {
      logError(url, stderr?.slice(0, 300) || err.message, ip);
      return res.status(500).json({ error: "Could not fetch video info. The video may be unavailable or region-locked." });
    }
    try {
      const info = JSON.parse(stdout);
      if (store.settings.maxDuration && info.duration > store.settings.maxDuration) {
        return res.status(400).json({ error: `Video too long (max ${store.settings.maxDuration / 60} minutes).` });
      }
      const data = {
        title: info.title,
        channel: info.uploader || info.channel,
        duration: info.duration,
        thumbnail: info.thumbnail,
        view_count: info.view_count,
        upload_date: info.upload_date,
      };
      setCache(url, data);
      res.json(data);
    } catch (e) {
      logError(url, "Failed to parse yt-dlp JSON: " + e.message, ip);
      res.status(500).json({ error: "Failed to parse video info" });
    }
  });
});

// ── Download with SSE progress ────────────────────────────────────────────────
// This endpoint streams progress events back to the client using Server-Sent Events
app.get("/api/download-progress", (req, res) => {
  const { url, format = "mp4", quality = "1080", type = "video", start, end } = req.query;
  const ip = getIp(req);

  if (!url) { res.status(400).end(); return; }
  if (store.blocked.has(ip)) { res.status(403).end(); return; }
  if (store.settings.maintenanceMode) { res.status(503).end(); return; }
  if (!checkRateLimit(ip)) { res.status(429).end(); return; }
  if (!store.settings.allowedFormats.includes(format)) { res.status(400).end(); return; }
  if (store.activeJobs >= store.settings.maxConcurrent) { res.status(503).end(); return; }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  store.activeJobs++;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");

  const args = [
    "--no-playlist",
    "--newline",           // One line per progress update
    "--progress",
    ...buildYtdlpBaseArgs(),
    "-o", outputTemplate,
  ];

  if (type === "audio") {
    args.push("-x", "--audio-format", format, "--audio-quality", "0");
  } else {
    const h = quality || "1080";
    args.push("-f", `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`, "--merge-output-format", format);
  }

  if (start && end) {
    args.push("--postprocessor-args", `ffmpeg:-ss ${start} -to ${end}`);
  }

  args.push(url);

  send("status", { message: "Starting download…", percent: 0 });

  const startTime = Date.now();
  const ytdlp = spawn("yt-dlp", args);
  let stderr = "";
  let downloadId = null;

  // Parse yt-dlp progress output
  ytdlp.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    lines.forEach(line => {
      // yt-dlp progress line looks like:
      // [download]  45.2% of  123.45MiB at  1.23MiB/s ETA 00:32
      const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)(?:\s+ETA\s+(\S+))?/);
      if (match) {
        send("progress", {
          percent: parseFloat(match[1]),
          size: match[2],
          speed: match[3],
          eta: match[4] || "",
        });
      }
      // Detect merging/post-processing
      if (line.includes("[Merger]") || line.includes("[ffmpeg]")) {
        send("status", { message: "Processing & merging…", percent: 99 });
      }
    });
  });

  ytdlp.stderr.on("data", d => { stderr += d.toString(); });

  ytdlp.on("close", async (code) => {
    store.activeJobs = Math.max(0, store.activeJobs - 1);

    if (code !== 0) {
      logError(url, stderr?.slice(0, 300) || "yt-dlp exited with code " + code, ip);
      send("error", { message: "Download failed. The video may be age-restricted or unavailable." });
      res.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    const files = fs.readdirSync(tmpDir);
    if (!files.length) {
      logError(url, "No output file produced", ip);
      send("error", { message: "No output file found." });
      res.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    const filePath = path.join(tmpDir, files[0]);
    const fileName = files[0];
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Store file temporarily and give client a token to download it
    const token = uid();
    // Store reference for 5 minutes
    pendingFiles.set(token, { filePath, fileName, tmpDir, expires: Date.now() + 5 * 60 * 1000 });

    downloadId = logDownload({
      url, format, quality, type,
      title: fileName.replace(/\.[^.]+$/, ""),
      trimmed: !!(start && end),
      trimStart: start, trimEnd: end,
      sizeMB: parseFloat(sizeMB),
      elapsedSecs: parseFloat(elapsed),
      ip, status: "success",
    }).id;

    send("done", { token, fileName, sizeMB, elapsed });
    res.end();
  });

  // Clean up if client disconnects
  req.on("close", () => {
    if (ytdlp.exitCode === null) ytdlp.kill();
  });
});

// ── Pending files store (token → file path) ───────────────────────────────────
const pendingFiles = new Map();

// Clean up expired files every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingFiles.entries()) {
    if (now > entry.expires) {
      fs.rmSync(entry.tmpDir, { recursive: true, force: true });
      pendingFiles.delete(token);
    }
  }
}, 60000);

// ── Serve downloaded file by token ────────────────────────────────────────────
app.get("/api/file/:token", (req, res) => {
  const entry = pendingFiles.get(req.params.token);
  if (!entry) return res.status(404).json({ error: "File not found or expired." });
  if (Date.now() > entry.expires) {
    pendingFiles.delete(req.params.token);
    fs.rmSync(entry.tmpDir, { recursive: true, force: true });
    return res.status(410).json({ error: "File has expired. Please download again." });
  }

  const stat = fs.statSync(entry.filePath);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(entry.fileName)}"`);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Type", "application/octet-stream");

  const stream = fs.createReadStream(entry.filePath);
  stream.pipe(res);
  stream.on("close", () => {
    // Clean up after serving
    pendingFiles.delete(req.params.token);
    fs.rmSync(entry.tmpDir, { recursive: true, force: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/admin/stats", adminAuth, (req, res) => {
  const now = Date.now();
  const day = 86400000;
  const week = 7 * day;
  const today = store.downloads.filter(d => now - new Date(d.timestamp) < day);
  const thisWeek = store.downloads.filter(d => now - new Date(d.timestamp) < week);
  const byFormat = {};
  store.downloads.forEach(d => { byFormat[d.format] = (byFormat[d.format] || 0) + 1; });
  const byType = { video: 0, audio: 0 };
  store.downloads.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });
  const perDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    perDay[key] = 0;
  }
  store.downloads.forEach(d => { const key = d.timestamp.slice(0, 10); if (key in perDay) perDay[key]++; });
  const ipCounts = {};
  store.downloads.forEach(d => { ipCounts[d.ip] = (ipCounts[d.ip] || 0) + 1; });
  const topIPs = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sizes = store.downloads.filter(d => d.sizeMB).map(d => d.sizeMB);
  const avgSize = sizes.length ? (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2) : 0;
  const totalMB = sizes.reduce((a, b) => a + b, 0).toFixed(0);
  res.json({
    totals: { allTime: store.downloads.length, today: today.length, thisWeek: thisWeek.length, errors: store.errors.length, activeJobs: store.activeJobs, blockedIPs: store.blocked.size },
    byFormat, byType, perDay, topIPs,
    avgFileSizeMB: parseFloat(avgSize),
    totalDataServedMB: parseFloat(totalMB),
    trimmedDownloads: store.downloads.filter(d => d.trimmed).length,
    cachedInfoCount: infoCache.size,
    uptime: process.uptime(),
    memoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
  });
});

app.get("/api/admin/downloads", adminAuth, (req, res) => {
  const { page = 1, limit = 50, format, type, search } = req.query;
  let list = [...store.downloads];
  if (format) list = list.filter(d => d.format === format);
  if (type) list = list.filter(d => d.type === type);
  if (search) list = list.filter(d => d.title?.toLowerCase().includes(search.toLowerCase()) || d.url?.includes(search));
  const start = (page - 1) * limit;
  res.json({ total: list.length, page: parseInt(page), data: list.slice(start, start + parseInt(limit)) });
});

app.get("/api/admin/errors", adminAuth, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const start = (page - 1) * limit;
  res.json({ total: store.errors.length, data: store.errors.slice(start, start + parseInt(limit)) });
});

app.delete("/api/admin/errors", adminAuth, (req, res) => {
  store.errors = [];
  res.json({ ok: true });
});

app.post("/api/admin/block", adminAuth, (req, res) => {
  const { ip, action } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });
  if (action === "unblock") store.blocked.delete(ip);
  else store.blocked.add(ip);
  res.json({ ok: true, blocked: [...store.blocked] });
});

app.get("/api/admin/blocked", adminAuth, (req, res) => {
  res.json({ blocked: [...store.blocked] });
});

app.patch("/api/admin/settings", adminAuth, (req, res) => {
  const allowed = ["maxConcurrent", "allowedFormats", "maxDuration", "rateLimitPerHour", "maintenanceMode", "bannerMessage"];
  allowed.forEach(k => { if (k in req.body) store.settings[k] = req.body[k]; });
  res.json({ ok: true, settings: store.settings });
});

app.get("/api/admin/settings", adminAuth, (req, res) => {
  res.json(store.settings);
});

// Clear info cache from admin
app.delete("/api/admin/cache", adminAuth, (req, res) => {
  infoCache.clear();
  res.json({ ok: true, message: "Cache cleared" });
});

app.get("/api/admin/export", adminAuth, (req, res) => {
  const headers = ["id","timestamp","title","url","format","quality","type","trimmed","sizeMB","elapsedSecs","ip","status"];
  const rows = store.downloads.map(d => headers.map(h => JSON.stringify(d[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=kingo-downloads.csv");
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Kingo YT Downloader API v2 on http://localhost:${PORT}`);
  console.log(`🔑 Admin secret: ${ADMIN_SECRET}`);
});
