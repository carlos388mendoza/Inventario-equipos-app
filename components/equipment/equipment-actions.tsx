"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  addEquipmentNote,
  changeEquipmentStatus,
} from "@/app/(dashboard)/equipment/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_LABELS,
} from "@/lib/db/enums";

export function EquipmentActions({
  equipmentId,
  currentStatus,
}: {
  equipmentId: string;
  currentStatus: string;
}) {
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [newStatus, setNewStatus] = React.useState(currentStatus);
  const [comment, setComment] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, startSubmit] = useTransition();

  function openStatus() {
    setNewStatus(currentStatus);
    setComment("");
    setStatusOpen(true);
  }

  function handleStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const result = await changeEquipmentStatus({
        id: equipmentId,
        newStatus,
        comment,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar el estado.");
        return;
      }
      toast.success("Estado actualizado.");
      setStatusOpen(false);
      window.location.reload();
    });
  }

  function handleNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const result = await addEquipmentNote({ id: equipmentId, note });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar la nota.");
        return;
      }
      toast.success("Nota registrada.");
      setNoteOpen(false);
      setNote("");
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={openStatus}>Cambiar estado</Button>
      <Button variant="outline" onClick={() => setNoteOpen(true)}>
        Agregar nota
      </Button>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado del equipo</DialogTitle>
            <DialogDescription>
              El cambio quedará registrado en el historial del equipo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStatus} className="space-y-4">
            <div className="space-y-2">
              <Label>Nuevo estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_EQUIPMENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EQUIPMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-comment">Detalle (opcional)</Label>
              <Textarea
                id="status-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ej. Se detectó falla en pantalla"
                maxLength={1000}
                rows={3}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar nota al equipo</DialogTitle>
            <DialogDescription>
              Las notas ayudan a documentar la vida útil del equipo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-text">Nota</Label>
              <Textarea
                id="note-text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Requiere soporte técnico"
                maxLength={1000}
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}