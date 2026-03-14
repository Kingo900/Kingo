const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "kingo-admin-secret-change-me";

app.use(cors());
app.use(express.json());

// ── In-memory data store (use a real DB like MongoDB/SQLite for production) ──
const store = {
  downloads: [],       // { id, url, title, format, quality, type, trimmed, size, duration, ip, timestamp, status }
  errors: [],          // { id, url, message, stack, ip, timestamp }
  blocked: new Set(),  // blocked IPs
  settings: {
    maxConcurrent: 5,
    allowedFormats: ["mp4", "mkv", "webm", "mp3", "aac", "opus", "flac", "wav", "m4a"],
    maxDuration: 7200, // seconds (2hrs)
    rateLimitPerHour: 20,
    maintenanceMode: false,
    bannerMessage: "",
  },
  rateLimits: {},      // ip -> [timestamps]
  activeJobs: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  const window = 3600000; // 1 hour
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

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", app: "Kingo YT Downloader", uptime: process.uptime() });
});

// ── Banner (public) ───────────────────────────────────────────────────────────
app.get("/api/banner", (req, res) => {
  res.json({ message: store.settings.bannerMessage, maintenance: store.settings.maintenanceMode });
});

// ── Info ──────────────────────────────────────────────────────────────────────
app.get("/api/info", (req, res) => {
  const { url } = req.query;
  const ip = getIp(req);

  if (!url) return res.status(400).json({ error: "URL is required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error: "Your IP has been blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error: "Kingo is under maintenance. Check back soon." });

  const cmd = `yt-dlp --dump-json --no-playlist "${url}"`;
  exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      logError(url, stderr?.slice(0, 300) || err.message, ip);
      return res.status(500).json({ error: "Could not fetch video info. The video may be unavailable or region-locked." });
    }
    try {
      const info = JSON.parse(stdout);
      if (store.settings.maxDuration && info.duration > store.settings.maxDuration) {
        return res.status(400).json({ error: `Video is too long (max ${store.settings.maxDuration / 60} minutes).` });
      }
      res.json({
        title: info.title,
        channel: info.uploader || info.channel,
        duration: info.duration,
        thumbnail: info.thumbnail,
        view_count: info.view_count,
        upload_date: info.upload_date,
      });
    } catch (e) {
      logError(url, "Failed to parse yt-dlp JSON: " + e.message, ip);
      res.status(500).json({ error: "Failed to parse video info" });
    }
  });
});

