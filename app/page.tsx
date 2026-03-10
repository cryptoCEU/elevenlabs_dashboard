"use client";

import { useEffect, useState, useCallback } from "react";
import { ElevenLabsCall } from "@/types/elevenlabs";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import CallDetail from "@/components/CallDetail";
import ImportModal from "@/components/ImportModal";
import AnalyticsSection from "@/components/AnalyticsSection";

interface CallsResponse {
  calls: ElevenLabsCall[];
  total: number;
  page: number;
  limit: number;
}

export default function Dashboard() {
  const [data, setData] = useState<CallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<ElevenLabsCall | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchCalls = useCallback(async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
      ...(search && { search }),
    });
    const res = await fetch(`/api/calls?${params}`);
    const json = await res.json();
    setData(json);
    setLastUpdated(new Date());
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchCalls, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchCalls]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const statusColor = (status: string) => {
    if (status === "done" || status === "completed") return "var(--green)";
    if (status === "failed" || status === "error") return "var(--red)";
    if (status === "in_progress" || status === "active") return "var(--amber)";
    return "var(--dim)";
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      done: "COMPLETADA",
      completed: "COMPLETADA",
      failed: "FALLIDA",
      error: "ERROR",
      in_progress: "EN CURSO",
      active: "ACTIVA",
    };
    return map[status] || status.toUpperCase();
  };

  // Deep search helper — looks in metadata, raw_payload, and nested data fields
  const deepFind = (call: ElevenLabsCall, ...keys: string[]): unknown => {
    const sources = [
      call.metadata as Record<string, unknown>,
      call.raw_payload as Record<string, unknown>,
      (call.raw_payload as Record<string, unknown>)?.data as Record<string, unknown>,
      (call.raw_payload as Record<string, unknown>)?.metadata as Record<string, unknown>,
    ].filter(Boolean);
    for (const key of keys) {
      for (const src of sources) {
        if (src?.[key] !== undefined && src?.[key] !== null) return src[key];
        // One level deeper
        for (const v of Object.values(src || {})) {
          if (v && typeof v === "object" && !Array.isArray(v)) {
            const found = (v as Record<string, unknown>)[key];
            if (found !== undefined && found !== null) return found;
          }
        }
      }
    }
    return null;
  };

  const getDuration = (call: ElevenLabsCall) => {
    const raw = deepFind(call, "call_duration_secs", "duration_secs", "duration");
    const secs = typeof raw === "number" ? raw : null;
    if (secs === null) return "—";
    if (secs === 0) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Extract error reason from metadata for failed calls
  const getErrorReason = (call: ElevenLabsCall): string | null => {
    if (!["failed", "error"].includes(call.status)) return null;
    const meta = call.metadata as Record<string, unknown>;
    const err = meta?.error as Record<string, unknown> | null;
    if (err?.reason) return err.reason as string;
    const rawMeta = (call.raw_payload as Record<string, unknown>)?.metadata as Record<string, unknown>;
    const rawErr = rawMeta?.error as Record<string, unknown> | null;
    if (rawErr?.reason) return rawErr.reason as string;
    const termination = meta?.termination_reason as string;
    if (termination) return termination;
    return null;
  };

  const getPhone = (call: ElevenLabsCall) => {
    const phone = (deepFind(call, "phone_call") as Record<string, string>) ||
      (deepFind(call, "caller_id") ? { from: deepFind(call, "caller_id") as string } : null);
    if (!phone) return null;
    return phone.from || phone.to || null;
  };

  const getLatency = (call: ElevenLabsCall): string => {
    // Try latency object first
    const lat = deepFind(call, "latency") as Record<string, number> | null;
    if (lat?.p50) return `${Math.round(lat.p50)}ms`;
    if (lat?.mean) return `${Math.round(lat.mean)}ms`;
    // Try direct latency fields
    const agentLat = deepFind(call, "agent_response_latency_secs", "response_latency_secs") as number | null;
    if (agentLat) return `${Math.round(agentLat * 1000)}ms`;
    return "—";
  };

  const getLLMLatency = (call: ElevenLabsCall): string => {
    const v = deepFind(call, "llm_response_latency_secs", "llm_latency_secs") as number | null;
    if (v) return `${Math.round(v * 1000)}ms`;
    return "—";
  };

  const getTTSLatency = (call: ElevenLabsCall): string => {
    const v = deepFind(call, "tts_latency_secs", "tts_latency") as number | null;
    if (v) return `${Math.round(v * 1000)}ms`;
    return "—";
  };

  // ElevenLabs credits (voice/TTS usage)
  const getCredits = (call: ElevenLabsCall): string => {
    const charging = deepFind(call, "charging") as Record<string, unknown> | null;
    const callCharge = charging?.call_charge as number | null;
    const cost = callCharge ?? (deepFind(call, "cost") as number | null) ?? call.metadata?.cost;
    if (cost == null) return "—";
    if (cost === 0) return "0 cr";
    return `${Math.round(cost)} cr`;
  };

  // LLM cost in dollars
  const getLLMCost = (call: ElevenLabsCall): string => {
    const charging = deepFind(call, "charging") as Record<string, unknown> | null;
    const llmCharge = charging?.llm_charge as number | null;
    if (llmCharge == null) return "—";
    if (llmCharge === 0) return "$0";
    return `$${llmCharge.toFixed(5)}`;
  };

  const stats = data
    ? {
        total: data.total,
        completed: data.calls.filter((c) => ["done", "completed"].includes(c.status)).length,
        failed: data.calls.filter((c) => ["failed", "error"].includes(c.status)).length,
        avgDuration:
          data.calls.reduce((sum, c) => sum + (c.metadata?.call_duration_secs || 0), 0) /
          (data.calls.length || 1),
      }
    : null;

  const TABLE_HEADERS = [
    "ESTADO", "CONVERSATION ID", "TELÉFONO",
    "DURACIÓN", "LATENCIA P50", "LLM", "TTS",
    "MENSAJES", "CRÉDITOS EL", "COSTE LLM", "TIMESTAMP", ""
  ];

  return (
    <div className="min-h-screen text-terminal-text">
      {/* Header */}
      <header
        className="border-b border-terminal-border sticky top-0 z-50"
        style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-terminal-amber animate-pulse" />
              <span className="font-mono text-xs text-terminal-amber tracking-widest uppercase">
                ElevenLabs Monitor
              </span>
            </div>
            <span className="text-terminal-border">|</span>
            <span className="font-mono text-xs text-terminal-dim">CALL INTELLIGENCE DASHBOARD</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-terminal-dim">
              UPD: {format(lastUpdated, "HH:mm:ss")}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`font-mono text-xs px-3 py-1 border rounded transition-all ${
                autoRefresh
                  ? "border-terminal-green text-terminal-green"
                  : "border-terminal-muted text-terminal-dim"
              }`}
            >
              {autoRefresh ? "● AUTO" : "○ MANUAL"}
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="font-mono text-xs px-3 py-1 border border-terminal-blue text-terminal-blue rounded hover:bg-terminal-blue hover:text-black transition-all"
            >
              ⬇ IMPORTAR
            </button>
            <button
              onClick={fetchCalls}
              className="font-mono text-xs px-3 py-1 border border-terminal-amber text-terminal-amber rounded hover:bg-terminal-amber hover:text-black transition-all"
            >
              ↻ SYNC
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "TOTAL LLAMADAS", value: stats.total, color: "var(--text)" },
              { label: "COMPLETADAS", value: stats.completed, color: "var(--green)" },
              { label: "FALLIDAS", value: stats.failed, color: "var(--red)" },
              { label: "DURACIÓN MEDIA", value: `${Math.round(stats.avgDuration)}s`, color: "var(--amber)" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border border-terminal-border rounded p-4"
                style={{ background: "var(--surface)" }}
              >
                <div className="font-mono text-2xl font-bold count-up" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="font-mono text-xs text-terminal-dim mt-1 tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-terminal-amber text-sm">›</span>
            <input
              type="text"
              placeholder="Buscar por conversation ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full font-mono text-sm bg-terminal-surface border border-terminal-border rounded px-8 py-2 text-terminal-text placeholder-terminal-muted focus:outline-none focus:border-terminal-amber transition-colors"
            />
          </div>
          <div
            className="font-mono text-xs text-terminal-dim flex items-center px-3 border border-terminal-border rounded"
            style={{ background: "var(--surface)" }}
          >
            {data?.total ?? 0} REGISTROS
          </div>
        </div>

        {/* Table */}
        <div className="border border-terminal-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-terminal-border" style={{ background: "rgba(245,158,11,0.05)" }}>
                  {TABLE_HEADERS.map((h) => (
                    <th key={h} className="font-mono text-xs text-terminal-dim tracking-widest text-left px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-terminal-border">
                      {Array.from({ length: TABLE_HEADERS.length }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-3 rounded animate-pulse"
                            style={{ background: "var(--border)", width: j === 1 ? "160px" : "50px" }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.calls.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_HEADERS.length} className="text-center py-16">
                      <div className="font-mono text-terminal-dim text-sm">
                        <div className="text-2xl mb-2">∅</div>
                        <div>NO HAY LLAMADAS REGISTRADAS</div>
                        <div className="text-xs mt-2 text-terminal-muted">
                          Configura el webhook en ElevenLabs para comenzar
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data?.calls.map((call, i) => {
                    const latency = getLatency(call);
                    const llmLat = getLLMLatency(call);
                    const ttsLat = getTTSLatency(call);
                    const latencyNum = latency !== "—" ? parseInt(latency) : null;
                    const latencyColor =
                      latencyNum === null ? "var(--dim)"
                      : latencyNum < 500 ? "var(--green)"
                      : latencyNum < 1500 ? "var(--amber)"
                      : "var(--red)";

                    return (
                      <tr
                        key={call.id}
                        onClick={() => setSelectedCall(call)}
                        className="border-b border-terminal-border cursor-pointer transition-all hover:bg-terminal-surface group"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {/* Estado */}
                        <td className="px-4 py-3" style={{ minWidth: 140 }}>
                          <div className="flex items-center gap-2">
                            <span
                              className="status-dot animate-pulse-slow"
                              style={{ background: statusColor(call.status) }}
                            />
                            <span className="font-mono text-xs font-medium" style={{ color: statusColor(call.status) }}>
                              {statusLabel(call.status)}
                            </span>
                          </div>
                          {getErrorReason(call) && (
                            <div className="font-mono text-xs mt-0.5 leading-tight" style={{ color: "var(--red)", opacity: 0.75, maxWidth: 160, whiteSpace: "normal" }}>
                              {(getErrorReason(call) as string).substring(0, 50)}{(getErrorReason(call) as string).length > 50 ? "…" : ""}
                            </div>
                          )}
                        </td>

                        {/* Conversation ID */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-terminal-amber">
                            {call.conversation_id.substring(0, 18)}…
                          </span>
                        </td>

                        {/* Teléfono */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-text">
                            {getPhone(call) || "—"}
                          </span>
                        </td>

                        {/* Duración */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-text font-medium">
                            {getDuration(call)}
                          </span>
                        </td>

                        {/* Latencia P50 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-medium" style={{ color: latencyColor }}>
                            {latency}
                          </span>
                        </td>

                        {/* LLM latency */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-dim">
                            {llmLat}
                          </span>
                        </td>

                        {/* TTS latency */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-dim">
                            {ttsLat}
                          </span>
                        </td>

                        {/* Mensajes */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-text">
                            {call.transcript?.length || 0}
                          </span>
                        </td>

                        {/* Créditos ElevenLabs */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-amber">
                            {getCredits(call)}
                          </span>
                        </td>

                        {/* Coste LLM */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-terminal-dim">
                            {getLLMCost(call)}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs text-terminal-dim">
                            {formatDistanceToNow(new Date(call.event_timestamp || call.created_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </div>
                          <div className="font-mono text-xs text-terminal-muted">
                            {format(new Date(call.event_timestamp || call.created_at), "dd/MM HH:mm")}
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-terminal-amber opacity-0 group-hover:opacity-100 transition-opacity">
                            →
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="font-mono text-xs text-terminal-dim">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="font-mono text-xs px-4 py-2 border border-terminal-border rounded text-terminal-dim disabled:opacity-30 hover:border-terminal-amber hover:text-terminal-amber transition-all"
              >
                ← PREV
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="font-mono text-xs px-4 py-2 border border-terminal-border rounded text-terminal-dim disabled:opacity-30 hover:border-terminal-amber hover:text-terminal-amber transition-all"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Analytics Section */}
        <AnalyticsSection />

        {/* Webhook hint */}
        <div
          className="mt-8 border border-terminal-border rounded p-4"
          style={{ background: "rgba(245,158,11,0.03)" }}
        >
          <div className="font-mono text-xs text-terminal-amber mb-2 tracking-wider">⚡ WEBHOOK ENDPOINT</div>
          <div className="font-mono text-xs text-terminal-dim">Configura en ElevenLabs → Agent → Webhooks:</div>
          <div className="font-mono text-sm text-terminal-text mt-1 bg-black rounded px-3 py-2 border border-terminal-border">
            https://TU-DOMINIO.vercel.app/api/webhook
          </div>
        </div>
      </main>

      {/* Call Detail Panel */}
      {selectedCall && (
        <CallDetail call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImportComplete={() => { fetchCalls(); }}
        />
      )}
    </div>
  );
}
