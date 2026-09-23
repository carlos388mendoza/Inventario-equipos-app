"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function StatsAgentChat() {
  const [question, setQuestion] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = question.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/stats-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await res.json()) as
        | { ok: true; answer: string }
        | { ok: false; error: string };
      if (!data.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Error." },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error de conexión." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asistente de estadísticas</CardTitle>
        <CardDescription>
          Pregunta en lenguaje natural: solicitudes, inventario, estados y vida
          útil. Responde solo con datos reales del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ejemplos: “¿Cuántas solicitudes hay en total?”, “¿Cómo se
              distribuyen las solicitudes por restaurante?”, “¿Qué equipos
              hay por tipo?”
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "rounded-md bg-muted px-3 py-2 text-sm"
                  : "prose prose-sm max-w-none"
              }
            >
              {m.role === "user" ? (
                <p className="font-medium">{m.content}</p>
              ) : (
                <Streamdown>{m.content}</Streamdown>
              )}
            </div>
          ))}
          {loading && (
            <p className="text-sm text-muted-foreground">Consultando…</p>
          )}
        </div>
        <form onSubmit={ask} className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Haz una pregunta sobre las estadísticas…"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || question.trim().length === 0}>
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}