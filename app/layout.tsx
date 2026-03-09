import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ElevenLabs Call Monitor",
  description: "Dashboard para monitorizar llamadas del agente ElevenLabs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="scanlines grid-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
