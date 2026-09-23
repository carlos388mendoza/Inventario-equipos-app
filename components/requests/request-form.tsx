"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Mic, Send, Sparkles } from "lucide-react";
import { createRequest } from "@/app/(dashboard)/requests/actions";
import {
  REQUEST_KINDS,
  REQUEST_KIND_LABELS,
  type RequestKind,
} from "@/lib/validation/requests";
import { ALL_REQUEST_PRIORITY, REQUEST_PRIORITY_LABELS } from "@/lib/db/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EquipmentSelectOption,
  RestaurantSelectOption,
} from "@/app/(dashboard)/requests/types";

interface TypeOption {
  id: string;
  name: string;
}

interface VoiceDraft {
  equipmentTypeId: string;
  kind: RequestKind;
  currentEquipmentId: string;
  priority: string;
  reason: string;
  description: string;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ transcript: string }>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function VoiceRequestPanel({
  restaurantId,
  restaurantLocked,
  onPrefill,
}: {
  restaurantId: string;
  restaurantLocked: boolean;
  onPrefill: (draft: VoiceDraft) => void;
}) {
  const [transcript, setTranscript] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  function stopListening() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
  }

  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("Tu navegador no soporta dictado por voz. Escribe el texto manualmente.");
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i].transcript;
      }
      setTranscript(finalText);
    };
    recognition.onerror = () => {
      stopListening();
      setError("No se pudo capturar la voz. Intenta de nuevo.");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  async function analyze() {
    if (transcript.trim().length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/voice-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          restaurantId: restaurantLocked ? undefined : restaurantId || undefined,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; draft: VoiceDraft }
        | { ok: false; error: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo analizar la solicitud.");
        return;
      }
      onPrefill(data.draft);
    } catch {
      setError("Error de conexión al analizar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Solicitud por voz</p>
        <Button
          type="button"
          size="sm"
          variant={listening ? "destructive" : "outline"}
          onClick={toggleListening}
          disabled={loading}
        >
          <Mic className="mr-1 h-4 w-4" />
          {listening ? "Detener" : "Dictar"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={analyze}
          disabled={loading || transcript.trim().length === 0}
        >
          <Send className="mr-1 h-4 w-4" />
          {loading ? "Analizando…" : "Prellenar con IA"}
        </Button>
      </div>
      <Input
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Dicta o escribe lo que necesitas, p. ej. 'Se dañó la impresora de facturas y necesito reemplazarla con urgencia'."
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {transcript && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Revisa el análisis antes de enviar: rellena el formulario pero no crea
          la solicitud automáticamente.
        </p>
      )}
    </div>
  );
}

export function RequestForm({
  restaurantOptions,
  typeOptions,
  equipmentOptions,
  currentRestaurantId,
  onDone,
}: {
  restaurantOptions: RestaurantSelectOption[];
  typeOptions: TypeOption[];
  equipmentOptions: EquipmentSelectOption[];
  currentRestaurantId?: string;
  onDone: () => void;
}) {
  const [submitting, startSubmit] = useTransition();

  const [restaurantId, setRestaurantId] = React.useState(
    currentRestaurantId ?? ""
  );
  const [equipmentTypeId, setEquipmentTypeId] = React.useState("");
  const [kind, setKind] = React.useState<RequestKind>("purchase");
  const [currentEquipmentId, setCurrentEquipmentId] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");

  const restaurantLocked = Boolean(currentRestaurantId);

  const candidateEquipment = equipmentOptions.filter((e) => {
    const sameRestaurant = !restaurantId || e.restaurantId === restaurantId;
    const sameType = !equipmentTypeId || e.equipmentTypeId === equipmentTypeId;
    return sameRestaurant && sameType;
  });

  function resetForm() {
    setRestaurantId(currentRestaurantId ?? "");
    setEquipmentTypeId("");
    setKind("purchase");
    setCurrentEquipmentId("");
    setPriority("NORMAL");
    setReason("");
    setDescription("");
  }

  function applyDraft(draft: VoiceDraft) {
    setEquipmentTypeId(draft.equipmentTypeId);
    setKind(draft.kind);
    setCurrentEquipmentId(draft.currentEquipmentId ?? "");
    setPriority(draft.priority ?? "NORMAL");
    setReason(draft.reason);
    setDescription(draft.description ?? "");
    toast.success("Solicitud prellenada con la IA. Revísala y envía.");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const result = await createRequest({
        equipmentTypeId,
        priority,
        kind,
        currentEquipmentId: currentEquipmentId || "",
        reason,
        description,
        restaurantId: restaurantLocked ? "" : restaurantId,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo crear la solicitud.");
        return;
      }
      toast.success("Solicitud creada.");
      resetForm();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <VoiceRequestPanel
        restaurantId={restaurantId}
        restaurantLocked={restaurantLocked}
        onPrefill={applyDraft}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de equipo</Label>
          <Select value={equipmentTypeId} onValueChange={setEquipmentTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!restaurantLocked && (
          <div className="space-y-2">
            <Label>Restaurante</Label>
            <Select value={restaurantId} onValueChange={setRestaurantId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un restaurante" />
              </SelectTrigger>
              <SelectContent>
                {restaurantOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Tipo de solicitud</Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as RequestKind);
              setCurrentEquipmentId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Compra o reemplazo" />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {REQUEST_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              {ALL_REQUEST_PRIORITY.map((p) => (
                <SelectItem key={p} value={p}>
                  {REQUEST_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "replacement" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Equipo a reemplazar</Label>
            <Select
              value={currentEquipmentId}
              onValueChange={setCurrentEquipmentId}
              disabled={candidateEquipment.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    candidateEquipment.length === 0
                      ? "Selecciona primero restaurante y tipo"
                      : "Selecciona el equipo actual"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {candidateEquipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.assetCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="req-reason">Motivo</Label>
        <Textarea
          id="req-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. El equipo ya no enciende y requiere reemplazo."
          maxLength={500}
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="req-description">Descripción (opcional)</Label>
        <Textarea
          id="req-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalles adicionales que ayuden a evaluar la solicitud."
          maxLength={2000}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando…" : "Crear solicitud"}
        </Button>
      </div>
    </form>
  );
}