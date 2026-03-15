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

// ── Auto-detect node path ─────────────────────────────────────────────────────
let NODE_PATH = "node";
try {
  NODE_PATH = execSync("which node || command -v node").toString().trim();
  console.log("✅ Node path:", NODE_PATH);
} catch (e) { console.log("⚠️ Could not detect node path"); }

// ── Cookies ───────────────────────────────────────────────────────────────────
const COOKIES = path.join(__dirname, "cookies.txt");
const getCookieArgs = () => fs.existsSync(COOKIES) ? ["--cookies", COOKIES] : [];
const getCookieArg = () => fs.existsSync(COOKIES) ? `--cookies "${COOKIES}"` : "";

// ── Store ─────────────────────────────────────────────────────────────────────
const store = {
  downloads: [], errors: [], blocked: new Set(),
  settings: {
    maxConcurrent: 5,
    allowedFormats: ["mp4","mkv","webm","mp3","aac","opus","flac","wav","m4a"],
    maxDuration: 7200, rateLimitPerHour: 20,
    maintenanceMode: false, bannerMessage: "",
  },
  rateLimits: {}, activeJobs: 0,
};

// ── Info cache ────────────────────────────────────────────────────────────────
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
function getCached(url) {
  const e = infoCache.get(url);
  if (!e) return null;
  if (Date.now() - e.timestamp > CACHE_TTL) { infoCache.delete(url); return null; }
  return e.data;
}
function setCache(url, data) {
  infoCache.set(url, { data, timestamp: Date.now() });
  if (infoCache.size > 100) infoCache.delete(infoCache.keys().next().value);
}

// ── Pending files ─────────────────────────────────────────────────────────────
const pendingFiles = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingFiles.entries()) {
    if (now > entry.expires) { fs.rmSync(entry.tmpDir, { recursive:true, force:true }); pendingFiles.delete(token); }
  }
}, 60000);

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return crypto.randomBytes(6).toString("hex"); }
function getIp(req) { return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "unknown"; }
function logError(url, message, ip="unknown") {
  const entry = { id:uid(), url, message, ip, timestamp:new Date().toISOString() };
  store.errors.unshift(entry);
  if (store.errors.length > 500) store.errors = store.errors.slice(0,500);
  console.error(`[ERROR] ${message}`);
  return entry;
}
function logDownload(data) {
  const entry = { id:uid(), ...data, timestamp:new Date().toISOString() };
  store.downloads.unshift(entry);
  if (store.downloads.length > 1000) store.downloads = store.downloads.slice(0,1000);
  return entry;
}
function checkRateLimit(ip) {
  const now = Date.now(); const window = 3600000;
  if (!store.rateLimits[ip]) store.rateLimits[ip] = [];
  store.rateLimits[ip] = store.rateLimits[ip].filter(t => now-t < window);
  if (store.rateLimits[ip].length >= store.settings.rateLimitPerHour) return false;
  store.rateLimits[ip].push(now); return true;
}
function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  if (key !== ADMIN_SECRET) return res.status(401).json({ error:"Unauthorized" });
  next();
}
function buildYtdlpBaseArgs() {
  return [...getCookieArgs(), "--js-runtimes", `node:${NODE_PATH}`, "--remote-components", "ejs:github"];
}
function sseSetup(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}
function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status:"ok", version:"3.0.0", app:"Kingo YT Downloader" }));
app.get("/api/banner", (req, res) => res.json({ message:store.settings.bannerMessage, maintenance:store.settings.maintenanceMode }));

// ── Info (single video, cached) ───────────────────────────────────────────────
app.get("/api/info", (req, res) => {
  const { url } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL is required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Your IP has been blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error:"Kingo is under maintenance." });
  const cached = getCached(url);
  if (cached) return res.json({ ...cached, cached:true });
  const baseArgs = buildYtdlpBaseArgs().join(" ");
  const cmd = `yt-dlp --dump-json --no-playlist ${baseArgs} "${url}"`;
  exec(cmd, { timeout:40000 }, (err, stdout, stderr) => {
    if (err) { logError(url, stderr?.slice(0,300)||err.message, ip); return res.status(500).json({ error:"Could not fetch video info." }); }
    try {
      const info = JSON.parse(stdout);
      const data = { title:info.title, channel:info.uploader||info.channel, duration:info.duration, thumbnail:info.thumbnail, view_count:info.view_count };
      setCache(url, data);
      res.json(data);
    } catch(e) { logError(url, "Parse error: "+e.message, ip); res.status(500).json({ error:"Failed to parse video info" }); }
  });
});