// ── Download ──────────────────────────────────────────────────────────────────
app.get("/api/download", (req, res) => {
  const { url, format = "mp4", quality = "1080", type = "video", start, end } = req.query;
  const ip = getIp(req);

  if (!url) return res.status(400).json({ error: "URL is required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error: "Your IP has been blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error: "Under maintenance." });
  if (!checkRateLimit(ip)) return res.status(429).json({ error: `Rate limit exceeded. Max ${store.settings.rateLimitPerHour} downloads/hour.` });
  if (!store.settings.allowedFormats.includes(format)) return res.status(400).json({ error: `Format .${format} is not allowed.` });
  if (store.activeJobs >= store.settings.maxConcurrent) return res.status(503).json({ error: "Server busy. Please try again in a moment." });

  store.activeJobs++;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const args = ["--no-playlist", "-o", outputTemplate];

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

  const startTime = Date.now();
  const ytdlp = spawn("yt-dlp", args);
  let stderr = "";
  ytdlp.stderr.on("data", d => { stderr += d.toString(); });

  ytdlp.on("close", code => {
    store.activeJobs = Math.max(0, store.activeJobs - 1);

    if (code !== 0) {
      logError(url, stderr?.slice(0, 300) || "yt-dlp exited with code " + code, ip);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (!res.headersSent) return res.status(500).json({ error: "Download failed. The video may be age-restricted or unavailable." });
      return;
    }

    const files = fs.readdirSync(tmpDir);
    if (!files.length) {
      logError(url, "No output file produced", ip);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (!res.headersSent) return res.status(500).json({ error: "No output file found" });
      return;
    }

    const filePath = path.join(tmpDir, files[0]);
    const fileName = files[0];
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Log successful download
    logDownload({
      url, format, quality, type,
      title: fileName.replace(/\.[^.]+$/, ""),
      trimmed: !!(start && end),
      trimStart: start, trimEnd: end,
      sizeMB: parseFloat(sizeMB),
      elapsedSecs: parseFloat(elapsed),
      ip, status: "success",
    });

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/octet-stream");

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
    stream.on("error", (e) => {
      logError(url, "Stream error: " + e.message, ip);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN ROUTES (all require x-admin-key header) ────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Dashboard stats
app.get("/api/admin/stats", adminAuth, (req, res) => {
  const now = Date.now();
  const day = 86400000;
  const week = 7 * day;

  const today = store.downloads.filter(d => now - new Date(d.timestamp) < day);
  const thisWeek = store.downloads.filter(d => now - new Date(d.timestamp) < week);

  // Downloads by format
  const byFormat = {};
  store.downloads.forEach(d => { byFormat[d.format] = (byFormat[d.format] || 0) + 1; });

  // Downloads by type
  const byType = { video: 0, audio: 0 };
  store.downloads.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });

  // Downloads per day (last 7 days)
  const perDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    perDay[key] = 0;
  }
  store.downloads.forEach(d => {
    const key = d.timestamp.slice(0, 10);
    if (key in perDay) perDay[key]++;
  });

  // Top IPs
  const ipCounts = {};
  store.downloads.forEach(d => { ipCounts[d.ip] = (ipCounts[d.ip] || 0) + 1; });
  const topIPs = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Avg file size
  const sizes = store.downloads.filter(d => d.sizeMB).map(d => d.sizeMB);
  const avgSize = sizes.length ? (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2) : 0;

  // Total data served
  const totalMB = sizes.reduce((a, b) => a + b, 0).toFixed(0);

  res.json({
    totals: {
      allTime: store.downloads.length,
      today: today.length,
      thisWeek: thisWeek.length,
      errors: store.errors.length,
      activeJobs: store.activeJobs,
      blockedIPs: store.blocked.size,
    },
    byFormat,
    byType,
    perDay,
    topIPs,
    avgFileSizeMB: parseFloat(avgSize),
    totalDataServedMB: parseFloat(totalMB),
    trimmedDownloads: store.downloads.filter(d => d.trimmed).length,
    uptime: process.uptime(),
    memoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
  });
});

// Recent downloads
app.get("/api/admin/downloads", adminAuth, (req, res) => {
  const { page = 1, limit = 50, format, type, search } = req.query;
  let list = [...store.downloads];
  if (format) list = list.filter(d => d.format === format);
  if (type) list = list.filter(d => d.type === type);
  if (search) list = list.filter(d => d.title?.toLowerCase().includes(search.toLowerCase()) || d.url?.includes(search));
  const start = (page - 1) * limit;
  res.json({ total: list.length, page: parseInt(page), data: list.slice(start, start + parseInt(limit)) });
});

// Error logs
app.get("/api/admin/errors", adminAuth, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const start = (page - 1) * limit;
  res.json({ total: store.errors.length, data: store.errors.slice(start, start + parseInt(limit)) });
});

// Clear errors
app.delete("/api/admin/errors", adminAuth, (req, res) => {
  store.errors = [];
  res.json({ ok: true });
});

// Block/unblock IP
app.post("/api/admin/block", adminAuth, (req, res) => {
  const { ip, action } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });
  if (action === "unblock") store.blocked.delete(ip);
  else store.blocked.add(ip);
  res.json({ ok: true, blocked: [...store.blocked] });
});

// Get blocked IPs
app.get("/api/admin/blocked", adminAuth, (req, res) => {
  res.json({ blocked: [...store.blocked] });
});

// Update settings
app.patch("/api/admin/settings", adminAuth, (req, res) => {
  const allowed = ["maxConcurrent", "allowedFormats", "maxDuration", "rateLimitPerHour", "maintenanceMode", "bannerMessage"];
  allowed.forEach(k => { if (k in req.body) store.settings[k] = req.body[k]; });
  res.json({ ok: true, settings: store.settings });
});

// Get settings
app.get("/api/admin/settings", adminAuth, (req, res) => {
  res.json(store.settings);
});

// Export download logs as CSV
app.get("/api/admin/export", adminAuth, (req, res) => {
  const headers = ["id","timestamp","title","url","format","quality","type","trimmed","sizeMB","elapsedSecs","ip","status"];
  const rows = store.downloads.map(d => headers.map(h => JSON.stringify(d[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=kingo-downloads.csv");
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Kingo YT Downloader API on http://localhost:${PORT}`);
  console.log(`🔑 Admin secret: ${ADMIN_SECRET}`);
});
