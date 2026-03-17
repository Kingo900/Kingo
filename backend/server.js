const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "kingo-admin-secret-change-me";

// ── Security: Rate limiting & helmet-style headers ────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ── CORS: restrict to known origins in production ─────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (ALLOWED_ORIGINS.includes("*") || !origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "10kb" })); // prevent large payload attacks

// ── Auto-detect node path ─────────────────────────────────────────────────────
let NODE_PATH = "node";
try {
  NODE_PATH = execSync("which node || command -v node").toString().trim();
  console.log("✅ Node path:", NODE_PATH);
} catch { console.log("⚠️ Could not detect node path"); }

// ── Per-platform cookies ──────────────────────────────────────────────────────
const PLATFORMS = {
  youtube:   { file:"cookies-youtube.txt",   domains:["youtube.com","google.com"], label:"YouTube" },
  instagram: { file:"cookies-instagram.txt", domains:["instagram.com"],            label:"Instagram" },
  tiktok:    { file:"cookies-tiktok.txt",    domains:["tiktok.com"],               label:"TikTok" },
};

function getCookiesPath(platform="youtube") {
  const p = PLATFORMS[platform] || PLATFORMS.youtube;
  return path.join(__dirname, p.file);
}

function getCookieArgs(platform="youtube") {
  const cp = getCookiesPath(platform);
  if (fs.existsSync(cp)) return ["--cookies", cp];
  const legacy = path.join(__dirname, "cookies.txt");
  if (platform==="youtube" && fs.existsSync(legacy)) return ["--cookies", legacy];
  return [];
}

function validateCookiesSync(platform="youtube") {
  const cp = getCookiesPath(platform);
  const legacy = path.join(__dirname, "cookies.txt");
  const filePath = fs.existsSync(cp) ? cp : (platform==="youtube" && fs.existsSync(legacy) ? legacy : null);
  if (!filePath) return { valid:false, reason:"No cookies file found" };
  const stat = fs.statSync(filePath);
  if (stat.size < 100) return { valid:false, reason:"Cookies file is empty" };
  const content = fs.readFileSync(filePath, "utf8");
  const found = (PLATFORMS[platform]?.domains||[]).some(d => content.includes(d));
  if (!found) return { valid:false, reason:`No ${PLATFORMS[platform]?.label} cookies found` };
  const ageDays = (Date.now()-stat.mtimeMs)/(1000*60*60*24);
  if (ageDays>21) return { valid:true, reason:`Valid but ${Math.floor(ageDays)} days old — refresh soon`, ageDays:Math.floor(ageDays), sizeKB:(stat.size/1024).toFixed(1) };
  return { valid:true, reason:`Valid (${Math.floor(ageDays)} days old, ${(stat.size/1024).toFixed(1)} KB)`, ageDays:Math.floor(ageDays), sizeKB:(stat.size/1024).toFixed(1) };
}

async function validateCookies(platform="youtube") { return Promise.resolve(validateCookiesSync(platform)); }

// ── Store ─────────────────────────────────────────────────────────────────────
const store = {
  downloads: [],
  errors: [],
  blocked: new Set(),
  autoBlocked: new Set(), // auto-blocked by abuse detection
  settings: {
    maxConcurrent: 5,
    allowedFormats: ["mp4","mkv","webm","mp3","aac","opus","flac","wav","m4a"],
    maxDuration: 7200,
    rateLimitPerHour: 20,
    maintenanceMode: false,
    bannerMessage: "",
    // Email settings
    emailAlerts: false,
    alertEmail: "",
    emailOnErrorSpike: true,
    errorSpikeThreshold: 10, // errors per hour to trigger alert
    dailyReport: false,
    dailyReportHour: 8, // 8 AM
    // Auto-block settings
    autoBlockEnabled: true,
    autoBlockThreshold: 50, // downloads per hour
    // SMTP settings
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: parseInt(process.env.SMTP_PORT || "587"),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "kingo@yourdomain.com",
  },
  rateLimits: {},
  activeJobs: 0,
  countryStats: {}, // country_code -> count
  dailyReportSent: null, // date string of last sent report
};

// ── Info cache ────────────────────────────────────────────────────────────────
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
function getCached(url) { const e=infoCache.get(url); if(!e) return null; if(Date.now()-e.timestamp>CACHE_TTL){infoCache.delete(url);return null;} return e.data; }
function setCache(url,data) { infoCache.set(url,{data,timestamp:Date.now()}); if(infoCache.size>100) infoCache.delete(infoCache.keys().next().value); }