// ── Playlist info ─────────────────────────────────────────────────────────────
app.get("/api/playlist", (req, res) => {
  const { url } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL is required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Blocked." });
  if (store.settings.maintenanceMode) return res.status(503).json({ error:"Under maintenance." });

  const baseArgs = buildYtdlpBaseArgs().join(" ");
  // Get flat playlist info (no downloading)
  const cmd = `yt-dlp --flat-playlist --dump-json ${baseArgs} "${url}"`;

  exec(cmd, { timeout:60000, maxBuffer:10*1024*1024 }, (err, stdout, stderr) => {
    if (err) { logError(url, stderr?.slice(0,300)||err.message, ip); return res.status(500).json({ error:"Could not fetch playlist. Make sure it's a valid YouTube playlist URL." }); }
    try {
      // Each line is a JSON object
      const lines = stdout.trim().split("\n").filter(Boolean);
      const videos = lines.map(line => {
        try {
          const v = JSON.parse(line);
          return { id:v.id, title:v.title, url:`https://youtube.com/watch?v=${v.id}`, duration:v.duration, thumbnail:v.thumbnail||`https://img.youtube.com/vi/${v.id}/mqdefault.jpg` };
        } catch { return null; }
      }).filter(Boolean);

      if (!videos.length) return res.status(404).json({ error:"No videos found in playlist." });

      res.json({ total:videos.length, videos:videos.slice(0,50) }); // Cap at 50 for safety
    } catch(e) { logError(url, "Playlist parse error: "+e.message, ip); res.status(500).json({ error:"Failed to parse playlist" }); }
  });
});

// ── Download with SSE progress ────────────────────────────────────────────────
app.get("/api/download-progress", (req, res) => {
  const { url, format="mp4", quality="1080", type="video", start, end } = req.query;
  const ip = getIp(req);
  if (!url) { res.status(400).end(); return; }
  if (store.blocked.has(ip)) { res.status(403).end(); return; }
  if (store.settings.maintenanceMode) { res.status(503).end(); return; }
  if (!checkRateLimit(ip)) { res.status(429).end(); return; }
  if (!store.settings.allowedFormats.includes(format)) { res.status(400).end(); return; }
  if (store.activeJobs >= store.settings.maxConcurrent) { res.status(503).end(); return; }

  sseSetup(res);
  store.activeJobs++;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const args = ["--no-playlist", "--newline", "--progress", ...buildYtdlpBaseArgs(), "-o", outputTemplate];
  if (type==="audio") { args.push("-x", "--audio-format", format, "--audio-quality", "0"); }
  else { args.push("-f", `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`, "--merge-output-format", format); }
  if (start && end) args.push("--postprocessor-args", `ffmpeg:-ss ${start} -to ${end}`);
  args.push(url);

  sseSend(res, "status", { message:"Starting download…", percent:0 });
  const startTime = Date.now();
  const ytdlp = spawn("yt-dlp", args);
  let stderr = "";
  ytdlp.stdout.on("data", chunk => {
    const lines = chunk.toString().split("\n");
    lines.forEach(line => {
      const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)(?:\s+ETA\s+(\S+))?/);
      if (match) sseSend(res, "progress", { percent:parseFloat(match[1]), size:match[2], speed:match[3], eta:match[4]||"" });
      if (line.includes("[Merger]")||line.includes("[ffmpeg]")) sseSend(res, "status", { message:"Processing…", percent:99 });
    });
  });
  ytdlp.stderr.on("data", d => { stderr += d.toString(); });
  ytdlp.on("close", code => {
    store.activeJobs = Math.max(0, store.activeJobs-1);
    if (code!==0) { logError(url, stderr?.slice(0,300)||"Exit "+code, ip); sseSend(res,"error",{message:"Download failed."}); res.end(); fs.rmSync(tmpDir,{recursive:true,force:true}); return; }
    const files = fs.readdirSync(tmpDir);
    if (!files.length) { logError(url,"No output",ip); sseSend(res,"error",{message:"No output file."}); res.end(); fs.rmSync(tmpDir,{recursive:true,force:true}); return; }
    const filePath = path.join(tmpDir, files[0]);
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size/1024/1024).toFixed(2);
    const elapsed = ((Date.now()-startTime)/1000).toFixed(1);
    const token = uid();
    pendingFiles.set(token, { filePath, fileName:files[0], tmpDir, expires:Date.now()+5*60*1000 });
    logDownload({ url, format, quality, type, title:files[0].replace(/\.[^.]+$/,""), trimmed:!!(start&&end), trimStart:start, trimEnd:end, sizeMB:parseFloat(sizeMB), elapsedSecs:parseFloat(elapsed), ip, status:"success" });
    sseSend(res, "done", { token, fileName:files[0], sizeMB, elapsed });
    res.end();
  });
  req.on("close", () => { if (ytdlp.exitCode===null) ytdlp.kill(); });
});

