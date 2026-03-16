import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const themes = {
  dark: {
    bg: "#080810", surface: "#10101c", card: "#16162a", border: "#252540",
    accent: "#7c3aed", accentSoft: "#7c3aed22", accentGlow: "#7c3aed55",
    accent2: "#f59e0b", accent2Soft: "#f59e0b22",
    text: "#f0f0ff", textMuted: "#6b6b9a", textSub: "#9090c0",
    success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
    info: "#3b82f6", infoSoft: "#3b82f618",
  },
  light: {
    bg: "#f4f4f9", surface: "#ffffff", card: "#fafaff", border: "#e0e0f0",
    accent: "#7c3aed", accentSoft: "#7c3aed15", accentGlow: "#7c3aed33",
    accent2: "#d97706", accent2Soft: "#d9770615",
    text: "#0a0a1a", textMuted: "#9090b0", textSub: "#5a5a7a",
    success: "#059669", warning: "#d97706", danger: "#dc2626",
    info: "#2563eb", infoSoft: "#2563eb15",
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
  { name:"Bitcoin", symbol:"BTC", address:"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", icon:"₿", color:"#f7931a" },
  { name:"Ethereum", symbol:"ETH", address:"0x742d35Cc6634C0532925a3b844Bc454e4438f44e", icon:"Ξ", color:"#627eea" },
  { name:"USDT (TRC20)", symbol:"USDT", address:"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", icon:"₮", color:"#26a17b" },
  { name:"Solana", symbol:"SOL", address:"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgHkv", icon:"◎", color:"#9945ff" },
];

const POPULAR_LANGS = [
  { code:"en", label:"English" }, { code:"ar", label:"Arabic" },
  { code:"fr", label:"French" }, { code:"es", label:"Spanish" },
  { code:"de", label:"German" }, { code:"it", label:"Italian" },
  { code:"pt", label:"Portuguese" }, { code:"ru", label:"Russian" },
  { code:"ja", label:"Japanese" }, { code:"zh", label:"Chinese" },
  { code:"ko", label:"Korean" }, { code:"hi", label:"Hindi" },
];

const toSecs = (h,m,s) => h*3600+m*60+s;
const fromSecs = (total) => { const t=Math.max(0,Math.round(total)); return {h:Math.floor(t/3600),m:Math.floor((t%3600)/60),s:t%60}; };
const fmt = (total) => { const {h,m,s}=fromSecs(total); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
const fmtDiff = (secs) => { const t=Math.round(secs); if(t<60) return `${t}s`; if(t<3600) return `${Math.floor(t/60)}m ${t%60}s`; return `${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m`; };

const RECENT_KEY = "kingo_Recent_urls";
const MAX_RECENT = 5;
function getRecentURLs() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)||"[]"); } catch { return []; } }
function saveRecentURL(url,title,thumbnail) { try { const e=getRecentURLs().filter(r=>r.url!==url); localStorage.setItem(RECENT_KEY,JSON.stringify([{url,title,thumbnail,savedAt:Date.now()},...e].slice(0,MAX_RECENT))); } catch {} }
function removeRecentURL(url) { try { localStorage.setItem(RECENT_KEY,JSON.stringify(getRecentURLs().filter(r=>r.url!==url))); } catch {} }

function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    const pieces = Array.from({length:120},()=>({x:Math.random()*canvas.width,y:-20,w:Math.random()*10+5,h:Math.random()*6+3,color:["#7c3aed","#f59e0b","#10b981","#3b82f6","#ef4444","#ec4899"][Math.floor(Math.random()*6)],rot:Math.random()*360,rotV:(Math.random()-0.5)*6,vx:(Math.random()-0.5)*3,vy:Math.random()*4+2}));
    let alive=true;
    const animate=()=>{ if(!alive) return; ctx.clearRect(0,0,canvas.width,canvas.height); pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.rot+=p.rotV;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}); if(pieces.some(p=>p.y<canvas.height)) requestAnimationFrame(animate); };
    animate(); return ()=>{alive=false;};
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,pointerEvents:"none",zIndex:9999}} />;
}

function Spinner({color,size=16}) { return <span style={{display:"inline-block",width:size,height:size,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}} />; }
function CopyButton({text,theme}) {
  const [copied,setCopied]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:copied?theme.success+"22":theme.accentSoft,border:`1px solid ${copied?theme.success:theme.accent}44`,color:copied?theme.success:theme.accent,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",whiteSpace:"nowrap"}}>{copied?"✓ Copied":"Copy"}</button>;
}