// ── Pending files ─────────────────────────────────────────────────────────────
const pendingFiles = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingFiles.entries()) {
    if (now > entry.expires) { try { fs.rmSync(entry.tmpDir,{recursive:true,force:true}); } catch {} pendingFiles.delete(token); }
  }
}, 60000);

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return crypto.randomBytes(6).toString("hex"); }
function getIp(req) { return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown"; }

const ALLOWED_HOSTS = {
  youtube:   ["youtube.com","www.youtube.com","youtu.be","m.youtube.com","music.youtube.com"],
  instagram: ["instagram.com","www.instagram.com"],
  tiktok:    ["tiktok.com","www.tiktok.com","vm.tiktok.com","vt.tiktok.com"],
};

function detectPlatform(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./,"");
    if (["youtube.com","youtu.be","m.youtube.com","music.youtube.com"].includes(h)) return "youtube";
    if (["instagram.com"].includes(h)) return "instagram";
    if (["tiktok.com","vm.tiktok.com","vt.tiktok.com"].includes(h)) return "tiktok";
    return null;
  } catch { return null; }
}

function sanitizeUrl(url, platform=null) {
  try {
    const u = new URL(url);
    const allHosts = Object.values(ALLOWED_HOSTS).flat();
    if (!allHosts.includes(u.hostname)) return null;
    if (platform) {
      const allowed = ALLOWED_HOSTS[platform] || [];
      if (!allowed.includes(u.hostname)) return null;
    }
    return u.toString();
  } catch { return null; }
}

function logError(url, message, ip="unknown") {
  const entry = { id:uid(), url, message, ip, timestamp:new Date().toISOString() };
  store.errors.unshift(entry);
  if(store.errors.length>500) store.errors=store.errors.slice(0,500);
  console.error(`[ERROR] ${message}`);
  checkErrorSpike();
  return entry;
}

function logDownload(data) {
  const entry = { id:uid(), ...data, timestamp:new Date().toISOString() };
  store.downloads.unshift(entry);
  if(store.downloads.length>1000) store.downloads=store.downloads.slice(0,1000);
  // Track country
  if(data.country) store.countryStats[data.country]=(store.countryStats[data.country]||0)+1;
  return entry;
}

function checkRateLimit(ip) {
  const now=Date.now(); const window=3600000;
  if(!store.rateLimits[ip]) store.rateLimits[ip]=[];
  store.rateLimits[ip]=store.rateLimits[ip].filter(t=>now-t<window);
  if(store.rateLimits[ip].length>=store.settings.rateLimitPerHour) return false;
  store.rateLimits[ip].push(now);
  return true;
}

function adminAuth(req,res,next) {
  const key=req.headers["x-admin-key"]||req.query.adminKey;
  if(key!==ADMIN_SECRET) return res.status(401).json({error:"Unauthorized"});
  next();
}

function buildYtdlpBaseArgs(platform="youtube") {
  return [...getCookieArgs(platform), "--js-runtimes", `node:${NODE_PATH}`, "--remote-components", "ejs:github"];
}

function sseSetup(res) {
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  res.setHeader("X-Accel-Buffering","no");
  res.flushHeaders();
}

function sseSend(res,event,data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }

// ── Get country from IP using free API ───────────────────────────────────────
async function getCountry(ip) {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::")) return "Local";
  return new Promise((resolve) => {
    const req = http.get(`http://ip-api.com/json/${ip}?fields=countryCode,country`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { const j = JSON.parse(data); resolve(j.countryCode || "Unknown"); }
        catch { resolve("Unknown"); }
      });
    });
    req.on("error", () => resolve("Unknown"));
    req.setTimeout(3000, () => { req.destroy(); resolve("Unknown"); });
  });
}

// ── Auto-block aggressive IPs ─────────────────────────────────────────────────
function checkAutoBlock(ip) {
  if (!store.settings.autoBlockEnabled) return;
  const now = Date.now();
  const window = 3600000;
  const recentDownloads = store.downloads.filter(d => d.ip === ip && now - new Date(d.timestamp) < window);
  if (recentDownloads.length >= store.settings.autoBlockThreshold) {
    if (!store.blocked.has(ip) && !store.autoBlocked.has(ip)) {
      store.autoBlocked.add(ip);
      store.blocked.add(ip);
      console.log(`🚫 Auto-blocked IP: ${ip} (${recentDownloads.length} downloads/hour)`);
      sendEmail(
        store.settings.alertEmail,
        "🚫 Kingo: IP Auto-Blocked",
        `IP <strong>${ip}</strong> was automatically blocked for excessive usage: <strong>${recentDownloads.length} downloads</strong> in the last hour (threshold: ${store.settings.autoBlockThreshold}).`
      );
    }
  }
}