// ── Serve file by token ───────────────────────────────────────────────────────
app.get("/api/file/:token", (req, res) => {
  const entry = pendingFiles.get(req.params.token);
  if (!entry || Date.now() > entry.expires) { pendingFiles.delete(req.params.token); return res.status(404).json({ error:"File not found or expired." }); }
  const stat = fs.statSync(entry.filePath);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(entry.fileName)}"`);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Type", "application/octet-stream");
  const stream = fs.createReadStream(entry.filePath);
  stream.pipe(res);
  stream.on("close", () => { pendingFiles.delete(req.params.token); fs.rmSync(entry.tmpDir,{recursive:true,force:true}); });
});

// ── Subtitles download ────────────────────────────────────────────────────────
app.get("/api/subtitles", (req, res) => {
  const { url, lang="en" } = req.query;
  const ip = getIp(req);
  if (!url) return res.status(400).json({ error:"URL required" });
  if (store.blocked.has(ip)) return res.status(403).json({ error:"Blocked." });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kingo-subs-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const baseArgs = buildYtdlpBaseArgs();

  const args = [
    ...baseArgs,
    "--no-playlist",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs", lang,
    "--sub-format", "srt/vtt/best",
    "--skip-download", // Don't download video, just subs
    "-o", outputTemplate,
    url
  ];

  exec(`yt-dlp ${args.join(" ")}`, { timeout:30000 }, (err, stdout, stderr) => {
    const files = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
    const subFile = files.find(f => f.match(/\.(srt|vtt|ass)$/i));

    if (!subFile) {
      fs.rmSync(tmpDir, { recursive:true, force:true });
      logError(url, "No subtitles found for lang: "+lang, ip);
      return res.status(404).json({ error:`No subtitles found for language "${lang}". Try a different language code (e.g. "en", "ar", "fr").` });
    }

    const filePath = path.join(tmpDir, subFile);
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(subFile)}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => fs.rmSync(tmpDir,{recursive:true,force:true}));
  });
});

