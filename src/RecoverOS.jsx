import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ─────────────────────────────────────────────────────────
// Palette: Deep navy command room + amber signal + phosphor green telemetry
// Avoids the defaults: no cream/terracotta, no acid-green-on-black, no broadsheet
// Signature: Live "radar pulse" on the ops center header that maps lead velocity
const TOKENS = {
  navy: "#0B1220",
  navyMid: "#111C30",
  navySurface: "#162035",
  navyBorder: "#1E2D45",
  navyHover: "#1A2840",
  amber: "#D4860A",
  amberBright: "#F59E0B",
  amberDim: "#92600A",
  phosphor: "#22C55E",
  phosphorDim: "#166534",
  crimson: "#DC2626",
  sky: "#38BDF8",
  slate: "#94A3B8",
  slateLight: "#CBD5E1",
  white: "#F1F5F9",
};

// ─── Mock Live Data ─────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: "lead", label: "Lead", count: 1842, value: 4_210_000 },
  { id: "research", label: "Research", count: 394, value: 1_180_000 },
  { id: "skip_traced", label: "Skip Traced", count: 271, value: 890_000 },
  { id: "contacted", label: "Contacted", count: 183, value: 640_000 },
  { id: "qualified", label: "Qualified", count: 97, value: 420_000 },
  { id: "agreement_sent", label: "Agreement Sent", count: 54, value: 288_000 },
  { id: "signed", label: "Signed", count: 31, value: 186_000 },
  { id: "claim_filed", label: "Claim Filed", count: 18, value: 112_000 },
  { id: "awaiting", label: "Awaiting Recovery", count: 11, value: 77_000 },
  { id: "paid", label: "Paid", count: 6, value: 43_200 },
];

const TOP_LEADS = [
  { id: 1, name: "Margaret R. Okafor", county: "Cuyahoga, OH", surplus: 84_200, score: 94, stage: "Contacted", phone: "(216) 555-0142", daysOld: 3 },
  { id: 2, name: "James T. Holloway", county: "Lee, FL", surplus: 67_800, score: 91, stage: "Skip Traced", phone: "(239) 555-0887", daysOld: 7 },
  { id: 3, name: "Patricia M. Vasquez", county: "Volusia, FL", surplus: 112_400, score: 89, stage: "Research", phone: null, daysOld: 1 },
  { id: 4, name: "Robert L. Nguyen", county: "Osceola, FL", surplus: 55_100, score: 87, stage: "Qualified", phone: "(407) 555-0331", daysOld: 12 },
  { id: 5, name: "Dorothy K. Williams", county: "Collier, FL", surplus: 93_600, score: 85, stage: "Agreement Sent", phone: "(239) 555-0219", daysOld: 5 },
];

const WORKER_STATUS = [
  { id: "cuyahoga-oh", name: "Cuyahoga OH Crawler", status: "running", lastRun: "2m ago", leads: 142 },
  { id: "volusia-fl", name: "Volusia FL Crawler", status: "running", lastRun: "8m ago", leads: 89 },
  { id: "lee-fl", name: "Lee FL Crawler", status: "idle", lastRun: "1h ago", leads: 0 },
  { id: "skip-trace", name: "Skip Trace Worker", status: "running", lastRun: "Just now", leads: 31 },
  { id: "ai-score", name: "AI Scoring Engine", status: "running", lastRun: "4m ago", leads: 67 },
  { id: "dedup", name: "Deduplication Engine", status: "error", lastRun: "22m ago", leads: 0 },
];

const DEADLINES = [
  { case: "Okafor v. Cuyahoga", days: 3, type: "Filing Deadline", amount: 84_200 },
  { case: "Holloway Estate", days: 7, type: "Agreement Expiry", amount: 67_800 },
  { case: "Vasquez Claim", days: 14, type: "Court Response", amount: 112_400 },
  { case: "Chen Surplus", days: 21, type: "Filing Deadline", amount: 38_900 },
];

const REVENUE_SPARKLINE = [18400, 22100, 19800, 31200, 28700, 34100, 29900, 38400, 41200, 43200];

// ─── Utilities ──────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n}`;
const fmtFull = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const scoreColor = (s) => s >= 90 ? TOKENS.phosphor : s >= 75 ? TOKENS.amberBright : TOKENS.crimson;

// ─── Sub-components ─────────────────────────────────────────────────────────