// ── Email via SMTP (nodemailer-free, raw SMTP) ────────────────────────────────
// Uses fetch to a simple email API or logs to console if not configured
async function sendEmail(to, subject, htmlBody) {
  if (!store.settings.emailAlerts || !to || !store.settings.smtpHost) {
    console.log(`[EMAIL NOT CONFIGURED] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    // Use nodemailer if available
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransporter({
      host: store.settings.smtpHost,
      port: store.settings.smtpPort,
      secure: store.settings.smtpPort === 465,
      auth: { user: store.settings.smtpUser, pass: store.settings.smtpPass },
    });
    await transporter.sendMail({
      from: `"Kingo YT Downloader" <${store.settings.smtpFrom}>`,
      to, subject,
      html: `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#7c3aed;padding:20px;border-radius:12px;text-align:center;margin-bottom:20px">
          <h1 style="color:#fff;margin:0;font-size:24px">K Kingo</h1>
          <p style="color:#e9d5ff;margin:8px 0 0;font-size:14px">YT Downloader Admin Alert</p>
        </div>
        <div style="background:#f9f9f9;padding:20px;border-radius:12px">${htmlBody}</div>
        <p style="color:#999;font-size:12px;text-align:center;margin-top:16px">Kingo YT Downloader · Auto-generated alert</p>
      </div>`,
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.error(`[EMAIL ERROR] ${e.message}`);
  }
}

// ── Error spike detection ─────────────────────────────────────────────────────
let lastErrorAlertTime = 0;
function checkErrorSpike() {
  if (!store.settings.emailAlerts || !store.settings.emailOnErrorSpike) return;
  const now = Date.now();
  if (now - lastErrorAlertTime < 60 * 60 * 1000) return; // max 1 alert per hour
  const recentErrors = store.errors.filter(e => now - new Date(e.timestamp) < 3600000);
  if (recentErrors.length >= store.settings.errorSpikeThreshold) {
    lastErrorAlertTime = now;
    sendEmail(
      store.settings.alertEmail,
      `⚠️ Kingo: ${recentErrors.length} errors in last hour`,
      `<h2>Error Spike Detected</h2>
      <p>Kingo has recorded <strong>${recentErrors.length} errors</strong> in the last hour (threshold: ${store.settings.errorSpikeThreshold}).</p>
      <h3>Recent errors:</h3>
      <ul>${recentErrors.slice(0,5).map(e=>`<li><code>${e.message?.slice(0,100)}</code> — IP: ${e.ip}</li>`).join("")}</ul>
      <p><a href="${process.env.FRONTEND_URL||""}/admin">Open Admin Panel →</a></p>`
    );
  }
}

// ── Daily report ──────────────────────────────────────────────────────────────
function checkDailyReport() {
  if (!store.settings.dailyReport || !store.settings.emailAlerts) return;
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const currentHour = now.getUTCHours();
  if (currentHour !== store.settings.dailyReportHour) return;
  if (store.dailyReportSent === todayStr) return;

  store.dailyReportSent = todayStr;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const todayDownloads = store.downloads.filter(d => d.timestamp.slice(0,10) === todayStr);
  const yesterdayDownloads = store.downloads.filter(d => d.timestamp.slice(0,10) === yesterday);

  const byFormat = {};
  todayDownloads.forEach(d => { byFormat[d.format]=(byFormat[d.format]||0)+1; });
  const topCountries = Object.entries(store.countryStats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalMB = todayDownloads.filter(d=>d.sizeMB).reduce((s,d)=>s+d.sizeMB,0).toFixed(0);
  const trend = todayDownloads.length > yesterdayDownloads.length ? "📈" : "📉";

  sendEmail(
    store.settings.alertEmail,
    `📊 Kingo Daily Report — ${todayStr}`,
    `<h2>Daily Report for ${todayStr}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px;background:#f3f4f6"><strong>Total Downloads</strong></td><td style="padding:8px">${todayDownloads.length} ${trend} (yesterday: ${yesterdayDownloads.length})</td></tr>
      <tr><td style="padding:8px"><strong>Data Served</strong></td><td style="padding:8px">${totalMB} MB</td></tr>
      <tr><td style="padding:8px;background:#f3f4f6"><strong>Errors</strong></td><td style="padding:8px">${store.errors.filter(e=>e.timestamp.slice(0,10)===todayStr).length}</td></tr>
      <tr><td style="padding:8px"><strong>Active Blocks</strong></td><td style="padding:8px">${store.blocked.size}</td></tr>
    </table>
    <h3>By Format</h3>
    <p>${Object.entries(byFormat).map(([f,c])=>`<strong>.${f}</strong>: ${c}`).join(" · ")}</p>
    <h3>Top Countries</h3>
    <p>${topCountries.map(([c,n])=>`<strong>${c}</strong>: ${n}`).join(" · ")||"No data"}</p>
    <p><a href="${process.env.FRONTEND_URL||""}/admin">Open Admin Panel →</a></p>`
  );
}

// Run daily report check every 30 minutes
setInterval(checkDailyReport, 30 * 60 * 1000);

// ── yt-dlp version check ──────────────────────────────────────────────────────
let ytdlpVersion = { current: "unknown", latest: "unknown", lastChecked: null };
function checkYtdlpVersion() {
  exec("yt-dlp --version", (err, stdout) => {
    if (!err) ytdlpVersion.current = stdout.trim();
  });
  exec("pip index versions yt-dlp 2>/dev/null | head -1", (err, stdout) => {
    const match = stdout?.match(/LATEST:\s*(\S+)/);
    if (match) ytdlpVersion.latest = match[1];
  });
  ytdlpVersion.lastChecked = new Date().toISOString();
}
checkYtdlpVersion();
setInterval(checkYtdlpVersion, 6 * 60 * 60 * 1000); // check every 6 hours

// ══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/health", (req, res) => res.json({ status:"ok", version:"4.0.0", app:"Kingo YT Downloader", uptime:process.uptime() }));
app.get("/api/banner", (req, res) => res.json({ message:store.settings.bannerMessage, maintenance:store.settings.maintenanceMode }));

// ── Info (all platforms) ──────────────────────────────────────────────────────
app.get("/api/info", async (req, res) => {
  const { url, platform="youtube" } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL is required" });
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return res.status(400).json({ error:"URL not supported. Use YouTube, Instagram or TikTok." });
  const detectedPlatform = detectPlatform(url) || platform;
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Your IP has been blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error:"Kingo is under maintenance." });
  const cacheKey = `${detectedPlatform}:${safeUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached:true });
  const baseArgs = buildYtdlpBaseArgs(detectedPlatform).join(" ");
  const cmd = `yt-dlp --dump-json --no-playlist ${baseArgs} "${safeUrl}"`;
  exec(cmd, { timeout:45000 }, (err, stdout, stderr) => {
    if (err) { logError(safeUrl, stderr?.slice(0,300)||err.message, ip); return res.status(500).json({ error:"Could not fetch info. The content may be private or unavailable." }); }
    try {
      const info = JSON.parse(stdout);
      if (detectedPlatform==="youtube" && store.settings.maxDuration && info.duration > store.settings.maxDuration) return res.status(400).json({ error:`Video too long (max ${store.settings.maxDuration/60} minutes).` });
      const formatSizes = {};
      if (info.formats) {
        const qMap = {2160:[],1440:[],1080:[],720:[],480:[],360:[],240:[]};
        info.formats.forEach(f => {
          if (f.height && qMap[f.height]!==undefined) { const s=f.filesize||f.filesize_approx; if(s) qMap[f.height].push(s); }
        });
        Object.entries(qMap).forEach(([q,sizes]) => { if(sizes.length) formatSizes[q]=Math.max(...sizes); });
        const audioFmts = info.formats.filter(f=>f.vcodec==="none"&&(f.filesize||f.filesize_approx));
        if (audioFmts.length) formatSizes["audio"] = Math.max(...audioFmts.map(f=>f.filesize||f.filesize_approx||0));
      }
      // Detect if it's a multi-image carousel (Instagram)
      const isCarousel = info._type === "playlist" || (info.entries && info.entries.length > 1);
      const mediaType = info.ext === "jpg" || info.ext === "png" || info.ext === "webp" ? "image" : "video";
      const data = {
        title: info.title, channel: info.uploader||info.channel,
        duration: info.duration, thumbnail: info.thumbnail,
        view_count: info.view_count, formatSizes,
        platform: detectedPlatform, mediaType,
        isCarousel, imageCount: info.entries?.length || null,
        ext: info.ext,
      };
      setCache(cacheKey, data);
      res.json(data);
    } catch(e) { logError(safeUrl,"Parse error: "+e.message,ip); res.status(500).json({error:"Failed to parse info"}); }
  });
});

