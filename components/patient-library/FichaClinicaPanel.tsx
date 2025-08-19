"use client"

import { useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { FichaClinicaState, PatientRecord } from "@/types/clinical-types"

interface FichaClinicaPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientRecord
  fichas: FichaClinicaState[]
  onRefresh: () => Promise<void>
  onGenerate: () => Promise<void>
}

export function FichaClinicaPanel({ open, onOpenChange, patient, fichas, onRefresh, onGenerate }: FichaClinicaPanelProps) {
  const latest = useMemo(() => {
    if (!fichas || fichas.length === 0) return null
    // Assume latest by ultimaActualizacion
    return [...fichas].sort((a, b) => new Date(b.ultimaActualizacion).getTime() - new Date(a.ultimaActualizacion).getTime())[0]
  }, [fichas])

  useEffect(() => {
    // noop for now
  }, [latest])

  const statusBadge = (estado?: FichaClinicaState['estado']) => {
    if (!estado) return null
    const map: Record<FichaClinicaState['estado'], { label: string; className: string }> = {
      generando: { label: 'Generando…', className: 'bg-accent/10 text-accent-foreground' },
      actualizando: { label: 'Actualizando…', className: 'bg-primary/10 text-primary' },
      completado: { label: 'Ficha', className: 'bg-primary/15 text-primary' },
      error: { label: 'Error', className: 'bg-destructive/10 text-destructive' },
    }
    const info = map[estado]
    return <Badge className={info.className}>{info.label}</Badge>
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full paper-noise color-fragment">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <SheetTitle className="font-serif tracking-wide">Ficha Clínica</SheetTitle>
              <SheetDescription>{patient.displayName}</SheetDescription>
            </div>
            {statusBadge(latest?.estado)}
          </div>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button variant="default" onClick={onGenerate}>Actualizar Ficha</Button>
            <Button variant="outline" onClick={onRefresh}>Refrescar</Button>
            {latest?.contenido && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(latest.contenido)}
                >Copiar</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([latest.contenido], { type: 'text/markdown;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${patient.displayName.replace(/\s+/g, '_')}_ficha.md`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  }}
                >Descargar .md</Button>
              </>
            )}
          </div>

          <ScrollArea className="h-[70vh] border rounded-md p-4 brush-border paper-noise">
            {!latest && (
              <div className="text-sm text-muted-foreground">No hay ficha. Use “Actualizar Ficha” para generar.</div>
            )}
            {latest && latest.estado !== 'completado' && (
              <div className="space-y-2">
                <div className="animate-pulse h-4 bg-muted rounded" />
                <div className="animate-pulse h-4 bg-muted rounded w-5/6" />
                <div className="animate-pulse h-4 bg-muted rounded w-4/6" />
              </div>
            )}
            {latest && latest.estado === 'completado' && (
              <MarkdownRenderer content={latest.contenido} />
            )}
            {latest && latest.estado === 'error' && (
              <div className="text-sm text-destructive">Error al generar la ficha. Intente nuevamente.</div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default FichaClinicaPanel


