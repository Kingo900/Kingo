import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "";
const AUTH_KEY = "kingo_auth_v1";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap";

const themes = {
  dark: {
    bg:"#06060f",surface:"#0d0d1f",card:"#111128",border:"#1a1a35",borderHover:"#2e2e5a",
    accent:"#6d28d9",accentBright:"#7c3aed",accentSoft:"#7c3aed18",accentGlow:"#7c3aed40",accentText:"#a78bfa",
    accent2:"#f59e0b",accent2Soft:"#f59e0b15",
    text:"#eeeeff",textMuted:"#4a4a7a",textSub:"#7878aa",
    success:"#10b981",successSoft:"#10b98115",warning:"#f59e0b",warningSoft:"#f59e0b15",
    danger:"#ef4444",dangerSoft:"#ef444415",info:"#3b82f6",infoSoft:"#3b82f615",
    glass:"rgba(6,6,15,0.85)",gradientBg:"radial-gradient(ellipse 80% 50% at 50% -20%,#7c3aed1a,transparent)",
  },
  light: {
    bg:"#f4f4fb",surface:"#ffffff",card:"#fafaff",border:"#e4e4f0",borderHover:"#c0c0e0",
    accent:"#6d28d9",accentBright:"#7c3aed",accentSoft:"#7c3aed12",accentGlow:"#7c3aed28",accentText:"#6d28d9",
    accent2:"#d97706",accent2Soft:"#d9770612",
    text:"#09091a",textMuted:"#a0a0c0",textSub:"#6060a0",
    success:"#059669",successSoft:"#05966912",warning:"#d97706",warningSoft:"#d9770612",
    danger:"#dc2626",dangerSoft:"#dc262612",info:"#2563eb",infoSoft:"#2563eb12",
    glass:"rgba(244,244,251,0.88)",gradientBg:"radial-gradient(ellipse 80% 50% at 50% -20%,#7c3aed0e,transparent)",
  },
};

const VIDEO_FORMATS=["mp4","mkv","webm"];
const AUDIO_FORMATS=["mp3","aac","opus","flac","wav","m4a"];
const QUALITY_OPTIONS={
  video:[{label:"4K — 2160p",value:"2160"},{label:"2K — 1440p",value:"1440"},{label:"Full HD — 1080p",value:"1080"},{label:"HD — 720p",value:"720"},{label:"SD — 480p",value:"480"},{label:"Low — 360p",value:"360"}],
  audio:[{label:"Best Quality",value:"0"},{label:"320 kbps",value:"320"},{label:"192 kbps",value:"192"},{label:"128 kbps",value:"128"}],
};
const CRYPTO_WALLETS=[
  {name:"Bitcoin",symbol:"BTC",address:"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",icon:"₿",color:"#f7931a"},
  {name:"Ethereum",symbol:"ETH",address:"0x742d35Cc6634C0532925a3b844Bc454e4438f44e",icon:"Ξ",color:"#627eea"},
  {name:"USDT (TRC20)",symbol:"USDT",address:"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",icon:"₮",color:"#26a17b"},
  {name:"Solana",symbol:"SOL",address:"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgHkv",icon:"◎",color:"#9945ff"},
];
const POPULAR_LANGS=[
  {code:"en",label:"English"},{code:"ar",label:"Arabic"},{code:"fr",label:"French"},
  {code:"es",label:"Spanish"},{code:"de",label:"German"},{code:"it",label:"Italian"},
  {code:"pt",label:"Portuguese"},{code:"ru",label:"Russian"},{code:"ja",label:"Japanese"},
  {code:"zh",label:"Chinese"},{code:"ko",label:"Korean"},{code:"hi",label:"Hindi"},
];

