import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const C = {
  bg:"#07070f", surface:"#0f0f1e", card:"#13132a", border:"#1e1e3a",
  accent:"#7c3aed", accentSoft:"#7c3aed22", accentGlow:"#7c3aed44",
  accent2:"#f59e0b", accent2Soft:"#f59e0b18",
  text:"#e8e8ff", textMuted:"#5a5a8a", textSub:"#8888bb",
  success:"#10b981", successSoft:"#10b98118",
  warning:"#f59e0b", warningSoft:"#f59e0b18",
  danger:"#ef4444", dangerSoft:"#ef444418",
  info:"#3b82f6", infoSoft:"#3b82f618",
};

function Spinner({color=C.accent,size=16}){return <span style={{display:"inline-block",width:size,height:size,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}} />;}
function Card({children,style={}}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:20,...style}}>{children}</div>;}
function Badge({label,color}){return <span style={{background:color+"22",color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,letterSpacing:0.5,whiteSpace:"nowrap"}}>{label}</span>;}

function StatCard({label,value,icon,color,sub}){
  return (
    <Card style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:22}}>{icon}</span>
        <span style={{fontSize:11,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{label}</span>
      </div>
      <div style={{fontSize:32,fontWeight:800,color,fontVariantNumeric:"tabular-nums"}}>{value}</div>
      {sub && <div style={{fontSize:12,color:C.textMuted}}>{sub}</div>}
    </Card>
  );
}