function RadarPulse({ value, max }) {
  const pct = Math.min(value / max, 1);
  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke={TOKENS.navyBorder} strokeWidth="3" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={TOKENS.amber}
          strokeWidth="3" strokeDasharray={`${pct * 176} 176`}
          strokeLinecap="round" transform="rotate(-90 32 32)" />
        <circle cx="32" cy="32" r="18" fill="none" stroke={TOKENS.navyBorder} strokeWidth="1.5" />
        <circle cx="32" cy="32" r="4" fill={TOKENS.amber} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: TOKENS.amberBright, fontFamily: "monospace" }}>
        {Math.round(pct * 100)}%
      </div>
    </div>
  );
}

function SparkBar({ data, color }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          width: 8, borderRadius: 2,
          height: `${(v / max) * 100}%`,
          background: i === data.length - 1 ? color : `${color}60`,
          transition: "height 0.3s ease",
        }} />
      ))}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { running: TOKENS.phosphor, idle: TOKENS.slate, error: TOKENS.crimson };
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: colors[status] || TOKENS.slate,
      boxShadow: status === "running" ? `0 0 6px ${colors.running}` : "none" }} />
  );
}

function PipelineFunnel({ stages }) {
  const max = stages[0].count;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {stages.map((s, i) => {
        const pct = (s.count / max) * 100;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 110, fontSize: 11, color: TOKENS.slate, textAlign: "right", flexShrink: 0 }}>
              {s.label}
            </div>
            <div style={{ flex: 1, height: 20, background: TOKENS.navyBorder, borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: i < 4 ? `linear-gradient(90deg, ${TOKENS.amberDim}, ${TOKENS.amber})` :
                  i < 7 ? `linear-gradient(90deg, ${TOKENS.sky}80, ${TOKENS.sky})` :
                  `linear-gradient(90deg, ${TOKENS.phosphorDim}, ${TOKENS.phosphor})`,
                transition: "width 0.6s ease",
                display: "flex", alignItems: "center", paddingLeft: 6,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TOKENS.navy, whiteSpace: "nowrap" }}>
                  {s.count.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ width: 72, fontSize: 11, color: TOKENS.slate, flexShrink: 0, fontFamily: "monospace" }}>
              {fmt(s.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBadge({ score }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 36, height: 36, borderRadius: "50%",
      border: `2px solid ${scoreColor(score)}`,
      fontSize: 11, fontWeight: 800, fontFamily: "monospace",
      color: scoreColor(score),
    }}>{score}</span>
  );
}

function StagePill({ stage }) {
  const stageColors = {
    "Lead": TOKENS.slate, "Research": TOKENS.sky, "Skip Traced": TOKENS.amberBright,
    "Contacted": TOKENS.amber, "Qualified": TOKENS.phosphor, "Agreement Sent": TOKENS.phosphor,
    "Signed": TOKENS.phosphor, "Claim Filed": TOKENS.phosphor,
  };
  const c = stageColors[stage] || TOKENS.slate;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
      background: `${c}20`, color: c, border: `1px solid ${c}40`,
    }}>{stage}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: TOKENS.navySurface,
      border: `1px solid ${TOKENS.navyBorder}`,
      borderRadius: 10,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ label, sublabel, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </div>
        {sublabel && <div style={{ fontSize: 10, color: TOKENS.navyBorder === sublabel ? TOKENS.slate : `${TOKENS.slate}80`, marginTop: 2 }}>{sublabel}</div>}
      </div>
      {action && <button style={{
        background: "none", border: `1px solid ${TOKENS.navyBorder}`, borderRadius: 6,
        color: TOKENS.slate, fontSize: 11, padding: "4px 10px", cursor: "pointer",
        fontFamily: "inherit",
      }}>{action}</button>}
    </div>
  );
}

function MetricTile({ label, value, sub, trend, color }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 10, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || TOKENS.white, fontFamily: "monospace", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 11, color: trend === "up" ? TOKENS.phosphor : trend === "down" ? TOKENS.crimson : TOKENS.slate }}>
          {trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}{sub}
        </div>
      )}
    </Card>
  );
}

