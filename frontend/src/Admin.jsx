import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const C = {
  bg: "#07070f",
  surface: "#0f0f1e",
  card: "#13132a",
  border: "#1e1e3a",
  accent: "#7c3aed",
  accentSoft: "#7c3aed22",
  accentGlow: "#7c3aed44",
  accent2: "#f59e0b",
  accent2Soft: "#f59e0b18",
  text: "#e8e8ff",
  textMuted: "#5a5a8a",
  textSub: "#8888bb",
  success: "#10b981",
  successSoft: "#10b98118",
  warning: "#f59e0b",
  warningSoft: "#f59e0b18",
  danger: "#ef4444",
  dangerSoft: "#ef444418",
  info: "#3b82f6",
  infoSoft: "#3b82f618",
};

function Spinner({ color = C.accent, size = 16 }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:`2px solid ${color}33`, borderTop:`2px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />;
}

function Card({ children, style = {} }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:20, ...style }}>{children}</div>;
}

function Badge({ label, color }) {
  return <span style={{ background:color+"22", color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, letterSpacing:0.5, whiteSpace:"nowrap" }}>{label}</span>;
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <Card style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <span style={{ fontSize:11, color:C.textMuted, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      </div>
      <div style={{ fontSize:32, fontWeight:800, color, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:C.textMuted }}>{sub}</div>}
    </Card>
  );
}

// Simple bar chart
function MiniBarChart({ data, color }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(e => e[1]), 1);
  return (
    <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:60 }}>
      {entries.map(([key, val]) => (
        <div key={key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{ width:"100%", background:color, borderRadius:4, height:`${(val/max)*52}px`, minHeight:val>0?4:2, opacity:0.85, transition:"height 0.3s" }} />
          <span style={{ fontSize:8, color:C.textMuted, whiteSpace:"nowrap" }}>{key.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, colors }) {
  const entries = Object.entries(data).filter(e => e[1] > 0);
  const total = entries.reduce((s, e) => s + e[1], 0);
  if (!total) return <div style={{ color:C.textMuted, fontSize:13 }}>No data</div>;
  let offset = 0;
  const r = 40, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20 }}>
      <svg width={100} height={100}>
        {entries.map(([key, val], i) => {
          const pct = val / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const rotation = offset * 360;
          offset += pct;
          return (
            <circle key={key} cx={cx} cy={cy} r={r}
              fill="none" stroke={colors[i % colors.length]} strokeWidth={18}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={circumference * 0.25 - dash * offset + dash}
              style={{ transform:`rotate(${rotation - 90}deg)`, transformOrigin:"50px 50px" }} />
          );
        })}
        <circle cx={cx} cy={cy} r={28} fill={C.card} />
        <text x={cx} y={cy+5} textAnchor="middle" fill={C.text} fontSize={12} fontWeight={700}>{total}</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:colors[i % colors.length] }} />
            <span style={{ fontSize:12, color:C.textSub }}>{key}</span>
            <span style={{ fontSize:12, fontWeight:700, color:C.text, marginLeft:"auto" }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const attempt = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: { "x-admin-key": key } });
      if (res.ok) { onLogin(key); }
      else { setError("Invalid admin key. Check your ADMIN_SECRET env variable."); }
    } catch { setError("Cannot reach backend. Is it running?"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width:360 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:`linear-gradient(135deg,${C.accent},#a855f7)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:"#fff", fontWeight:900, margin:"0 auto 16px", boxShadow:`0 0 30px ${C.accentGlow}` }}>K</div>
          <h1 style={{ color:C.text, fontSize:22, fontWeight:800, margin:"0 0 6px" }}>Kingo Admin Panel</h1>
          <p style={{ color:C.textMuted, fontSize:13 }}>Enter your admin secret key to continue</p>
        </div>
        <Card>
          <input type="password" value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}
            placeholder="Admin secret key..."
            style={{ width:"100%", background:C.surface, border:`1.5px solid ${error?C.danger:C.border}`, borderRadius:10, padding:"12px 16px", color:C.text, fontSize:14, fontFamily:"monospace", outline:"none", marginBottom:12 }} />
          {error && <p style={{ color:C.danger, fontSize:12, marginBottom:12 }}>⚠ {error}</p>}
          <button onClick={attempt} disabled={!key||loading}
            style={{ width:"100%", background:C.accent, border:"none", borderRadius:10, padding:13, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:`0 0 20px ${C.accentGlow}` }}>
            {loading ? <><Spinner color="#fff"/> Verifying…</> : "→ Enter Admin Panel"}
          </button>
        </Card>
        <p style={{ color:C.textMuted, fontSize:11, textAlign:"center", marginTop:16 }}>
          Default key: <code style={{ color:C.accent }}>kingo-admin-secret-change-me</code><br/>Set <code>ADMIN_SECRET</code> env var on your server to change it.
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ stats }) {
  if (!stats) return <div style={{ display:"flex", alignItems:"center", gap:10, color:C.textMuted }}><Spinner /> Loading…</div>;
  return (
    <div>
      <h2 style={{ color:C.text, fontWeight:800, fontSize:18, marginBottom:20 }}>📊 Dashboard</h2>

      {/* Stat Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
        <StatCard label="All Time" value={stats.totals.allTime} icon="⬇" color={C.accent} sub="Total downloads" />
        <StatCard label="Today" value={stats.totals.today} icon="📅" color={C.success} sub="Downloads today" />
        <StatCard label="This Week" value={stats.totals.thisWeek} icon="📆" color={C.info} sub="Last 7 days" />
        <StatCard label="Errors" value={stats.totals.errors} icon="⚠" color={stats.totals.errors > 0 ? C.danger : C.textMuted} sub="Error count" />
        <StatCard label="Active Jobs" value={stats.totals.activeJobs} icon="⚙" color={C.warning} sub="Running now" />
        <StatCard label="Data Served" value={`${(stats.totalDataServedMB/1024).toFixed(1)} GB`} icon="💾" color={C.accent2} sub={`Avg ${stats.avgFileSizeMB} MB/file`} />
        <StatCard label="Trimmed" value={stats.trimmedDownloads} icon="✂" color={C.success} sub="Trimmed downloads" />
        <StatCard label="Blocked IPs" value={stats.totals.blockedIPs} icon="🚫" color={C.danger} sub="IP blocks active" />
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
        <Card>
          <h3 style={{ color:C.textSub, fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>Downloads Last 7 Days</h3>
          <MiniBarChart data={stats.perDay} color={C.accent} />
        </Card>
        <Card>
          <h3 style={{ color:C.textSub, fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>By Format</h3>
          <DonutChart data={stats.byFormat} colors={[C.accent, C.accent2, C.success, C.info, C.danger, "#a855f7", "#ec4899"]} />
        </Card>
      </div>

      {/* Bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <h3 style={{ color:C.textSub, fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>Video vs Audio</h3>
          <DonutChart data={stats.byType} colors={[C.accent, C.success]} />
        </Card>
        <Card>
          <h3 style={{ color:C.textSub, fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>Top Users (by IP)</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {stats.topIPs.slice(0,5).map(([ip, count]) => (
              <div key={ip} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <code style={{ color:C.textSub, fontSize:11, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ip}</code>
                <div style={{ background:C.accent+"33", borderRadius:100, height:6, width:80, overflow:"hidden" }}>
                  <div style={{ background:C.accent, height:"100%", width:`${(count/stats.topIPs[0][1])*100}%`, borderRadius:100 }} />
                </div>
                <span style={{ color:C.text, fontWeight:700, fontSize:13, minWidth:24, textAlign:"right" }}>{count}</span>
              </div>
            ))}
            {stats.topIPs.length === 0 && <p style={{ color:C.textMuted, fontSize:13 }}>No downloads yet</p>}
          </div>
        </Card>
      </div>

      {/* System */}
      <Card style={{ marginTop:16 }}>
        <h3 style={{ color:C.textSub, fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12 }}>System</h3>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          {[
            ["Uptime", `${Math.floor(stats.uptime/3600)}h ${Math.floor((stats.uptime%3600)/60)}m`],
            ["Memory", `${stats.memoryMB} MB`],
            ["Backend", API_BASE],
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:14, color:C.text, fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Downloads Log ─────────────────────────────────────────────────────────────
function DownloadsLog({ adminKey }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filterFormat, setFilterFormat] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page, limit:50, ...(search&&{search}), ...(filterFormat&&{format:filterFormat}), ...(filterType&&{type:filterType}) });
    const res = await fetch(`${API_BASE}/api/admin/downloads?${params}`, { headers:{"x-admin-key":adminKey} });
    setData(await res.json());
  }, [adminKey, page, search, filterFormat, filterType]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => { window.open(`${API_BASE}/api/admin/export?adminKey=${adminKey}`); };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ color:C.text, fontWeight:800, fontSize:18 }}>⬇ Downloads Log</h2>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search title/URL…"
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"monospace", outline:"none", width:180 }} />
          <select value={filterFormat} onChange={e=>{ setFilterFormat(e.target.value); setPage(1); }}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none" }}>
            <option value="">All Formats</option>
            {["mp4","mkv","webm","mp3","aac","opus","flac","wav","m4a"].map(f=><option key={f} value={f}>.{f}</option>)}
          </select>
          <select value={filterType} onChange={e=>{ setFilterType(e.target.value); setPage(1); }}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none" }}>
            <option value="">All Types</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
          <button onClick={exportCSV} style={{ background:C.successSoft, border:`1px solid ${C.success}44`, borderRadius:8, padding:"8px 14px", color:C.success, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            ↓ Export CSV
          </button>
          <button onClick={load} style={{ background:C.accentSoft, border:`1px solid ${C.accent}44`, borderRadius:8, padding:"8px 14px", color:C.accent, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {!data ? <div style={{ display:"flex", gap:10, color:C.textMuted, padding:20 }}><Spinner /> Loading…</div> : (
        <>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {["Time","Title","Format","Quality","Type","Size","Trim","IP","Status"].map(h=>(
                      <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:C.textMuted, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((d,i) => (
                    <tr key={d.id} style={{ borderBottom:`1px solid ${C.border}44`, background:i%2===0?"transparent":C.surface+"44" }}>
                      <td style={{ padding:"10px 14px", color:C.textMuted, whiteSpace:"nowrap" }}>{new Date(d.timestamp).toLocaleString()}</td>
                      <td style={{ padding:"10px 14px", color:C.text, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={d.title}>{d.title || "—"}</td>
                      <td style={{ padding:"10px 14px" }}><Badge label={"."+d.format} color={C.accent} /></td>
                      <td style={{ padding:"10px 14px", color:C.textSub }}>{d.quality}p</td>
                      <td style={{ padding:"10px 14px" }}><Badge label={d.type} color={d.type==="audio"?C.success:C.info} /></td>
                      <td style={{ padding:"10px 14px", color:C.textSub, whiteSpace:"nowrap" }}>{d.sizeMB ? `${d.sizeMB} MB` : "—"}</td>
                      <td style={{ padding:"10px 14px" }}>{d.trimmed ? <Badge label="✂ Trimmed" color={C.warning} /> : <span style={{ color:C.textMuted }}>—</span>}</td>
                      <td style={{ padding:"10px 14px" }}><code style={{ color:C.textMuted, fontSize:11 }}>{d.ip}</code></td>
                      <td style={{ padding:"10px 14px" }}><Badge label={d.status} color={d.status==="success"?C.success:C.danger} /></td>
                    </tr>
                  ))}
                  {data.data.length === 0 && (
                    <tr><td colSpan={9} style={{ padding:40, textAlign:"center", color:C.textMuted }}>No downloads found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16, color:C.textMuted, fontSize:13 }}>
            <span>Showing {data.data.length} of {data.total}</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:page===1?C.textMuted:C.text, fontSize:12, cursor:page===1?"default":"pointer", fontFamily:"inherit" }}>← Prev</button>
              <span style={{ padding:"6px 12px", color:C.text }}>Page {page}</span>
              <button onClick={()=>setPage(p=>p+1)} disabled={data.data.length < 50}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:data.data.length<50?C.textMuted:C.text, fontSize:12, cursor:data.data.length<50?"default":"pointer", fontFamily:"inherit" }}>Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Error Logs ────────────────────────────────────────────────────────────────
function ErrorLogs({ adminKey }) {
  const [data, setData] = useState(null);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_BASE}/api/admin/errors`, { headers:{"x-admin-key":adminKey} });
    setData(await res.json());
  };

  const clearAll = async () => {
    if (!confirm("Clear all error logs?")) return;
    setClearing(true);
    await fetch(`${API_BASE}/api/admin/errors`, { method:"DELETE", headers:{"x-admin-key":adminKey} });
    setData({ total:0, data:[] });
    setClearing(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ color:C.text, fontWeight:800, fontSize:18 }}>⚠ Error Logs</h2>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={load} style={{ background:C.accentSoft, border:`1px solid ${C.accent}44`, borderRadius:8, padding:"8px 14px", color:C.accent, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>↺ Refresh</button>
          <button onClick={clearAll} disabled={clearing} style={{ background:C.dangerSoft, border:`1px solid ${C.danger}44`, borderRadius:8, padding:"8px 14px", color:C.danger, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {clearing ? "Clearing…" : "🗑 Clear All"}
          </button>
        </div>
      </div>

      {!data ? <div style={{ display:"flex", gap:10, color:C.textMuted, padding:20 }}><Spinner /> Loading…</div> : (
        <div>
          {data.data.length === 0 ? (
            <Card style={{ textAlign:"center", padding:40 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <p style={{ color:C.success, fontWeight:700, fontSize:16 }}>No errors logged</p>
            </Card>
          ) : data.data.map(e => (
            <div key={e.id} style={{ background:C.dangerSoft, border:`1px solid ${C.danger}33`, borderRadius:12, padding:"14px 18px", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:C.danger, fontWeight:700, fontSize:13, margin:"0 0 6px", wordBreak:"break-word" }}>{e.message}</p>
                  {e.url && <p style={{ color:C.textMuted, fontSize:11, margin:"0 0 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🔗 {e.url}</p>}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    <code style={{ color:C.textMuted, fontSize:10 }}>IP: {e.ip}</code>
                    <code style={{ color:C.textMuted, fontSize:10 }}>{new Date(e.timestamp).toLocaleString()}</code>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── IP Management ─────────────────────────────────────────────────────────────
function IPManager({ adminKey }) {
  const [blocked, setBlocked] = useState([]);
  const [newIP, setNewIP] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch(`${API_BASE}/api/admin/blocked`, { headers:{"x-admin-key":adminKey} });
    const d = await res.json();
    setBlocked(d.blocked || []);
  };

  useEffect(() => { load(); }, []);

  const blockIP = async () => {
    if (!newIP.trim()) return;
    setLoading(true);
    await fetch(`${API_BASE}/api/admin/block`, { method:"POST", headers:{"x-admin-key":adminKey,"Content-Type":"application/json"}, body:JSON.stringify({ip:newIP.trim(),action:"block"}) });
    setMsg(`✅ Blocked ${newIP}`); setNewIP(""); await load(); setLoading(false);
    setTimeout(()=>setMsg(""),3000);
  };

  const unblockIP = async (ip) => {
    await fetch(`${API_BASE}/api/admin/block`, { method:"POST", headers:{"x-admin-key":adminKey,"Content-Type":"application/json"}, body:JSON.stringify({ip,action:"unblock"}) });
    await load();
  };

  return (
    <div>
      <h2 style={{ color:C.text, fontWeight:800, fontSize:18, marginBottom:20 }}>🚫 IP Management</h2>
      <Card style={{ marginBottom:20 }}>
        <h3 style={{ color:C.textSub, fontSize:13, fontWeight:700, marginBottom:14 }}>Block an IP Address</h3>
        <div style={{ display:"flex", gap:10 }}>
          <input value={newIP} onChange={e=>setNewIP(e.target.value)} placeholder="e.g. 192.168.1.100"
            style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:13, fontFamily:"monospace", outline:"none" }} />
          <button onClick={blockIP} disabled={loading||!newIP}
            style={{ background:C.danger, border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {loading ? <Spinner color="#fff" /> : "Block IP"}
          </button>
        </div>
        {msg && <p style={{ color:C.success, fontSize:13, marginTop:10 }}>{msg}</p>}
      </Card>

      <Card>
        <h3 style={{ color:C.textSub, fontSize:13, fontWeight:700, marginBottom:14 }}>Blocked IPs ({blocked.length})</h3>
        {blocked.length === 0 ? (
          <p style={{ color:C.textMuted, fontSize:13 }}>No IPs blocked</p>
        ) : blocked.map(ip => (
          <div key={ip} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <code style={{ color:C.danger, fontSize:13 }}>{ip}</code>
            <button onClick={()=>unblockIP(ip)} style={{ background:C.successSoft, border:`1px solid ${C.success}44`, borderRadius:6, padding:"4px 12px", color:C.success, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Unblock</button>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function AdminSettings({ adminKey }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_BASE}/api/admin/settings`, { headers:{"x-admin-key":adminKey} });
    setSettings(await res.json());
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    await fetch(`${API_BASE}/api/admin/settings`, { method:"PATCH", headers:{"x-admin-key":adminKey,"Content-Type":"application/json"}, body:JSON.stringify(settings) });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  if (!settings) return <div style={{ display:"flex", gap:10, color:C.textMuted, padding:20 }}><Spinner /> Loading…</div>;

  const Field = ({ label, desc, children }) => (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"16px 0", borderBottom:`1px solid ${C.border}`, gap:20 }}>
      <div>
        <p style={{ color:C.text, fontWeight:600, fontSize:14, margin:0 }}>{label}</p>
        {desc && <p style={{ color:C.textMuted, fontSize:12, margin:"3px 0 0" }}>{desc}</p>}
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h2 style={{ color:C.text, fontWeight:800, fontSize:18 }}>⚙ Server Settings</h2>
        <button onClick={save} disabled={saving}
          style={{ background:saved?C.successSoft:C.accent, border:"none", borderRadius:10, padding:"10px 24px", color:saved?C.success:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", boxShadow:!saved?`0 0 20px ${C.accentGlow}`:"none" }}>
          {saving ? <Spinner color="#fff" /> : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      <Card>
        <Field label="Maintenance Mode" desc="Block all downloads for users (shows maintenance message)">
          <div onClick={()=>setSettings(s=>({...s,maintenanceMode:!s.maintenanceMode}))}
            style={{ width:48, height:26, borderRadius:100, background:settings.maintenanceMode?C.danger:C.border, cursor:"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:settings.maintenanceMode?25:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.25s" }} />
          </div>
        </Field>

        <Field label="Banner Message" desc="Show an announcement banner to all users (leave empty to hide)">
          <input value={settings.bannerMessage} onChange={e=>setSettings(s=>({...s,bannerMessage:e.target.value}))}
            placeholder="e.g. Server maintenance tonight at 10PM…"
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", width:280 }} />
        </Field>

        <Field label="Max Concurrent Downloads" desc="How many downloads can run at the same time">
          <input type="number" min={1} max={20} value={settings.maxConcurrent} onChange={e=>setSettings(s=>({...s,maxConcurrent:parseInt(e.target.value)}))}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:14, fontFamily:"inherit", outline:"none", width:80, textAlign:"center" }} />
        </Field>

        <Field label="Rate Limit (per IP/hour)" desc="Max downloads per IP address per hour">
          <input type="number" min={1} max={100} value={settings.rateLimitPerHour} onChange={e=>setSettings(s=>({...s,rateLimitPerHour:parseInt(e.target.value)}))}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:14, fontFamily:"inherit", outline:"none", width:80, textAlign:"center" }} />
        </Field>

        <Field label="Max Video Duration (minutes)" desc="Reject videos longer than this. 0 = no limit.">
          <input type="number" min={0} value={Math.round(settings.maxDuration/60)} onChange={e=>setSettings(s=>({...s,maxDuration:parseInt(e.target.value)*60}))}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:14, fontFamily:"inherit", outline:"none", width:80, textAlign:"center" }} />
        </Field>

        <Field label="Allowed Formats" desc="Comma-separated list of allowed formats">
          <input value={settings.allowedFormats.join(",")} onChange={e=>setSettings(s=>({...s,allowedFormats:e.target.value.split(",").map(f=>f.trim())}))}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"monospace", outline:"none", width:280 }} />
        </Field>
      </Card>
    </div>
  );
}

