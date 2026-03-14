import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const themes = {
  dark: {
    bg: "#080810", surface: "#10101c", card: "#16162a", border: "#252540",
    accent: "#7c3aed", accentSoft: "#7c3aed22", accentGlow: "#7c3aed55",
    accent2: "#f59e0b", accent2Soft: "#f59e0b22",
    text: "#f0f0ff", textMuted: "#6b6b9a", textSub: "#9090c0",
    success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
  },
  light: {
    bg: "#f4f4f9", surface: "#ffffff", card: "#fafaff", border: "#e0e0f0",
    accent: "#7c3aed", accentSoft: "#7c3aed15", accentGlow: "#7c3aed33",
    accent2: "#d97706", accent2Soft: "#d9770615",
    text: "#0a0a1a", textMuted: "#9090b0", textSub: "#5a5a7a",
    success: "#059669", warning: "#d97706", danger: "#dc2626",
  },
};

const VIDEO_FORMATS = ["mp4", "mkv", "webm"];
const AUDIO_FORMATS = ["mp3", "aac", "opus", "flac", "wav", "m4a"];
const QUALITY_OPTIONS = {
  video: [
    { label: "4K (2160p)", value: "2160" },
    { label: "2K (1440p)", value: "1440" },
    { label: "Full HD (1080p)", value: "1080" },
    { label: "HD (720p)", value: "720" },
    { label: "SD (480p)", value: "480" },
    { label: "Low (360p)", value: "360" },
    { label: "Mobile (240p)", value: "240" },
  ],
  audio: [
    { label: "Best Quality", value: "0" },
    { label: "320 kbps", value: "320" },
    { label: "192 kbps", value: "192" },
    { label: "128 kbps", value: "128" },
  ],
};
const CRYPTO_WALLETS = [
  { name: "Bitcoin", symbol: "BTC", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", icon: "₿", color: "#f7931a" },
  { name: "Ethereum", symbol: "ETH", address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", icon: "Ξ", color: "#627eea" },
  { name: "USDT (TRC20)", symbol: "USDT", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", icon: "₮", color: "#26a17b" },
  { name: "Solana", symbol: "SOL", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgHkv", icon: "◎", color: "#9945ff" },
];

const toSecs = (h, m, s) => h * 3600 + m * 60 + s;
const fromSecs = (total) => { const t = Math.max(0, Math.round(total)); return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }; };
const fmt = (total) => { const { h, m, s } = fromSecs(total); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
const fmtDiff = (secs) => { const t = Math.round(secs); if (t < 60) return `${t}s`; if (t < 3600) return `${Math.floor(t/60)}m ${t%60}s`; return `${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m`; };

function Spinner({ color, size = 16 }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:`2px solid ${color}33`, borderTop:`2px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />;
}

function CopyButton({ text, theme }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      style={{ background: copied ? theme.success+"22" : theme.accentSoft, border:`1px solid ${copied?theme.success:theme.accent}44`, color: copied?theme.success:theme.accent, borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s", whiteSpace:"nowrap" }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function TimeInput({ value, onChange, max, label, theme, color }) {
  const { h, m, s } = fromSecs(value);
  const update = (field, raw) => {
    const n = Math.max(0, parseInt(raw)||0);
    let nh=h, nm=m, ns=s;
    if (field==="h") nh=n; if (field==="m") nm=Math.min(59,n); if (field==="s") ns=Math.min(59,n);
    onChange(Math.min(max, Math.max(0, toSecs(nh,nm,ns))));
  };
  const cell = (val, field, maxN) => (
    <input type="number" min="0" max={maxN} value={String(val).padStart(2,"0")} onChange={e=>update(field,e.target.value)}
      style={{ width:40, background:"transparent", border:"none", outline:"none", color: color||theme.accent, fontWeight:800, fontSize:20, fontFamily:"monospace", textAlign:"center" }} />
  );
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:theme.textMuted, textTransform:"uppercase", marginBottom:6 }}>{label}</div>
      <div style={{ display:"inline-flex", alignItems:"center", background:theme.surface, border:`1.5px solid ${color||theme.accent}55`, borderRadius:10, padding:"8px 2px", gap:1 }}>
        {cell(h,"h",99)}<span style={{ color:theme.textMuted, fontWeight:700, fontSize:18 }}>:</span>
        {cell(m,"m",59)}<span style={{ color:theme.textMuted, fontWeight:700, fontSize:18 }}>:</span>
        {cell(s,"s",59)}
      </div>
    </div>
  );
}

function TrimTimeline({ duration, startTime, endTime, onChange, theme }) {
  const railRef = useRef(null);
  const dragging = useRef(null);
  const dragStartX = useRef(0);
  const dragStartVals = useRef({ start:0, end:0 });
  const startPct = (startTime / duration) * 100;
  const endPct = (endTime / duration) * 100;

  const startDrag = (handle, clientX) => {
    dragging.current = handle; dragStartX.current = clientX;
    dragStartVals.current = { start: startTime, end: endTime };
  };

  const applyDrag = useCallback((clientX) => {
    if (!dragging.current || !railRef.current) return;
    const { width } = railRef.current.getBoundingClientRect();
    const dt = ((clientX - dragStartX.current) / width) * duration;
    const { start: s0, end: e0 } = dragStartVals.current;
    const MIN = 2;
    if (dragging.current === "start") onChange(Math.max(0, Math.min(e0-MIN, s0+dt)), endTime);
    else if (dragging.current === "end") onChange(startTime, Math.max(s0+MIN, Math.min(duration, e0+dt)));
    else { const span=e0-s0; const ns=Math.max(0,Math.min(duration-span,s0+dt)); onChange(ns,ns+span); }
  }, [duration, startTime, endTime, onChange]);

  useEffect(() => {
    const onMove = (e) => applyDrag(e.clientX ?? e.touches?.[0]?.clientX);
    const onUp = () => { dragging.current = null; };
    const onTouchMove = (e) => { e.preventDefault(); applyDrag(e.touches[0].clientX); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive:false }); window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onUp); };
  }, [applyDrag]);

  const ticks = Array.from({ length: 5 }, (_,i) => ({ pct: (i/4)*100, label: fmt((i/4)*duration) }));
  const handleBase = { position:"absolute", top:"50%", transform:"translate(-50%,-50%)", width:20, height:48, borderRadius:6, border:"2px solid #fff3", cursor:"ew-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" };

  return (
    <div style={{ userSelect:"none" }}>
      <div ref={railRef} style={{ position:"relative", height:60 }}>
        <div style={{ position:"absolute", left:0, right:0, top:"50%", transform:"translateY(-50%)", height:12, borderRadius:100, background:theme.surface, border:`1px solid ${theme.border}` }} />
        <div style={{ position:"absolute", left:0, width:`${startPct}%`, top:"50%", transform:"translateY(-50%)", height:12, background:theme.border+"99", borderRadius:"100px 0 0 100px" }} />
        <div style={{ position:"absolute", right:0, width:`${100-endPct}%`, top:"50%", transform:"translateY(-50%)", height:12, background:theme.border+"99", borderRadius:"0 100px 100px 0" }} />
        <div onMouseDown={e=>{e.preventDefault();startDrag("range",e.clientX);}} onTouchStart={e=>startDrag("range",e.touches[0].clientX)}
          style={{ position:"absolute", left:`${startPct}%`, width:`${endPct-startPct}%`, top:"50%", transform:"translateY(-50%)", height:12, background:`linear-gradient(90deg,${theme.accent},${theme.accent2})`, cursor:"grab", borderRadius:2 }} />
        <div onMouseDown={e=>{e.preventDefault();startDrag("start",e.clientX);}} onTouchStart={e=>startDrag("start",e.touches[0].clientX)}
          style={{ ...handleBase, left:`${startPct}%`, background:theme.success }}>
          <div style={{ width:2, height:18, background:"#fff9", borderRadius:2 }} />
        </div>
        <div onMouseDown={e=>{e.preventDefault();startDrag("end",e.clientX);}} onTouchStart={e=>startDrag("end",e.touches[0].clientX)}
          style={{ ...handleBase, left:`${endPct}%`, background:theme.accent2 }}>
          <div style={{ width:2, height:18, background:"#fff9", borderRadius:2 }} />
        </div>
      </div>
      <div style={{ position:"relative", height:18, marginTop:2 }}>
        {ticks.map((t,i) => <span key={i} style={{ position:"absolute", left:`${t.pct}%`, transform:"translateX(-50%)", fontSize:9, color:theme.textMuted, fontFamily:"monospace", whiteSpace:"nowrap" }}>{t.label}</span>)}
      </div>
    </div>
  );
}

function TrimPanel({ theme, duration, startTime, endTime, onStartChange, onEndChange, enabled, onToggle }) {
  const clipDuration = endTime - startTime;
  return (
    <div style={{ background:theme.card, border:`1px solid ${enabled?theme.accent+"55":theme.border}`, borderRadius:16, padding:20, marginBottom:20, boxShadow:enabled?`0 0 28px ${theme.accent}18`:"none" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:enabled?24:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>✂️</span>
          <div>
            <p style={{ color:theme.text, fontWeight:700, fontSize:14, margin:0 }}>Trim / Crop</p>
            <p style={{ color:theme.textMuted, fontSize:11, margin:0 }}>Download only a portion</p>
          </div>
        </div>
        <div onClick={onToggle} style={{ width:48, height:26, borderRadius:100, background:enabled?theme.accent:theme.border, cursor:"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
          <div style={{ position:"absolute", top:3, left:enabled?25:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.25s" }} />
        </div>
      </div>
      {enabled && (
        <>
          <TrimTimeline duration={duration} startTime={startTime} endTime={endTime} onChange={(s,e)=>{onStartChange(s);onEndChange(e);}} theme={theme} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, gap:8 }}>
            <TimeInput value={startTime} onChange={v=>onStartChange(Math.min(v,endTime-2))} max={endTime-2} label="Start" theme={theme} color={theme.success} />
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:theme.textMuted, textTransform:"uppercase", marginBottom:6 }}>Duration</div>
              <div style={{ display:"inline-block", background:theme.accentSoft, border:`1px solid ${theme.accent}44`, borderRadius:8, padding:"8px 14px", color:theme.accent, fontWeight:800, fontSize:15, fontFamily:"monospace" }}>{fmtDiff(clipDuration)}</div>
            </div>
            <TimeInput value={endTime} onChange={v=>onEndChange(Math.max(v,startTime+2))} max={duration} label="End" theme={theme} color={theme.accent2} />
          </div>
          <div style={{ marginTop:16 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[{label:"First 30s",s:0,e:Math.min(30,duration)},{label:"First 1min",s:0,e:Math.min(60,duration)},{label:"Last 1min",s:Math.max(0,duration-60),e:duration},{label:"Middle",s:duration*0.25,e:duration*0.75},{label:"Full",s:0,e:duration}]
                .filter(p=>p.e-p.s>1).map(p=>(
                <button key={p.label} onClick={()=>{onStartChange(p.s);onEndChange(p.e);}}
                  style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:20, padding:"5px 12px", color:theme.textSub, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop:16, background:theme.surface, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ color:theme.textSub, fontSize:12, flex:1 }}>
              <strong style={{ color:theme.success }}>{fmt(startTime)}</strong>
              <span style={{ color:theme.textMuted }}> → </span>
              <strong style={{ color:theme.accent2 }}>{fmt(endTime)}</strong>
              <span style={{ color:theme.textMuted }}> ({fmtDiff(clipDuration)} of {fmt(duration)})</span>
            </span>
            <span style={{ background:theme.success+"22", color:theme.success, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>-{Math.round(((duration-clipDuration)/duration)*100)}% size</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Download Tab ──────────────────────────────────────────────────────────────
function DownloadTab({ theme, banner }) {
  const [url, setUrl] = useState("");
  const [mediaType, setMediaType] = useState("video");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState(QUALITY_OPTIONS.video[2]);
  const [status, setStatus] = useState("idle");
  const [videoInfo, setVideoInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const formats = mediaType === "video" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const qualities = QUALITY_OPTIONS[mediaType];

  useEffect(() => {
    if (mediaType==="video") { setFormat("mp4"); setQuality(QUALITY_OPTIONS.video[2]); }
    else { setFormat("mp3"); setQuality(QUALITY_OPTIONS.audio[0]); }
  }, [mediaType]);

  const isValidYT = u => /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(u);

  const handleAnalyze = async () => {
    if (!isValidYT(url)) { setErrorMsg("Please enter a valid YouTube URL."); setStatus("error"); return; }
    setStatus("analyzing"); setVideoInfo(null); setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch info");
      setVideoInfo(data);
      setStartTime(0); setEndTime(data.duration || 0);
      setStatus("ready");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  const handleDownload = () => {
    setStatus("downloading");
    const params = new URLSearchParams({
      url, format, quality: quality.value, type: mediaType,
      ...(trimEnabled && { start: fmt(startTime), end: fmt(endTime) }),
    });
    window.location.href = `${API_BASE}/api/download?${params}`;
    setTimeout(() => setStatus("done"), 3000);
  };

  const reset = () => { setUrl(""); setStatus("idle"); setVideoInfo(null); setErrorMsg(""); setTrimEnabled(false); };

  return (
    <div style={{ maxWidth:640, margin:"0 auto", paddingBottom:40 }}>
      {banner && (
        <div style={{ background:theme.accent2Soft, border:`1px solid ${theme.accent2}44`, borderRadius:12, padding:"10px 16px", marginBottom:16, color:theme.accent2, fontSize:13, fontWeight:600 }}>
          📢 {banner}
        </div>
      )}

      <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:16, padding:24, marginBottom:20, boxShadow:`0 4px 40px ${theme.accent}0a` }}>
        <label style={{ display:"block", fontSize:11, fontWeight:800, letterSpacing:2.5, color:theme.accent, marginBottom:12, textTransform:"uppercase" }}>YouTube URL</label>
        <div style={{ display:"flex", gap:10 }}>
          <input value={url} onChange={e=>{setUrl(e.target.value);if(status!=="idle")setStatus("idle");setErrorMsg("");}}
            placeholder="https://youtube.com/watch?v=..."
            onKeyDown={e=>e.key==="Enter"&&handleAnalyze()}
            style={{ flex:1, background:theme.surface, border:`1.5px solid ${status==="error"?theme.danger:theme.border}`, borderRadius:10, padding:"12px 16px", color:theme.text, fontSize:14, fontFamily:"monospace", outline:"none" }} />
          <button onClick={handleAnalyze} disabled={!url||status==="analyzing"}
            style={{ background:status==="analyzing"?theme.accentSoft:theme.accent, border:"none", borderRadius:10, padding:"12px 20px", color:"#fff", fontWeight:700, fontSize:13, cursor:status==="analyzing"?"default":"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap", fontFamily:"inherit", boxShadow:status!=="analyzing"?`0 0 20px ${theme.accentGlow}`:"none" }}>
            {status==="analyzing" ? <><Spinner color={theme.accent}/> Analyzing…</> : "→ Analyze"}
          </button>
        </div>
        {status==="error" && <p style={{ color:theme.danger, fontSize:12, marginTop:8 }}>⚠ {errorMsg}</p>}
      </div>

      {videoInfo && (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:16, padding:20, marginBottom:20, display:"flex", gap:16, alignItems:"flex-start" }}>
          {videoInfo.thumbnail && <img src={videoInfo.thumbnail} alt="thumb" style={{ width:120, height:68, borderRadius:8, objectFit:"cover", flexShrink:0 }} onError={e=>{e.target.style.display="none";}} />}
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ color:theme.text, fontWeight:700, fontSize:15, margin:"0 0 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{videoInfo.title}</p>
            <p style={{ color:theme.textMuted, fontSize:12, margin:"0 0 8px" }}>{videoInfo.channel} · {fmt(videoInfo.duration||0)}</p>
            <span style={{ display:"inline-block", background:theme.success+"22", color:theme.success, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>✓ READY</span>
          </div>
        </div>
      )}

      {videoInfo && (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:16, padding:24, marginBottom:20 }}>
          <div style={{ display:"flex", background:theme.surface, borderRadius:10, padding:4, marginBottom:20, width:"fit-content" }}>
            {["video","audio"].map(t=>(
              <button key={t} onClick={()=>setMediaType(t)}
                style={{ background:mediaType===t?theme.accent:"transparent", border:"none", borderRadius:8, padding:"8px 24px", color:mediaType===t?"#fff":theme.textMuted, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                {t==="video"?"🎬 Video":"🎵 Audio"}
              </button>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:1.5, color:theme.textMuted, marginBottom:8, textTransform:"uppercase" }}>Format</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {formats.map(f=>(
                  <button key={f} onClick={()=>setFormat(f)}
                    style={{ background:format===f?theme.accentSoft:theme.surface, border:`1.5px solid ${format===f?theme.accent:theme.border}`, borderRadius:8, padding:"7px 14px", color:format===f?theme.accent:theme.textSub, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase" }}>.{f}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:1.5, color:theme.textMuted, marginBottom:8, textTransform:"uppercase" }}>Quality</label>
              <select value={quality.value} onChange={e=>setQuality(qualities.find(q=>q.value===e.target.value))}
                style={{ width:"100%", background:theme.surface, border:`1.5px solid ${theme.border}`, borderRadius:8, padding:"10px 14px", color:theme.text, fontSize:13, fontFamily:"inherit", outline:"none" }}>
                {qualities.map(q=><option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {videoInfo && videoInfo.duration > 0 && (status==="ready"||status==="downloading"||status==="done") && (
        <TrimPanel theme={theme} duration={videoInfo.duration} startTime={startTime} endTime={endTime}
          onStartChange={setStartTime} onEndChange={setEndTime} enabled={trimEnabled} onToggle={()=>setTrimEnabled(t=>!t)} />
      )}

      {(status==="ready"||status==="downloading"||status==="done") && (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:16, padding:24 }}>
          {status==="ready" && (
            <button onClick={handleDownload} style={{ width:"100%", background:theme.accent, border:"none", borderRadius:12, padding:16, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit", boxShadow:`0 0 30px ${theme.accentGlow}` }}>
              {trimEnabled?`✂️ DOWNLOAD · ${fmt(startTime)} → ${fmt(endTime)}`:`↓ DOWNLOAD ${format.toUpperCase()} · ${quality.label}`}
            </button>
          )}
          {status==="downloading" && (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <Spinner color={theme.accent} size={24} />
              <p style={{ color:theme.textSub, fontSize:13, marginTop:12 }}>Starting download… check your browser downloads bar</p>
            </div>
          )}
          {status==="done" && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
              <p style={{ color:theme.success, fontWeight:700, fontSize:16, margin:"0 0 4px" }}>Download started!</p>
              <p style={{ color:theme.textMuted, fontSize:13, margin:"0 0 16px" }}>Check your browser's download bar</p>
              <button onClick={reset} style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:10, padding:"10px 24px", color:theme.textSub, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Download Another</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DonateTab({ theme }) {
  const [activeMethod, setActiveMethod] = useState("crypto");
  return (
    <div style={{ maxWidth:560, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>❤️</div>
        <h2 style={{ color:theme.text, fontWeight:800, fontSize:22, margin:"0 0 8px" }}>Support Kingo</h2>
        <p style={{ color:theme.textMuted, fontSize:14, maxWidth:360, margin:"0 auto" }}>Kingo is free forever. A small donation keeps the servers running.</p>
      </div>
      <div style={{ display:"flex", background:theme.surface, borderRadius:12, padding:4, marginBottom:24, gap:4 }}>
        {["crypto","paypal"].map(m=>(
          <button key={m} onClick={()=>setActiveMethod(m)} style={{ flex:1, background:activeMethod===m?theme.accent:"transparent", border:"none", borderRadius:9, padding:10, color:activeMethod===m?"#fff":theme.textMuted, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {m==="crypto"?"₿ Crypto":"🅿 PayPal"}
          </button>
        ))}
      </div>
      {activeMethod==="crypto" && CRYPTO_WALLETS.map(w=>(
        <div key={w.symbol} style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:14, padding:20, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:w.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:w.color, fontWeight:900 }}>{w.icon}</div>
            <div><p style={{ color:theme.text, fontWeight:700, fontSize:15, margin:0 }}>{w.name}</p><p style={{ color:theme.textMuted, fontSize:12, margin:0 }}>{w.symbol}</p></div>
          </div>
          <div style={{ background:theme.surface, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
            <code style={{ color:theme.textSub, fontSize:11, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{w.address}</code>
            <CopyButton text={w.address} theme={theme} />
          </div>
        </div>
      ))}
      {activeMethod==="paypal" && (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:16, padding:32, textAlign:"center" }}>
          <p style={{ color:theme.text, fontWeight:700, fontSize:16, margin:"0 0 8px" }}>PayPal Donation</p>
          <p style={{ color:theme.textMuted, fontSize:13, margin:"0 0 20px" }}>donate@kingo.app</p>
          <a href="https://paypal.me/yourusername" target="_blank" rel="noreferrer"
            style={{ display:"inline-block", background:"#003087", color:"#fff", borderRadius:10, padding:"12px 32px", fontWeight:700, fontSize:14, textDecoration:"none" }}>Donate via PayPal →</a>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ theme, themeMode, setThemeMode }) {
  return (
    <div style={{ maxWidth:540, margin:"0 auto" }}>
      <section style={{ marginBottom:32 }}>
        <h3 style={{ color:theme.textMuted, fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:16 }}>Appearance</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[{id:"dark",label:"Dark",icon:"🌙",desc:"Easy on the eyes"},{id:"light",label:"Light",icon:"☀️",desc:"Bright mode"},{id:"system",label:"System",icon:"⚙️",desc:"Follow device"}].map(o=>(
            <button key={o.id} onClick={()=>setThemeMode(o.id)}
              style={{ background:themeMode===o.id?theme.accentSoft:theme.card, border:`2px solid ${themeMode===o.id?theme.accent:theme.border}`, borderRadius:14, padding:"20px 12px", textAlign:"center", cursor:"pointer", fontFamily:"inherit" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{o.icon}</div>
              <p style={{ color:theme.text, fontWeight:700, fontSize:14, margin:"0 0 2px" }}>{o.label}</p>
              <p style={{ color:theme.textMuted, fontSize:11, margin:0 }}>{o.desc}</p>
            </button>
          ))}
        </div>
      </section>
      <section style={{ marginBottom:32 }}>
        <h3 style={{ color:theme.textMuted, fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:16 }}>About</h3>
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:14, overflow:"hidden" }}>
          {[["App","Kingo YT Downloader"],["Version","2.0.0"],["Backend",API_BASE],["Build","2026.03.08"]].map(([k,v],i,a)=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"14px 20px", borderBottom:i<a.length-1?`1px solid ${theme.border}`:"none", gap:4 }}>
              <span style={{ color:theme.textMuted, fontSize:13 }}>{k}</span>
              <span style={{ color:theme.text, fontWeight:600, fontSize:13, wordBreak:"break-all" }}>{v}</span>
            </div>
          ))}
        </div>
      </section>
      <p style={{ color:theme.textMuted, fontSize:12, textAlign:"center" }}>⚠️ Personal use only. Respect YouTube's ToS.</p>
    </div>
  );
}

export default function App() {
  const [themeMode, setThemeMode] = useState("dark");
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved = themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;
  const theme = themes[resolved];
  const [activeTab, setActiveTab] = useState("download");
  const [banner, setBanner] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/banner`).then(r=>r.json()).then(d=>{ if(d.message) setBanner(d.message); }).catch(()=>{});
  }, []);

  const tabs = [{id:"download",label:"Download",icon:"⬇"},{id:"donate",label:"Donate",icon:"❤"},{id:"settings",label:"Settings",icon:"⚙"}];

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, fontFamily:"system-ui,sans-serif", color:theme.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}`}</style>
      <div style={{ borderBottom:`1px solid ${theme.border}`, background:theme.surface, padding:"14px 24px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${theme.accent},#a855f7)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"#fff", fontWeight:900, boxShadow:`0 0 20px ${theme.accentGlow}` }}>K</div>
        <div>
          <h1 style={{ fontSize:17, fontWeight:800, color:theme.text, margin:0 }}>Kingo <span style={{ color:theme.accent }}>YT</span> Downloader</h1>
          <p style={{ fontSize:10, color:theme.textMuted, margin:0 }}>Fast · Free · Private · ✂️ Trim</p>
        </div>
      </div>
      <div style={{ padding:"28px 24px 100px" }}>
        {activeTab==="download" && <DownloadTab theme={theme} banner={banner} />}
        {activeTab==="donate" && <DonateTab theme={theme} />}
        {activeTab==="settings" && <SettingsTab theme={theme} themeMode={themeMode} setThemeMode={setThemeMode} />}
      </div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.surface, borderTop:`1px solid ${theme.border}`, display:"flex", padding:"8px 0" }}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ flex:1, background:"none", border:"none", cursor:"pointer", padding:"8px 4px", display:"flex", flexDirection:"column", alignItems:"center", gap:4, fontFamily:"inherit" }}>
            <div style={{ width:40, height:32, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:activeTab===tab.id?theme.accentSoft:"transparent", fontSize:18 }}>{tab.icon}</div>
            <span style={{ fontSize:10, fontWeight:700, color:activeTab===tab.id?theme.accent:theme.textMuted, textTransform:"uppercase" }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