// ─── View: Command Center ────────────────────────────────────────────────────
function ViewOverview({ setTab }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const liveLeads = 1842 + (tick % 5);
  const recovered = 43_200 + tick * 120;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <MetricTile label="Active Leads" value={liveLeads.toLocaleString()} sub="+23 today" trend="up" color={TOKENS.white} />
        <MetricTile label="Total Surplus" value="$7.82M" sub="+$340K this week" trend="up" color={TOKENS.amberBright} />
        <MetricTile label="Recovered (30d)" value={fmt(recovered)} sub="+18% vs last month" trend="up" color={TOKENS.phosphor} />
        <MetricTile label="Avg AI Score" value="78" sub="Active leads only" color={TOKENS.sky} />
        <MetricTile label="Deadlines (7d)" value="3" sub="Action required" trend="down" color={TOKENS.crimson} />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Pipeline Funnel */}
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader label="Recovery Pipeline" sublabel="Live count × value by stage" action="View All" />
          <PipelineFunnel stages={PIPELINE_STAGES} />
        </Card>

        {/* Top Leads */}
        <Card>
          <CardHeader label="Priority Queue" sublabel="Ranked by AI recovery score" action="Open Dialer" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TOP_LEADS.map(lead => (
              <div key={lead.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: TOKENS.navyMid, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${TOKENS.navyBorder}`,
              }}>
                <ScoreBadge score={lead.score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lead.name}
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.slate, marginTop: 2 }}>{lead.county}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.amberBright, fontFamily: "monospace" }}>
                    {fmtFull(lead.surplus)}
                  </div>
                  <StagePill stage={lead.stage} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Worker Status */}
          <Card>
            <CardHeader label="Worker Health" sublabel="Crawler & processor status" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {WORKER_STATUS.map(w => (
                <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  background: TOKENS.navyMid, borderRadius: 6 }}>
                  <StatusDot status={w.status} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: TOKENS.white }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: TOKENS.slate }}>{w.lastRun}</div>
                  </div>
                  {w.leads > 0 && (
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: TOKENS.phosphor, fontWeight: 700 }}>
                      +{w.leads}
                    </span>
                  )}
                  {w.status === "error" && (
                    <span style={{ fontSize: 10, color: TOKENS.crimson, fontWeight: 700 }}>ERR</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader label="Recovery Revenue" sublabel="Last 10 closed cases" />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: TOKENS.phosphor, fontFamily: "monospace" }}>
                  $43.2K
                </div>
                <div style={{ fontSize: 11, color: TOKENS.slate, marginTop: 4 }}>Last recovery</div>
              </div>
              <SparkBar data={REVENUE_SPARKLINE} color={TOKENS.phosphor} />
            </div>
          </Card>

          {/* Deadlines */}
          <Card>
            <CardHeader label="Upcoming Deadlines" sublabel="Next 30 days" action="View All" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DEADLINES.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: d.days <= 7 ? `${TOKENS.crimson}20` : `${TOKENS.amber}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, fontFamily: "monospace",
                    color: d.days <= 7 ? TOKENS.crimson : TOKENS.amberBright,
                  }}>
                    {d.days}d
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: TOKENS.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.case}
                    </div>
                    <div style={{ fontSize: 10, color: TOKENS.slate }}>{d.type}</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: TOKENS.amberBright, flexShrink: 0 }}>
                    {fmt(d.amount)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── View: Leads ─────────────────────────────────────────────────────────────
function ViewLeads() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");

  const stages = ["all", ...new Set(TOP_LEADS.map(l => l.stage))];
  const extended = [...TOP_LEADS,
    { id: 6, name: "Charles B. Freeman", county: "Cuyahoga, OH", surplus: 29_400, score: 82, stage: "Lead", phone: null, daysOld: 0 },
    { id: 7, name: "Ruth A. Delgado", county: "Lee, FL", surplus: 71_200, score: 79, stage: "Research", phone: "(239) 555-0004", daysOld: 4 },
    { id: 8, name: "Thomas E. Nakamura", county: "Collier, FL", surplus: 44_800, score: 76, stage: "Lead", phone: null, daysOld: 1 },
  ];

  const filtered = extended
    .filter(l => stageFilter === "all" || l.stage === stageFilter)
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.county.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "surplus" ? b.surplus - a.surplus : a.daysOld - b.daysOld);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads…"
          style={{
            flex: 1, minWidth: 200, padding: "9px 14px",
            background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`,
            borderRadius: 8, color: TOKENS.white, fontSize: 13, outline: "none", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {stages.map(s => (
            <button key={s} onClick={() => setStageFilter(s)} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${stageFilter === s ? TOKENS.amber : TOKENS.navyBorder}`,
              background: stageFilter === s ? `${TOKENS.amber}20` : TOKENS.navySurface,
              color: stageFilter === s ? TOKENS.amberBright : TOKENS.slate,
            }}>{s === "all" ? "All Stages" : s}</button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          padding: "9px 12px", background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`,
          borderRadius: 8, color: TOKENS.slate, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        }}>
          <option value="score">Sort: AI Score</option>
          <option value="surplus">Sort: Surplus Value</option>
          <option value="daysOld">Sort: Newest</option>
        </select>
      </div>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.navyBorder}` }}>
              {["Score", "Claimant", "County", "Surplus", "Stage", "Phone", "Age", "Action"].map(h => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left", fontSize: 10,
                  color: TOKENS.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, i) => (
              <tr key={lead.id} style={{
                borderBottom: `1px solid ${TOKENS.navyBorder}`,
                background: i % 2 === 0 ? "transparent" : `${TOKENS.navyMid}60`,
                cursor: "pointer",
              }}>
                <td style={{ padding: "12px 16px" }}><ScoreBadge score={lead.score} /></td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.white }}>{lead.name}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: TOKENS.slate }}>{lead.county}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: TOKENS.amberBright, fontFamily: "monospace" }}>
                  {fmtFull(lead.surplus)}
                </td>
                <td style={{ padding: "12px 16px" }}><StagePill stage={lead.stage} /></td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: lead.phone ? TOKENS.sky : TOKENS.slate, fontFamily: "monospace" }}>
                  {lead.phone || "—"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: TOKENS.slate, fontFamily: "monospace" }}>
                  {lead.daysOld === 0 ? "Today" : `${lead.daysOld}d`}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{
                      padding: "5px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                      background: lead.phone ? `${TOKENS.phosphor}20` : `${TOKENS.slate}20`,
                      border: `1px solid ${lead.phone ? TOKENS.phosphor : TOKENS.slate}40`,
                      color: lead.phone ? TOKENS.phosphor : TOKENS.slate,
                    }}>
                      {lead.phone ? "Call" : "Skip Trace"}
                    </button>
                    <button style={{
                      padding: "5px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                      background: "none", border: `1px solid ${TOKENS.navyBorder}`, color: TOKENS.slate,
                    }}>Open</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ fontSize: 12, color: TOKENS.slate, textAlign: "center" }}>
        Showing {filtered.length} leads — <span style={{ color: TOKENS.amber }}>PostgREST pagination active</span> (`.range()` loop for full dataset)
      </div>
    </div>
  );
}