// ── Root Admin App ────────────────────────────────────────────────────────────
export default function AdminApp() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("kingo_admin_key") || "");
  const [authed, setAuthed] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogin = (key) => {
    localStorage.setItem("kingo_admin_key", key);
    setAdminKey(key);
    setAuthed(true);
  };

  const loadStats = useCallback(async () => {
    if (!adminKey) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers:{"x-admin-key":adminKey} });
      if (res.ok) setStats(await res.json());
    } catch {}
    setRefreshing(false);
  }, [adminKey]);

  useEffect(() => {
    if (authed) { loadStats(); const iv = setInterval(loadStats, 30000); return ()=>clearInterval(iv); }
  }, [authed, loadStats]);

  useEffect(() => {
    if (adminKey) {
      fetch(`${API_BASE}/api/admin/stats`, { headers:{"x-admin-key":adminKey} }).then(r=>{ if(r.ok) setAuthed(true); });
    }
  }, []);

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  const nav = [
    { id:"dashboard", label:"Dashboard", icon:"📊" },
    { id:"downloads", label:"Downloads", icon:"⬇" },
    { id:"errors",    label:"Error Logs", icon:"⚠", badge: stats?.totals?.errors },
    { id:"ips",       label:"IP Manager", icon:"🚫" },
    { id:"settings",  label:"Settings",  icon:"⚙" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"system-ui,sans-serif", color:C.text, display:"flex" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Sidebar */}
      <div style={{ width:220, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:100 }}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${C.accent},#a855f7)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff", fontWeight:900 }}>K</div>
            <div>
              <p style={{ color:C.text, fontWeight:800, fontSize:13, margin:0 }}>Kingo Admin</p>
              <p style={{ color:C.textMuted, fontSize:10, margin:0 }}>Control Panel</p>
            </div>
          </div>
        </div>
        <nav style={{ flex:1, padding:"12px 10px" }}>
          {nav.map(n => (
            <button key={n.id} onClick={()=>setActiveSection(n.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, border:"none", background:activeSection===n.id?C.accentSoft:"transparent", cursor:"pointer", fontFamily:"inherit", marginBottom:2, textAlign:"left" }}>
              <span style={{ fontSize:16 }}>{n.icon}</span>
              <span style={{ color:activeSection===n.id?C.accent:C.textSub, fontWeight:activeSection===n.id?700:500, fontSize:13 }}>{n.label}</span>
              {n.badge > 0 && <span style={{ marginLeft:"auto", background:C.danger, color:"#fff", fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:20 }}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding:"12px 10px", borderTop:`1px solid ${C.border}` }}>
          <a href="/" target="_blank" style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, textDecoration:"none" }}>
            <span style={{ fontSize:14 }}>↗</span>
            <span style={{ color:C.textMuted, fontSize:12 }}>View App</span>
          </a>
          <button onClick={()=>{ localStorage.removeItem("kingo_admin_key"); setAuthed(false); }}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, border:"none", background:"transparent", cursor:"pointer", fontFamily:"inherit" }}>
            <span style={{ fontSize:14 }}>⏻</span>
            <span style={{ color:C.textMuted, fontSize:12 }}>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft:220, flex:1, padding:28, minWidth:0 }}>
        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <p style={{ color:C.textMuted, fontSize:12 }}>Kingo YT Downloader · Admin Panel</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {stats && <span style={{ background:C.successSoft, color:C.success, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20 }}>● Live</span>}
            <button onClick={loadStats} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 14px", color:C.textSub, fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
              {refreshing ? <Spinner color={C.accent} size={12} /> : "↺"} Refresh
            </button>
          </div>
        </div>

        {activeSection === "dashboard" && <Dashboard stats={stats} />}
        {activeSection === "downloads" && <DownloadsLog adminKey={adminKey} />}
        {activeSection === "errors"    && <ErrorLogs adminKey={adminKey} />}
        {activeSection === "ips"       && <IPManager adminKey={adminKey} />}
        {activeSection === "settings"  && <AdminSettings adminKey={adminKey} />}
      </div>
    </div>
  );
}