function MiniBarChart({data,color}){
  const entries=Object.entries(data);const max=Math.max(...entries.map(e=>e[1]),1);
  return (
    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60}}>
      {entries.map(([key,val])=>(
        <div key={key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{width:"100%",background:color,borderRadius:4,height:`${(val/max)*52}px`,minHeight:val>0?4:2,opacity:0.85,transition:"height 0.3s"}} />
          <span style={{fontSize:8,color:C.textMuted,whiteSpace:"nowrap"}}>{key.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({data,colors}){
  const entries=Object.entries(data).filter(e=>e[1]>0);
  const total=entries.reduce((s,e)=>s+e[1],0);
  if(!total) return <div style={{color:C.textMuted,fontSize:13}}>No data</div>;
  let offset=0;const r=40,cx=50,cy=50,circumference=2*Math.PI*r;
  return (
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <svg width={100} height={100}>
        {entries.map(([key,val],i)=>{const pct=val/total;const dash=pct*circumference;const gap=circumference-dash;const rotation=offset*360;offset+=pct;return(<circle key={key} cx={cx} cy={cy} r={r} fill="none" stroke={colors[i%colors.length]} strokeWidth={18} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={circumference*0.25-dash*offset+dash} style={{transform:`rotate(${rotation-90}deg)`,transformOrigin:"50px 50px"}} />);})}
        <circle cx={cx} cy={cy} r={28} fill={C.card} /><text x={cx} y={cy+5} textAnchor="middle" fill={C.text} fontSize={12} fontWeight={700}>{total}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {entries.map(([key,val],i)=>(<div key={key} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:2,background:colors[i%colors.length]}} /><span style={{fontSize:12,color:C.textSub}}>{key}</span><span style={{fontSize:12,fontWeight:700,color:C.text,marginLeft:"auto"}}>{val}</span></div>))}
      </div>
    </div>
  );
}

// ── World Map (SVG country dots) ──────────────────────────────────────────────
const COUNTRY_COORDS = {
  US:[39,-98],GB:[55,-3],DE:[51,10],FR:[46,2],CA:[56,-106],AU:[-27,133],IN:[21,78],
  BR:[-15,-47],JP:[36,138],KR:[37,128],CN:[35,105],RU:[60,90],SA:[24,45],AE:[24,54],
  EG:[27,30],TR:[39,35],ID:[-5,120],MX:[23,-102],ES:[40,-4],IT:[42,12],NL:[52,5],
  SE:[62,16],NO:[62,8],PL:[52,20],UA:[49,32],AR:[-34,-64],ZA:[-29,25],NG:[10,8],
  PK:[30,70],BD:[23,90],TH:[15,101],VN:[14,108],MY:[3,112],PH:[13,122],
};

function WorldMap({countryStats}){
  const maxVal = Math.max(...Object.values(countryStats||{}), 1);
  return (
    <div style={{position:"relative",background:C.surface,borderRadius:12,padding:16,overflow:"hidden"}}>
      <svg viewBox="0 0 360 180" style={{width:"100%",height:"auto",opacity:0.8}}>
        <rect width={360} height={180} fill="transparent"/>
        {/* Simple grid */}
        {[30,60,90,120,150].map(y=><line key={y} x1={0} y1={y} x2={360} y2={y} stroke={C.border} strokeWidth={0.5}/>)}
        {[60,120,180,240,300].map(x=><line key={x} x1={x} y1={0} x2={x} y2={180} stroke={C.border} strokeWidth={0.5}/>)}
        {/* Country dots */}
        {Object.entries(countryStats||{}).map(([code,count])=>{
          const coords = COUNTRY_COORDS[code];
          if(!coords) return null;
          const x = (coords[1]+180)/360*360;
          const y = (90-coords[0])/180*180;
          const r = Math.max(3, Math.min(12, (count/maxVal)*12));
          return <circle key={code} cx={x} cy={y} r={r} fill={C.accent} opacity={0.7} title={`${code}: ${count}`}><title>{code}: {count}</title></circle>;
        })}
      </svg>
      {Object.keys(countryStats||{}).length===0 && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMuted,fontSize:13}}>No country data yet</div>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [key,setKey]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const attempt=async()=>{setLoading(true);setError("");try{const res=await fetch(`${API_BASE}/api/admin/stats`,{headers:{"x-admin-key":key}});if(res.ok){onLogin(key);}else{setError("Invalid admin key.");}}catch{setError("Cannot reach backend.");}setLoading(false);};
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{width:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${C.accent},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#fff",fontWeight:900,margin:"0 auto 16px",boxShadow:`0 0 40px ${C.accentGlow}`}}>K</div>
          <h1 style={{color:C.text,fontSize:24,fontWeight:800,margin:"0 0 6px"}}>Kingo Admin</h1>
          <p style={{color:C.textMuted,fontSize:13}}>Enter your admin secret key</p>
        </div>
        <Card>
          <input type="password" value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}
            placeholder="Admin secret key..." autoFocus
            style={{width:"100%",background:C.surface,border:`1.5px solid ${error?C.danger:C.border}`,borderRadius:10,padding:"12px 16px",color:C.text,fontSize:14,fontFamily:"monospace",outline:"none",marginBottom:12}} />
          {error&&<p style={{color:C.danger,fontSize:12,marginBottom:12}}>⚠ {error}</p>}
          <button onClick={attempt} disabled={!key||loading}
            style={{width:"100%",background:C.accent,border:"none",borderRadius:10,padding:13,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 0 20px ${C.accentGlow}`}}>
            {loading?<><Spinner color="#fff"/> Verifying…</>:"→ Enter Admin Panel"}
          </button>
        </Card>
        <p style={{color:C.textMuted,fontSize:11,textAlign:"center",marginTop:16}}>Key is set via <code style={{color:C.accent}}>ADMIN_SECRET</code> env var on Render</p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({stats,onRefresh}){
  if(!stats) return <div style={{display:"flex",alignItems:"center",gap:10,color:C.textMuted}}><Spinner/> Loading…</div>;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <h2 style={{color:C.text,fontWeight:800,fontSize:18,margin:0}}>📊 Dashboard</h2>
        {stats.ytdlpVersion?.current!==stats.ytdlpVersion?.latest&&stats.ytdlpVersion?.latest!=="unknown"&&(
          <div style={{background:C.warningSoft,border:`1px solid ${C.warning}44`,borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>⚠️</span>
            <span style={{color:C.warning,fontSize:12,fontWeight:600}}>yt-dlp update available: {stats.ytdlpVersion?.latest}</span>
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        <StatCard label="All Time" value={stats.totals.allTime} icon="⬇" color={C.accent} sub="Total downloads" />
        <StatCard label="Today" value={stats.totals.today} icon="📅" color={C.success} sub="Downloads today" />
        <StatCard label="This Week" value={stats.totals.thisWeek} icon="📆" color={C.info} sub="Last 7 days" />
        <StatCard label="Errors" value={stats.totals.errors} icon="⚠" color={stats.totals.errors>0?C.danger:C.textMuted} sub="Error count" />
        <StatCard label="Active Jobs" value={stats.totals.activeJobs} icon="⚙" color={C.warning} sub="Running now" />
        <StatCard label="Data Served" value={`${(stats.totalDataServedMB/1024).toFixed(1)} GB`} icon="💾" color={C.accent2} sub={`Avg ${stats.avgFileSizeMB} MB`} />
        <StatCard label="Trimmed" value={stats.trimmedDownloads} icon="✂" color={C.success} sub="Trimmed" />
        <StatCard label="Blocked IPs" value={stats.totals.blockedIPs} icon="🚫" color={C.danger} sub={`${stats.totals.autoBlocked} auto-blocked`} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
        <Card><h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Downloads — Last 7 Days</h3><MiniBarChart data={stats.perDay} color={C.accent} /></Card>
        <Card><h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>By Format</h3><DonutChart data={stats.byFormat} colors={[C.accent,C.accent2,C.success,C.info,C.danger,"#a855f7","#ec4899"]} /></Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card><h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Video vs Audio</h3><DonutChart data={stats.byType} colors={[C.accent,C.success]} /></Card>
        <Card>
          <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Top Users</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {stats.topIPs.slice(0,5).map(([ip,count])=>(
              <div key={ip} style={{display:"flex",alignItems:"center",gap:10}}>
                <code style={{color:C.textSub,fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ip}</code>
                <div style={{background:C.accent+"33",borderRadius:100,height:6,width:60,overflow:"hidden"}}><div style={{background:C.accent,height:"100%",width:`${(count/stats.topIPs[0][1])*100}%`,borderRadius:100}} /></div>
                <span style={{color:C.text,fontWeight:700,fontSize:13,minWidth:20,textAlign:"right"}}>{count}</span>
              </div>
            ))}
            {stats.topIPs.length===0&&<p style={{color:C.textMuted,fontSize:13}}>No downloads yet</p>}
          </div>
        </Card>
      </div>
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>System</h3>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          {[["Uptime",`${Math.floor(stats.uptime/3600)}h ${Math.floor((stats.uptime%3600)/60)}m`],["Memory",`${stats.memoryMB} MB`],["Cache",`${stats.cachedInfoCount} entries`],["yt-dlp",stats.ytdlpVersion?.current||"unknown"]].map(([k,v])=>(
            <div key={k}><div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{k}</div><div style={{fontSize:14,color:C.text,fontWeight:600}}>{v}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Country Analytics ─────────────────────────────────────────────────────────
function CountryAnalytics({adminKey}){
  const [data,setData]=useState(null);
  useEffect(()=>{fetch(`${API_BASE}/api/admin/countries`,{headers:{"x-admin-key":adminKey}}).then(r=>r.json()).then(setData).catch(()=>{});},[adminKey]);
  return (
    <div>
      <h2 style={{color:C.text,fontWeight:800,fontSize:18,marginBottom:20}}>🌍 Country Analytics</h2>
      {!data?<div style={{display:"flex",gap:10,color:C.textMuted}}><Spinner/> Loading…</div>:(
        <>
          <Card style={{marginBottom:16}}>
            <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Geographic Distribution</h3>
            <WorldMap countryStats={Object.fromEntries(data.countries)} />
          </Card>
          <Card>
            <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Top Countries ({data.countries.length} total)</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {data.countries.slice(0,15).map(([country,count],i)=>(
                <div key={country} style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{color:C.textMuted,fontSize:11,width:20,textAlign:"right"}}>{i+1}</span>
                  <span style={{color:C.text,fontWeight:700,fontSize:13,width:40}}>{country}</span>
                  <div style={{flex:1,background:C.surface,borderRadius:100,height:8,overflow:"hidden"}}>
                    <div style={{width:`${(count/data.countries[0][1])*100}%`,height:"100%",background:`linear-gradient(90deg,${C.accent},${C.accent2})`,borderRadius:100,transition:"width 0.5s"}} />
                  </div>
                  <span style={{color:C.text,fontWeight:700,fontSize:13,minWidth:32,textAlign:"right"}}>{count}</span>
                  <span style={{color:C.textMuted,fontSize:11,minWidth:40,textAlign:"right"}}>{((count/data.total)*100).toFixed(1)}%</span>
                </div>
              ))}
              {data.countries.length===0&&<p style={{color:C.textMuted,fontSize:13}}>No country data yet. Downloads will be tracked going forward.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Downloads Log ─────────────────────────────────────────────────────────────
function DownloadsLog({adminKey}){
  const [data,setData]=useState(null);const [search,setSearch]=useState("");const [filterFormat,setFilterFormat]=useState("");const [filterType,setFilterType]=useState("");const [page,setPage]=useState(1);
  const load=useCallback(async()=>{const params=new URLSearchParams({page,limit:50,...(search&&{search}),...(filterFormat&&{format:filterFormat}),...(filterType&&{type:filterType})});const res=await fetch(`${API_BASE}/api/admin/downloads?${params}`,{headers:{"x-admin-key":adminKey}});setData(await res.json());},[adminKey,page,search,filterFormat,filterType]);
  useEffect(()=>{load();},[load]);
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{color:C.text,fontWeight:800,fontSize:18}}>⬇ Downloads Log</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search title/URL…" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"monospace",outline:"none",width:180}} />
          <select value={filterFormat} onChange={e=>{setFilterFormat(e.target.value);setPage(1);}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}}>
            <option value="">All Formats</option>
            {["mp4","mkv","webm","mp3","aac","opus","flac","wav","m4a"].map(f=><option key={f} value={f}>.{f}</option>)}
          </select>
          <select value={filterType} onChange={e=>{setFilterType(e.target.value);setPage(1);}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}}>
            <option value="">All Types</option><option value="video">Video</option><option value="audio">Audio</option>
          </select>
          <button onClick={()=>window.open(`${API_BASE}/api/admin/export?adminKey=${adminKey}`)} style={{background:C.successSoft,border:`1px solid ${C.success}44`,borderRadius:8,padding:"8px 14px",color:C.success,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↓ CSV</button>
          <button onClick={load} style={{background:C.accentSoft,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 14px",color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↺</button>
        </div>
      </div>
      {!data?<div style={{display:"flex",gap:10,color:C.textMuted,padding:20}}><Spinner/> Loading…</div>:(
        <>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Time","Title","Format","Quality","Type","Size","Country","Trim","IP","Status"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",color:C.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",fontSize:10,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.data.map((d,i)=>(
                    <tr key={d.id} style={{borderBottom:`1px solid ${C.border}44`,background:i%2===0?"transparent":C.surface+"44"}}>
                      <td style={{padding:"10px 14px",color:C.textMuted,whiteSpace:"nowrap"}}>{new Date(d.timestamp).toLocaleString()}</td>
                      <td style={{padding:"10px 14px",color:C.text,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.title}>{d.title||"—"}</td>
                      <td style={{padding:"10px 14px"}}><Badge label={"."+d.format} color={C.accent} /></td>
                      <td style={{padding:"10px 14px",color:C.textSub}}>{d.quality}p</td>
                      <td style={{padding:"10px 14px"}}><Badge label={d.type} color={d.type==="audio"?C.success:C.info} /></td>
                      <td style={{padding:"10px 14px",color:C.textSub,whiteSpace:"nowrap"}}>{d.sizeMB?`${d.sizeMB} MB`:"—"}</td>
                      <td style={{padding:"10px 14px",color:C.textSub}}>{d.country||"—"}</td>
                      <td style={{padding:"10px 14px"}}>{d.trimmed?<Badge label="✂ Trimmed" color={C.warning}/>:<span style={{color:C.textMuted}}>—</span>}</td>
                      <td style={{padding:"10px 14px"}}><code style={{color:C.textMuted,fontSize:11}}>{d.ip}</code></td>
                      <td style={{padding:"10px 14px"}}><Badge label={d.status} color={d.status==="success"?C.success:C.danger} /></td>
                    </tr>
                  ))}
                  {data.data.length===0&&<tr><td colSpan={10} style={{padding:40,textAlign:"center",color:C.textMuted}}>No downloads found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,color:C.textMuted,fontSize:13}}>
            <span>Showing {data.data.length} of {data.total}</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:page===1?C.textMuted:C.text,fontSize:12,cursor:page===1?"default":"pointer",fontFamily:"inherit"}}>← Prev</button>
              <span style={{padding:"6px 12px",color:C.text}}>Page {page}</span>
              <button onClick={()=>setPage(p=>p+1)} disabled={data.data.length<50} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:data.data.length<50?C.textMuted:C.text,fontSize:12,cursor:data.data.length<50?"default":"pointer",fontFamily:"inherit"}}>Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Error Logs ────────────────────────────────────────────────────────────────
function ErrorLogs({adminKey}){
  const [data,setData]=useState(null);const [clearing,setClearing]=useState(false);
  const load=async()=>{const res=await fetch(`${API_BASE}/api/admin/errors`,{headers:{"x-admin-key":adminKey}});setData(await res.json());};
  const clearAll=async()=>{if(!confirm("Clear all error logs?"))return;setClearing(true);await fetch(`${API_BASE}/api/admin/errors`,{method:"DELETE",headers:{"x-admin-key":adminKey}});setData({total:0,data:[]});setClearing(false);};
  useEffect(()=>{load();},[]);
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{color:C.text,fontWeight:800,fontSize:18}}>⚠ Error Logs</h2>
        <div style={{display:"flex",gap:8}}>
          <button onClick={load} style={{background:C.accentSoft,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 14px",color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↺ Refresh</button>
          <button onClick={clearAll} disabled={clearing} style={{background:C.dangerSoft,border:`1px solid ${C.danger}44`,borderRadius:8,padding:"8px 14px",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{clearing?"Clearing…":"🗑 Clear All"}</button>
        </div>
      </div>
      {!data?<div style={{display:"flex",gap:10,color:C.textMuted,padding:20}}><Spinner/> Loading…</div>:(
        data.data.length===0?<Card style={{textAlign:"center",padding:40}}><div style={{fontSize:40,marginBottom:12}}>✅</div><p style={{color:C.success,fontWeight:700,fontSize:16}}>No errors logged</p></Card>:
        data.data.map(e=>(
          <div key={e.id} style={{background:C.dangerSoft,border:`1px solid ${C.danger}33`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
            <p style={{color:C.danger,fontWeight:700,fontSize:13,margin:"0 0 6px",wordBreak:"break-word"}}>{e.message}</p>
            {e.url&&<p style={{color:C.textMuted,fontSize:11,margin:"0 0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {e.url}</p>}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <code style={{color:C.textMuted,fontSize:10}}>IP: {e.ip}</code>
              <code style={{color:C.textMuted,fontSize:10}}>{new Date(e.timestamp).toLocaleString()}</code>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── IP Manager ────────────────────────────────────────────────────────────────
function IPManager({adminKey}){
  const [blocked,setBlocked]=useState([]);const [autoBlocked,setAutoBlocked]=useState([]);const [newIP,setNewIP]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");
  const load=async()=>{const res=await fetch(`${API_BASE}/api/admin/blocked`,{headers:{"x-admin-key":adminKey}});const d=await res.json();setBlocked(d.blocked||[]);setAutoBlocked(d.autoBlocked||[]);};
  useEffect(()=>{load();},[]);
  const blockIP=async()=>{if(!newIP.trim())return;setLoading(true);await fetch(`${API_BASE}/api/admin/block`,{method:"POST",headers:{"x-admin-key":adminKey,"Content-Type":"application/json"},body:JSON.stringify({ip:newIP.trim(),action:"block"})});setMsg(`✅ Blocked ${newIP}`);setNewIP("");await load();setLoading(false);setTimeout(()=>setMsg(""),3000);};
  const unblockIP=async(ip)=>{await fetch(`${API_BASE}/api/admin/block`,{method:"POST",headers:{"x-admin-key":adminKey,"Content-Type":"application/json"},body:JSON.stringify({ip,action:"unblock"})});await load();};
  return (
    <div>
      <h2 style={{color:C.text,fontWeight:800,fontSize:18,marginBottom:20}}>🚫 IP Manager</h2>
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:13,fontWeight:700,marginBottom:14}}>Block an IP</h3>
        <div style={{display:"flex",gap:10}}>
          <input value={newIP} onChange={e=>setNewIP(e.target.value)} placeholder="e.g. 192.168.1.100" style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"monospace",outline:"none"}} />
          <button onClick={blockIP} disabled={loading||!newIP} style={{background:C.danger,border:"none",borderRadius:8,padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{loading?<Spinner color="#fff"/>:"Block IP"}</button>
        </div>
        {msg&&<p style={{color:C.success,fontSize:13,marginTop:10}}>{msg}</p>}
      </Card>
      {autoBlocked.length>0&&(
        <Card style={{marginBottom:16,border:`1px solid ${C.warning}44`}}>
          <h3 style={{color:C.warning,fontSize:13,fontWeight:700,marginBottom:14}}>🤖 Auto-Blocked IPs ({autoBlocked.length})</h3>
          <p style={{color:C.textMuted,fontSize:12,marginBottom:12}}>These IPs were automatically blocked for exceeding the download rate limit.</p>
          {autoBlocked.map(ip=>(
            <div key={ip} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:14}}>🤖</span><code style={{color:C.warning,fontSize:13}}>{ip}</code></div>
              <button onClick={()=>unblockIP(ip)} style={{background:C.successSoft,border:`1px solid ${C.success}44`,borderRadius:6,padding:"4px 12px",color:C.success,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Unblock</button>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <h3 style={{color:C.textSub,fontSize:13,fontWeight:700,marginBottom:14}}>Manually Blocked ({blocked.filter(ip=>!autoBlocked.includes(ip)).length})</h3>
        {blocked.filter(ip=>!autoBlocked.includes(ip)).length===0?<p style={{color:C.textMuted,fontSize:13}}>No manually blocked IPs</p>:
          blocked.filter(ip=>!autoBlocked.includes(ip)).map(ip=>(
            <div key={ip} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <code style={{color:C.danger,fontSize:13}}>{ip}</code>
              <button onClick={()=>unblockIP(ip)} style={{background:C.successSoft,border:`1px solid ${C.success}44`,borderRadius:6,padding:"4px 12px",color:C.success,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Unblock</button>
            </div>
          ))
        }
      </Card>
    </div>
  );
}

// ── Cookies Manager ───────────────────────────────────────────────────────────
function CookiesManager({adminKey}){
  const [status,setStatus]=useState(null);const [uploading,setUploading]=useState(false);const [content,setContent]=useState("");const [msg,setMsg]=useState({type:"",text:""});const [validating,setValidating]=useState(false);
  const loadStatus=async()=>{const res=await fetch(`${API_BASE}/api/admin/cookies/status`,{headers:{"x-admin-key":adminKey}});setStatus(await res.json());};
  useEffect(()=>{loadStatus();},[]);
  const upload=async()=>{if(!content.trim())return;setUploading(true);const res=await fetch(`${API_BASE}/api/admin/cookies/upload`,{method:"POST",headers:{"x-admin-key":adminKey,"Content-Type":"text/plain"},body:content});const d=await res.json();if(res.ok){setMsg({type:"success",text:"✅ Cookies uploaded successfully!"});setContent("");await loadStatus();}else{setMsg({type:"error",text:"❌ "+d.error});}setUploading(false);};
  const remove=async()=>{if(!confirm("Delete cookies file?"))return;await fetch(`${API_BASE}/api/admin/cookies`,{method:"DELETE",headers:{"x-admin-key":adminKey}});await loadStatus();setMsg({type:"success",text:"Cookies deleted"});};
  const validate=async()=>{setValidating(true);await loadStatus();setValidating(false);};
  return (
    <div>
      <h2 style={{color:C.text,fontWeight:800,fontSize:18,marginBottom:20}}>🍪 Cookies Manager</h2>
      <div style={{background:C.infoSoft,border:`1px solid ${C.info}44`,borderRadius:12,padding:16,marginBottom:20}}>
        <p style={{color:C.info,fontWeight:700,fontSize:13,margin:"0 0 8px"}}>ℹ Why cookies are needed</p>
        <p style={{color:C.textSub,fontSize:12,margin:0}}>YouTube requires authentication to access some videos and bypass bot detection. Upload your YouTube cookies to avoid "Sign in to confirm you're not a bot" errors. Cookies expire periodically and need to be refreshed.</p>
      </div>

      {/* Current Status */}
      {status && (
        <Card style={{marginBottom:16,border:`1px solid ${status.valid?C.success+"44":C.danger+"44"}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <p style={{color:C.text,fontWeight:700,fontSize:14,margin:"0 0 4px"}}>Cookie Status</p>
              <p style={{color:status.valid?C.success:C.danger,fontSize:13,margin:0,fontWeight:600}}>
                {status.valid?"✅ Valid & Working":"❌ "+status.reason}
              </p>
              {status.exists&&<p style={{color:C.textMuted,fontSize:11,margin:"4px 0 0"}}>Size: {status.size} bytes · Modified: {new Date(status.modified).toLocaleString()}</p>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={validate} disabled={validating} style={{background:C.accentSoft,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 14px",color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                {validating?<Spinner color={C.accent} size={12}/>:"🔍"} Validate
              </button>
              {status.exists&&<button onClick={remove} style={{background:C.dangerSoft,border:`1px solid ${C.danger}44`,borderRadius:8,padding:"8px 14px",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 Delete</button>}
            </div>
          </div>
        </Card>
      )}

      {/* Upload new cookies */}
      <Card>
        <h3 style={{color:C.textSub,fontSize:13,fontWeight:700,marginBottom:16}}>Upload New Cookies</h3>
        <div style={{background:C.surface,borderRadius:10,padding:14,marginBottom:16,border:`1px solid ${C.border}`}}>
          <p style={{color:C.text,fontWeight:600,fontSize:13,margin:"0 0 8px"}}>How to get your YouTube cookies:</p>
          <ol style={{color:C.textSub,fontSize:12,paddingLeft:20,lineHeight:1.8,margin:0}}>
            <li>Install <strong style={{color:C.accent}}>"Get cookies.txt LOCALLY"</strong> extension in Chrome/Firefox</li>
            <li>Go to <strong>youtube.com</strong> and make sure you're logged in</li>
            <li>Click the extension icon → click <strong>"Export"</strong></li>
            <li>Copy the entire contents of the downloaded file</li>
            <li>Paste it in the box below and click Upload</li>
          </ol>
        </div>
        <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="# Netscape HTTP Cookie File&#10;# Paste your cookies.txt content here..." rows={8}
          style={{width:"100%",background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"12px 16px",color:C.text,fontSize:12,fontFamily:"monospace",outline:"none",resize:"vertical",lineHeight:1.5}} />
        {msg.text&&<p style={{color:msg.type==="success"?C.success:C.danger,fontSize:13,marginTop:10,fontWeight:600}}>{msg.text}</p>}
        <button onClick={upload} disabled={uploading||!content.trim()}
          style={{marginTop:12,width:"100%",background:content.trim()?C.accent:C.border,border:"none",borderRadius:10,padding:13,color:"#fff",fontWeight:700,fontSize:14,cursor:content.trim()?"pointer":"default",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {uploading?<><Spinner color="#fff"/> Uploading…</>:"🍪 Upload Cookies"}
        </button>
      </Card>
    </div>
  );
}

// ── Settings & Email ──────────────────────────────────────────────────────────
function AdminSettings({adminKey,stats}){
  const [settings,setSettings]=useState(null);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState(false);const [testingEmail,setTestingEmail]=useState(false);const [testMsg,setTestMsg]=useState("");const [updating,setUpdating]=useState(false);const [updateLog,setUpdateLog]=useState([]);

  const load=async()=>{const res=await fetch(`${API_BASE}/api/admin/settings`,{headers:{"x-admin-key":adminKey}});setSettings(await res.json());};
  useEffect(()=>{load();},[]);

  const save=async()=>{setSaving(true);await fetch(`${API_BASE}/api/admin/settings`,{method:"PATCH",headers:{"x-admin-key":adminKey,"Content-Type":"application/json"},body:JSON.stringify(settings)});setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2500);};

  const testEmail=async()=>{setTestingEmail(true);setTestMsg("");const res=await fetch(`${API_BASE}/api/admin/test-email`,{method:"POST",headers:{"x-admin-key":adminKey}});const d=await res.json();setTestMsg(res.ok?"✅ "+d.message:"❌ "+d.error);setTestingEmail(false);};

  const updateYtdlp=async()=>{
    setUpdating(true);setUpdateLog(["Starting update…"]);
    const es=new EventSource(`${API_BASE}/api/admin/ytdlp-update?adminKey=${adminKey}`);
    es.addEventListener("message",(e)=>{const d=JSON.parse(e.data);setUpdateLog(l=>[...l,d.message]);});
    es.addEventListener("done",(e)=>{es.close();setUpdating(false);});
    es.addEventListener("error",(e)=>{es.close();setUpdating(false);setUpdateLog(l=>[...l,"❌ Update failed"]);});
    es.onerror=()=>{es.close();setUpdating(false);};
  };

  if(!settings) return <div style={{display:"flex",gap:10,color:C.textMuted,padding:20}}><Spinner/> Loading…</div>;

  const Field=({label,desc,children})=>(
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"16px 0",borderBottom:`1px solid ${C.border}`,gap:20}}>
      <div><p style={{color:C.text,fontWeight:600,fontSize:14,margin:0}}>{label}</p>{desc&&<p style={{color:C.textMuted,fontSize:12,margin:"3px 0 0"}}>{desc}</p>}</div>
      {children}
    </div>
  );
  const Toggle=({val,onChange})=>(
    <div onClick={onChange} style={{width:48,height:26,borderRadius:100,background:val?C.accent:C.border,cursor:"pointer",position:"relative",transition:"background 0.3s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:val?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.25s"}} />
    </div>
  );
  const Input=({val,onChange,type="text",width=120,placeholder=""})=>(
    <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:type==="number"?"inherit":"monospace",outline:"none",width}} />
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{color:C.text,fontWeight:800,fontSize:18}}>⚙ Settings</h2>
        <button onClick={save} disabled={saving} style={{background:saved?C.successSoft:C.accent,border:"none",borderRadius:10,padding:"10px 24px",color:saved?C.success:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",boxShadow:!saved?`0 0 20px ${C.accentGlow}`:"none"}}>
          {saving?<Spinner color="#fff"/>:saved?"✓ Saved!":"Save Changes"}
        </button>
      </div>

      {/* Server Settings */}
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Server</h3>
        <Field label="Maintenance Mode" desc="Block all downloads for users"><Toggle val={settings.maintenanceMode} onChange={()=>setSettings(s=>({...s,maintenanceMode:!s.maintenanceMode}))}/></Field>
        <Field label="Banner Message" desc="Shown to all users (empty = hidden)"><Input val={settings.bannerMessage} onChange={v=>setSettings(s=>({...s,bannerMessage:v}))} width={240} placeholder="e.g. Maintenance tonight..." /></Field>
        <Field label="Max Concurrent Downloads" desc="Simultaneous downloads allowed"><Input type="number" val={settings.maxConcurrent} onChange={v=>setSettings(s=>({...s,maxConcurrent:parseInt(v)}))} /></Field>
        <Field label="Rate Limit (per IP/hour)" desc="Max downloads per user per hour"><Input type="number" val={settings.rateLimitPerHour} onChange={v=>setSettings(s=>({...s,rateLimitPerHour:parseInt(v)}))} /></Field>
        <Field label="Max Video Duration (minutes)" desc="0 = no limit"><Input type="number" val={Math.round(settings.maxDuration/60)} onChange={v=>setSettings(s=>({...s,maxDuration:parseInt(v)*60}))} /></Field>
      </Card>

      {/* Auto-block Settings */}
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>🤖 Auto-Block</h3>
        <Field label="Auto-Block Enabled" desc="Automatically block IPs that exceed threshold"><Toggle val={settings.autoBlockEnabled} onChange={()=>setSettings(s=>({...s,autoBlockEnabled:!s.autoBlockEnabled}))}/></Field>
        <Field label="Auto-Block Threshold" desc="Downloads per hour before IP is blocked"><Input type="number" val={settings.autoBlockThreshold} onChange={v=>setSettings(s=>({...s,autoBlockThreshold:parseInt(v)}))} /></Field>
      </Card>

      {/* Email Settings */}
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>📧 Email Alerts</h3>
        <Field label="Email Alerts Enabled" desc="Enable all email notifications"><Toggle val={settings.emailAlerts} onChange={()=>setSettings(s=>({...s,emailAlerts:!s.emailAlerts}))}/></Field>
        <Field label="Alert Email Address" desc="Where to send all alerts"><Input val={settings.alertEmail} onChange={v=>setSettings(s=>({...s,alertEmail:v}))} width={240} placeholder="you@example.com" /></Field>
        <Field label="Error Spike Alerts" desc="Alert when errors spike"><Toggle val={settings.emailOnErrorSpike} onChange={()=>setSettings(s=>({...s,emailOnErrorSpike:!s.emailOnErrorSpike}))}/></Field>
        <Field label="Error Spike Threshold" desc="Errors per hour to trigger alert"><Input type="number" val={settings.errorSpikeThreshold} onChange={v=>setSettings(s=>({...s,errorSpikeThreshold:parseInt(v)}))} /></Field>
        <Field label="Daily Report" desc="Send daily summary email"><Toggle val={settings.dailyReport} onChange={()=>setSettings(s=>({...s,dailyReport:!s.dailyReport}))}/></Field>
        <Field label="Report Hour (UTC)" desc="Hour to send daily report (0-23)"><Input type="number" val={settings.dailyReportHour} onChange={v=>setSettings(s=>({...s,dailyReportHour:parseInt(v)}))} /></Field>
        <div style={{paddingTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={testEmail} disabled={testingEmail||!settings.alertEmail}
            style={{background:C.infoSoft,border:`1px solid ${C.info}44`,borderRadius:8,padding:"8px 16px",color:C.info,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            {testingEmail?<Spinner color={C.info} size={13}/>:"📧"} Send Test Email
          </button>
          <button onClick={async()=>{const res=await fetch(`${API_BASE}/api/admin/send-report`,{method:"POST",headers:{"x-admin-key":adminKey}});const d=await res.json();setTestMsg(d.message||"Report sent");}}
            style={{background:C.accentSoft,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 16px",color:C.accent,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            📊 Send Report Now
          </button>
        </div>
        {testMsg&&<p style={{color:testMsg.startsWith("✅")?C.success:C.danger,fontSize:13,marginTop:10,fontWeight:600}}>{testMsg}</p>}
      </Card>

      {/* SMTP Settings */}
      <Card style={{marginBottom:16}}>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>📮 SMTP Config</h3>
        <div style={{background:C.infoSoft,border:`1px solid ${C.info}44`,borderRadius:8,padding:12,marginBottom:12}}>
          <p style={{color:C.info,fontSize:12,margin:0}}>💡 Use Gmail: enable 2FA → create an App Password at myaccount.google.com/apppasswords. SMTP Host: <code>smtp.gmail.com</code>, Port: <code>587</code></p>
        </div>
        <Field label="SMTP Host"><Input val={settings.smtpHost} onChange={v=>setSettings(s=>({...s,smtpHost:v}))} width={200} placeholder="smtp.gmail.com" /></Field>
        <Field label="SMTP Port"><Input type="number" val={settings.smtpPort} onChange={v=>setSettings(s=>({...s,smtpPort:parseInt(v)}))} /></Field>
        <Field label="SMTP Username"><Input val={settings.smtpUser} onChange={v=>setSettings(s=>({...s,smtpUser:v}))} width={200} placeholder="you@gmail.com" /></Field>
        <Field label="SMTP Password"><input type="password" value={settings.smtpPass} onChange={e=>setSettings(s=>({...s,smtpPass:e.target.value}))} placeholder="App password..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"monospace",outline:"none",width:200}} /></Field>
        <Field label="From Email"><Input val={settings.smtpFrom} onChange={v=>setSettings(s=>({...s,smtpFrom:v}))} width={200} placeholder="kingo@yourdomain.com" /></Field>
      </Card>

      {/* yt-dlp Update */}
      <Card>
        <h3 style={{color:C.textSub,fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>🔄 yt-dlp Update</h3>
        {stats?.ytdlpVersion&&(
          <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
            <div><div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Current</div><div style={{color:C.text,fontWeight:600,fontSize:14}}>{stats.ytdlpVersion.current}</div></div>
            <div><div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Last Checked</div><div style={{color:C.text,fontWeight:600,fontSize:14}}>{stats.ytdlpVersion.lastChecked?new Date(stats.ytdlpVersion.lastChecked).toLocaleString():"—"}</div></div>
          </div>
        )}
        <button onClick={updateYtdlp} disabled={updating}
          style={{background:C.accent,border:"none",borderRadius:10,padding:"12px 24px",color:"#fff",fontWeight:700,fontSize:14,cursor:updating?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,boxShadow:`0 0 20px ${C.accentGlow}`}}>
          {updating?<Spinner color="#fff"/>:"🔄"} Update yt-dlp to Latest
        </button>
        {updateLog.length>0&&(
          <div style={{marginTop:16,background:C.surface,borderRadius:10,padding:14,fontFamily:"monospace",fontSize:12}}>
            {updateLog.map((l,i)=><div key={i} style={{color:l.includes("❌")?C.danger:l.includes("✅")?C.success:C.textSub,marginBottom:4}}>{l}</div>)}
            {updating&&<div style={{display:"flex",alignItems:"center",gap:8,color:C.textMuted}}><Spinner color={C.textMuted} size={12}/> Running…</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Root Admin App ────────────────────────────────────────────────────────────
export default function AdminApp(){
  const [adminKey,setAdminKey]=useState(localStorage.getItem("kingo_admin_key")||"");
  const [authed,setAuthed]=useState(false);
  const [activeSection,setActiveSection]=useState("dashboard");
  const [stats,setStats]=useState(null);
  const [refreshing,setRefreshing]=useState(false);

  const handleLogin=(key)=>{localStorage.setItem("kingo_admin_key",key);setAdminKey(key);setAuthed(true);};

  const loadStats=useCallback(async()=>{if(!adminKey)return;setRefreshing(true);try{const res=await fetch(`${API_BASE}/api/admin/stats`,{headers:{"x-admin-key":adminKey}});if(res.ok)setStats(await res.json());}catch{}setRefreshing(false);},[adminKey]);

  useEffect(()=>{if(authed){loadStats();const iv=setInterval(loadStats,30000);return()=>clearInterval(iv);}},[authed,loadStats]);
  useEffect(()=>{if(adminKey){fetch(`${API_BASE}/api/admin/stats`,{headers:{"x-admin-key":adminKey}}).then(r=>{if(r.ok)setAuthed(true);});}},[]);

  if(!authed) return <LoginScreen onLogin={handleLogin}/>;

  const nav=[
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"downloads",label:"Downloads",icon:"⬇"},
    {id:"errors",label:"Errors",icon:"⚠",badge:stats?.totals?.errors},
    {id:"countries",label:"Countries",icon:"🌍"},
    {id:"ips",label:"IP Manager",icon:"🚫"},
    {id:"cookies",label:"Cookies",icon:"🍪"},
    {id:"settings",label:"Settings",icon:"⚙"},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"system-ui,sans-serif",color:C.text,display:"flex"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${C.accent},#a855f7)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:900}}>K</div>
            <div><p style={{color:C.text,fontWeight:800,fontSize:13,margin:0}}>Kingo Admin</p><p style={{color:C.textMuted,fontSize:10,margin:0}}>v4.0 Control Panel</p></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setActiveSection(n.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:activeSection===n.id?C.accentSoft:"transparent",cursor:"pointer",fontFamily:"inherit",marginBottom:2,textAlign:"left"}}>
              <span style={{fontSize:16}}>{n.icon}</span>
              <span style={{color:activeSection===n.id?C.accent:C.textSub,fontWeight:activeSection===n.id?700:500,fontSize:13}}>{n.label}</span>
              {n.badge>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:20}}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:`1px solid ${C.border}`}}>
          <a href="/" target="_blank" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,textDecoration:"none"}}>
            <span style={{fontSize:14}}>↗</span><span style={{color:C.textMuted,fontSize:12}}>View App</span>
          </a>
          <button onClick={()=>{localStorage.removeItem("kingo_admin_key");setAuthed(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{fontSize:14}}>⏻</span><span style={{color:C.textMuted,fontSize:12}}>Logout</span>
          </button>
        </div>
      </div>
      <div style={{marginLeft:220,flex:1,padding:28,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <p style={{color:C.textMuted,fontSize:12}}>Kingo YT Downloader · Admin Panel v4</p>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {stats&&<span style={{background:C.successSoft,color:C.success,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20}}>● Live</span>}
            <button onClick={loadStats} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",color:C.textSub,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              {refreshing?<Spinner color={C.accent} size={12}/>:"↺"} Refresh
            </button>
          </div>
        </div>
        {activeSection==="dashboard"&&<Dashboard stats={stats} onRefresh={loadStats}/>}
        {activeSection==="downloads"&&<DownloadsLog adminKey={adminKey}/>}
        {activeSection==="errors"&&<ErrorLogs adminKey={adminKey}/>}
        {activeSection==="countries"&&<CountryAnalytics adminKey={adminKey}/>}
        {activeSection==="ips"&&<IPManager adminKey={adminKey}/>}
        {activeSection==="cookies"&&<CookiesManager adminKey={adminKey}/>}
        {activeSection==="settings"&&<AdminSettings adminKey={adminKey} stats={stats}/>}
      </div>
    </div>
  );
}
