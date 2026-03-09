"use client";

import { ElevenLabsCall } from "@/types/elevenlabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

interface Props {
  call: ElevenLabsCall;
  onClose: () => void;
}

type Tab = "transcript" | "analysis" | "metadata" | "raw";

export default function CallDetail({ call, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("transcript");
  const [copied, setCopied] = useState(false);

  const copyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(call.raw_payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "transcript", label: "TRANSCRIPCIÓN" },
    { id: "analysis", label: "ANÁLISIS" },
    { id: "metadata", label: "METADATOS" },
    { id: "raw", label: "RAW JSON" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.8)" }}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-full max-w-2xl border-l border-terminal-border flex flex-col"
        style={{ background: "var(--bg)", animation: "slideUp 0.3s ease" }}
      >
        {/* Header */}
        <div className="border-b border-terminal-border px-5 py-4 flex items-start justify-between">
          <div>
            <div className="font-mono text-xs text-terminal-amber tracking-wider mb-1">
              DETALLE DE LLAMADA
            </div>
            <div className="font-mono text-sm text-terminal-text break-all">
              {call.conversation_id}
            </div>
            <div className="font-mono text-xs text-terminal-dim mt-1">
              {call.event_timestamp
                ? format(new Date(call.event_timestamp), "dd MMM yyyy · HH:mm:ss", { locale: es })
                : "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-terminal-dim hover:text-terminal-text transition-colors text-lg ml-4"
          >
            ✕
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 border-b border-terminal-border">
          {[
            {
              label: "DURACIÓN",
              value: call.metadata?.call_duration_secs
                ? `${call.metadata.call_duration_secs}s`
                : "—",
            },
            {
              label: "MENSAJES",
              value: call.transcript?.length || 0,
            },
            {
              label: "ESTADO",
              value: call.status?.toUpperCase() || "—",
            },
          ].map((s) => (
            <div key={s.label} className="px-5 py-3 border-r last:border-r-0 border-terminal-border">
              <div className="font-mono text-xs text-terminal-dim">{s.label}</div>
              <div className="font-mono text-base text-terminal-amber font-medium">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Phone info if available */}
        {call.metadata?.phone_call && (
          <div className="border-b border-terminal-border px-5 py-2 flex gap-6">
            {call.metadata.phone_call.from && (
              <div>
                <span className="font-mono text-xs text-terminal-dim">DE: </span>
                <span className="font-mono text-xs text-terminal-text">
                  {call.metadata.phone_call.from}
                </span>
              </div>
            )}
            {call.metadata.phone_call.to && (
              <div>
                <span className="font-mono text-xs text-terminal-dim">A: </span>
                <span className="font-mono text-xs text-terminal-text">
                  {call.metadata.phone_call.to}
                </span>
              </div>
            )}
            {call.metadata.phone_call.direction && (
              <div>
                <span className="font-mono text-xs text-terminal-dim">DIRECCIÓN: </span>
                <span className="font-mono text-xs text-terminal-text">
                  {call.metadata.phone_call.direction.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-terminal-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mono text-xs tracking-wider px-4 py-3 transition-all border-b-2 ${
                tab === t.id
                  ? "text-terminal-amber border-terminal-amber"
                  : "text-terminal-dim border-transparent hover:text-terminal-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "transcript" && (
            <div className="space-y-3">
              {!call.transcript || call.transcript.length === 0 ? (
                <div className="font-mono text-sm text-terminal-dim text-center py-8">
                  No hay transcripción disponible
                </div>
              ) : (
                call.transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded px-4 py-3 ${
                      msg.role === "agent" ? "bubble-agent" : "bubble-user"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-mono text-xs font-semibold tracking-wider"
                        style={{
                          color: msg.role === "agent" ? "var(--amber)" : "var(--blue)",
                        }}
                      >
                        {msg.role === "agent" ? "● AGENTE" : "○ USUARIO"}
                      </span>
                      {msg.time_in_call_secs !== undefined && (
                        <span className="font-mono text-xs text-terminal-muted">
                          {msg.time_in_call_secs}s
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-terminal-text leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "analysis" && (
            <div className="space-y-4">
              {!call.analysis ? (
                <div className="font-mono text-sm text-terminal-dim text-center py-8">
                  No hay análisis disponible
                </div>
              ) : (
                <>
                  {call.analysis.transcript_summary && (
                    <div>
                      <div className="font-mono text-xs text-terminal-amber mb-2 tracking-wider">
                        RESUMEN
                      </div>
                      <p className="text-sm text-terminal-text leading-relaxed bg-terminal-surface border border-terminal-border rounded p-3">
                        {call.analysis.transcript_summary}
                      </p>
                    </div>
                  )}
                  {call.analysis.call_successful !== undefined && (
                    <div>
                      <div className="font-mono text-xs text-terminal-amber mb-2 tracking-wider">
                        RESULTADO
                      </div>
                      <span
                        className="font-mono text-sm px-3 py-1 rounded border"
                        style={
                          call.analysis.call_successful === "success"
                            ? { color: "var(--green)", borderColor: "var(--green)", background: "rgba(34,197,94,0.1)" }
                            : { color: "var(--red)", borderColor: "var(--red)", background: "rgba(239,68,68,0.1)" }
                        }
                      >
                        {call.analysis.call_successful?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {call.analysis.data_collection_results && (
                    <div>
                      <div className="font-mono text-xs text-terminal-amber mb-2 tracking-wider">
                        DATOS RECOPILADOS
                      </div>
                      <pre className="font-mono text-xs text-terminal-text bg-terminal-surface border border-terminal-border rounded p-3 overflow-x-auto">
                        {JSON.stringify(call.analysis.data_collection_results, null, 2)}
                      </pre>
                    </div>
                  )}
                  {call.analysis.evaluation_criteria_results && (
                    <div>
                      <div className="font-mono text-xs text-terminal-amber mb-2 tracking-wider">
                        CRITERIOS DE EVALUACIÓN
                      </div>
                      <pre className="font-mono text-xs text-terminal-text bg-terminal-surface border border-terminal-border rounded p-3 overflow-x-auto">
                        {JSON.stringify(call.analysis.evaluation_criteria_results, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "metadata" && (
            <div className="space-y-2">
              {Object.entries(call.metadata || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-start py-2 border-b border-terminal-border"
                >
                  <span className="font-mono text-xs text-terminal-dim tracking-wider">
                    {key.toUpperCase().replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-xs text-terminal-text text-right max-w-xs">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-start py-2 border-b border-terminal-border">
                <span className="font-mono text-xs text-terminal-dim tracking-wider">
                  AGENT ID
                </span>
                <span className="font-mono text-xs text-terminal-amber text-right">
                  {call.agent_id}
                </span>
              </div>
              <div className="flex justify-between items-start py-2">
                <span className="font-mono text-xs text-terminal-dim tracking-wider">
                  TERMINACIÓN
                </span>
                <span className="font-mono text-xs text-terminal-text text-right">
                  {call.metadata?.termination_reason || "—"}
                </span>
              </div>
            </div>
          )}

          {tab === "raw" && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-xs text-terminal-dim">
                  PAYLOAD COMPLETO
                </span>
                <button
                  onClick={copyRaw}
                  className="font-mono text-xs px-3 py-1 border border-terminal-border rounded text-terminal-dim hover:border-terminal-amber hover:text-terminal-amber transition-all"
                >
                  {copied ? "✓ COPIADO" : "⎘ COPIAR"}
                </button>
              </div>
              <pre className="font-mono text-xs text-terminal-green bg-black border border-terminal-border rounded p-4 overflow-x-auto leading-relaxed">
                {JSON.stringify(call.raw_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