// ─── View: Execution Hub ──────────────────────────────────────────────────────
function ViewExecution() {
  const [dialing, setDialing] = useState(false);
  const [currentLead, setCurrentLead] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [disposition, setDisposition] = useState(null);
  const timerRef = useRef(null);

  const lead = TOP_LEADS[currentLead];

  useEffect(() => {
    if (dialing) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [dialing]);

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const DISPOSITIONS = ["Connected", "Voicemail", "Wrong Number", "Call Back", "Do Not Contact", "Deceased", "Attorney Represented"];

  const handleDispose = (d) => {
    setDisposition(d);
    setDialing(false);
    setTimeout(() => {
      setDisposition(null);
      setCurrentLead(i => (i + 1) % TOP_LEADS.length);
    }, 1500);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      {/* Dialer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <CardHeader label="Power Dialer" sublabel="TCPA-gated · Highest score first" />
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
                padding: 16, background: TOKENS.navyMid, borderRadius: 10, border: `1px solid ${TOKENS.navyBorder}` }}>
                <ScoreBadge score={lead.score} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TOKENS.white }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: TOKENS.slate }}>{lead.county}</div>
                  <div style={{ fontSize: 13, color: TOKENS.amberBright, fontFamily: "monospace", marginTop: 4 }}>
                    {fmtFull(lead.surplus)} surplus
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <StagePill stage={lead.stage} />
                </div>
              </div>

              {/* Phone row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, padding: "12px 16px", background: TOKENS.navyMid,
                  borderRadius: 8, border: `1px solid ${TOKENS.navyBorder}` }}>
                  <div style={{ fontSize: 11, color: TOKENS.slate, marginBottom: 4 }}>Primary Phone</div>
                  <div style={{ fontSize: 15, fontFamily: "monospace", color: TOKENS.sky }}>
                    {lead.phone || "No phone — skip trace required"}
                  </div>
                </div>
                {lead.phone && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: TOKENS.slate }}>Confidence</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: TOKENS.phosphor }}>94%</div>
                  </div>
                )}
              </div>

              {/* Call controls */}
              {dialing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
                    background: `${TOKENS.phosphor}15`, borderRadius: 10, border: `1px solid ${TOKENS.phosphor}40` }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: TOKENS.phosphor,
                      animation: "pulse 1s infinite" }} />
                    <span style={{ color: TOKENS.phosphor, fontWeight: 700 }}>Live Call</span>
                    <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: TOKENS.white }}>
                      {fmtTime(elapsed)}
                    </span>
                    <button onClick={() => setDialing(false)} style={{
                      padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                      background: TOKENS.crimson, border: "none", color: "white", fontWeight: 700, fontSize: 13,
                    }}>End Call</button>
                  </div>
                  <div style={{ fontSize: 12, color: TOKENS.slate, marginBottom: 6 }}>Disposition:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DISPOSITIONS.map(d => (
                      <button key={d} onClick={() => handleDispose(d)} style={{
                        padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                        background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`,
                        color: TOKENS.slateLight, fontSize: 12,
                      }}>{d}</button>
                    ))}
                  </div>
                </div>
              ) : disposition ? (
                <div style={{ padding: 16, background: `${TOKENS.phosphor}15`, borderRadius: 10, textAlign: "center" }}>
                  <div style={{ color: TOKENS.phosphor, fontWeight: 700 }}>Logged: {disposition}</div>
                  <div style={{ color: TOKENS.slate, fontSize: 12, marginTop: 4 }}>Loading next lead…</div>
                </div>
              ) : (
                <button onClick={() => lead.phone && setDialing(true)} style={{
                  width: "100%", padding: "14px", borderRadius: 10, cursor: lead.phone ? "pointer" : "not-allowed",
                  background: lead.phone ? `linear-gradient(135deg, ${TOKENS.phosphorDim}, ${TOKENS.phosphor})` : TOKENS.navyBorder,
                  border: "none", color: lead.phone ? TOKENS.navy : TOKENS.slate,
                  fontSize: 15, fontWeight: 800, fontFamily: "inherit",
                }}>
                  {lead.phone ? "▶ Initiate Call" : "Skip Trace Required"}
                </button>
              )}
            </div>

            {/* Queue preview */}
            <div style={{ width: 180, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: TOKENS.slate, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 10 }}>Up Next</div>
              {TOP_LEADS.slice(1, 4).map((l, i) => (
                <div key={l.id} style={{ padding: "8px 10px", borderRadius: 8,
                  background: TOKENS.navyMid, marginBottom: 6,
                  border: `1px solid ${TOKENS.navyBorder}`, opacity: 1 - i * 0.2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: scoreColor(l.score), fontWeight: 700 }}>
                      {l.score}
                    </span>
                    <span style={{ fontSize: 11, color: TOKENS.slateLight, flex: 1, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: TOKENS.slate, marginTop: 2 }}>{fmt(l.surplus)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader label="Activity Log" sublabel="All contact events — auto-logged" />
          {[
            { time: "10:42 AM", type: "Call", lead: "Dorothy K. Williams", note: "Disposition: Connected · 4m 12s", color: TOKENS.phosphor },
            { time: "10:38 AM", type: "SMS", lead: "Robert L. Nguyen", note: "Agreement reminder sent", color: TOKENS.sky },
            { time: "10:31 AM", type: "Call", lead: "James T. Holloway", note: "Disposition: Voicemail · 0m 32s", color: TOKENS.amber },
            { time: "10:15 AM", type: "Doc", lead: "Dorothy K. Williams", note: "Contingency agreement generated", color: TOKENS.amberBright },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0",
              borderBottom: i < 3 ? `1px solid ${TOKENS.navyBorder}` : "none" }}>
              <div style={{ fontSize: 10, color: TOKENS.slate, fontFamily: "monospace", width: 60, flexShrink: 0, paddingTop: 2 }}>
                {a.time}
              </div>
              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: `${a.color}20`, color: a.color, height: "fit-content", flexShrink: 0 }}>
                {a.type}
              </span>
              <div>
                <div style={{ fontSize: 12, color: TOKENS.white }}>{a.lead}</div>
                <div style={{ fontSize: 11, color: TOKENS.slate }}>{a.note}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Right panel: Lead detail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <CardHeader label="Case Detail" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "State", value: "Florida" },
              { label: "Statute", value: "§197.582" },
              { label: "Max Fee", value: "20%" },
              { label: "POA Required", value: "Yes" },
              { label: "Notarization", value: "Yes" },
              { label: "Claim Window", value: "2 years" },
              { label: "Filing Method", value: "County Clerk" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
                padding: "8px 0", borderBottom: `1px solid ${TOKENS.navyBorder}` }}>
                <span style={{ fontSize: 12, color: TOKENS.slate }}>{r.label}</span>
                <span style={{ fontSize: 12, color: TOKENS.white, fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader label="Documents" action="Generate" />
          {[
            { name: "Contingency Agreement", status: "Signed", icon: "✓" },
            { name: "Authorization to Represent", status: "Pending", icon: "○" },
            { name: "FL State Claim Form", status: "Not Started", icon: "—" },
          ].map(d => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: `1px solid ${TOKENS.navyBorder}` }}>
              <span style={{ fontSize: 14, color: d.status === "Signed" ? TOKENS.phosphor : TOKENS.slate }}>
                {d.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: TOKENS.white }}>{d.name}</div>
                <div style={{ fontSize: 10, color: TOKENS.slate }}>{d.status}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader label="Filing Deadline" />
          <div style={{ padding: 16, background: `${TOKENS.crimson}15`, borderRadius: 8,
            border: `1px solid ${TOKENS.crimson}40`, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: TOKENS.crimson, fontFamily: "monospace" }}>7</div>
            <div style={{ fontSize: 12, color: TOKENS.slateLight }}>days remaining</div>
            <div style={{ fontSize: 11, color: TOKENS.slate, marginTop: 6 }}>
              Court deadline: Jul 11, 2026
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── View: Intelligence ──────────────────────────────────────────────────────
function ViewIntelligence() {
  const [query, setQuery] = useState("");
  const [profiled, setProfiled] = useState(null);
  const [loading, setLoading] = useState(false);

  const runProfile = () => {
    if (!query) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setProfiled({
        name: "Margaret R. Okafor",
        age: 67,
        phones: [
          { number: "(216) 555-0142", confidence: 94, carrier: "Verizon", type: "Mobile", dncClear: true },
          { number: "(216) 555-0891", confidence: 71, carrier: "AT&T", type: "Landline", dncClear: false },
        ],
        emails: ["mokafor@gmail.com", "margaretokafor@yahoo.com"],
        addresses: [
          { addr: "1842 Euclid Ave, Cleveland OH", type: "Current" },
          { addr: "903 Mayfield Rd, Cleveland Heights OH", type: "Previous" },
        ],
        relatives: ["David Okafor (Son)", "Adaeze Williams (Daughter)", "Samuel Okafor (Brother)"],
        properties: 2,
        deceased: false,
        bankruptcy: false,
        propensity: { recovery: 94, revenue: 16_840, timeMonths: 3, tier: "Priority" },
      });
    }, 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search */}
      <Card>
        <CardHeader label="Identity Resolution Engine" sublabel="Skip trace & OSINT enrichment" />
        <div style={{ display: "flex", gap: 10 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runProfile()}
            placeholder="Enter name, address, or lead ID…"
            style={{ flex: 1, padding: "10px 14px", background: TOKENS.navyMid,
              border: `1px solid ${TOKENS.navyBorder}`, borderRadius: 8,
              color: TOKENS.white, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <button onClick={runProfile} style={{
            padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            background: `linear-gradient(135deg, ${TOKENS.amberDim}, ${TOKENS.amber})`,
            border: "none", color: TOKENS.navy, fontWeight: 700, fontSize: 13,
          }}>
            {loading ? "Resolving…" : "Run Skip Trace"}
          </button>
        </div>
      </Card>

      {profiled && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 16 }}>
          {/* Identity */}
          <Card>
            <CardHeader label="Identity Profile" />
            <div style={{ fontSize: 18, fontWeight: 700, color: TOKENS.white, marginBottom: 4 }}>{profiled.name}</div>
            <div style={{ fontSize: 13, color: TOKENS.slate, marginBottom: 16 }}>Age {profiled.age} · {profiled.properties} properties</div>

            <div style={{ fontSize: 11, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Addresses</div>
            {profiled.addresses.map(a => (
              <div key={a.addr} style={{ padding: "8px 10px", background: TOKENS.navyMid, borderRadius: 6, marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: TOKENS.white }}>{a.addr}</div>
                <div style={{ fontSize: 10, color: TOKENS.slate }}>{a.type}</div>
              </div>
            ))}

            <div style={{ fontSize: 11, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 8px" }}>Relatives</div>
            {profiled.relatives.map(r => (
              <div key={r} style={{ padding: "6px 10px", background: TOKENS.navyMid, borderRadius: 6, marginBottom: 4,
                fontSize: 12, color: TOKENS.slateLight }}>{r}</div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[
                { label: "Deceased", val: profiled.deceased, bad: true },
                { label: "Bankruptcy", val: profiled.bankruptcy, bad: true },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: "8px 10px", background: TOKENS.navyMid, borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: TOKENS.slate }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.val === s.bad ? TOKENS.crimson : TOKENS.phosphor }}>
                    {s.val ? "Yes" : "No"}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Phones & Emails */}
          <Card>
            <CardHeader label="Contact Intelligence" />
            <div style={{ fontSize: 11, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Phones</div>
            {profiled.phones.map(p => (
              <div key={p.number} style={{ padding: "12px", background: TOKENS.navyMid, borderRadius: 8, marginBottom: 8,
                border: `1px solid ${p.confidence > 85 ? `${TOKENS.phosphor}40` : TOKENS.navyBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontFamily: "monospace", color: TOKENS.sky }}>{p.number}</div>
                  <RadarPulse value={p.confidence} max={100} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: TOKENS.slate }}>{p.carrier}</span>
                  <span style={{ fontSize: 11, color: TOKENS.slate }}>{p.type}</span>
                  <span style={{ fontSize: 11, color: p.dncClear ? TOKENS.phosphor : TOKENS.crimson }}>
                    DNC {p.dncClear ? "Clear" : "Flagged"}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em", margin: "14px 0 10px" }}>Emails</div>
            {profiled.emails.map(e => (
              <div key={e} style={{ padding: "10px 12px", background: TOKENS.navyMid, borderRadius: 6, marginBottom: 6,
                fontSize: 13, fontFamily: "monospace", color: TOKENS.sky }}>{e}</div>
            ))}
          </Card>

          {/* AI Propensity */}
          <Card>
            <CardHeader label="AI Propensity Model" />
            <div style={{ padding: 20, background: TOKENS.navyMid, borderRadius: 10, textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: TOKENS.slate, marginBottom: 8 }}>Recovery Probability</div>
              <div style={{ fontSize: 48, fontWeight: 900, color: TOKENS.phosphor, fontFamily: "monospace", lineHeight: 1 }}>
                {profiled.propensity.recovery}%
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{ padding: "4px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                  background: `${TOKENS.phosphor}25`, color: TOKENS.phosphor }}>
                  {profiled.propensity.tier}
                </span>
              </div>
            </div>
            {[
              { label: "Expected Revenue", value: fmtFull(profiled.propensity.revenue) },
              { label: "Est. Time to Recovery", value: `${profiled.propensity.timeMonths} months` },
              { label: "Surplus Amount", value: "$84,200" },
              { label: "Case Type", value: "Tax Deed Surplus" },
              { label: "Filing Risk", value: "Low" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between",
                padding: "9px 0", borderBottom: `1px solid ${TOKENS.navyBorder}` }}>
                <span style={{ fontSize: 12, color: TOKENS.slate }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: TOKENS.white }}>{m.value}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!profiled && !loading && (
        <Card>
          <div style={{ padding: 40, textAlign: "center", color: TOKENS.slate }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬆</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.slateLight }}>Enter a name or lead ID above</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Resolves identity across 18+ OSINT platforms with Twilio Lookup v2 phone scrub
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── View: Counties ───────────────────────────────────────────────────────────
function ViewCounties() {
  const counties = [
    { fips: "39035", name: "Cuyahoga", state: "OH", leads: 142, surplus: 1_840_000, status: "active", lastSync: "2m ago" },
    { fips: "12127", name: "Volusia", state: "FL", leads: 89, surplus: 1_120_000, status: "active", lastSync: "8m ago" },
    { fips: "12071", name: "Lee", state: "FL", leads: 67, surplus: 890_000, status: "idle", lastSync: "1h ago" },
    { fips: "12097", name: "Osceola", state: "FL", leads: 44, surplus: 640_000, status: "active", lastSync: "15m ago" },
    { fips: "12021", name: "Collier", state: "FL", leads: 38, surplus: 520_000, status: "active", lastSync: "31m ago" },
    { fips: "06085", name: "Santa Clara", state: "CA", leads: 0, surplus: 0, status: "pending", lastSync: "Never" },
    { fips: "12086", name: "Miami-Dade", state: "FL", leads: 0, surplus: 0, status: "pending", lastSync: "Never" },
    { fips: "48201", name: "Harris", state: "TX", leads: 0, surplus: 0, status: "pending", lastSync: "Never" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <MetricTile label="Active Counties" value="5" sub="Nationwide coverage" color={TOKENS.phosphor} />
        <MetricTile label="Total Config Entries" value="586+" sub="Across 32 states" color={TOKENS.sky} />
        <MetricTile label="Supabase Rows" value="3,143" sub="counties table" color={TOKENS.amberBright} />
        <MetricTile label="Pending Sync" value="577" sub="FIPS upsert pending" color={TOKENS.slate} />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${TOKENS.navyBorder}`, display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: TOKENS.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}>County Coverage</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              background: `${TOKENS.amber}20`, border: `1px solid ${TOKENS.amber}40`, color: TOKENS.amberBright }}>
              Run Upsert Sync
            </button>
            <button style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`, color: TOKENS.slate }}>
              + Add County
            </button>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.navyBorder}` }}>
              {["FIPS", "County", "State", "Active Leads", "Surplus Value", "Crawler", "Last Sync", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10,
                  color: TOKENS.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {counties.map((c, i) => (
              <tr key={c.fips} style={{ borderBottom: `1px solid ${TOKENS.navyBorder}`,
                background: i % 2 === 0 ? "transparent" : `${TOKENS.navyMid}40` }}>
                <td style={{ padding: "12px 16px", fontSize: 11, fontFamily: "monospace", color: TOKENS.slate }}>{c.fips}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: TOKENS.white }}>{c.name}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: TOKENS.slate }}>{c.state}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace", color: c.leads > 0 ? TOKENS.white : TOKENS.slate }}>
                  {c.leads > 0 ? c.leads.toLocaleString() : "—"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace", color: c.surplus > 0 ? TOKENS.amberBright : TOKENS.slate }}>
                  {c.surplus > 0 ? fmt(c.surplus) : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusDot status={c.status} />
                    <span style={{ fontSize: 11, color: TOKENS.slate, textTransform: "capitalize" }}>{c.status}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: TOKENS.slate, fontFamily: "monospace" }}>{c.lastSync}</td>
                <td style={{ padding: "12px 16px" }}>
                  <button style={{ padding: "5px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                    background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`, color: TOKENS.slate }}>
                    Configure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Main App Shell ──────────────────────────────────────────────────────────
