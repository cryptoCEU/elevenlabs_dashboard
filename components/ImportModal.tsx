"use client";

import { useState, useEffect } from "react";

interface Props {
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportStatus = "idle" | "checking" | "running" | "done" | "error";

export default function ImportModal({ onClose, onImportComplete }: Props) {
  const [status, setStatus] = useState<ImportStatus>("checking");
  const [apiConfigured, setApiConfigured] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [progress, setProgress] = useState({ imported: 0, skipped: 0, batches: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/import")
      .then((r) => r.json())
      .then((d) => {
        setApiConfigured(d.configured);
        setStatus("idle");
      });
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runImport = async () => {
    setStatus("running");
    setProgress({ imported: 0, skipped: 0, batches: 0 });
    setLogs([]);
    setError("");

    addLog("Iniciando importación desde ElevenLabs API...");

    let cursor: string | null = null;
    let totalImported = 0;
    let totalSkipped = 0;
    let batches = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        addLog(`Descargando lote ${batches + 1}...`);

        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cursor: cursor || undefined,
            agent_id: agentId || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Error desconocido");
        }

        totalImported += data.imported;
        totalSkipped += data.skipped;
        batches++;

        addLog(
          `Lote ${batches}: ${data.imported} guardadas, ${data.skipped} omitidas`
        );

        if (data.errors?.length) {
          data.errors.forEach((e: string) => addLog(`⚠ ${e}`));
        }

        setProgress({ imported: totalImported, skipped: totalSkipped, batches });

        hasMore = data.has_more;
        cursor = data.next_cursor;

        // Small delay to avoid rate limiting
        if (hasMore) await new Promise((r) => setTimeout(r, 300));
      }

      addLog(`✓ Importación completada. Total: ${totalImported} llamadas guardadas.`);
      setStatus("done");
      onImportComplete();
    } catch (err) {
      setError(String(err));
      setStatus("error");
      addLog(`✗ Error: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}>
      <div
        className="w-full max-w-lg border border-terminal-border rounded-lg overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {/* Header */}
        <div className="border-b border-terminal-border px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(245,158,11,0.05)" }}>
          <div>
            <div className="font-mono text-xs text-terminal-amber tracking-widest mb-1">
              ⬇ IMPORTAR HISTORIAL
            </div>
            <div className="font-mono text-xs text-terminal-dim">
              Vuelca todas las llamadas anteriores desde ElevenLabs
            </div>
          </div>
          <button onClick={onClose} className="font-mono text-terminal-dim hover:text-terminal-text">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* API Key status */}
          <div className={`border rounded p-3 flex items-start gap-3 ${
            apiConfigured
              ? "border-green-800 bg-green-950/30"
              : "border-red-800 bg-red-950/30"
          }`}>
            <span className={`font-mono text-lg ${apiConfigured ? "text-terminal-green" : "text-terminal-red"}`}>
              {status === "checking" ? "..." : apiConfigured ? "✓" : "✗"}
            </span>
            <div>
              <div className={`font-mono text-xs font-semibold ${apiConfigured ? "text-terminal-green" : "text-terminal-red"}`}>
                ELEVENLABS_API_KEY {apiConfigured ? "CONFIGURADA" : "NO ENCONTRADA"}
              </div>
              {!apiConfigured && (
                <div className="font-mono text-xs text-terminal-dim mt-1">
                  Añade <code className="text-terminal-amber">ELEVENLABS_API_KEY</code> en tus variables de entorno de Vercel y redespliega.
                </div>
              )}
            </div>
          </div>

          {/* Agent ID filter (optional) */}
          {apiConfigured && status !== "running" && status !== "done" && (
            <div>
              <label className="font-mono text-xs text-terminal-dim block mb-2 tracking-wider">
                FILTRAR POR AGENT ID{" "}
                <span className="text-terminal-muted">(opcional — deja vacío para importar todos)</span>
              </label>
              <input
                type="text"
                placeholder="ej: abc123xyz..."
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full font-mono text-sm bg-terminal-surface border border-terminal-border rounded px-3 py-2 text-terminal-text placeholder-terminal-muted focus:outline-none focus:border-terminal-amber transition-colors"
              />
            </div>
          )}

          {/* Progress stats */}
          {(status === "running" || status === "done") && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "IMPORTADAS", value: progress.imported, color: "var(--green)" },
                { label: "OMITIDAS", value: progress.skipped, color: "var(--dim)" },
                { label: "LOTES", value: progress.batches, color: "var(--amber)" },
              ].map((s) => (
                <div key={s.label} className="border border-terminal-border rounded p-3 text-center"
                  style={{ background: "var(--surface)" }}>
                  <div className="font-mono text-xl font-bold" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="font-mono text-xs text-terminal-dim">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Logs terminal */}
          {logs.length > 0 && (
            <div className="bg-black border border-terminal-border rounded p-3 max-h-40 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={`font-mono text-xs ${
                  log.includes("✓") ? "text-terminal-green" :
                  log.includes("✗") || log.includes("Error") ? "text-terminal-red" :
                  log.includes("⚠") ? "text-terminal-amber" :
                  "text-terminal-dim"
                }`}>
                  {log}
                </div>
              ))}
              {status === "running" && (
                <div className="font-mono text-xs text-terminal-amber animate-pulse">
                  ▊
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border border-red-800 rounded p-3 font-mono text-xs text-terminal-red">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-terminal-border px-5 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="font-mono text-xs px-4 py-2 border border-terminal-border rounded text-terminal-dim hover:text-terminal-text transition-all"
          >
            {status === "done" ? "CERRAR" : "CANCELAR"}
          </button>

          {apiConfigured && status !== "running" && status !== "done" && (
            <button
              onClick={runImport}
              className="font-mono text-xs px-5 py-2 rounded text-black font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--amber)" }}
            >
              ⬇ INICIAR IMPORTACIÓN
            </button>
          )}

          {status === "done" && (
            <button
              onClick={() => { setStatus("idle"); setProgress({ imported: 0, skipped: 0, batches: 0 }); setLogs([]); }}
              className="font-mono text-xs px-4 py-2 border border-terminal-amber text-terminal-amber rounded hover:bg-terminal-amber hover:text-black transition-all"
            >
              ↺ VOLVER A IMPORTAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