// ── Available subtitle languages ──────────────────────────────────────────────
app.get("/api/subtitles/langs", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error:"URL required" });
  const baseArgs = buildYtdlpBaseArgs().join(" ");
  const cmd = `yt-dlp --list-subs --no-playlist ${baseArgs} "${url}"`;
  exec(cmd, { timeout:20000 }, (err, stdout) => {
    // Parse language codes from output
    const langs = [];
    const lines = (stdout||"").split("\n");
    let inSection = false;
    lines.forEach(line => {
      if (line.includes("Available subtitles") || line.includes("Available automatic")) inSection = true;
      if (inSection) {
        const match = line.match(/^([a-z]{2,5}(-\w+)?)\s+/);
        if (match && !langs.find(l=>l.code===match[1])) langs.push({ code:match[1], label:match[1].toUpperCase() });
      }
    });
    res.json({ langs: langs.length ? langs : [{ code:"en", label:"EN" }] });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/admin/stats", adminAuth, (req, res) => {
  const now=Date.now(), day=86400000, week=7*day;
  const today=store.downloads.filter(d=>now-new Date(d.timestamp)<day);
  const thisWeek=store.downloads.filter(d=>now-new Date(d.timestamp)<week);
  const byFormat={}, byType={video:0,audio:0};
  store.downloads.forEach(d=>{ byFormat[d.format]=(byFormat[d.format]||0)+1; byType[d.type]=(byType[d.type]||0)+1; });
  const perDay={};
  for(let i=6;i>=0;i--){const d=new Date(now-i*day);perDay[d.toISOString().slice(0,10)]=0;}
  store.downloads.forEach(d=>{const k=d.timestamp.slice(0,10);if(k in perDay)perDay[k]++;});
  const ipCounts={};
  store.downloads.forEach(d=>{ipCounts[d.ip]=(ipCounts[d.ip]||0)+1;});
  const topIPs=Object.entries(ipCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const sizes=store.downloads.filter(d=>d.sizeMB).map(d=>d.sizeMB);
  const avgSize=sizes.length?(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(2):0;
  const totalMB=sizes.reduce((a,b)=>a+b,0).toFixed(0);
  res.json({ totals:{allTime:store.downloads.length,today:today.length,thisWeek:thisWeek.length,errors:store.errors.length,activeJobs:store.activeJobs,blockedIPs:store.blocked.size}, byFormat, byType, perDay, topIPs, avgFileSizeMB:parseFloat(avgSize), totalDataServedMB:parseFloat(totalMB), trimmedDownloads:store.downloads.filter(d=>d.trimmed).length, cachedInfoCount:infoCache.size, uptime:process.uptime(), memoryMB:(process.memoryUsage().rss/1024/1024).toFixed(1) });
});
app.get("/api/admin/downloads", adminAuth, (req,res)=>{
  const{page=1,limit=50,format,type,search}=req.query;
  let list=[...store.downloads];
  if(format)list=list.filter(d=>d.format===format);
  if(type)list=list.filter(d=>d.type===type);
  if(search)list=list.filter(d=>d.title?.toLowerCase().includes(search.toLowerCase())||d.url?.includes(search));
  const start=(page-1)*limit;
  res.json({total:list.length,page:parseInt(page),data:list.slice(start,start+parseInt(limit))});
});
app.get("/api/admin/errors",adminAuth,(req,res)=>{const{page=1,limit=50}=req.query;const start=(page-1)*limit;res.json({total:store.errors.length,data:store.errors.slice(start,start+parseInt(limit))});});
app.delete("/api/admin/errors",adminAuth,(req,res)=>{store.errors=[];res.json({ok:true});});
app.post("/api/admin/block",adminAuth,(req,res)=>{const{ip,action}=req.body;if(!ip)return res.status(400).json({error:"IP required"});if(action==="unblock")store.blocked.delete(ip);else store.blocked.add(ip);res.json({ok:true,blocked:[...store.blocked]});});
app.get("/api/admin/blocked",adminAuth,(req,res)=>res.json({blocked:[...store.blocked]}));
app.patch("/api/admin/settings",adminAuth,(req,res)=>{["maxConcurrent","allowedFormats","maxDuration","rateLimitPerHour","maintenanceMode","bannerMessage"].forEach(k=>{if(k in req.body)store.settings[k]=req.body[k];});res.json({ok:true,settings:store.settings});});
app.get("/api/admin/settings",adminAuth,(req,res)=>res.json(store.settings));
app.delete("/api/admin/cache",adminAuth,(req,res)=>{infoCache.clear();res.json({ok:true});});
app.get("/api/admin/export",adminAuth,(req,res)=>{
  const headers=["id","timestamp","title","url","format","quality","type","trimmed","sizeMB","elapsedSecs","ip","status"];
  const rows=store.downloads.map(d=>headers.map(h=>JSON.stringify(d[h]??'')).join(","));
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=kingo-downloads.csv");
  res.send([headers.join(","),...rows].join("\n"));
});

app.listen(PORT, () => {
  console.log(`✅ Kingo YT Downloader API v3 on http://localhost:${PORT}`);
});