const RECENT_KEY="kingo_Recent_urls",MAX_RECENT=5;
function getRecentURLs(){try{return JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");}catch{return[];}}
function saveRecentURL(url,title,thumbnail){try{const e=getRecentURLs().filter(r=>r.url!==url);localStorage.setItem(RECENT_KEY,JSON.stringify([{url,title,thumbnail,savedAt:Date.now()},...e].slice(0,MAX_RECENT)));}catch{}}
function removeRecentURL(url){try{localStorage.setItem(RECENT_KEY,JSON.stringify(getRecentURLs().filter(r=>r.url!==url)));}catch{}}
const toSecs=(h,m,s)=>h*3600+m*60+s;
const fromSecs=(total)=>{const t=Math.max(0,Math.round(total));return{h:Math.floor(t/3600),m:Math.floor((t%3600)/60),s:t%60};};
const fmt=(total)=>{const{h,m,s}=fromSecs(total);return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;};
function estimateSize(videoInfo,mediaType,qualityValue){
  if(!videoInfo?.duration)return null;
  const dur=videoInfo.duration;
  if(videoInfo.formatSizes){
    const key=mediaType==="audio"?"audio":qualityValue;
    const s=videoInfo.formatSizes[key];
    if(s&&s>0){const mb=s/1024/1024;return mb>=1024?(mb/1024).toFixed(1)+" GB":mb.toFixed(0)+" MB";}
  }
  const kbps=mediaType==="audio"
    ?({0:320,320:320,192:192,128:128}[qualityValue]||192)
    :({2160:25000,1440:12000,1080:5000,720:2500,480:1200,360:700,240:400}[qualityValue]||2500);
  const mb=(kbps*1000/8)*dur/1024/1024;
  return"~"+(mb>=1024?(mb/1024).toFixed(1)+" GB":mb.toFixed(0)+" MB");
}

const CSS=`
@import url('${FONT_LINK}');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--font:'Inter',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;--display:'Inter',system-ui,sans-serif;}
body{font-family:var(--font);-webkit-font-smoothing:antialiased;}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.fade-up{animation:fadeUp 0.35s ease forwards;}
input:focus,textarea:focus,select:focus{outline:none;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#7c3aed44;border-radius:100px;}
::-webkit-scrollbar-thumb:hover{background:#7c3aed80;}
::selection{background:#7c3aed44;color:#fff;}
`;

// ── Micro components ──────────────────────────────────────────────────────────
function Spinner({color,size=15}){return <span style={{display:"inline-block",width:size,height:size,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;}

function CopyBtn({text,t}){
  const[copied,set]=useState(false);
  return<button onClick={()=>{navigator.clipboard.writeText(text);set(true);setTimeout(()=>set(false),2000);}} style={{background:copied?t.successSoft:t.accentSoft,border:`1px solid ${copied?t.success:t.accentBright}44`,color:copied?t.success:t.accentText,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",transition:"all 0.2s"}}>{copied?"✓ Copied":"Copy"}</button>;
}

function Pill({label,color,soft}){return<span style={{background:soft,color,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,letterSpacing:0.4,whiteSpace:"nowrap"}}>{label}</span>;}

function ProgressBar({pct,t}){
  return<div style={{width:"100%",height:5,background:t.border,borderRadius:100,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${t.accentBright},#a855f7)`,borderRadius:100,transition:"width 0.25s ease",boxShadow:`0 0 10px ${t.accentGlow}`}}/>
  </div>;
}

// ── Password Gate ─────────────────────────────────────────────────────────────
function PasswordGate({onAuth,t}){
  const[pw,set]=useState("");const[err,setErr]=useState("");const[shake,setShake]=useState(false);
  const go=()=>{if(pw===APP_PASSWORD){localStorage.setItem(AUTH_KEY,btoa(APP_PASSWORD));onAuth();}else{setErr("Incorrect password");setShake(true);setTimeout(()=>setShake(false),600);}};
  return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font)",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <div style={{position:"absolute",inset:0,background:t.gradientBg,pointerEvents:"none"}}/>
      <div style={{width:360,animation:"fadeUp 0.4s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:68,height:68,borderRadius:18,background:`linear-gradient(135deg,${t.accentBright},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,color:"#fff",fontFamily:"var(--display)",fontWeight:800,margin:"0 auto 16px",boxShadow:`0 0 60px ${t.accentGlow)`}}>K</div>
          <h1 style={{fontFamily:"var(--display)",color:t.text,fontSize:26,fontWeight:800,marginBottom:6}}>Kingo YTDownloader</h1>
          <p style={{color:t.textMuted,fontSize:13}}>Enter your password to continue</p>
        </div>
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:28,boxShadow:`0 20px 80px ${t.accentGlow}`,animation:shake?"shake 0.5s ease":undefined}}>
          <input type="password" value={pw} onChange={e=>{set(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password" autoFocus
            style={{width:"100%",background:t.surface,border:`1.5px solid ${err?t.danger:t.border}`,borderRadius:12,padding:"13px 16px",color:t.text,fontSize:14,fontFamily:"var(--mono)",letterSpacing:2,transition:"border-color 0.2s",marginBottom:err?8:14}}
            onFocus={e=>!err&&(e.target.style.borderColor=t.accentBright)} onBlur={e=>!err&&(e.target.style.borderColor=t.border)}/>
          {err&&<p style={{color:t.danger,fontSize:12,fontWeight:600,marginBottom:12}}>⚠ {err}</p>}
          <button onClick={go} disabled={!pw} style={{width:"100%",background:pw?`linear-gradient(135deg,${t.accentBright},#a855f7)`:"#ffffff0a",border:"none",borderRadius:12,padding:14,color:"#fff",fontWeight:700,fontSize:14,cursor:pw?"pointer":"default",fontFamily:"var(--font)",boxShadow:pw?`0 8px 32px ${t.accentGlow}`:"none",transition:"all 0.2s"}}>Unlock →</button>
        </div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti(){
  const r=useRef(null);
  useEffect(()=>{
    const c=r.current;if(!c)return;const x=c.getContext("2d");c.width=window.innerWidth;c.height=window.innerHeight;
    const p=Array.from({length:120},()=>({x:Math.random()*c.width,y:-20,w:Math.random()*10+4,h:Math.random()*6+3,color:["#7c3aed","#f59e0b","#10b981","#3b82f6","#a855f7","#ec4899"][Math.floor(Math.random()*6)],rot:Math.random()*360,rv:(Math.random()-0.5)*6,vx:(Math.random()-0.5)*3,vy:Math.random()*4+2}));
    let alive=true;
    const go=()=>{if(!alive)return;x.clearRect(0,0,c.width,c.height);p.forEach(q=>{q.x+=q.vx;q.y+=q.vy;q.rot+=q.rv;x.save();x.translate(q.x,q.y);x.rotate(q.rot*Math.PI/180);x.fillStyle=q.color;x.fillRect(-q.w/2,-q.h/2,q.w,q.h);x.restore();});if(p.some(q=>q.y<c.height))requestAnimationFrame(go);};
    go();return()=>{alive=false;};
  },[]);
  return<canvas ref={r} style={{position:"fixed",top:0,left:0,pointerEvents:"none",zIndex:9999}}/>;
}

// ── Speed badge ───────────────────────────────────────────────────────────────
function SpeedBadge({speed,t}){
  if(!speed)return null;
  const m=speed.match(/([\d.]+)(\w+\/s)/);if(!m)return null;
  return<span style={{display:"inline-flex",alignItems:"center",gap:4,background:t.infoSoft,border:`1px solid ${t.info}30`,borderRadius:7,padding:"2px 8px"}}>
    <span style={{color:t.info,fontSize:11,fontWeight:700,fontFamily:"var(--mono)"}}>{parseFloat(m[1]).toFixed(1)}</span>
    <span style={{color:t.textMuted,fontSize:10}}>{m[2]}</span>
    <span style={{color:t.info,fontSize:9}}>↓</span>
  </span>;
}

// ── Queue Item ────────────────────────────────────────────────────────────────
function QueueItem({item,t}){
  const statusColor={idle:t.textMuted,downloading:t.info,done:t.success,error:t.danger}[item.status]||t.textMuted;
  const statusIcon={idle:"⏳",downloading:"⬇",done:"✅",error:"❌"}[item.status]||"⏳";
  const isActive=item.status==="downloading";
  return(
    <div style={{background:t.surface,border:`1px solid ${isActive?t.accentBright+"55":item.status==="done"?t.success+"33":t.border}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,animation:"slideIn 0.3s ease",transition:"all 0.3s",boxShadow:isActive?`0 0 24px ${t.accentGlow}`:"none"}}>
      <span style={{fontSize:18,flexShrink:0}}>{statusIcon}</span>
      <div style={{flex:1,minWidth:0}}>
        <p style={{color:t.text,fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:5}}>{item.title||item.url}</p>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{color:t.textMuted,fontSize:11,fontFamily:"var(--mono)"}}>{item.format?.toUpperCase()}{item.type==="video"&&item.quality!=="0"?` · ${item.quality}p`:""}</span>
          {isActive&&<SpeedBadge speed={item.speed} t={t}/>}
          {isActive&&item.eta&&<span style={{color:t.textMuted,fontSize:11,fontFamily:"var(--mono)"}}>ETA {item.eta}</span>}
          {item.sizeMB&&<span style={{color:t.textMuted,fontSize:11,fontFamily:"var(--mono)"}}>{item.sizeMB} MB</span>}
          {item.status==="done"&&<Pill label="Done" color={t.success} soft={t.successSoft}/>}
          {item.status==="error"&&<span style={{color:t.danger,fontSize:11}}>{item.error}</span>}
        </div>
        {isActive&&<div style={{marginTop:8}}><ProgressBar pct={item.percent||0} t={t}/></div>}
      </div>
      <div style={{flexShrink:0}}>
        {isActive&&<span style={{color:t.accentText,fontSize:13,fontWeight:700,fontFamily:"var(--mono)"}}>{(item.percent||0).toFixed(0)}%</span>}
        {item.status==="done"&&item.token&&(
          <a href={`${API_BASE}/api/file/${item.token}`} download={item.fileName}
            style={{background:`linear-gradient(135deg,${t.success},#34d399)`,border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",fontWeight:700,fontSize:12,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,boxShadow:`0 4px 16px ${t.success}40`,fontFamily:"var(--font)"}}>
            ↓ Save
          </a>
        )}
      </div>
    </div>
  );
}

// ── Recent URLs ───────────────────────────────────────────────────────────────
function RecentURLs({t,onSelect}){
  const[recent,setRecent]=useState([]);const[open,setOpen]=useState(false);
  useEffect(()=>{setRecent(getRecentURLs());},[]);
  const rm=(e,url)=>{e.stopPropagation();removeRecentURL(url);setRecent(getRecentURLs());};
  if(!recent.length)return null;
  return(
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",color:t.textMuted,fontSize:12,cursor:"pointer",fontFamily:"var(--font)",padding:"3px 0",display:"flex",alignItems:"center",gap:8}}>
        🕐 Recent
        <span style={{background:t.accentSoft,color:t.accentText,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20}}>{recent.length}</span>
        <span style={{fontSize:9,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6,animation:"fadeUp 0.2s ease"}}>
        {recent.map(r=>(
          <div key={r.url} onClick={()=>onSelect(r.url)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderHover;e.currentTarget.style.transform="translateX(2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="none";}}>
            {r.thumbnail&&<img src={r.thumbnail} alt="" style={{width:44,height:30,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
            <span style={{color:t.text,fontSize:12,fontWeight:500,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title||r.url}</span>
            <button onClick={e=>rm(e,r.url)} style={{background:"none",border:"none",color:t.textMuted,fontSize:16,cursor:"pointer",padding:"0 4px",borderRadius:4,flexShrink:0,lineHeight:1}}>×</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── Trim Control ──────────────────────────────────────────────────────────────
function TrimControl({duration,trimStart,trimEnd,setTrimStart,setTrimEnd,t}){
  const sp=trimStart/duration*100,ep=trimEnd/duration*100;
  const s=fromSecs(trimStart),e=fromSecs(trimEnd);
  return(
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{color:t.textMuted,fontSize:11,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase"}}>✂ Trim</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{background:t.accentSoft,color:t.accentText,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:8,fontFamily:"var(--mono)"}}>{fmt(trimStart)}</span>
          <span style={{color:t.textMuted,fontSize:10}}>→</span>
          <span style={{background:t.accentSoft,color:t.accentText,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:8,fontFamily:"var(--mono)"}}>{fmt(trimEnd)}</span>
          <span style={{background:t.successSoft,color:t.success,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:8,fontFamily:"var(--mono)"}}>{fmt(trimEnd-trimStart)}</span>
        </div>
      </div>
      <div style={{position:"relative",height:28,display:"flex",alignItems:"center",marginBottom:14}}>
        <div style={{position:"absolute",width:"100%",height:4,background:t.border,borderRadius:100}}>
          <div style={{position:"absolute",left:`${sp}%`,right:`${100-ep}%`,height:"100%",background:`linear-gradient(90deg,${t.accentBright},#a855f7)`,borderRadius:100}}/>
        </div>
        <input type="range" min={0} max={duration} value={trimStart} onChange={e=>setTrimStart(Math.min(+e.target.value,trimEnd-1))} style={{position:"absolute",width:"100%",height:"100%",opacity:0,cursor:"pointer",zIndex:2}}/>
        <input type="range" min={0} max={duration} value={trimEnd} onChange={e=>setTrimEnd(Math.max(+e.target.value,trimStart+1))} style={{position:"absolute",width:"100%",height:"100%",opacity:0,cursor:"pointer",zIndex:3}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Start",s,setTrimStart,0,trimEnd-1],["End",e,setTrimEnd,trimStart+1,duration]].map(([label,time,setter,min,max])=>(
          <div key={label}>
            <div style={{color:t.textMuted,fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>{label}</div>
            <div style={{display:"flex",gap:4}}>
              {[["H",time.h,0,23],["M",time.m,0,59],["S",time.s,0,59]].map(([u,v,mn,mx])=>(
                <div key={u} style={{flex:1}}>
                  <input type="number" value={v} min={mn} max={mx}
                    onChange={ev=>{const n={...time,[u.toLowerCase()]:Math.max(mn,Math.min(mx,parseInt(ev.target.value)||0))};setter(Math.max(min,Math.min(max,toSecs(n.h,n.m,n.s))));}}
                    style={{width:"100%",background:t.card,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 4px",color:t.text,fontSize:12,fontFamily:"var(--mono)",textAlign:"center"}}/>
                  <div style={{color:t.textMuted,fontSize:9,textAlign:"center",marginTop:3}}>{u}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const[authed,setAuthed]=useState(()=>{if(!APP_PASSWORD)return true;try{return atob(localStorage.getItem(AUTH_KEY)||"")===APP_PASSWORD;}catch{return false;}});
  const[themeMode,setThemeMode]=useState(()=>localStorage.getItem("kingo_theme")||"dark");
  const t=themes[themeMode]||themes.dark;
  useEffect(()=>localStorage.setItem("kingo_theme",themeMode),[themeMode]);

  const[tab,setTab]=useState("download");
  const[banner,setBanner]=useState(null);
  const[pwaPrompt,setPwaPrompt]=useState(null);
  const[confetti,setConfetti]=useState(false);

  // Download state
  const[url,setUrl]=useState("");const[dragging,setDragging]=useState(false);
  const[videoInfo,setVideoInfo]=useState(null);const[loadingInfo,setLoadingInfo]=useState(false);const[infoError,setInfoError]=useState("");
  const[format,setFormat]=useState("mp4");const[quality,setQuality]=useState("1080");const[dlType,setDlType]=useState("video");
  const[trimEnabled,setTrimEnabled]=useState(false);const[trimStart,setTrimStart]=useState(0);const[trimEnd,setTrimEnd]=useState(0);
  const[subtitleEnabled,setSubtitleEnabled]=useState(false);const[subLang,setSubLang]=useState("en");

  // Queue
  const[queue,setQueue]=useState([]);
  const queueRef=useRef([]);
  const updateQ=(id,u)=>{queueRef.current=queueRef.current.map(i=>i.id===id?{...i,...u}:i);setQueue([...queueRef.current]);};

  // Playlist
  const[plUrl,setPlUrl]=useState("");const[plInfo,setPlInfo]=useState(null);const[plLoading,setPlLoading]=useState(false);const[plError,setPlError]=useState("");
  const[plSelected,setPlSelected]=useState(new Set());const[plFormat,setPlFormat]=useState("mp4");const[plQuality,setPlQuality]=useState("720");
  const[plDownloading,setPlDownloading]=useState(false);

  // Batch
  const[batchUrls,setBatchUrls]=useState("");const[batchFormat,setBatchFormat]=useState("mp4");const[batchQuality,setBatchQuality]=useState("720");
  const[batchRunning,setBatchRunning]=useState(false);

  useEffect(()=>{fetch(`${API_BASE}/api/banner`).then(r=>r.json()).then(d=>{if(d.message||d.maintenance)setBanner(d);}).catch(()=>{});const h=e=>{e.preventDefault();setPwaPrompt(e);};window.addEventListener("beforeinstallprompt",h);if(window.__pwaPrompt)setPwaPrompt(window.__pwaPrompt);return()=>window.removeEventListener("beforeinstallprompt",h);},[]);

  if(!authed)return<><style>{CSS}</style><PasswordGate onAuth={()=>setAuthed(true)} t={t}/></>;

  const celebrate=()=>{setConfetti(true);setTimeout(()=>setConfetti(false),3500);};

  const fetchInfo=async(inputUrl)=>{
    const u=(inputUrl||url).trim();if(!u)return;
    setLoadingInfo(true);setInfoError("");setVideoInfo(null);setTrimEnabled(false);
    try{
      const res=await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(u)}`);
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Failed");
      setVideoInfo(data);setTrimStart(0);setTrimEnd(data.duration||0);saveRecentURL(u,data.title,data.thumbnail);
    }catch(e){setInfoError(e.message);}
    setLoadingInfo(false);
  };

  const startDownload=useCallback((opts={})=>{
    const dlUrl=opts.url||url;if(!dlUrl)return;
    const dlFormat=opts.format||format;const dlQuality=opts.quality||quality;const dlDlType=opts.type||dlType;
    const id=Math.random().toString(36).slice(2);
    const item={id,url:dlUrl,format:dlFormat,quality:dlQuality,type:dlDlType,status:"downloading",percent:0,speed:"",eta:"",title:videoInfo?.title||dlUrl,token:null,fileName:null,sizeMB:null,error:null};
    queueRef.current=[item,...queueRef.current];setQueue([...queueRef.current]);setTab("queue");
    const params=new URLSearchParams({url:dlUrl,format:dlFormat,quality:dlQuality,type:dlDlType,...(trimEnabled&&!opts.url?{start:fmt(trimStart),end:fmt(trimEnd)}:{})});
    const es=new EventSource(`${API_BASE}/api/download-progress?${params}`);
    es.addEventListener("progress",e=>{const d=JSON.parse(e.data);updateQ(id,{percent:d.percent,speed:d.speed,eta:d.eta});});
    es.addEventListener("status",e=>{const d=JSON.parse(e.data);updateQ(id,{percent:d.percent||queueRef.current.find(i=>i.id===id)?.percent||0});});
    es.addEventListener("done",e=>{const d=JSON.parse(e.data);updateQ(id,{status:"done",percent:100,token:d.token,fileName:d.fileName,sizeMB:d.sizeMB,speed:"",eta:""});es.close();celebrate();});
    es.addEventListener("error",e=>{try{const d=JSON.parse(e.data);updateQ(id,{status:"error",error:d.message});}catch{updateQ(id,{status:"error",error:"Download failed"});}es.close();});
    es.onerror=()=>{updateQ(id,{status:"error",error:"Connection lost"});es.close();};
  },[url,format,quality,dlType,trimEnabled,trimStart,trimEnd,videoInfo]);

  const downloadSubtitle=()=>{if(!url)return;const a=document.createElement("a");a.href=`${API_BASE}/api/subtitles?url=${encodeURIComponent(url)}&lang=${subLang}`;a.click();};

  const fetchPlaylist=async()=>{
    if(!plUrl)return;setPlLoading(true);setPlError("");setPlInfo(null);
    try{const r=await fetch(`${API_BASE}/api/playlist?url=${encodeURIComponent(plUrl)}`);const d=await r.json();if(!r.ok)throw new Error(d.error);setPlInfo(d);setPlSelected(new Set(d.videos.map(v=>v.url)));}
    catch(e){setPlError(e.message);}setPlLoading(false);
  };

  const downloadPlaylist=async()=>{
    const vids=(plInfo?.videos||[]).filter(v=>plSelected.has(v.url));if(!vids.length)return;setPlDownloading(true);
    for(const v of vids){
      const id=Math.random().toString(36).slice(2);
      queueRef.current=[...queueRef.current,{id,url:v.url,format:plFormat,quality:plQuality,type:"video",status:"downloading",percent:0,speed:"",eta:"",title:v.title,token:null,fileName:null,sizeMB:null,error:null}];
      setQueue([...queueRef.current]);
      await new Promise(resolve=>{
        const es=new EventSource(`${API_BASE}/api/download-progress?${new URLSearchParams({url:v.url,format:plFormat,quality:plQuality,type:"video"})}`);
        es.addEventListener("progress",e=>{const d=JSON.parse(e.data);updateQ(id,{percent:d.percent,speed:d.speed,eta:d.eta});});
        es.addEventListener("done",e=>{const d=JSON.parse(e.data);updateQ(id,{status:"done",percent:100,token:d.token,fileName:d.fileName,sizeMB:d.sizeMB});es.close();resolve();});
        es.addEventListener("error",e=>{try{const d=JSON.parse(e.data);updateQ(id,{status:"error",error:d.message});}catch{updateQ(id,{status:"error",error:"Failed"});}es.close();resolve();});
        es.onerror=()=>{updateQ(id,{status:"error",error:"Lost"});es.close();resolve();};
      });
    }
    setPlDownloading(false);celebrate();
  };

  const runBatch=async()=>{
    const urls=batchUrls.split("\n").map(u=>u.trim()).filter(Boolean);if(!urls.length)return;
    setBatchRunning(true);setTab("queue");
    for(const u of urls){
      const id=Math.random().toString(36).slice(2);
      queueRef.current=[...queueRef.current,{id,url:u,format:batchFormat,quality:batchQuality,type:"video",status:"downloading",percent:0,speed:"",eta:"",title:u,token:null,fileName:null,sizeMB:null,error:null}];
      setQueue([...queueRef.current]);
      await new Promise(resolve=>{
        const es=new EventSource(`${API_BASE}/api/download-progress?${new URLSearchParams({url:u,format:batchFormat,quality:batchQuality,type:"video"})}`);
        es.addEventListener("progress",e=>{const d=JSON.parse(e.data);updateQ(id,{percent:d.percent,speed:d.speed,eta:d.eta});});
        es.addEventListener("done",e=>{const d=JSON.parse(e.data);updateQ(id,{status:"done",percent:100,token:d.token,fileName:d.fileName,sizeMB:d.sizeMB});es.close();resolve();});
        es.addEventListener("error",e=>{try{const d=JSON.parse(e.data);updateQ(id,{status:"error",error:d.message});}catch{updateQ(id,{status:"error",error:"Failed"});}es.close();resolve();});
        es.onerror=()=>{updateQ(id,{status:"error",error:"Lost"});es.close();resolve();};
      });
    }
    setBatchRunning(false);celebrate();
  };

  const activeDownloads=queue.filter(i=>i.status==="downloading").length;
  const doneDownloads=queue.filter(i=>i.status==="done").length;

  // Shared input style
  const inputStyle=(extra={})=>({background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px",color:t.text,fontSize:14,fontFamily:"var(--font)",width:"100%",transition:"border-color 0.2s",...extra});
  const selectStyle=(extra={})=>({background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:"11px 14px",color:t.text,fontSize:13,fontFamily:"var(--font)",cursor:"pointer",width:"100%",...extra});
  const btnPrimary=(extra={})=>({background:`linear-gradient(135deg,${t.accentBright},#a855f7)`,border:"none",borderRadius:13,padding:"13px 28px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font)",boxShadow:`0 8px 32px ${t.accentGlow}`,transition:"all 0.2s",...extra});
  const NavBtn=({id,icon,label,badge})=>(
    <button onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:11,border:"none",background:tab===id?t.accentSoft:"transparent",cursor:"pointer",fontFamily:"var(--font)",fontWeight:tab===id?700:500,fontSize:13,color:tab===id?t.accentText:t.textMuted,transition:"all 0.15s",whiteSpace:"nowrap",position:"relative"}}>
      <span>{icon}</span>{label}
      {badge>0&&<span style={{background:tab===id?t.accentBright:t.danger,color:"#fff",fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:20,minWidth:16,textAlign:"center"}}>{badge}</span>}
    </button>
  );

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"var(--font)",color:t.text}}>
      <style>{CSS}</style>
      {confetti&&<Confetti/>}
      <div style={{position:"fixed",inset:0,background:t.gradientBg,pointerEvents:"none",zIndex:0}}/>

      {/* Banner */}
      {banner?.message&&<div style={{background:`linear-gradient(90deg,${t.accentBright},#a855f7)`,padding:"10px 20px",textAlign:"center",fontSize:13,fontWeight:600,color:"#fff",letterSpacing:0.2,position:"relative",zIndex:10}}>{banner.maintenance&&"🔧 "}{banner.message}</div>}

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:100,backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",background:t.glass,borderBottom:`1px solid ${t.border}`}}>
        <div style={{maxWidth:920,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58,gap:12}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${t.accentBright},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--display)",fontWeight:800,fontSize:17,boxShadow:`0 0 20px ${t.accentGlow}`}}>K</div>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1.1}}>
              <span style={{fontFamily:"var(--display)",fontSize:15,fontWeight:800,color:t.text,letterSpacing:-0.3}}>Kingo</span>
              <span style={{fontFamily:"var(--display)",fontSize:10,fontWeight:600,color:t.accentText,letterSpacing:0.5,textTransform:"uppercase"}}>YTDownloader</span>
            </div>
          </div>
          {/* Nav */}
          <nav style={{display:"flex",gap:2,overflowX:"auto"}}>
            <NavBtn id="download" icon="⬇" label="Download"/>
            <NavBtn id="playlist" icon="📋" label="Playlist"/>
            <NavBtn id="batch" icon="📦" label="Batch"/>
            <NavBtn id="queue" icon="⚡" label="Queue" badge={activeDownloads||doneDownloads}/>
            <NavBtn id="donate" icon="💜" label="Donate"/>
          </nav>
          {/* Actions */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {pwaPrompt&&<button onClick={()=>pwaPrompt.prompt()} style={{background:t.accentSoft,border:`1px solid ${t.accentBright}44`,borderRadius:9,padding:"6px 12px",color:t.accentText,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)"}}>+ App</button>}
            <button onClick={()=>setThemeMode(m=>m==="dark"?"light":"dark")} style={{width:36,height:36,borderRadius:9,background:t.surface,border:`1px solid ${t.border}`,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}} title="Toggle theme">
              {themeMode==="dark"?"☀️":"🌙"}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{maxWidth:920,margin:"0 auto",padding:"32px 20px 60px",position:"relative",zIndex:1}}>

        {/* ── DOWNLOAD ── */}
        {tab==="download"&&(
          <div className="fade-up">
            <div style={{textAlign:"center",marginBottom:36}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${t.accentBright},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"#fff",fontFamily:"var(--display)",fontWeight:800,boxShadow:`0 0 30px ${t.accentGlow}`}}>K</div>
                <div style={{textAlign:"left"}}>
                  <h1 style={{fontFamily:"var(--display)",fontSize:clamp(24,4,34),fontWeight:900,color:t.text,letterSpacing:-0.5,lineHeight:1,margin:0}}>Kingo</h1>
                  <p style={{color:t.accentText,fontWeight:700,fontSize:13,letterSpacing:1,textTransform:"uppercase",margin:0}}>YTDownloader</p>
                </div>
              </div>
              <h2 style={{fontFamily:"var(--display)",fontSize:clamp(20,3,28),fontWeight:700,color:t.text,letterSpacing:-0.5,lineHeight:1.3,marginBottom:8}}>
                Download <span style={{background:`linear-gradient(135deg,${t.accentBright},#a855f7)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>YouTube</span> videos instantly
              </h2>
              <p style={{color:t.textMuted,fontSize:14}}>Video · Audio · Playlists · Subtitles · Fast &amp; Free</p>
            </div>

            {/* URL input */}
            <div style={{background:t.card,border:`1px solid ${dragging?t.accentBright:t.border}`,borderRadius:20,padding:22,marginBottom:16,transition:"all 0.2s",boxShadow:dragging?`0 0 40px ${t.accentGlow}`:"none"}}
              onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);const tx=e.dataTransfer.getData("text");if(tx){setUrl(tx);fetchInfo(tx);}}}>
              <RecentURLs t={t} onSelect={u=>{setUrl(u);fetchInfo(u);}}/>
              <div style={{display:"flex",gap:10}}>
                <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste YouTube URL here…" onKeyDown={e=>e.key==="Enter"&&fetchInfo()}
                  style={inputStyle({flex:1})}
                  onFocus={e=>e.target.style.borderColor=t.accentBright} onBlur={e=>e.target.style.borderColor=t.border}/>
                <button onClick={()=>fetchInfo()} disabled={!url||loadingInfo} style={btnPrimary({flexShrink:0,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap",opacity:url&&!loadingInfo?1:0.55})}>
                  {loadingInfo?<><Spinner color="#fff" size={13}/> Analyzing…</>:"→ Analyze"}
                </button>
              </div>
              {dragging&&<p style={{color:t.accentText,fontSize:13,textAlign:"center",marginTop:10,fontWeight:600}}>Drop URL here ↓</p>}
            </div>

            {infoError&&(
              <div style={{background:t.dangerSoft,border:`1px solid ${t.danger}44`,borderRadius:14,padding:"13px 18px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start",animation:"fadeUp 0.3s ease"}}>
                <span>⚠️</span><p style={{color:t.danger,fontSize:13}}>{infoError}</p>
              </div>
            )}

            {videoInfo&&(
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden",animation:"fadeUp 0.3s ease"}}>
                <div style={{display:"flex"}}>
                  {videoInfo.thumbnail&&<img src={videoInfo.thumbnail} alt={videoInfo.title} style={{width:200,objectFit:"cover",flexShrink:0}}/>}
                  <div style={{padding:20,flex:1,minWidth:0}}>
                    <h3 style={{color:t.text,fontWeight:700,fontSize:16,lineHeight:1.4,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{videoInfo.title}</h3>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
                      {videoInfo.channel&&<span style={{color:t.textMuted,fontSize:12}}>📺 {videoInfo.channel}</span>}
                      {videoInfo.duration&&<span style={{color:t.textMuted,fontSize:12,fontFamily:"var(--mono)"}}>⏱ {fmt(videoInfo.duration)}</span>}
                      {videoInfo.view_count&&<span style={{color:t.textMuted,fontSize:12}}>👁 {videoInfo.view_count.toLocaleString()}</span>}
                      {estimateSize(videoInfo,dlType,quality)&&<span style={{color:t.accentText,fontSize:12,fontWeight:700,fontFamily:"var(--mono)"}}>💾 {estimateSize(videoInfo,dlType,quality)}</span>}
                    </div>
                    <a href={videoInfo.thumbnail} download target="_blank" rel="noreferrer"
                      style={{display:"inline-flex",alignItems:"center",gap:6,background:t.accentSoft,border:`1px solid ${t.accentBright}30`,borderRadius:9,padding:"6px 14px",color:t.accentText,fontSize:12,fontWeight:600,textDecoration:"none"}}>
                      🖼 Thumbnail
                    </a>
                  </div>
                </div>

                <div style={{padding:"0 20px 22px",display:"flex",flexDirection:"column",gap:14}}>
                  {/* Type toggle */}
                  <div style={{display:"flex",background:t.surface,borderRadius:12,padding:4,gap:3}}>
                    {[["video","🎬 Video"],["audio","🎵 Audio"]].map(([type,label])=>(
                      <button key={type} onClick={()=>{setDlType(type);setFormat(type==="video"?"mp4":"mp3");}}
                        style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:dlType===type?`linear-gradient(135deg,${t.accentBright},#a855f7)`:"transparent",color:dlType===type?"#fff":t.textMuted,fontWeight:dlType===type?700:500,fontSize:13,cursor:"pointer",fontFamily:"var(--font)",transition:"all 0.2s"}}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div>
                      <div style={{color:t.textMuted,fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>Format</div>
                      <select value={format} onChange={e=>setFormat(e.target.value)} style={selectStyle()}>{(dlType==="video"?VIDEO_FORMATS:AUDIO_FORMATS).map(f=><option key={f} value={f}>.{f.toUpperCase()}</option>)}</select>
                    </div>
                    <div>
                      <div style={{color:t.textMuted,fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>Quality</div>
                      <select value={quality} onChange={e=>setQuality(e.target.value)} style={selectStyle()}>{QUALITY_OPTIONS[dlType].map(o=><option key={o.value} value={o.value}>{o.label}{estimateSize(videoInfo,dlType,o.value)?" · "+estimateSize(videoInfo,dlType,o.value):""}</option>)}</select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {videoInfo.duration>0&&<button onClick={()=>setTrimEnabled(v=>!v)} style={{background:trimEnabled?t.warningSoft:"transparent",border:`1px solid ${trimEnabled?t.warning:t.border}`,borderRadius:10,padding:"8px 16px",color:trimEnabled?t.warning:t.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",transition:"all 0.2s"}}>✂ Trim {trimEnabled?"On":""}</button>}
                    <button onClick={()=>setSubtitleEnabled(v=>!v)} style={{background:subtitleEnabled?t.infoSoft:"transparent",border:`1px solid ${subtitleEnabled?t.info:t.border}`,borderRadius:10,padding:"8px 16px",color:subtitleEnabled?t.info:t.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",transition:"all 0.2s"}}>💬 Subtitles {subtitleEnabled?"On":""}</button>
                  </div>
                  {trimEnabled&&videoInfo.duration>0&&<div style={{animation:"fadeUp 0.3s ease"}}><TrimControl duration={videoInfo.duration} trimStart={trimStart} trimEnd={trimEnd} setTrimStart={setTrimStart} setTrimEnd={setTrimEnd} t={t}/></div>}
                  {subtitleEnabled&&(
                    <div style={{display:"flex",gap:10,animation:"fadeUp 0.2s ease"}}>
                      <select value={subLang} onChange={e=>setSubLang(e.target.value)} style={selectStyle({flex:1})}>{POPULAR_LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select>
                      <button onClick={downloadSubtitle} style={{background:t.infoSoft,border:`1px solid ${t.info}44`,borderRadius:10,padding:"10px 18px",color:t.info,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font)",whiteSpace:"nowrap"}}>↓ .srt</button>
                    </div>
                  )}
                  <button onClick={()=>startDownload()} style={btnPrimary({width:"100%",padding:15,fontSize:15,fontFamily:"var(--display)",letterSpacing:0.3,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4})}>
                    <span>⬇ Download Now</span>
                    {estimateSize(videoInfo,dlType,quality)&&<span style={{fontSize:11,fontWeight:500,opacity:0.8}}>💾 Est. {estimateSize(videoInfo,dlType,quality)}</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QUEUE ── */}
        {tab==="queue"&&(
          <div className="fade-up">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
              <div>
                <h2 style={{fontFamily:"var(--display)",fontSize:24,fontWeight:800,color:t.text,marginBottom:4}}>⚡ Download Queue</h2>
                <p style={{color:t.textMuted,fontSize:13}}>{activeDownloads>0?<><span style={{color:t.info,fontWeight:600}}>{activeDownloads} active</span> · </>:""}{doneDownloads} completed</p>
              </div>
              {queue.length>0&&<button onClick={()=>{queueRef.current=[];setQueue([]);}} style={{background:t.dangerSoft,border:`1px solid ${t.danger}44`,borderRadius:10,padding:"8px 16px",color:t.danger,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)"}}>🗑 Clear</button>}
            </div>
            {queue.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px",color:t.textMuted}}>
                <div style={{fontSize:52,marginBottom:16,opacity:0.3}}>⚡</div>
                <p style={{fontSize:15,fontWeight:600,marginBottom:8}}>Queue is empty</p>
                <p style={{fontSize:13}}>Start a download and it will appear here</p>
                <button onClick={()=>setTab("download")} style={{marginTop:20,background:t.accentSoft,border:`1px solid ${t.accentBright}44`,borderRadius:11,padding:"10px 24px",color:t.accentText,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font)"}}>→ Download</button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {queue.map(item=><QueueItem key={item.id} item={item} t={t}/>)}
              </div>
            )}
          </div>
        )}

        {/* ── PLAYLIST ── */}
        {tab==="playlist"&&(
          <div className="fade-up">
            <h2 style={{fontFamily:"var(--display)",fontSize:24,fontWeight:800,color:t.text,marginBottom:4}}>📋 Playlist Download</h2>
            <p style={{color:t.textMuted,fontSize:13,marginBottom:24}}>Download entire YouTube playlists at once</p>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:22,marginBottom:16}}>
              <div style={{display:"flex",gap:10,marginBottom:14}}>
                <input value={plUrl} onChange={e=>setPlUrl(e.target.value)} placeholder="Paste YouTube playlist URL…" onKeyDown={e=>e.key==="Enter"&&fetchPlaylist()}
                  style={inputStyle({flex:1})} onFocus={e=>e.target.style.borderColor=t.accentBright} onBlur={e=>e.target.style.borderColor=t.border}/>
                <button onClick={fetchPlaylist} disabled={!plUrl||plLoading} style={btnPrimary({flexShrink:0,opacity:!plUrl||plLoading?0.55:1,display:"flex",alignItems:"center",gap:8})}>
                  {plLoading?<><Spinner color="#fff" size={13}/> Loading…</>:"→ Load"}
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <select value={plFormat} onChange={e=>setPlFormat(e.target.value)} style={selectStyle()}>{VIDEO_FORMATS.map(f=><option key={f} value={f}>.{f.toUpperCase()}</option>)}</select>
                <select value={plQuality} onChange={e=>setPlQuality(e.target.value)} style={selectStyle()}>{QUALITY_OPTIONS.video.map(o=><option key={o.value} value={o.value}>{o.label}{estimateSize({duration:300,formatSizes:{}},"video",o.value)?" · ~"+estimateSize({duration:300,formatSizes:{}},"video",o.value)+"/5min":""}</option>)}</select>
              </div>
            </div>
            {plError&&<div style={{background:t.dangerSoft,border:`1px solid ${t.danger}44`,borderRadius:14,padding:14,marginBottom:16,color:t.danger,fontSize:13}}>{plError}</div>}
            {plInfo&&(
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden",animation:"fadeUp 0.3s ease"}}>
                <div style={{padding:"14px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <span style={{color:t.text,fontWeight:700,fontSize:14}}>{plSelected.size} / {plInfo.total} selected</span>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[["All",new Set(plInfo.videos.map(v=>v.url))],["None",new Set()],["First 10",new Set(plInfo.videos.slice(0,10).map(v=>v.url))],["First 25",new Set(plInfo.videos.slice(0,25).map(v=>v.url))]].map(([label,set])=>(
                      <button key={label} onClick={()=>setPlSelected(set)} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",color:t.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)"}}>{label}</button>
                    ))}
                  </div>
                </div>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {plInfo.videos.map((v,i)=>(
                    <div key={v.url} onClick={()=>setPlSelected(s=>{const n=new Set(s);n.has(v.url)?n.delete(v.url):n.add(v.url);return n;})}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",borderBottom:`1px solid ${t.border}44`,cursor:"pointer",background:plSelected.has(v.url)?t.accentSoft:"transparent",transition:"background 0.15s"}}>
                      <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${plSelected.has(v.url)?t.accentBright:t.border}`,background:plSelected.has(v.url)?t.accentBright:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                        {plSelected.has(v.url)&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                      </div>
                      {v.thumbnail&&<img src={v.thumbnail} alt="" style={{width:50,height:34,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{color:t.text,fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</p>
                        {v.duration&&<p style={{color:t.textMuted,fontSize:11,fontFamily:"var(--mono)",marginTop:2}}>{fmt(v.duration)}</p>}
                      </div>
                      <span style={{color:t.textMuted,fontSize:11,flexShrink:0}}>#{i+1}</span>
                    </div>
                  ))}
                </div>
                <div style={{padding:"14px 20px",borderTop:`1px solid ${t.border}`}}>
                  <button onClick={downloadPlaylist} disabled={!plSelected.size||plDownloading} style={btnPrimary({width:"100%",padding:14,opacity:!plSelected.size||plDownloading?0.55:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3})}>
                    {plDownloading?<><Spinner color="#fff" size={13}/> Downloading…</>:`⬇ Download ${plSelected.size} Video${plSelected.size!==1?"s":""}`}
                    {!plDownloading&&plSelected.size>0&&<span style={{fontSize:11,fontWeight:500,opacity:0.8}}>💾 Est. {estimateSize({duration:(plInfo?.videos?.filter(v=>plSelected.has(v.url))?.reduce((s,v)=>s+(v.duration||0),0)||0)/Math.max(plSelected.size,1)*plSelected.size,formatSizes:{}},"video",plQuality)} total</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BATCH ── */}
        {tab==="batch"&&(
          <div className="fade-up">
            <h2 style={{fontFamily:"var(--display)",fontSize:24,fontWeight:800,color:t.text,marginBottom:4}}>📦 Batch Download</h2>
            <p style={{color:t.textMuted,fontSize:13,marginBottom:24}}>Paste multiple YouTube URLs, one per line</p>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:22}}>
              <textarea value={batchUrls} onChange={e=>setBatchUrls(e.target.value)} placeholder={"https://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=..."} rows={6}
                style={{width:"100%",background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"13px 16px",color:t.text,fontSize:13,fontFamily:"var(--mono)",resize:"vertical",lineHeight:1.65,marginBottom:14}}
                onFocus={e=>e.target.style.borderColor=t.accentBright} onBlur={e=>e.target.style.borderColor=t.border}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <select value={batchFormat} onChange={e=>setBatchFormat(e.target.value)} style={selectStyle()}>{VIDEO_FORMATS.map(f=><option key={f} value={f}>.{f.toUpperCase()}</option>)}</select>
                <select value={batchQuality} onChange={e=>setBatchQuality(e.target.value)} style={selectStyle()}>{QUALITY_OPTIONS.video.map(o=><option key={o.value} value={o.value}>{o.label}{estimateSize({duration:300,formatSizes:{}},"video",o.value)?" · ~"+estimateSize({duration:300,formatSizes:{}},"video",o.value)+"/5min":""}</option>)}</select>
              </div>
              <button onClick={runBatch} disabled={!batchUrls.trim()||batchRunning} style={btnPrimary({width:"100%",padding:14,opacity:!batchUrls.trim()||batchRunning?0.55:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3})}>
                {batchRunning?<><Spinner color="#fff" size={13}/> Downloading…</>:`⬇ Download ${batchUrls.split("\n").filter(u=>u.trim()).length} URLs`}
                {!batchRunning&&batchUrls.trim()&&<span style={{fontSize:11,fontWeight:500,opacity:0.8}}>💾 Est. ~{estimateSize({duration:300,formatSizes:{}},"video",batchQuality)} per video</span>}
              </button>
            </div>
          </div>
        )}

        {/* ── DONATE ── */}
        {tab==="donate"&&(
          <div className="fade-up">
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{fontSize:48,marginBottom:12}}>💜</div>
              <h2 style={{fontFamily:"var(--display)",fontSize:28,fontWeight:800,color:t.text,marginBottom:8}}>Support Kingo</h2>
              <p style={{color:t.textMuted,fontSize:14,maxWidth:380,margin:"0 auto"}}>If Kingo saves you time, consider supporting its development with a crypto donation.</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
              {CRYPTO_WALLETS.map(w=>(
                <div key={w.symbol} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:22,transition:"all 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=w.color+"66"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{width:44,height:44,borderRadius:12,background:w.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:w.color,fontWeight:700,border:`1px solid ${w.color}30`}}>{w.icon}</div>
                    <div><p style={{color:t.text,fontWeight:700,fontSize:15}}>{w.name}</p><p style={{color:t.textMuted,fontSize:12,fontFamily:"var(--mono)"}}>{w.symbol}</p></div>
                  </div>
                  <div style={{background:t.surface,borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                    <code style={{color:t.textSub,fontSize:11,fontFamily:"var(--mono)",wordBreak:"break-all",lineHeight:1.6}}>{w.address}</code>
                  </div>
                  <CopyBtn text={w.address} t={t}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer style={{textAlign:"center",padding:"20px",color:t.textMuted,fontSize:12,letterSpacing:0.3,position:"relative",zIndex:1}}>
        <span style={{fontFamily:"var(--display)",fontWeight:800,marginRight:8,color:t.textMuted}}>Kingo</span>Fast · Free · Private
      </footer>
    </div>
  );
}

// Tiny clamp helper
function clamp(min,vw,max){return`clamp(${min}px,${vw}vw,${max}px)`;}