const NAV = [
  { id: "overview", label: "Command Center", icon: "◈" },
  { id: "leads", label: "Leads", icon: "◉" },
  { id: "execution", label: "Execution Hub", icon: "▶" },
  { id: "intelligence", label: "Intelligence", icon: "◌" },
  { id: "counties", label: "Counties", icon: "◫" },
];

export default function RecoverOS() {
  const [tab, setTab] = useState("overview");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const renderView = () => {
    if (tab === "overview") return <ViewOverview setTab={setTab} />;
    if (tab === "leads") return <ViewLeads />;
    if (tab === "execution") return <ViewExecution />;
    if (tab === "intelligence") return <ViewIntelligence />;
    if (tab === "counties") return <ViewCounties />;
    return null;
  };

  return (
    <div style={{
      minHeight: "100vh", background: TOKENS.navy, color: TOKENS.white,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: ${TOKENS.slate}; }
        select option { background: ${TOKENS.navySurface}; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${TOKENS.navySurface}; }
        ::-webkit-scrollbar-thumb { background: ${TOKENS.navyBorder}; border-radius: 3px; }
      `}</style>

      {/* Top bar */}
      <div style={{
        height: 52, background: TOKENS.navyMid, borderBottom: `1px solid ${TOKENS.navyBorder}`,
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6,
            background: `linear-gradient(135deg, ${TOKENS.amberDim}, ${TOKENS.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: TOKENS.navy }}>R</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.white, lineHeight: 1 }}>RecoverOS</div>
            <div style={{ fontSize: 9, color: TOKENS.slate, letterSpacing: "0.12em", textTransform: "uppercase" }}>Asset Recovery Platform</div>
          </div>
        </div>

        {/* Nav */}
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6,
            background: tab === n.id ? `${TOKENS.amber}20` : "none",
            border: `1px solid ${tab === n.id ? `${TOKENS.amber}50` : "transparent"}`,
            color: tab === n.id ? TOKENS.amberBright : TOKENS.slate,
            fontSize: 12, fontWeight: tab === n.id ? 700 : 400,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 10 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status="running" />
            <span style={{ fontSize: 11, color: TOKENS.slate }}>Live</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: TOKENS.slate }}>
            {time.toLocaleTimeString()}
          </div>
          <div style={{ width: 28, height: 28, borderRadius: "50%",
            background: TOKENS.navyBorder, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, color: TOKENS.slate }}>E</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        {/* Page header */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TOKENS.white }}>
              {NAV.find(n => n.id === tab)?.label}
            </h1>
            <div style={{ fontSize: 11, color: TOKENS.slate, marginTop: 3 }}>
              Primary project: <span style={{ color: TOKENS.sky, fontFamily: "monospace" }}>boydxuauwzwpllaeksjw</span>
              {" · "}RLS enforced on all tables
              {" · "}PostgREST pagination active
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: TOKENS.navySurface, border: `1px solid ${TOKENS.navyBorder}`, color: TOKENS.slate, fontSize: 12 }}>
              Refresh Data
            </button>
            <button style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: `linear-gradient(135deg, ${TOKENS.amberDim}, ${TOKENS.amber})`,
              border: "none", color: TOKENS.navy, fontWeight: 700, fontSize: 12 }}>
              + New Lead
            </button>
          </div>
        </div>

        {renderView()}
      </div>
    </div>
  );
}
