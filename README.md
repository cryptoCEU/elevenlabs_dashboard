# 📞 ElevenLabs Call Monitor

Dashboard para monitorizar y analizar todas las llamadas de tu agente ElevenLabs en tiempo real.

![Dashboard](https://img.shields.io/badge/Next.js-14-black) ![Supabase](https://img.shields.io/badge/Supabase-Database-green) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## ✨ Características

- **Webhook en tiempo real** — recibe y almacena cada evento de ElevenLabs
- **Dashboard live** — se actualiza automáticamente cada 15 segundos
- **Transcripción completa** — visualiza toda la conversación mensaje a mensaje
- **Análisis de IA** — resumen, criterios de evaluación y datos recopilados
- **Metadatos detallados** — duración, número de teléfono, motivo de fin de llamada
- **Raw JSON** — accede al payload completo con un click
- **Búsqueda y paginación** — filtra entre cientos de llamadas

---

## 🚀 Despliegue rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/elevenlabs-dashboard.git
cd elevenlabs-dashboard
npm install
```

### 2. Crear base de datos en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto gratuito
2. Abre el **SQL Editor** y ejecuta:

```sql
CREATE TABLE elevenlabs_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'conversation_ended',
  status TEXT NOT NULL DEFAULT 'unknown',
  transcript JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  analysis JSONB,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, event_type)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_calls_timestamp ON elevenlabs_calls(event_timestamp DESC);
CREATE INDEX idx_calls_agent ON elevenlabs_calls(agent_id);
CREATE INDEX idx_calls_conversation ON elevenlabs_calls(conversation_id);

-- Row Level Security (RLS) - habilitar pero permitir todo desde service role
ALTER TABLE elevenlabs_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON elevenlabs_calls
  USING (true)
  WITH CHECK (true);
```

3. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase
```

### 4. Ejecutar en local

```bash
npm run dev
# Abre http://localhost:3000
```

### 5. Desplegar en Vercel

```bash
npm install -g vercel
vercel deploy
```

O conéctalo directamente desde [vercel.com](https://vercel.com) importando el repositorio de GitHub.

**Variables de entorno en Vercel:**
- Ve a tu proyecto → Settings → Environment Variables
- Añade `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Opcionalmente: `ELEVENLABS_WEBHOOK_SECRET`

---

## 🔗 Configurar Webhook en ElevenLabs

1. Ve a [elevenlabs.io](https://elevenlabs.io) → **Conversational AI** → tu Agente
2. Navega a **Webhooks** o **Settings → Integrations**
3. Añade la URL:
   ```
   https://TU-APP.vercel.app/api/webhook
   ```
4. Selecciona los eventos: `conversation_initiated`, `conversation_ended`
5. Opcionalmente añade el mismo secreto que pusiste en `ELEVENLABS_WEBHOOK_SECRET`

---

## 📡 API Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/webhook` | `POST` | Recibe eventos de ElevenLabs |
| `/api/calls` | `GET` | Lista llamadas (paginado, con búsqueda) |
| `/api/calls/[id]` | `GET` | Detalle de una conversación |

### Parámetros de `/api/calls`

```
?page=1&limit=20&search=conv_id&agent_id=xxx
```

---

## 🗄️ Estructura del proyecto

```
elevenlabs-dashboard/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts     # Endpoint webhook
│   │   └── calls/
│   │       ├── route.ts         # Lista de llamadas
│   │       └── [id]/route.ts    # Detalle
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Dashboard principal
├── components/
│   └── CallDetail.tsx           # Panel lateral de detalle
├── lib/
│   └── supabase.ts              # Cliente Supabase
├── types/
│   └── elevenlabs.ts            # Tipos TypeScript
└── .env.example
```

---

## 🔒 Seguridad

- Configura `ELEVENLABS_WEBHOOK_SECRET` para validar que los webhooks provienen de ElevenLabs
- El `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (API routes), nunca se expone al cliente
- Considera añadir autenticación al dashboard (NextAuth, Clerk, etc.) antes de producción

---

## 📊 Datos almacenados por llamada

| Campo | Descripción |
|---|---|
| `conversation_id` | ID único de ElevenLabs |
| `agent_id` | ID del agente que atendió |
| `status` | Estado final (done, failed, etc.) |
| `transcript` | Array de mensajes con rol y timestamp |
| `metadata` | Duración, teléfono, motivo de fin |
| `analysis` | Resumen, criterios, datos recopilados |
| `raw_payload` | Payload JSON completo original |

---

## 📝 Licencia

MIT
