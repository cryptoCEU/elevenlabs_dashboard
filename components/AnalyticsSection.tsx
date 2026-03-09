"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

type Granularity = "day" | "week" | "month";
type Preset = "7d" | "30d" | "90d" | "custom";

interface DataPoint {
  date: string;
  total: number;
  completed: number;
  failed: number;
  avg_duration: number;
  avg_latency: number;
  total_cost: number;
  avg_messages: number;
}

const AMBER = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const PURPLE = "#a855f7";
const DIM = "#404040";

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border border-terminal-border rounded p-3 font-mono text-xs"
      style={{ background: "#0a0a0a", minWidth: 160 }}
    >
      <div className="text-terminal-amber mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsSection() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeChart, setActiveChart] = useState<"volume" | "duration" | "latency" | "cost">("volume");

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (preset === "7d") return { from: subDays(now, 7), to: now };
    if (preset === "30d") return { from: subDays(now, 30), to: now };
    if (preset === "90d") return { from: subMonths(now, 3), to: now };
    if (preset === "custom" && customFrom && customTo) {
      return {
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(new Date(customTo)),
      };
    }
    return { from: subDays(now, 30), to: now };
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
    });
    try {
      const res = await fetch(`/api/analytics?${params}`);
      const json = await res.json();
      setData(json.data || []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [getDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (granularity === "month") return format(d, "MMM yy", { locale: es });
      if (granularity === "week") return format(d, "dd MMM", { locale: es });
      return format(d, "dd MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  // Summary stats from data
  const summary = data.reduce(
    (acc, d) => ({
      total: acc.total + d.total,
      completed: acc.completed + d.completed,
      failed: acc.failed + d.failed,
      total_cost: acc.total_cost + d.total_cost,
      avg_duration: acc.avg_duration + d.avg_duration,
      avg_latency: acc.avg_latency + d.avg_latency,
      _count: acc._count + 1,
    }),
    { total: 0, completed: 0, failed: 0, total_cost: 0, avg_duration: 0, avg_latency: 0, _count: 0 }
  );
  const avgDuration = summary._count > 0 ? Math.round(summary.avg_duration / summary._count) : 0;
  const avgLatency = summary._count > 0 ? Math.round(summary.avg_latency / summary._count) : 0;
  const successRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  const charts = [
    { id: "volume" as const, label: "VOLUMEN", color: AMBER },
    { id: "duration" as const, label: "DURACIÓN", color: BLUE },
    { id: "latency" as const, label: "LATENCIA", color: GREEN },
    { id: "cost" as const, label: "COSTE", color: PURPLE },
  ];

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded" style={{ background: AMBER }} />
        <span className="font-mono text-sm text-terminal-amber tracking-widest">ANALYTICS</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        {/* Preset selector */}
        <div>
          <div className="font-mono text-xs text-terminal-dim mb-1 tracking-wider">RANGO</div>
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`font-mono text-xs px-3 py-1.5 border rounded transition-all ${
                  preset === p
                    ? "border-terminal-amber text-terminal-amber"
                    : "border-terminal-border text-terminal-dim hover:border-terminal-muted"
                }`}
              >
                {p === "custom" ? "CUSTOM" : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {preset === "custom" && (
          <div className="flex gap-2 items-end">
            <div>
              <div className="font-mono text-xs text-terminal-dim mb-1 tracking-wider">DESDE</div>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="font-mono text-xs bg-terminal-surface border border-terminal-border rounded px-3 py-1.5 text-terminal-text focus:outline-none focus:border-terminal-amber"
              />
            </div>
            <div>
              <div className="font-mono text-xs text-terminal-dim mb-1 tracking-wider">HASTA</div>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="font-mono text-xs bg-terminal-surface border border-terminal-border rounded px-3 py-1.5 text-terminal-text focus:outline-none focus:border-terminal-amber"
              />
            </div>
          </div>
        )}

        {/* Granularity */}
        <div>
          <div className="font-mono text-xs text-terminal-dim mb-1 tracking-wider">AGRUPACIÓN</div>
          <div className="flex gap-1">
            {(["day", "week", "month"] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`font-mono text-xs px-3 py-1.5 border rounded transition-all ${
                  granularity === g
                    ? "border-terminal-blue text-terminal-blue"
                    : "border-terminal-border text-terminal-dim hover:border-terminal-muted"
                }`}
              >
                {g === "day" ? "DÍA" : g === "week" ? "SEMANA" : "MES"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fetchData}
          className="font-mono text-xs px-3 py-1.5 border border-terminal-amber text-terminal-amber rounded hover:bg-terminal-amber hover:text-black transition-all"
        >
          ↻ ACTUALIZAR
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "LLAMADAS TOTALES", value: summary.total, color: "var(--text)", sub: `${successRate}% éxito` },
          { label: "COMPLETADAS", value: summary.completed, color: GREEN, sub: `${summary.failed} fallidas` },
          { label: "DURACIÓN MEDIA", value: `${avgDuration}s`, color: BLUE, sub: avgDuration >= 60 ? `${Math.floor(avgDuration/60)}m ${avgDuration%60}s` : "" },
          { label: "LATENCIA MEDIA", value: avgLatency > 0 ? `${avgLatency}ms` : "—", color: avgLatency < 500 ? GREEN : avgLatency < 1500 ? AMBER : RED, sub: "p50 agente" },
        ].map((s) => (
          <div key={s.label} className="border border-terminal-border rounded p-4" style={{ background: "var(--surface)" }}>
            <div className="font-mono text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="font-mono text-xs text-terminal-dim mt-1 tracking-wider">{s.label}</div>
            {s.sub && <div className="font-mono text-xs mt-0.5" style={{ color: DIM }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Chart selector tabs */}
      <div className="flex gap-1 mb-4 border-b border-terminal-border">
        {charts.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveChart(c.id)}
            className={`font-mono text-xs px-4 py-2.5 border-b-2 transition-all ${
              activeChart === c.id
                ? "border-current"
                : "border-transparent text-terminal-dim hover:text-terminal-text"
            }`}
            style={activeChart === c.id ? { color: c.color, borderColor: c.color } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div
        className="border border-terminal-border rounded p-5"
        style={{ background: "var(--surface)" }}
      >
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="font-mono text-xs text-terminal-dim animate-pulse">CARGANDO DATOS...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="font-mono text-xs text-terminal-dim text-center">
              <div className="text-2xl mb-2">∅</div>
              <div>SIN DATOS EN ESTE RANGO</div>
            </div>
          </div>
        ) : (
          <>
            {/* VOLUME chart */}
            {activeChart === "volume" && (
              <div>
                <div className="font-mono text-xs text-terminal-dim mb-4 tracking-wider">
                  LLAMADAS POR {granularity === "day" ? "DÍA" : granularity === "week" ? "SEMANA" : "MES"}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={AMBER} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={RED} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={RED} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#71717a" }} />
                    <Area type="monotone" dataKey="total" name="Total" stroke={AMBER} fill="url(#gradAmber)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="completed" name="Completadas" stroke={GREEN} fill="url(#gradGreen)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="failed" name="Fallidas" stroke={RED} fill="url(#gradRed)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* DURATION chart */}
            {activeChart === "duration" && (
              <div>
                <div className="font-mono text-xs text-terminal-dim mb-4 tracking-wider">
                  DURACIÓN MEDIA (segundos) + MENSAJES MEDIOS
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#71717a" }} />
                    <Bar yAxisId="left" dataKey="avg_duration" name="Duración (s)" fill={BLUE} radius={[2, 2, 0, 0]} opacity={0.8} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_messages" name="Mensajes" stroke={AMBER} strokeWidth={2} dot={{ fill: AMBER, r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* LATENCY chart */}
            {activeChart === "latency" && (
              <div>
                <div className="font-mono text-xs text-terminal-dim mb-4 tracking-wider">
                  LATENCIA MEDIA DEL AGENTE (ms)
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGreen2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip content={<CustomTooltip />} />
                    {/* Reference lines for thresholds */}
                    <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#71717a" }} />
                    <Line type="monotone" dataKey="avg_latency" name="Latencia (ms)" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3">
                  {[
                    { label: "< 500ms ÓPTIMO", color: GREEN },
                    { label: "500-1500ms NORMAL", color: AMBER },
                    { label: "> 1500ms LENTO", color: RED },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                      <span className="font-mono text-xs" style={{ color: DIM }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COST chart */}
            {activeChart === "cost" && (
              <div>
                <div className="font-mono text-xs text-terminal-dim mb-4 tracking-wider">
                  COSTE TOTAL ($) POR PERÍODO
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPurple" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor={PURPLE} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_cost" name="Coste ($)" fill="url(#gradPurple)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 font-mono text-xs text-terminal-dim">
                  COSTE TOTAL DEL PERÍODO:{" "}
                  <span className="font-semibold" style={{ color: PURPLE }}>
                    ${summary.total_cost.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