function RecentURLs({theme,onSelect}) {
  const [recent,setRecent]=useState([]);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{setRecent(getRecentURLs());},[]);
  const handleRemove=(e,url)=>{e.stopPropagation();removeRecentURL(url);setRecent(getRecentURLs());};
  if(!recent.length) return null;
  return (
    <div style={{marginBottom:8}}>
      <button onClick={()=>setVisible(v=>!v)} style={{background:"none",border:"none",color:theme.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:"4px 0",display:"flex",alignItems:"center",gap:6}}>
        🕐 Recent <span style={{background:theme.accentSoft,color:theme.accent,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:20}}>{recent.length}</span> <span style={{fontSize:10}}>{visible?"▲":"▼"}</span>
      </button>
      {visible && (
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:12,overflow:"hidden",marginTop:8}}>
          {recent.map((r,i)=>(
            <div key={r.url} onClick={()=>{onSelect(r.url);setVisible(false);}}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:i<recent.length-1?`1px solid ${theme.border}`:"none"}}
              onMouseEnter={e=>e.currentTarget.style.background=theme.card}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {r.thumbnail ? <img src={r.thumbnail} alt="" style={{width:48,height:28,borderRadius:4,objectFit:"cover",flexShrink:0}} onError={e=>{e.target.style.display="none";}} />
                : <div style={{width:48,height:28,borderRadius:4,background:theme.card,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>▶</div>}
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:theme.text,fontSize:12,fontWeight:600,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title||r.url}</p>
                <p style={{color:theme.textMuted,fontSize:10,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.url}</p>
              </div>
              <button onClick={e=>handleRemove(e,r.url)} style={{background:"none",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer",padding:"2px 6px",flexShrink:0}}>×</button>
            </div>
          ))}
          <div style={{padding:"8px 14px",borderTop:`1px solid ${theme.border}`}}>
            <button onClick={()=>{localStorage.removeItem(RECENT_KEY);setRecent([]);setVisible(false);}} style={{background:"none",border:"none",color:theme.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑 Clear all</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PWAInstallBanner({theme}) {
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [show,setShow]=useState(false);
  useEffect(()=>{
    if(window.matchMedia("(display-mode: standalone)").matches) return;
    if(localStorage.getItem("kingo_pwa_dismissed")) return;
    if(window.__pwaPrompt){setDeferredPrompt(window.__pwaPrompt);setShow(true);return;}
    const handler=(e)=>{e.preventDefault();window.__pwaPrompt=e;setDeferredPrompt(e);setShow(true);};
    window.addEventListener("beforeinstallprompt",handler);
    return ()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  if(!show) return null;
  return (
    <div style={{background:`linear-gradient(135deg,${theme.accent}22,${theme.accent2}22)`,border:`1px solid ${theme.accent}44`,borderRadius:14,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${theme.accent},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:900,flexShrink:0}}>K</div>
      <div style={{flex:1}}>
        <p style={{color:theme.text,fontWeight:700,fontSize:13,margin:"0 0 2px"}}>Install Kingo on your device</p>
        <p style={{color:theme.textMuted,fontSize:11,margin:0}}>Works like a native app!</p>
      </div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        <button onClick={async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;setShow(false);}} style={{background:theme.accent,border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Install</button>
        <button onClick={()=>{setShow(false);localStorage.setItem("kingo_pwa_dismissed","1");}} style={{background:"none",border:`1px solid ${theme.border}`,borderRadius:8,padding:"8px 10px",color:theme.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>
    </div>
  );
}

function DragOverlay({theme}) {
  return (
    <div style={{position:"fixed",inset:0,background:theme.accent+"33",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
      <div style={{background:theme.card,border:`3px dashed ${theme.accent}`,borderRadius:24,padding:"40px 60px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>🔗</div>
        <p style={{color:theme.accent,fontWeight:800,fontSize:20,margin:0}}>Drop YouTube URL</p>
        <p style={{color:theme.textMuted,fontSize:13,margin:"8px 0 0"}}>Release to analyze</p>
      </div>
    </div>
  );
}

function ProgressBar({percent,speed,eta,status,theme}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color:theme.textSub,fontSize:13}}>{status}</span>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          {speed && <span style={{color:theme.accent2,fontSize:12,fontWeight:600}}>⚡ {speed}</span>}
          {eta && <span style={{color:theme.textMuted,fontSize:12}}>ETA {eta}</span>}
          <span style={{color:theme.accent,fontWeight:800,fontSize:15}}>{Math.round(percent)}%</span>
        </div>
      </div>
      <div style={{background:theme.surface,borderRadius:100,height:8,overflow:"hidden",border:`1px solid ${theme.border}`}}>
        <div style={{width:`${percent}%`,height:"100%",borderRadius:100,background:`linear-gradient(90deg,${theme.accent},${theme.accent2})`,transition:"width 0.3s ease",boxShadow:`0 0 10px ${theme.accentGlow}`}} />
      </div>
      <div style={{marginTop:8,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:theme.textMuted}}>Downloading…</span>
        <span style={{fontSize:10,color:theme.textMuted}}>{percent<99?"Do not close this tab":"Finalizing…"}</span>
      </div>
    </div>
  );
}

function TimeInput({value,onChange,max,label,theme,color}) {
  const {h,m,s}=fromSecs(value);
  const update=(field,raw)=>{const n=Math.max(0,parseInt(raw)||0);let nh=h,nm=m,ns=s;if(field==="h")nh=n;if(field==="m")nm=Math.min(59,n);if(field==="s")ns=Math.min(59,n);onChange(Math.min(max,Math.max(0,toSecs(nh,nm,ns))));};
  const cell=(val,field,maxN)=>(<input type="number" min="0" max={maxN} value={String(val).padStart(2,"0")} onChange={e=>update(field,e.target.value)} style={{width:40,background:"transparent",border:"none",outline:"none",color:color||theme.accent,fontWeight:800,fontSize:20,fontFamily:"monospace",textAlign:"center"}} />);
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:theme.textMuted,textTransform:"uppercase",marginBottom:6}}>{label}</div>
      <div style={{display:"inline-flex",alignItems:"center",background:theme.surface,border:`1.5px solid ${color||theme.accent}55`,borderRadius:10,padding:"8px 2px",gap:1}}>
        {cell(h,"h",99)}<span style={{color:theme.textMuted,fontWeight:700,fontSize:18}}>:</span>
        {cell(m,"m",59)}<span style={{color:theme.textMuted,fontWeight:700,fontSize:18}}>:</span>
        {cell(s,"s",59)}
      </div>
    </div>
  );
}

function TrimTimeline({duration,startTime,endTime,onChange,theme}) {
  const railRef=useRef(null);const dragging=useRef(null);const dragStartX=useRef(0);const dragStartVals=useRef({start:0,end:0});
  const startPct=(startTime/duration)*100;const endPct=(endTime/duration)*100;
  const startDrag=(handle,clientX)=>{dragging.current=handle;dragStartX.current=clientX;dragStartVals.current={start:startTime,end:endTime};};
  const applyDrag=useCallback((clientX)=>{if(!dragging.current||!railRef.current)return;const{width}=railRef.current.getBoundingClientRect();const dt=((clientX-dragStartX.current)/width)*duration;const{start:s0,end:e0}=dragStartVals.current;const MIN=2;if(dragging.current==="start")onChange(Math.max(0,Math.min(e0-MIN,s0+dt)),endTime);else if(dragging.current==="end")onChange(startTime,Math.max(s0+MIN,Math.min(duration,e0+dt)));else{const span=e0-s0;const ns=Math.max(0,Math.min(duration-span,s0+dt));onChange(ns,ns+span);};},[duration,startTime,endTime,onChange]);
  useEffect(()=>{const onMove=(e)=>applyDrag(e.clientX??e.touches?.[0]?.clientX);const onUp=()=>{dragging.current=null;};const onTouchMove=(e)=>{e.preventDefault();applyDrag(e.touches[0].clientX);};window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);window.addEventListener("touchmove",onTouchMove,{passive:false});window.addEventListener("touchend",onUp);return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);window.removeEventListener("touchmove",onTouchMove);window.removeEventListener("touchend",onUp);};},[applyDrag]);
  const ticks=Array.from({length:5},(_,i)=>({pct:(i/4)*100,label:fmt((i/4)*duration)}));
  const handleBase={position:"absolute",top:"50%",transform:"translate(-50%,-50%)",width:20,height:48,borderRadius:6,border:"2px solid #fff3",cursor:"ew-resize",zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none"};
  return (
    <div style={{userSelect:"none"}}>
      <div ref={railRef} style={{position:"relative",height:60}}>
        <div style={{position:"absolute",left:0,right:0,top:"50%",transform:"translateY(-50%)",height:12,borderRadius:100,background:theme.surface,border:`1px solid ${theme.border}`}} />
        <div style={{position:"absolute",left:0,width:`${startPct}%`,top:"50%",transform:"translateY(-50%)",height:12,background:theme.border+"99",borderRadius:"100px 0 0 100px"}} />
        <div style={{position:"absolute",right:0,width:`${100-endPct}%`,top:"50%",transform:"translateY(-50%)",height:12,background:theme.border+"99",borderRadius:"0 100px 100px 0"}} />
        <div onMouseDown={e=>{e.preventDefault();startDrag("range",e.clientX);}} onTouchStart={e=>startDrag("range",e.touches[0].clientX)} style={{position:"absolute",left:`${startPct}%`,width:`${endPct-startPct}%`,top:"50%",transform:"translateY(-50%)",height:12,background:`linear-gradient(90deg,${theme.accent},${theme.accent2})`,cursor:"grab",borderRadius:2}} />
        <div onMouseDown={e=>{e.preventDefault();startDrag("start",e.clientX);}} onTouchStart={e=>startDrag("start",e.touches[0].clientX)} style={{...handleBase,left:`${startPct}%`,background:theme.success}}><div style={{width:2,height:18,background:"#fff9",borderRadius:2}} /></div>
        <div onMouseDown={e=>{e.preventDefault();startDrag("end",e.clientX);}} onTouchStart={e=>startDrag("end",e.touches[0].clientX)} style={{...handleBase,left:`${endPct}%`,background:theme.accent2}}><div style={{width:2,height:18,background:"#fff9",borderRadius:2}} /></div>
      </div>
      <div style={{position:"relative",height:18,marginTop:2}}>{ticks.map((t,i)=><span key={i} style={{position:"absolute",left:`${t.pct}%`,transform:"translateX(-50%)",fontSize:9,color:theme.textMuted,fontFamily:"monospace",whiteSpace:"nowrap"}}>{t.label}</span>)}</div>
    </div>
  );
}

function TrimPanel({theme,duration,startTime,endTime,onStartChange,onEndChange,enabled,onToggle}) {
  const clipDuration=endTime-startTime;
  return (
    <div style={{background:theme.card,border:`1px solid ${enabled?theme.accent+"55":theme.border}`,borderRadius:16,padding:20,marginBottom:20,boxShadow:enabled?`0 0 28px ${theme.accent}18`:"none"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:enabled?24:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>✂️</span>
          <div><p style={{color:theme.text,fontWeight:700,fontSize:14,margin:0}}>Trim / Crop</p><p style={{color:theme.textMuted,fontSize:11,margin:0}}>Download only a portion</p></div>
        </div>
        <div onClick={onToggle} style={{width:48,height:26,borderRadius:100,background:enabled?theme.accent:theme.border,cursor:"pointer",position:"relative",transition:"background 0.3s",flexShrink:0}}>
          <div style={{position:"absolute",top:3,left:enabled?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.25s"}} />
        </div>
      </div>
      {enabled && (<>
        <TrimTimeline duration={duration} startTime={startTime} endTime={endTime} onChange={(s,e)=>{onStartChange(s);onEndChange(e);}} theme={theme} />
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:20,gap:8}}>
          <TimeInput value={startTime} onChange={v=>onStartChange(Math.min(v,endTime-2))} max={endTime-2} label="Start" theme={theme} color={theme.success} />
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:theme.textMuted,textTransform:"uppercase",marginBottom:6}}>Duration</div>
            <div style={{display:"inline-block",background:theme.accentSoft,border:`1px solid ${theme.accent}44`,borderRadius:8,padding:"8px 14px",color:theme.accent,fontWeight:800,fontSize:15,fontFamily:"monospace"}}>{fmtDiff(clipDuration)}</div>
          </div>
          <TimeInput value={endTime} onChange={v=>onEndChange(Math.max(v,startTime+2))} max={duration} label="End" theme={theme} color={theme.accent2} />
        </div>
        <div style={{marginTop:16,display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{label:"First 30s",s:0,e:Math.min(30,duration)},{label:"First 1min",s:0,e:Math.min(60,duration)},{label:"Last 1min",s:Math.max(0,duration-60),e:duration},{label:"Middle",s:duration*0.25,e:duration*0.75},{label:"Full",s:0,e:duration}].filter(p=>p.e-p.s>1).map(p=>(
            <button key={p.label} onClick={()=>{onStartChange(p.s);onEndChange(p.e);}} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:20,padding:"5px 12px",color:theme.textSub,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p.label}</button>
          ))}
        </div>
        <div style={{marginTop:16,background:theme.surface,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{color:theme.textSub,fontSize:12,flex:1}}><strong style={{color:theme.success}}>{fmt(startTime)}</strong><span style={{color:theme.textMuted}}> → </span><strong style={{color:theme.accent2}}>{fmt(endTime)}</strong><span style={{color:theme.textMuted}}> ({fmtDiff(clipDuration)} of {fmt(duration)})</span></span>
          <span style={{background:theme.success+"22",color:theme.success,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20}}>-{Math.round(((duration-clipDuration)/duration)*100)}% size</span>
        </div>
      </>)}
    </div>
  );
}

// ── Subtitles Panel ───────────────────────────────────────────────────────────
function SubtitlesPanel({theme, url, enabled, onToggle}) {
  const [lang, setLang] = useState("en");
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setDownloading(true); setError(""); setDone(false);
    try {
      const res = await fetch(`${API_BASE}/api/subtitles?url=${encodeURIComponent(url)}&lang=${lang}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "No subtitles found");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : `subtitles-${lang}.srt`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch(e) {
      setError(e.message);
    }
    setDownloading(false);
  };

  return (
    <div style={{background:theme.card,border:`1px solid ${enabled?theme.info+"55":theme.border}`,borderRadius:16,padding:20,marginBottom:20,boxShadow:enabled?`0 0 28px ${theme.info}18`:"none"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:enabled?20:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>💬</span>
          <div><p style={{color:theme.text,fontWeight:700,fontSize:14,margin:0}}>Subtitles / Captions</p><p style={{color:theme.textMuted,fontSize:11,margin:0}}>Download .srt subtitle file</p></div>
        </div>
        <div onClick={onToggle} style={{width:48,height:26,borderRadius:100,background:enabled?theme.info:theme.border,cursor:"pointer",position:"relative",transition:"background 0.3s",flexShrink:0}}>
          <div style={{position:"absolute",top:3,left:enabled?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.25s"}} />
        </div>
      </div>

      {enabled && (
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:700,letterSpacing:1.5,color:theme.textMuted,marginBottom:10,textTransform:"uppercase"}}>Language</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {POPULAR_LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                style={{background:lang===l.code?theme.infoSoft:theme.surface,border:`1.5px solid ${lang===l.code?theme.info:theme.border}`,borderRadius:8,padding:"6px 12px",color:lang===l.code?theme.info:theme.textSub,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {l.label}
              </button>
            ))}
          </div>

          {error && <p style={{color:theme.danger,fontSize:12,marginBottom:12}}>⚠ {error}</p>}

          <button onClick={handleDownload} disabled={downloading}
            style={{width:"100%",background:done?theme.success:theme.info,border:"none",borderRadius:10,padding:"12px 16px",color:"#fff",fontWeight:700,fontSize:14,cursor:downloading?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"background 0.2s"}}>
            {downloading ? <><Spinner color="#fff"/> Fetching subtitles…</> : done ? "✅ Downloaded!" : `💬 Download ${POPULAR_LANGS.find(l=>l.code===lang)?.label||lang} Subtitles`}
          </button>
          <p style={{color:theme.textMuted,fontSize:11,marginTop:8,textAlign:"center"}}>Downloads as .srt file — works with VLC, MPC, and most video players</p>
        </div>
      )}
    </div>
  );
}

// ── Playlist Panel ────────────────────────────────────────────────────────────
function PlaylistTab({theme}) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ready | downloading
  const [playlist, setPlaylist] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState(QUALITY_OPTIONS.video[2]);
  const [mediaType, setMediaType] = useState("video");
  const [jobs, setJobs] = useState({}); // videoId -> { status, progress, error }
  const [errorMsg, setErrorMsg] = useState("");

  const isPlaylist = u => u.includes("playlist?list=") || u.includes("&list=");

  const handleLoad = async () => {
    if (!url.trim()) return;
    setStatus("loading"); setPlaylist(null); setErrorMsg(""); setJobs({});
    try {
      const res = await fetch(`${API_BASE}/api/playlist?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load playlist");
      setPlaylist(data);
      setSelected(new Set(data.videos.map(v => v.id)));
      setStatus("ready");
    } catch(e) {
      setErrorMsg(e.message);
      setStatus("idle");
    }
  };

  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => setSelected(new Set(playlist.videos.map(v => v.id)));
  const selectNone = () => setSelected(new Set());

  // Download selected videos one by one
  const handleDownloadAll = async () => {
    const toDownload = playlist.videos.filter(v => selected.has(v.id));
    if (!toDownload.length) return;
    setStatus("downloading");

    for (const video of toDownload) {
      setJobs(j => ({...j, [video.id]: { status:"downloading", progress:0, error:"" }}));

      await new Promise((resolve) => {
        const params = new URLSearchParams({ url:video.url, format, quality:quality.value, type:mediaType });
        const es = new EventSource(`${API_BASE}/api/download-progress?${params}`);

        es.addEventListener("progress", (e) => {
          const d = JSON.parse(e.data);
          setJobs(j => ({...j, [video.id]: { status:"downloading", progress:d.percent, error:"" }}));
        });

        es.addEventListener("done", (e) => {
          const d = JSON.parse(e.data);
          es.close();
          // Trigger file download
          const a = document.createElement("a");
          a.href = `${API_BASE}/api/file/${d.token}`;
          a.click();
          setJobs(j => ({...j, [video.id]: { status:"done", progress:100, error:"" }}));
          // Small delay between downloads
          setTimeout(resolve, 1500);
        });

        es.addEventListener("error", (e) => {
          es.close();
          try { const d = JSON.parse(e.data); setJobs(j => ({...j, [video.id]: { status:"error", progress:0, error:d.message }})); }
          catch { setJobs(j => ({...j, [video.id]: { status:"error", progress:0, error:"Failed" }})); }
          resolve();
        });

        es.onerror = () => { es.close(); setJobs(j => ({...j, [video.id]: { status:"error", progress:0, error:"Connection lost" }})); resolve(); };
      });
    }
    setStatus("ready");
  };

  const formats = mediaType === "video" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const qualities = QUALITY_OPTIONS[mediaType];
  const doneCount = Object.values(jobs).filter(j => j.status === "done").length;
  const totalSelected = selected.size;

  return (
    <div style={{maxWidth:640,margin:"0 auto",paddingBottom:40}}>
      {/* URL Input */}
      <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:24,marginBottom:20}}>
        <label style={{display:"block",fontSize:11,fontWeight:800,letterSpacing:2.5,color:theme.accent,marginBottom:12,textTransform:"uppercase"}}>YouTube Playlist URL</label>
        <div style={{display:"flex",gap:10}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLoad()}
            placeholder="https://youtube.com/playlist?list=..."
            style={{flex:1,background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:10,padding:"12px 16px",color:theme.text,fontSize:14,fontFamily:"monospace",outline:"none"}} />
          <button onClick={handleLoad} disabled={!url||status==="loading"}
            style={{background:status==="loading"?theme.accentSoft:theme.accent,border:"none",borderRadius:10,padding:"12px 20px",color:status==="loading"?theme.accent:"#fff",fontWeight:700,fontSize:13,cursor:status==="loading"?"default":"pointer",display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap",fontFamily:"inherit",boxShadow:status==="idle"?`0 0 20px ${theme.accentGlow}`:"none"}}>
            {status==="loading" ? <><Spinner color={theme.accent}/> Loading…</> : "→ Load"}
          </button>
        </div>
        {errorMsg && <p style={{color:theme.danger,fontSize:12,marginTop:8}}>⚠ {errorMsg}</p>}
        <p style={{color:theme.textMuted,fontSize:11,marginTop:8}}>💡 Paste a YouTube playlist URL to download multiple videos at once</p>
      </div>

      {/* Playlist loaded */}
      {playlist && (
        <>
         {/* Info bar */}
<div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,padding:"14px 20px",marginBottom:16}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:12}}>
    <div>
      <p style={{color:theme.text,fontWeight:700,fontSize:15,margin:"0 0 2px"}}>🎬 Playlist loaded</p>
      <p style={{color:theme.textMuted,fontSize:12,margin:0}}>{playlist.total} videos · <strong style={{color:theme.accent}}>{selected.size} selected</strong></p>
    </div>
    {/* Master checkbox */}
    <div onClick={()=>selected.size===playlist.videos.length?selectNone():selectAll()}
      style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 14px",background:theme.surface,borderRadius:10,border:`1.5px solid ${selected.size===playlist.videos.length?theme.accent:theme.border}`,transition:"all 0.2s"}}>
      <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${selected.size===playlist.videos.length?theme.accent:selected.size>0?theme.accent:theme.border}`,background:selected.size===playlist.videos.length?theme.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",flexShrink:0}}>
        {selected.size===playlist.videos.length && <span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
        {selected.size>0&&selected.size<playlist.videos.length && <span style={{color:theme.accent,fontSize:14,fontWeight:900,lineHeight:1}}>—</span>}
      </div>
      <span style={{color:selected.size===playlist.videos.length?theme.accent:theme.textSub,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
        {selected.size===playlist.videos.length?"Deselect All":"Select All"}
      </span>
    </div>
  </div>

  {/* Quick filter buttons */}
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button onClick={selectAll}
      style={{background:theme.accentSoft,border:`1px solid ${theme.accent}44`,borderRadius:20,padding:"5px 14px",color:theme.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      ✓ All ({playlist.videos.length})
    </button>
    <button onClick={selectNone}
      style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:20,padding:"5px 14px",color:theme.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      ✗ None
    </button>
    <button onClick={()=>setSelected(new Set(playlist.videos.filter((_,i)=>i<10).map(v=>v.id)))}
      style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:20,padding:"5px 14px",color:theme.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      First 10
    </button>
    <button onClick={()=>setSelected(new Set(playlist.videos.filter((_,i)=>i<25).map(v=>v.id)))}
      style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:20,padding:"5px 14px",color:theme.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      First 25
    </button>
    <span style={{marginLeft:"auto",color:theme.textMuted,fontSize:12,display:"flex",alignItems:"center"}}>
      {selected.size} / {playlist.videos.length} selected
    </span>
  </div>
</div>

          {/* Format settings */}
          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,padding:20,marginBottom:16}}>
            <div style={{display:"flex",background:theme.surface,borderRadius:10,padding:4,marginBottom:16,width:"fit-content"}}>
              {["video","audio"].map(t=>(
                <button key={t} onClick={()=>setMediaType(t)} style={{background:mediaType===t?theme.accent:"transparent",border:"none",borderRadius:8,padding:"7px 20px",color:mediaType===t?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  {t==="video"?"🎬 Video":"🎵 Audio"}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:theme.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:1.5}}>Format</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {formats.map(f=>(<button key={f} onClick={()=>setFormat(f)} style={{background:format===f?theme.accentSoft:theme.surface,border:`1.5px solid ${format===f?theme.accent:theme.border}`,borderRadius:8,padding:"6px 12px",color:format===f?theme.accent:theme.textSub,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase"}}>.{f}</button>))}
                </div>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:theme.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:1.5}}>Quality</label>
                <select value={quality.value} onChange={e=>setQuality(qualities.find(q=>q.value===e.target.value))} style={{width:"100%",background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:8,padding:"9px 12px",color:theme.text,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                  {qualities.map(q=><option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Video list */}
          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,overflow:"hidden",marginBottom:16}}>
            {playlist.videos.map((v,i) => {
              const job = jobs[v.id];
              const isSelected = selected.has(v.id);
              return (
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<playlist.videos.length-1?`1px solid ${theme.border}`:"none",background:isSelected?"transparent":theme.surface+"44"}}>
                  {/* Checkbox */}
                  <div onClick={()=>{ if(!job||job.status==="error") toggleSelect(v.id); }}
                    style={{width:20,height:20,borderRadius:5,border:`2px solid ${isSelected?theme.accent:theme.border}`,background:isSelected?theme.accent:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {isSelected && <span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
                  </div>
                  {/* Thumbnail */}
                  <img src={v.thumbnail} alt="" style={{width:60,height:34,borderRadius:4,objectFit:"cover",flexShrink:0}} onError={e=>{e.target.style.display="none";}} />
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{color:theme.text,fontSize:12,fontWeight:600,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</p>
                    {v.duration && <p style={{color:theme.textMuted,fontSize:10,margin:0}}>{fmt(v.duration)}</p>}
                    {/* Progress bar for this video */}
                    {job && job.status==="downloading" && (
                      <div style={{marginTop:4,background:theme.border,borderRadius:100,height:3,overflow:"hidden"}}>
                        <div style={{width:`${job.progress}%`,height:"100%",background:`linear-gradient(90deg,${theme.accent},${theme.accent2})`,transition:"width 0.3s"}} />
                      </div>
                    )}
                  </div>
                  {/* Status badge */}
                  <div style={{flexShrink:0}}>
                    {!job && <span style={{color:theme.textMuted,fontSize:10}}>—</span>}
                    {job?.status==="downloading" && <Spinner color={theme.accent} size={14} />}
                    {job?.status==="done" && <span style={{color:theme.success,fontSize:16}}>✅</span>}
                    {job?.status==="error" && <span style={{color:theme.danger,fontSize:11}} title={job.error}>❌</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Download button */}
          {status !== "downloading" && (
            <button onClick={handleDownloadAll} disabled={!selected.size}
              style={{width:"100%",background:selected.size?theme.accent:theme.border,border:"none",borderRadius:12,padding:16,color:"#fff",fontWeight:800,fontSize:15,cursor:selected.size?"pointer":"default",fontFamily:"inherit",boxShadow:selected.size?`0 0 30px ${theme.accentGlow}`:"none"}}>
              ↓ DOWNLOAD {selected.size} VIDEO{selected.size!==1?"S":""} · {format.toUpperCase()} · {quality.label}
            </button>
          )}

          {status === "downloading" && (
            <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:12,padding:16,textAlign:"center"}}>
              <Spinner color={theme.accent} size={24} />
              <p style={{color:theme.textSub,fontSize:13,marginTop:10}}>Downloading {doneCount} / {totalSelected} videos…</p>
              <p style={{color:theme.textMuted,fontSize:11}}>Do not close this tab</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Batch Download Tab ────────────────────────────────────────────────────────
function BatchTab({theme}) {
  const [urls, setUrls] = useState("");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState(QUALITY_OPTIONS.video[2]);
  const [mediaType, setMediaType] = useState("video");
  const [jobs, setJobs] = useState([]); // [{url, title, status, progress, error}]
  const [running, setRunning] = useState(false);

  const formats = mediaType === "video" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const qualities = QUALITY_OPTIONS[mediaType];

  const parseURLs = () => urls.split("\n").map(u => u.trim()).filter(u => u.length > 0 && u.includes("youtube"));

  const handleStart = async () => {
    const urlList = parseURLs();
    if (!urlList.length) return;
    setRunning(true);

    // Init jobs
    const initialJobs = urlList.map(url => ({ url, title:"", status:"pending", progress:0, error:"" }));
    setJobs(initialJobs);

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i];

      // Fetch title first
      try {
        const infoRes = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(url)}`);
        const info = await infoRes.json();
        setJobs(j => j.map((job,idx) => idx===i ? {...job, title:info.title||url, status:"downloading"} : job));
      } catch {
        setJobs(j => j.map((job,idx) => idx===i ? {...job, title:url, status:"downloading"} : job));
      }

      // Download
      await new Promise((resolve) => {
        const params = new URLSearchParams({ url, format, quality:quality.value, type:mediaType });
        const es = new EventSource(`${API_BASE}/api/download-progress?${params}`);
        es.addEventListener("progress", (e) => {
          const d = JSON.parse(e.data);
          setJobs(j => j.map((job,idx) => idx===i ? {...job, progress:d.percent} : job));
        });
        es.addEventListener("done", (e) => {
          const d = JSON.parse(e.data);
          es.close();
          const a = document.createElement("a");
          a.href = `${API_BASE}/api/file/${d.token}`;
          a.click();
          setJobs(j => j.map((job,idx) => idx===i ? {...job, status:"done", progress:100} : job));
          setTimeout(resolve, 1000);
        });
        es.addEventListener("error", (e) => {
          es.close();
          try { const d = JSON.parse(e.data); setJobs(j => j.map((job,idx) => idx===i ? {...job, status:"error", error:d.message} : job)); }
          catch { setJobs(j => j.map((job,idx) => idx===i ? {...job, status:"error", error:"Failed"} : job)); }
          resolve();
        });
        es.onerror = () => { es.close(); setJobs(j => j.map((job,idx) => idx===i ? {...job, status:"error", error:"Connection lost"} : job)); resolve(); };
      });
    }
    setRunning(false);
  };

  const reset = () => { setUrls(""); setJobs([]); setRunning(false); };
  const urlCount = parseURLs().length;
  const doneCount = jobs.filter(j => j.status==="done").length;

  return (
    <div style={{maxWidth:640,margin:"0 auto",paddingBottom:40}}>
      {jobs.length === 0 ? (
        <>
          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:24,marginBottom:20}}>
            <label style={{display:"block",fontSize:11,fontWeight:800,letterSpacing:2.5,color:theme.accent,marginBottom:12,textTransform:"uppercase"}}>YouTube URLs</label>
            <textarea value={urls} onChange={e=>setUrls(e.target.value)}
              placeholder={"Paste one URL per line:\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/..."}
              rows={6}
              style={{width:"100%",background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:10,padding:"12px 16px",color:theme.text,fontSize:13,fontFamily:"monospace",outline:"none",resize:"vertical",lineHeight:1.6}} />
            <p style={{color:theme.textMuted,fontSize:11,marginTop:8}}>
              {urlCount > 0 ? `✅ ${urlCount} URL${urlCount!==1?"s":""} detected` : "Paste one YouTube URL per line"}
            </p>
          </div>

          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,padding:20,marginBottom:20}}>
            <div style={{display:"flex",background:theme.surface,borderRadius:10,padding:4,marginBottom:16,width:"fit-content"}}>
              {["video","audio"].map(t=>(
                <button key={t} onClick={()=>setMediaType(t)} style={{background:mediaType===t?theme.accent:"transparent",border:"none",borderRadius:8,padding:"7px 20px",color:mediaType===t?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  {t==="video"?"🎬 Video":"🎵 Audio"}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:theme.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:1.5}}>Format</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {formats.map(f=>(<button key={f} onClick={()=>setFormat(f)} style={{background:format===f?theme.accentSoft:theme.surface,border:`1.5px solid ${format===f?theme.accent:theme.border}`,borderRadius:8,padding:"6px 12px",color:format===f?theme.accent:theme.textSub,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase"}}>.{f}</button>))}
                </div>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:theme.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:1.5}}>Quality</label>
                <select value={quality.value} onChange={e=>setQuality(qualities.find(q=>q.value===e.target.value))} style={{width:"100%",background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:8,padding:"9px 12px",color:theme.text,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                  {qualities.map(q=><option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button onClick={handleStart} disabled={!urlCount}
            style={{width:"100%",background:urlCount?theme.accent:theme.border,border:"none",borderRadius:12,padding:16,color:"#fff",fontWeight:800,fontSize:15,cursor:urlCount?"pointer":"default",fontFamily:"inherit",boxShadow:urlCount?`0 0 30px ${theme.accentGlow}`:"none"}}>
            ↓ DOWNLOAD {urlCount} VIDEO{urlCount!==1?"S":""} · {format.toUpperCase()} · {quality.label}
          </button>
        </>
      ) : (
        <div>
          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{color:theme.text,fontWeight:700,fontSize:15,margin:"0 0 2px"}}>
                {running ? `⬇ Downloading…` : `✅ Complete`}
              </p>
              <p style={{color:theme.textMuted,fontSize:12,margin:0}}>{doneCount} of {jobs.length} done</p>
            </div>
            {!running && <button onClick={reset} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:"8px 16px",color:theme.textSub,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>↺ New Batch</button>}
          </div>

          <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,overflow:"hidden"}}>
            {jobs.map((job,i) => (
              <div key={job.url} style={{padding:"14px 16px",borderBottom:i<jobs.length-1?`1px solid ${theme.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:job.status==="downloading"?8:0}}>
                  <div style={{flexShrink:0,width:20,textAlign:"center"}}>
                    {job.status==="pending" && <span style={{color:theme.textMuted,fontSize:12}}>⏳</span>}
                    {job.status==="downloading" && <Spinner color={theme.accent} size={14} />}
                    {job.status==="done" && <span style={{fontSize:14}}>✅</span>}
                    {job.status==="error" && <span style={{fontSize:14}}>❌</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{color:theme.text,fontSize:13,fontWeight:600,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.title||job.url}</p>
                    {job.error && <p style={{color:theme.danger,fontSize:11,margin:"2px 0 0"}}>{job.error}</p>}
                  </div>
                  {job.status==="downloading" && <span style={{color:theme.accent,fontWeight:700,fontSize:12,flexShrink:0}}>{Math.round(job.progress)}%</span>}
                </div>
                {job.status==="downloading" && (
                  <div style={{background:theme.surface,borderRadius:100,height:4,overflow:"hidden",marginLeft:30}}>
                    <div style={{width:`${job.progress}%`,height:"100%",background:`linear-gradient(90deg,${theme.accent},${theme.accent2})`,transition:"width 0.3s",borderRadius:100}} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single Download Tab ───────────────────────────────────────────────────────
function DownloadTab({theme, banner}) {
  const [url, setUrl] = useState("");
  const [mediaType, setMediaType] = useState("video");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState(QUALITY_OPTIONS.video[2]);
  const [status, setStatus] = useState("idle");
  const [videoInfo, setVideoInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [subsEnabled, setSubsEnabled] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [progress, setProgress] = useState({percent:0,speed:"",eta:"",statusMsg:"Starting…"});
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastDownload, setLastDownload] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [thumbDownloading, setThumbDownloading] = useState(false);
  const eventSourceRef = useRef(null);
  const inputRef = useRef(null);

  const formats = mediaType==="video" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const qualities = QUALITY_OPTIONS[mediaType];

  useEffect(()=>{ if(mediaType==="video"){setFormat("mp4");setQuality(QUALITY_OPTIONS.video[2]);} else{setFormat("mp3");setQuality(QUALITY_OPTIONS.audio[0]);} },[mediaType]);

  useEffect(()=>{
    const handler=(e)=>{if(e.key==="Enter"&&status==="idle"&&url)handleAnalyze();if((e.ctrlKey||e.metaKey)&&e.key==="d"&&status==="ready"){e.preventDefault();handleDownload();}};
    window.addEventListener("keydown",handler); return()=>window.removeEventListener("keydown",handler);
  },[status,url]);

  useEffect(()=>{
    const onDragOver=(e)=>{e.preventDefault();if(e.dataTransfer?.types?.includes("text/plain"))setIsDraggingOver(true);};
    const onDragLeave=(e)=>{if(!e.relatedTarget)setIsDraggingOver(false);};
    const onDrop=(e)=>{e.preventDefault();setIsDraggingOver(false);const text=e.dataTransfer.getData("text/plain")||e.dataTransfer.getData("text/uri-list");if(text&&text.includes("youtube")){setUrl(text.trim());setErrorMsg("");setStatus("idle");}};
    window.addEventListener("dragover",onDragOver);window.addEventListener("dragleave",onDragLeave);window.addEventListener("drop",onDrop);
    return()=>{window.removeEventListener("dragover",onDragOver);window.removeEventListener("dragleave",onDragLeave);window.removeEventListener("drop",onDrop);};
  },[]);

  const isValidYT=u=>/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(u);

  const handleAnalyze=async(urlOverride)=>{
    const targetUrl=urlOverride||url;
    if(!isValidYT(targetUrl)){setErrorMsg("Please enter a valid YouTube URL.");setStatus("error");return;}
    if(urlOverride)setUrl(urlOverride);
    setStatus("analyzing");setVideoInfo(null);setErrorMsg("");
    try{
      const res=await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(targetUrl)}`);
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to fetch info");
      setVideoInfo(data);setStartTime(0);setEndTime(data.duration||0);setStatus("ready");
      saveRecentURL(targetUrl,data.title,data.thumbnail);
    }catch(e){setErrorMsg(e.message);setStatus("error");}
  };

  const handleDownloadThumbnail=async()=>{
    if(!videoInfo?.thumbnail)return;setThumbDownloading(true);
    try{const res=await fetch(videoInfo.thumbnail);const blob=await res.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${videoInfo.title?.replace(/[^a-z0-9]/gi,"_")||"thumbnail"}.jpg`;a.click();URL.revokeObjectURL(a.href);}
    catch{window.open(videoInfo.thumbnail,"_blank");}
    setThumbDownloading(false);
  };

  const handleDownload=()=>{
    if(eventSourceRef.current)eventSourceRef.current.close();
    setStatus("downloading");setProgress({percent:0,speed:"",eta:"",statusMsg:"Connecting…"});
    const params=new URLSearchParams({url,format,quality:quality.value,type:mediaType,...(trimEnabled&&{start:fmt(startTime),end:fmt(endTime)})});
    const es=new EventSource(`${API_BASE}/api/download-progress?${params}`);
    eventSourceRef.current=es;
    es.addEventListener("status",(e)=>{const d=JSON.parse(e.data);setProgress(p=>({...p,statusMsg:d.message,percent:d.percent||p.percent}));});
    es.addEventListener("progress",(e)=>{const d=JSON.parse(e.data);setProgress({percent:d.percent,speed:d.speed,eta:d.eta,statusMsg:"Downloading…"});});
    es.addEventListener("done",(e)=>{const d=JSON.parse(e.data);es.close();window.location.href=`${API_BASE}/api/file/${d.token}`;setLastDownload({fileName:d.fileName,sizeMB:d.sizeMB});setStatus("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),4000);});
    es.addEventListener("error",(e)=>{es.close();try{const d=JSON.parse(e.data);setErrorMsg(d.message);}catch{setErrorMsg("Download failed.");}setStatus("error");});
    es.onerror=()=>{es.close();if(status!=="done"){setErrorMsg("Connection lost.");setStatus("error");}};
  };

  const resetDownload=()=>{if(eventSourceRef.current)eventSourceRef.current.close();setStatus("ready");setProgress({percent:0,speed:"",eta:"",statusMsg:"Starting…"});setErrorMsg("");};
  const resetAll=()=>{if(eventSourceRef.current)eventSourceRef.current.close();setUrl("");setStatus("idle");setVideoInfo(null);setErrorMsg("");setTrimEnabled(false);setSubsEnabled(false);setLastDownload(null);setProgress({percent:0,speed:"",eta:"",statusMsg:"Starting…"});};

  return (
    <div style={{maxWidth:640,margin:"0 auto",paddingBottom:40}}>
      {showConfetti && <Confetti />}
      {isDraggingOver && <DragOverlay theme={theme} />}
      <PWAInstallBanner theme={theme} />
      {banner && <div style={{background:theme.accent2Soft,border:`1px solid ${theme.accent2}44`,borderRadius:12,padding:"10px 16px",marginBottom:16,color:theme.accent2,fontSize:13,fontWeight:600}}>📢 {banner}</div>}

      <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:24,marginBottom:20}}>
        <label style={{display:"block",fontSize:11,fontWeight:800,letterSpacing:2.5,color:theme.accent,marginBottom:12,textTransform:"uppercase"}}>YouTube URL</label>
        <RecentURLs theme={theme} onSelect={(u)=>handleAnalyze(u)} />
        <div style={{display:"flex",gap:10}}>
          <input ref={inputRef} value={url} onChange={e=>{setUrl(e.target.value);setErrorMsg("");if(status==="error")setStatus("idle");}}
            placeholder="Paste URL or drag from browser… 🔗"
            onKeyDown={e=>e.key==="Enter"&&status==="idle"&&url&&handleAnalyze()}
            style={{flex:1,background:theme.surface,border:`1.5px solid ${status==="error"?theme.danger:isDraggingOver?theme.accent:theme.border}`,borderRadius:10,padding:"12px 16px",color:theme.text,fontSize:14,fontFamily:"monospace",outline:"none",transition:"border-color 0.2s"}} />
          <button onClick={()=>handleAnalyze()} disabled={!url||status==="analyzing"||status==="downloading"}
            style={{background:status==="analyzing"?theme.accentSoft:theme.accent,border:"none",borderRadius:10,padding:"12px 20px",color:status==="analyzing"?theme.accent:"#fff",fontWeight:700,fontSize:13,cursor:(status==="analyzing"||status==="downloading")?"default":"pointer",display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap",fontFamily:"inherit",boxShadow:status==="idle"?`0 0 20px ${theme.accentGlow}`:"none"}}>
            {status==="analyzing" ? <><Spinner color={theme.accent}/> Analyzing…</> : "→ Analyze"}
          </button>
        </div>
        {status==="error"&&!videoInfo&&<p style={{color:theme.danger,fontSize:12,marginTop:8}}>⚠ {errorMsg}</p>}
        {videoInfo?.cached&&<p style={{color:theme.success,fontSize:11,marginTop:6}}>⚡ Loaded from cache — instant!</p>}
        <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:theme.textMuted}}>⌨️ <kbd style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:3,padding:"1px 4px",fontSize:9}}>Enter</kbd> Analyze</span>
          <span style={{fontSize:10,color:theme.textMuted}}><kbd style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:3,padding:"1px 4px",fontSize:9}}>Ctrl+D</kbd> Download</span>
          <span style={{fontSize:10,color:theme.textMuted}}>🔗 Drag URL here</span>
        </div>
      </div>

      {videoInfo && (
        <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:20,marginBottom:20}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            {videoInfo.thumbnail && (
              <div style={{position:"relative",flexShrink:0}}>
                <img src={videoInfo.thumbnail} alt="thumb" style={{width:120,height:68,borderRadius:8,objectFit:"cover",display:"block"}} onError={e=>{e.target.style.display="none";}} />
                <button onClick={handleDownloadThumbnail} disabled={thumbDownloading} title="Download thumbnail"
                  style={{position:"absolute",bottom:4,right:4,background:"#000a",border:"none",borderRadius:6,padding:"3px 6px",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3}}>
                  {thumbDownloading ? <Spinner color="#fff" size={10}/> : "🖼 Save"}
                </button>
              </div>
            )}
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:theme.text,fontWeight:700,fontSize:15,margin:"0 0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{videoInfo.title}</p>
              <p style={{color:theme.textMuted,fontSize:12,margin:"0 0 8px"}}>{videoInfo.channel} · {fmt(videoInfo.duration||0)}</p>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{display:"inline-block",background:theme.success+"22",color:theme.success,fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:20}}>✓ READY</span>
                {videoInfo.view_count&&<span style={{color:theme.textMuted,fontSize:11}}>👁 {(videoInfo.view_count/1000).toFixed(0)}K views</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {videoInfo && (
        <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:24,marginBottom:20}}>
          <div style={{display:"flex",background:theme.surface,borderRadius:10,padding:4,marginBottom:20,width:"fit-content"}}>
            {["video","audio"].map(t=>(
              <button key={t} onClick={()=>{if(status!=="downloading")setMediaType(t);}} style={{background:mediaType===t?theme.accent:"transparent",border:"none",borderRadius:8,padding:"8px 24px",color:mediaType===t?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:status==="downloading"?"default":"pointer",fontFamily:"inherit"}}>
                {t==="video"?"🎬 Video":"🎵 Audio"}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,letterSpacing:1.5,color:theme.textMuted,marginBottom:8,textTransform:"uppercase"}}>Format</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {formats.map(f=>(<button key={f} onClick={()=>{if(status!=="downloading")setFormat(f);}} style={{background:format===f?theme.accentSoft:theme.surface,border:`1.5px solid ${format===f?theme.accent:theme.border}`,borderRadius:8,padding:"7px 14px",color:format===f?theme.accent:theme.textSub,fontWeight:700,fontSize:12,cursor:status==="downloading"?"default":"pointer",fontFamily:"inherit",textTransform:"uppercase"}}>.{f}</button>))}
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,letterSpacing:1.5,color:theme.textMuted,marginBottom:8,textTransform:"uppercase"}}>Quality</label>
              <select value={quality.value} onChange={e=>{if(status!=="downloading")setQuality(qualities.find(q=>q.value===e.target.value));}} style={{width:"100%",background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:8,padding:"10px 14px",color:theme.text,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                {qualities.map(q=><option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {videoInfo&&videoInfo.duration>0&&status!=="downloading"&&(
        <TrimPanel theme={theme} duration={videoInfo.duration} startTime={startTime} endTime={endTime} onStartChange={setStartTime} onEndChange={setEndTime} enabled={trimEnabled} onToggle={()=>setTrimEnabled(t=>!t)} />
      )}

      {videoInfo&&url&&status!=="downloading"&&(
        <SubtitlesPanel theme={theme} url={url} enabled={subsEnabled} onToggle={()=>setSubsEnabled(t=>!t)} />
      )}

      {videoInfo && (
        <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:24}}>
          {status==="ready"&&(
            <button onClick={handleDownload}
              style={{width:"100%",background:theme.accent,border:"none",borderRadius:12,padding:16,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 0 30px ${theme.accentGlow}`}}
              onMouseDown={e=>e.currentTarget.style.transform="scale(0.98)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
              {trimEnabled?`✂️ DOWNLOAD · ${fmt(startTime)} → ${fmt(endTime)}`:`↓ DOWNLOAD ${format.toUpperCase()} · ${quality.label}`}
              <span style={{display:"block",fontSize:11,fontWeight:500,opacity:0.8,marginTop:3}}>Ctrl+D</span>
            </button>
          )}
          {status==="downloading"&&<ProgressBar percent={progress.percent} speed={progress.speed} eta={progress.eta} status={progress.statusMsg} theme={theme} />}
          {status==="done"&&(
            <div>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:48,marginBottom:8}}>✅</div>
                <p style={{color:theme.success,fontWeight:800,fontSize:18,margin:"0 0 4px"}}>Download Complete!</p>
                {lastDownload&&<p style={{color:theme.textMuted,fontSize:13,margin:"0 0 4px"}}>{lastDownload.fileName} · {lastDownload.sizeMB} MB</p>}
                <p style={{color:theme.textMuted,fontSize:12}}>Check your browser's download bar</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <button onClick={resetDownload} style={{background:theme.accentSoft,border:`1.5px solid ${theme.accent}44`,borderRadius:12,padding:"12px 16px",color:theme.accent,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>↺ Download Again<span style={{display:"block",fontSize:10,fontWeight:400,opacity:0.8,marginTop:2}}>Change settings</span></button>
                <button onClick={resetAll} style={{background:theme.surface,border:`1.5px solid ${theme.border}`,borderRadius:12,padding:"12px 16px",color:theme.textSub,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ New Download<span style={{display:"block",fontSize:10,fontWeight:400,opacity:0.8,marginTop:2}}>Different URL</span></button>
              </div>
            </div>
          )}
          {status==="error"&&videoInfo&&(
            <div style={{textAlign:"center"}}>
              <p style={{color:theme.danger,fontWeight:700,fontSize:15,margin:"0 0 12px"}}>⚠ {errorMsg}</p>
              <button onClick={resetDownload} style={{background:theme.accentSoft,border:`1px solid ${theme.accent}44`,borderRadius:10,padding:"10px 24px",color:theme.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↺ Try Again</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DonateTab({theme}) {
  const [activeMethod,setActiveMethod]=useState("crypto");
  return (
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:32}}><div style={{fontSize:48,marginBottom:12}}>❤️</div><h2 style={{color:theme.text,fontWeight:800,fontSize:22,margin:"0 0 8px"}}>Support Kingo</h2><p style={{color:theme.textMuted,fontSize:14,maxWidth:360,margin:"0 auto"}}>Kingo is free forever. A small donation keeps the servers running.</p></div>
      <div style={{display:"flex",background:theme.surface,borderRadius:12,padding:4,marginBottom:24,gap:4}}>
        {["crypto","paypal"].map(m=>(<button key={m} onClick={()=>setActiveMethod(m)} style={{flex:1,background:activeMethod===m?theme.accent:"transparent",border:"none",borderRadius:9,padding:10,color:activeMethod===m?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{m==="crypto"?"₿ Crypto":"🅿 PayPal"}</button>))}
      </div>
      {activeMethod==="crypto"&&CRYPTO_WALLETS.map(w=>(
        <div key={w.symbol} style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,padding:20,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><div style={{width:40,height:40,borderRadius:10,background:w.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:w.color,fontWeight:900}}>{w.icon}</div><div><p style={{color:theme.text,fontWeight:700,fontSize:15,margin:0}}>{w.name}</p><p style={{color:theme.textMuted,fontSize:12,margin:0}}>{w.symbol}</p></div></div>
          <div style={{background:theme.surface,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><code style={{color:theme.textSub,fontSize:11,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{w.address}</code><CopyButton text={w.address} theme={theme} /></div>
        </div>
      ))}
      {activeMethod==="paypal"&&(<div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:16,padding:32,textAlign:"center"}}><p style={{color:theme.text,fontWeight:700,fontSize:16,margin:"0 0 8px"}}>PayPal Donation</p><p style={{color:theme.textMuted,fontSize:13,margin:"0 0 20px"}}>donate@kingo.app</p><a href="https://paypal.me/yourusername" target="_blank" rel="noreferrer" style={{display:"inline-block",background:"#003087",color:"#fff",borderRadius:10,padding:"12px 32px",fontWeight:700,fontSize:14,textDecoration:"none"}}>Donate via PayPal →</a></div>)}
    </div>
  );
}

function SettingsTab({theme,themeMode,setThemeMode}) {
  return (
    <div style={{maxWidth:540,margin:"0 auto"}}>
      <section style={{marginBottom:32}}>
        <h3 style={{color:theme.textMuted,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>Appearance</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {[{id:"dark",label:"Dark",icon:"🌙",desc:"Easy on the eyes"},{id:"light",label:"Light",icon:"☀️",desc:"Bright mode"},{id:"system",label:"System",icon:"⚙️",desc:"Follow device"}].map(o=>(
            <button key={o.id} onClick={()=>setThemeMode(o.id)} style={{background:themeMode===o.id?theme.accentSoft:theme.card,border:`2px solid ${themeMode===o.id?theme.accent:theme.border}`,borderRadius:14,padding:"20px 12px",textAlign:"center",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{fontSize:28,marginBottom:8}}>{o.icon}</div><p style={{color:theme.text,fontWeight:700,fontSize:14,margin:"0 0 2px"}}>{o.label}</p><p style={{color:theme.textMuted,fontSize:11,margin:0}}>{o.desc}</p>
            </button>
          ))}
        </div>
      </section>
      <section style={{marginBottom:32}}>
        <h3 style={{color:theme.textMuted,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>About</h3>
        <div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:14,overflow:"hidden"}}>
          {[["App","Kingo YT Downloader"],["Version","3.0.0"],["Backend",API_BASE],["Build","2026.03.15"]].map(([k,v],i,a)=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"14px 20px",borderBottom:i<a.length-1?`1px solid ${theme.border}`:"none",gap:4}}><span style={{color:theme.textMuted,fontSize:13}}>{k}</span><span style={{color:theme.text,fontWeight:600,fontSize:13,wordBreak:"break-all"}}>{v}</span></div>
          ))}
        </div>
      </section>
      <p style={{color:theme.textMuted,fontSize:12,textAlign:"center"}}>⚠️ Personal use only. Respect YouTube's ToS.</p>
    </div>
  );
}

export default function App() {
  const [themeMode,setThemeModeRaw]=useState(()=>localStorage.getItem("kingo_theme")||"dark");
  const setThemeMode=(m)=>{setThemeModeRaw(m);localStorage.setItem("kingo_theme",m);};
  const systemDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved=themeMode==="system"?(systemDark?"dark":"light"):themeMode;
  const theme=themes[resolved];
  const [activeTab,setActiveTab]=useState("download");
  const [banner,setBanner]=useState("");

  useEffect(()=>{fetch(`${API_BASE}/api/banner`).then(r=>r.json()).then(d=>{if(d.message)setBanner(d.message);}).catch(()=>{});},[]);

  const tabs=[
    {id:"download",label:"Download",icon:"⬇"},
    {id:"playlist",label:"Playlist",icon:"🎬"},
    {id:"batch",label:"Batch",icon:"📦"},
    {id:"donate",label:"Donate",icon:"❤"},
    {id:"settings",label:"Settings",icon:"⚙"},
  ];

  return (
    <div style={{minHeight:"100vh",background:theme.bg,fontFamily:"system-ui,sans-serif",color:theme.text}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}textarea{box-sizing:border-box}`}</style>
      <div style={{borderBottom:`1px solid ${theme.border}`,background:theme.surface,padding:"14px 24px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}>
        <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${theme.accent},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:900,boxShadow:`0 0 20px ${theme.accentGlow}`}}>K</div>
        <div><h1 style={{fontSize:17,fontWeight:800,color:theme.text,margin:0}}>Kingo <span style={{color:theme.accent}}>YT</span> Downloader</h1><p style={{fontSize:10,color:theme.textMuted,margin:0}}>Fast · Free · Private · ✂️ Trim · 🎬 Playlists</p></div>
      </div>
      <div style={{padding:"28px 24px 100px"}}>
        {activeTab==="download"&&<DownloadTab theme={theme} banner={banner} />}
        {activeTab==="playlist"&&<PlaylistTab theme={theme} />}
        {activeTab==="batch"&&<BatchTab theme={theme} />}
        {activeTab==="donate"&&<DonateTab theme={theme} />}
        {activeTab==="settings"&&<SettingsTab theme={theme} themeMode={themeMode} setThemeMode={setThemeMode} />}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:theme.surface,borderTop:`1px solid ${theme.border}`,display:"flex",padding:"8px 0"}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:"inherit"}}>
            <div style={{width:40,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:activeTab===tab.id?theme.accentSoft:"transparent",fontSize:18}}>{tab.icon}</div>
            <span style={{fontSize:9,fontWeight:700,color:activeTab===tab.id?theme.accent:theme.textMuted,textTransform:"uppercase"}}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