// ── Playlist (YouTube only) ───────────────────────────────────────────────────
app.get("/api/playlist", async (req, res) => {
  const { url } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL is required" });
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl || detectPlatform(url)!=="youtube") return res.status(400).json({ error:"Only YouTube playlist URLs are allowed." });
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error:"Under maintenance." });
  const baseArgs = buildYtdlpBaseArgs("youtube").join(" ");
  const cmd = `yt-dlp --flat-playlist --dump-json ${baseArgs} "${safeUrl}"`;
  exec(cmd, { timeout:60000, maxBuffer:10*1024*1024 }, (err, stdout, stderr) => {
    if (err) { logError(safeUrl, stderr?.slice(0,300)||err.message, ip); return res.status(500).json({ error:"Could not fetch playlist." }); }
    try {
      const videos = stdout.trim().split("\n").filter(Boolean).map(line => {
        try { const v=JSON.parse(line); return {id:v.id,title:v.title,url:`https://youtube.com/watch?v=${v.id}`,duration:v.duration,thumbnail:v.thumbnail||`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}; }
        catch { return null; }
      }).filter(Boolean);
      if (!videos.length) return res.status(404).json({ error:"No videos found in playlist." });
      res.json({ total:videos.length, videos:videos.slice(0,50) });
    } catch(e) { logError(safeUrl,"Playlist parse: "+e.message,ip); res.status(500).json({error:"Failed to parse playlist"}); }
  });
});

// ── Download with SSE progress (all platforms) ───────────────────────────────
app.get("/api/download-progress", async (req, res) => {
  const { url, format="mp4", quality="1080", type="video", start, end, platform, noWatermark } = req.query;
  const ip = getIp(req);
  const safeUrl = sanitizeUrl(url || "");
  if (!safeUrl) { res.status(400).end(); return; }
  if (store.blocked.has(ip)) { res.status(403).end(); return; }
  if (store.settings.maintenanceMode) { res.status(503).end(); return; }
  if (!checkRateLimit(ip)) { res.status(429).end(); return; }
  if (!store.settings.allowedFormats.includes(format)) { res.status(400).end(); return; }
  if (store.activeJobs >= store.settings.maxConcurrent) { res.status(503).end(); return; }

  const detectedPlatform = platform || detectPlatform(url) || "youtube";
  const countryPromise = getCountry(ip);

  sseSetup(res);
  store.activeJobs++;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const args = ["--no-playlist", "--newline", "--progress", ...buildYtdlpBaseArgs(detectedPlatform), "-o", outputTemplate];

  if (detectedPlatform === "instagram" || detectedPlatform === "tiktok") {
    // For social platforms: best quality, handle images too
    if (type === "audio") {
      args.push("-x", "--audio-format", format, "--audio-quality", "0");
    } else {
      // TikTok watermark removal
      if (detectedPlatform === "tiktok" && noWatermark === "true") {
        args.push("--extractor-args", "tiktok:api_hostname=api22-normal-c-alisg.tiktok.com");
      }
      args.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", format);
    }
  } else {
    // YouTube
    if (type === "audio") { args.push("-x","--audio-format",format,"--audio-quality","0"); }
    else { args.push("-f",`bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`,"--merge-output-format",format); }
    if (start && end) args.push("--postprocessor-args", `ffmpeg:-ss ${start} -to ${end}`);
  }

  args.push(safeUrl);
  sseSend(res, "status", { message:"Starting download…", percent:0 });
  const startTime = Date.now();
  const ytdlp = spawn("yt-dlp", args);
  let stderr = "";

  ytdlp.stdout.on("data", chunk => {
    chunk.toString().split("\n").forEach(line => {
      const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)(?:\s+ETA\s+(\S+))?/);
      if (match) sseSend(res,"progress",{percent:parseFloat(match[1]),size:match[2],speed:match[3],eta:match[4]||""});
      if (line.includes("[Merger]")||line.includes("[ffmpeg]")) sseSend(res,"status",{message:"Processing…",percent:99});
    });
  });

  ytdlp.stderr.on("data", d => { stderr += d.toString(); });

  ytdlp.on("close", async code => {
    store.activeJobs = Math.max(0, store.activeJobs-1);
    if (code!==0) { logError(safeUrl,stderr?.slice(0,300)||"Exit "+code,ip); sseSend(res,"error",{message:"Download failed. The video may be age-restricted."}); res.end(); try{fs.rmSync(tmpDir,{recursive:true,force:true});}catch{}; return; }
    const files = fs.readdirSync(tmpDir);
    if (!files.length) { logError(safeUrl,"No output",ip); sseSend(res,"error",{message:"No output file."}); res.end(); try{fs.rmSync(tmpDir,{recursive:true,force:true});}catch{}; return; }
    const filePath = path.join(tmpDir, files[0]);
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size/1024/1024).toFixed(2);
    const elapsed = ((Date.now()-startTime)/1000).toFixed(1);
    const token = uid();
    const country = await countryPromise;
    pendingFiles.set(token, { filePath, fileName:files[0], tmpDir, expires:Date.now()+5*60*1000 });
    logDownload({ url:safeUrl, format, quality, type, title:files[0].replace(/\.[^.]+$/,""), trimmed:!!(start&&end), trimStart:start, trimEnd:end, sizeMB:parseFloat(sizeMB), elapsedSecs:parseFloat(elapsed), ip, country, status:"success" });
    checkAutoBlock(ip);
    sseSend(res, "done", { token, fileName:files[0], sizeMB, elapsed });
    res.end();
  });

  req.on("close", () => { if(ytdlp.exitCode===null) ytdlp.kill(); });
});

// ── Serve file ────────────────────────────────────────────────────────────────
app.get("/api/file/:token", (req, res) => {
  // Validate token format
  if (!/^[a-f0-9]{12}$/.test(req.params.token)) return res.status(400).json({ error:"Invalid token" });
  const entry = pendingFiles.get(req.params.token);
  if (!entry || Date.now() > entry.expires) { pendingFiles.delete(req.params.token); return res.status(404).json({ error:"File not found or expired." }); }
  const stat = fs.statSync(entry.filePath);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(entry.fileName)}"`);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Type", "application/octet-stream");
  const stream = fs.createReadStream(entry.filePath);
  stream.pipe(res);
  stream.on("close", () => { pendingFiles.delete(req.params.token); try{fs.rmSync(entry.tmpDir,{recursive:true,force:true});}catch{} });
});

// ── Subtitles ─────────────────────────────────────────────────────────────────
app.get("/api/subtitles", (req, res) => {
  const { url, lang="en" } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL required" });
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return res.status(400).json({ error:"Only YouTube URLs allowed." });
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Blocked." });
  // Validate lang (only allow safe chars)
  if (!/^[a-z]{2,5}(-\w{1,8})?$/.test(lang)) return res.status(400).json({ error:"Invalid language code." });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-subs-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const args = [...buildYtdlpBaseArgs(),"--no-playlist","--write-subs","--write-auto-subs","--sub-langs",lang,"--sub-format","srt/vtt/best","--skip-download","-o",outputTemplate,safeUrl];
  exec(`yt-dlp ${args.join(" ")}`, { timeout:30000 }, (err) => {
    const files = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
    const subFile = files.find(f=>f.match(/\.(srt|vtt|ass)$/i));
    if (!subFile) { try{fs.rmSync(tmpDir,{recursive:true,force:true});}catch{} logError(safeUrl,"No subtitles for lang: "+lang,ip); return res.status(404).json({ error:`No subtitles found for "${lang}". Try another language.` }); }
    const filePath = path.join(tmpDir, subFile);
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Disposition",`attachment; filename="${encodeURIComponent(subFile)}"`);
    res.setHeader("Content-Length",stat.size);
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close",()=>{try{fs.rmSync(tmpDir,{recursive:true,force:true});}catch{}});
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/admin/stats", adminAuth, (req, res) => {
  const now=Date.now(),day=86400000,week=7*day;
  const today=store.downloads.filter(d=>now-new Date(d.timestamp)<day);
  const thisWeek=store.downloads.filter(d=>now-new Date(d.timestamp)<week);
  const byFormat={},byType={video:0,audio:0};
  store.downloads.forEach(d=>{byFormat[d.format]=(byFormat[d.format]||0)+1;byType[d.type]=(byType[d.type]||0)+1;});
  const perDay={};
  for(let i=6;i>=0;i--){const d=new Date(now-i*day);perDay[d.toISOString().slice(0,10)]=0;}
  store.downloads.forEach(d=>{const k=d.timestamp.slice(0,10);if(k in perDay)perDay[k]++;});
  const ipCounts={};
  store.downloads.forEach(d=>{ipCounts[d.ip]=(ipCounts[d.ip]||0)+1;});
  const topIPs=Object.entries(ipCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const sizes=store.downloads.filter(d=>d.sizeMB).map(d=>d.sizeMB);
  const avgSize=sizes.length?(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(2):0;
  const totalMB=sizes.reduce((a,b)=>a+b,0).toFixed(0);
  const topCountries=Object.entries(store.countryStats).sort((a,b)=>b[1]-a[1]).slice(0,10);
  res.json({
    totals:{allTime:store.downloads.length,today:today.length,thisWeek:thisWeek.length,errors:store.errors.length,activeJobs:store.activeJobs,blockedIPs:store.blocked.size,autoBlocked:store.autoBlocked.size},
    byFormat,byType,perDay,topIPs,topCountries,countryStats:store.countryStats,
    avgFileSizeMB:parseFloat(avgSize),totalDataServedMB:parseFloat(totalMB),
    trimmedDownloads:store.downloads.filter(d=>d.trimmed).length,
    cachedInfoCount:infoCache.size,uptime:process.uptime(),
    memoryMB:(process.memoryUsage().rss/1024/1024).toFixed(1),
    ytdlpVersion,
  });
});

app.get("/api/admin/downloads", adminAuth, (req,res)=>{
  const{page=1,limit=50,format,type,search,country}=req.query;
  let list=[...store.downloads];
  if(format)list=list.filter(d=>d.format===format);
  if(type)list=list.filter(d=>d.type===type);
  if(country)list=list.filter(d=>d.country===country);
  if(search)list=list.filter(d=>d.title?.toLowerCase().includes(search.toLowerCase())||d.url?.includes(search));
  const start=(page-1)*limit;
  res.json({total:list.length,page:parseInt(page),data:list.slice(start,start+parseInt(limit))});
});

app.get("/api/admin/errors",adminAuth,(req,res)=>{const{page=1,limit=50}=req.query;const start=(page-1)*limit;res.json({total:store.errors.length,data:store.errors.slice(start,start+parseInt(limit))});});
app.delete("/api/admin/errors",adminAuth,(req,res)=>{store.errors=[];res.json({ok:true});});
app.post("/api/admin/block",adminAuth,(req,res)=>{const{ip,action}=req.body;if(!ip||typeof ip!=="string")return res.status(400).json({error:"IP required"});if(action==="unblock"){store.blocked.delete(ip);store.autoBlocked.delete(ip);}else store.blocked.add(ip);res.json({ok:true,blocked:[...store.blocked]});});
app.get("/api/admin/blocked",adminAuth,(req,res)=>res.json({blocked:[...store.blocked],autoBlocked:[...store.autoBlocked]}));
app.patch("/api/admin/settings",adminAuth,(req,res)=>{
  const allowed=["maxConcurrent","allowedFormats","maxDuration","rateLimitPerHour","maintenanceMode","bannerMessage","emailAlerts","alertEmail","emailOnErrorSpike","errorSpikeThreshold","dailyReport","dailyReportHour","autoBlockEnabled","autoBlockThreshold","smtpHost","smtpPort","smtpUser","smtpPass","smtpFrom"];
  allowed.forEach(k=>{if(k in req.body)store.settings[k]=req.body[k];});
  res.json({ok:true,settings:store.settings});
});
app.get("/api/admin/settings",adminAuth,(req,res)=>res.json(store.settings));
app.delete("/api/admin/cache",adminAuth,(req,res)=>{infoCache.clear();res.json({ok:true});});

// ── yt-dlp update ─────────────────────────────────────────────────────────────
app.post("/api/admin/ytdlp-update", adminAuth, (req, res) => {
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  const send = (msg) => res.write(`data: ${JSON.stringify({message:msg})}\n\n`);
  send("Starting yt-dlp update...");
  exec("pip install -U yt-dlp --break-system-packages", { timeout:120000 }, (err, stdout, stderr) => {
    if (err) { send("❌ Update failed: "+stderr?.slice(0,200)); res.write(`event: error\ndata: {}\n\n`); res.end(); return; }
    send("✅ yt-dlp updated successfully!");
    exec("yt-dlp --version", (e, v) => {
      ytdlpVersion.current = v?.trim() || "unknown";
      ytdlpVersion.lastChecked = new Date().toISOString();
      send(`📦 New version: ${ytdlpVersion.current}`);
      res.write(`event: done\ndata: ${JSON.stringify({version:ytdlpVersion.current})}\n\n`);
      res.end();
    });
  });
});

// ── Cookie validation (per-platform) ─────────────────────────────────────────
app.get("/api/admin/cookies/status", adminAuth, async (req, res) => {
  const { platform } = req.query;
  if (platform && PLATFORMS[platform]) {
    const result = validateCookiesSync(platform);
    const cp = getCookiesPath(platform);
    const legacy = path.join(__dirname, "cookies.txt");
    const fp = fs.existsSync(cp) ? cp : (platform==="youtube" && fs.existsSync(legacy) ? legacy : null);
    return res.json({ exists:!!fp, ...result, platform, modified:fp?fs.statSync(fp).mtime:null });
  }
  // Return all platforms status
  const statuses = {};
  for (const [p] of Object.entries(PLATFORMS)) {
    const result = validateCookiesSync(p);
    const cp = getCookiesPath(p);
    const legacy = path.join(__dirname, "cookies.txt");
    const fp = fs.existsSync(cp) ? cp : (p==="youtube" && fs.existsSync(legacy) ? legacy : null);
    statuses[p] = { exists:!!fp, ...result, modified:fp?fs.statSync(fp).mtime:null };
  }
  res.json(statuses);
});

app.post("/api/admin/cookies/upload", adminAuth, express.text({ type:"*/*", limit:"500kb" }), (req, res) => {
  const { platform="youtube" } = req.query;
  const content = req.body;
  if (!content || typeof content !== "string") return res.status(400).json({ error:"Cookie content required" });
  if (!content.includes("# Netscape") && content.split("\n").length < 3) return res.status(400).json({ error:"Invalid cookies file format. Must be Netscape HTTP Cookie format." });
  const cp = getCookiesPath(platform);
  fs.writeFileSync(cp, content, "utf8");
  res.json({ ok:true, message:`${PLATFORMS[platform]?.label||platform} cookies uploaded successfully` });
});

app.delete("/api/admin/cookies", adminAuth, (req, res) => {
  const { platform="youtube" } = req.query;
  const cp = getCookiesPath(platform);
  if (fs.existsSync(cp)) fs.unlinkSync(cp);
  // Also remove legacy if youtube
  if (platform==="youtube") { const legacy=path.join(__dirname,"cookies.txt"); if(fs.existsSync(legacy)) fs.unlinkSync(legacy); }
  res.json({ ok:true });
});

// ── Send test email ───────────────────────────────────────────────────────────
app.post("/api/admin/test-email", adminAuth, async (req, res) => {
  if (!store.settings.alertEmail) return res.status(400).json({ error:"No alert email configured" });
  await sendEmail(store.settings.alertEmail, "✅ Kingo Test Email", "<h2>Test email from Kingo!</h2><p>Your email alerts are working correctly.</p>");
  res.json({ ok:true, message:`Test email sent to ${store.settings.alertEmail}` });
});

// ── Send manual daily report ──────────────────────────────────────────────────
app.post("/api/admin/send-report", adminAuth, (req, res) => {
  store.dailyReportSent = null; // reset so it sends
  checkDailyReport();
  res.json({ ok:true, message:"Report triggered" });
});

// ── Country stats ─────────────────────────────────────────────────────────────
app.get("/api/admin/countries", adminAuth, (req, res) => {
  const sorted = Object.entries(store.countryStats).sort((a,b)=>b[1]-a[1]);
  res.json({ countries:sorted, total:store.downloads.length });
});

// ── Export CSV ────────────────────────────────────────────────────────────────
app.get("/api/admin/export", adminAuth, (req, res) => {
  const headers=["id","timestamp","title","url","format","quality","type","trimmed","sizeMB","elapsedSecs","ip","country","status"];
  const rows=store.downloads.map(d=>headers.map(h=>JSON.stringify(d[h]??'')).join(","));
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=kingo-downloads.csv");
  res.send([headers.join(","),...rows].join("\n"));
});

app.listen(PORT, () => {
  console.log(`✅ Kingo YT Downloader API v4 on http://localhost:${PORT}`);
  console.log(`🔑 Admin secret configured: ${ADMIN_SECRET !== "kingo-admin-secret-change-me" ? "✅ Custom" : "⚠️ Default (change this!)"}`);
});
