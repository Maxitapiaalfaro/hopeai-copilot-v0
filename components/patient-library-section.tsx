"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Search,
  Users,
  MessageSquare,
  Trash2,
  Edit,
  User,
  Tag,
  Calendar,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePatientLibrary } from "@/hooks/use-patient-library"
import { useHopeAISystem } from "@/hooks/use-hopeai-system"
import type { PatientRecord } from "@/types/clinical-types"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { FichaClinicaPanel } from "@/components/patient-library/FichaClinicaPanel"
import { PatientConversationHistory } from "@/components/patient-conversation-history"
import { getAgentVisualConfigSafe } from "@/config/agent-visual-config"

interface PatientLibrarySectionProps {
  isOpen: boolean
  onPatientSelect?: (patient: PatientRecord) => void
  onStartConversation?: (patient: PatientRecord) => void
  onConversationSelect?: (sessionId: string) => void
}

export function PatientLibrarySection({ 
  isOpen, 
  onPatientSelect, 
  onStartConversation,
  onConversationSelect 
}: PatientLibrarySectionProps) {
  const {
    patients,
    isLoading,
    error,
    searchQuery,
    filteredPatients,
    selectedPatient,
    loadPatients,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    selectPatient,
    getPatientCount,
    clearError,
    refreshPatientSummary,
    generateFichaClinica,
    loadFichasClinicas,
    fichasClinicas
  } = usePatientLibrary()
  const { systemState } = useHopeAISystem()
  const [isFichaOpen, setIsFichaOpen] = useState(false)
  const [showConversationHistory, setShowConversationHistory] = useState(false)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null)

  // Form state for patient creation/editing
  const [formData, setFormData] = useState({
    displayName: "",
    ageRange: "",
    gender: "",
    occupation: "",
    tags: "",
    notes: "",
    confidentialityLevel: "medium" as "high" | "medium" | "low"
  })

  const resetForm = () => {
    setFormData({
      displayName: "",
      ageRange: "",
      gender: "",
      occupation: "",
      tags: "",
      notes: "",
      confidentialityLevel: "medium"
    })
  }

  const handleCreatePatient = async () => {
    try {
      const patientData = {
        displayName: formData.displayName.trim(),
        demographics: {
          ageRange: formData.ageRange.trim() || undefined,
          gender: formData.gender.trim() || undefined,
          occupation: formData.occupation.trim() || undefined
        },
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        notes: formData.notes.trim() || undefined,
        confidentiality: {
          pii: true,
          accessLevel: formData.confidentialityLevel
        }
      }

      await createPatient(patientData)
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (err) {
      console.error("Failed to create patient:", err)
    }
  }

  const handleEditPatient = (patient: PatientRecord) => {
    setEditingPatient(patient)
    setFormData({
      displayName: patient.displayName,
      ageRange: patient.demographics?.ageRange || "",
      gender: patient.demographics?.gender || "",
      occupation: patient.demographics?.occupation || "",
      tags: patient.tags?.join(", ") || "",
      notes: patient.notes || "",
      confidentialityLevel: patient.confidentiality?.accessLevel || "medium"
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePatient = async () => {
    if (!editingPatient) return

    try {
      const updatedPatient: PatientRecord = {
        ...editingPatient,
        displayName: formData.displayName.trim(),
        demographics: {
          ageRange: formData.ageRange.trim() || undefined,
          gender: formData.gender.trim() || undefined,
          occupation: formData.occupation.trim() || undefined
        },
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        notes: formData.notes.trim() || undefined,
        confidentiality: {
          ...editingPatient.confidentiality,
          accessLevel: formData.confidentialityLevel,
          pii: editingPatient.confidentiality?.pii ?? false
        }
      }

      await updatePatient(updatedPatient)
      setIsEditDialogOpen(false)
      setEditingPatient(null)
      resetForm()
    } catch (err) {
      console.error("Failed to update patient:", err)
    }
  }

  const handleDeletePatient = async (patientId: string) => {
    try {
      await deletePatient(patientId)
    } catch (err) {
      console.error("Failed to delete patient:", err)
    }
  }

  const handlePatientClick = (patient: PatientRecord) => {
    selectPatient(patient)
    onPatientSelect?.(patient)
    // Removed automatic conversation start - user must explicitly start conversation
  }

  const handleStartConversation = (patient: PatientRecord, event: React.MouseEvent) => {
    event.stopPropagation()
    onStartConversation?.(patient)
  }

  const handleOpenFicha = async (patient: PatientRecord) => {
    await loadFichasClinicas(patient.id)
    setIsFichaOpen(true)
  }

  const handleGenerateFicha = async (patient: PatientRecord) => {
    try {
      const sessionState = {
        sessionId: systemState.sessionId || `temp_${Date.now()}`,
        userId: systemState.userId,
        mode: systemState.mode,
        activeAgent: systemState.activeAgent,
        history: systemState.history,
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          totalTokens: 0,
          fileReferences: []
        },
        clinicalContext: {
          patientId: patient.id,
          supervisorId: undefined,
          sessionType: 'standard',
          confidentialityLevel: patient.confidentiality?.accessLevel || 'medium'
        }
      }
      const patientForm = {
        displayName: patient.displayName,
        demographics: patient.demographics,
        tags: patient.tags,
        notes: patient.notes,
        confidentiality: patient.confidentiality
      }
      const conversationSummary = systemState.history.slice(-6).map(m => `${m.role === 'user' ? 'Paciente' : 'Modelo'}: ${m.content}`).join('\n')
      const fichaId = `ficha_${patient.id}_${Date.now()}`
      await generateFichaClinica(patient.id, fichaId, { ...sessionState, patientForm, conversationSummary } as any)
      await loadFichasClinicas(patient.id)
    } catch (err) {
      console.error('Error generating ficha clínica:', err)
    }
  }

  if (!isOpen) {
    return (
      <div className="flex justify-center py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 hover:bg-secondary transition-colors"
          title="Biblioteca de Pacientes"
        >
          <Users className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div className="border-t border-border/80 mt-4 pt-4">
      {/* Header */}
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground font-sans">Pacientes</span>
            <Badge variant="secondary" className="text-xs">
              {getPatientCount()}
            </Badge>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Agregar paciente"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif">Agregar Paciente</DialogTitle>
                <DialogDescription className="font-sans">
                  Crea un nuevo registro de paciente para conversaciones contextualizadas.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 font-sans">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Nombre de identificación *</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="ej. Paciente A, Caso 001"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ageRange">Rango de edad</Label>
                    <Input
                      id="ageRange"
                      value={formData.ageRange}
                      onChange={(e) => setFormData(prev => ({ ...prev, ageRange: e.target.value }))}
                      placeholder="ej. 25-30"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Género</Label>
                    <Input
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      placeholder="ej. Femenino"
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="occupation">Ocupación</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                    placeholder="ej. Estudiante"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="tags">Áreas de enfoque</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="ej. ansiedad, trauma, relaciones"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="confidentiality">Nivel de confidencialidad</Label>
                  <Select
                    value={formData.confidentialityLevel}
                    onValueChange={(value: "high" | "medium" | "low") => 
                      setFormData(prev => ({ ...prev, confidentialityLevel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="low">Bajo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notas clínicas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Información relevante del caso..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    resetForm()
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreatePatient}
                  disabled={!formData.displayName.trim()}
                  className="w-full sm:w-auto"
                >
                  Crear Paciente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pacientes..."
            value={searchQuery}
            onChange={(e) => searchPatients(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Patient List */}
      <ScrollArea className="h-64">
        <div className="px-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-sans">Cargando...</span>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-sans">
                {searchQuery ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
              </p>
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div key={patient.id} className="relative group">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full p-3 h-auto text-left transition-all duration-200 rounded-lg",
                    selectedPatient?.id === patient.id
                      ? "bg-primary/10"
                      : "hover:bg-secondary"
                  )}
                  onClick={() => handlePatientClick(patient)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-sm text-foreground truncate">
                        {patient.displayName}
                      </div>
                      
                      {patient.tags && patient.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0.5 font-sans">
                              {tag}
                            </Badge>
                          ))}
                          {patient.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 font-sans">
                              +{patient.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground mt-1 font-sans">
                        {formatDistanceToNow(patient.updatedAt, { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </div>
                    </div>
                  </div>
                </Button>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {onStartConversation && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStartConversation(patient)
                      }}
                      title="Iniciar conversación"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowConversationHistory(true)
                    }}
                    title="Ver historial de conversaciones"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditPatient(patient)
                    }}
                    title="Editar paciente"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => e.stopPropagation()}
                        title="Eliminar paciente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. El registro de "{patient.displayName}" 
                          será eliminado permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePatient(patient.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Editar Paciente</DialogTitle>
            <DialogDescription className="font-sans">
              Modifica la información del paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 font-sans">
            <div className="grid gap-2">
              <Label htmlFor="edit-displayName">Nombre de identificación *</Label>
              <Input
                id="edit-displayName"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="ej. Paciente A, Caso 001"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-ageRange">Rango de edad</Label>
                <Input
                  id="edit-ageRange"
                  value={formData.ageRange}
                  onChange={(e) => setFormData(prev => ({ ...prev, ageRange: e.target.value }))}
                  placeholder="ej. 25-30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-gender">Género</Label>
                <Input
                  id="edit-gender"
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  placeholder="ej. Femenino"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-occupation">Ocupación</Label>
              <Input
                id="edit-occupation"
                value={formData.occupation}
                onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                placeholder="ej. Estudiante"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-tags">Áreas de enfoque</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="ej. ansiedad, trauma, relaciones"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-confidentiality">Nivel de confidencialidad</Label>
              <Select
                value={formData.confidentialityLevel}
                onValueChange={(value: "high" | "medium" | "low") => 
                  setFormData(prev => ({ ...prev, confidentialityLevel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="low">Bajo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notas clínicas</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Información relevante del caso..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingPatient(null)
                resetForm()
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePatient}
              disabled={!formData.displayName.trim()}
              className="w-full sm:w-auto"
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="px-4 mt-2">
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded font-sans">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-auto p-0 text-destructive hover:text-destructive/80"
              onClick={clearError}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Ficha Clínica Panel */}
      {selectedPatient && (
        <FichaClinicaPanel
          open={isFichaOpen}
          onOpenChange={(open) => setIsFichaOpen(open)}
          patient={selectedPatient}
          fichas={fichasClinicas as any}
          onRefresh={async () => { await loadFichasClinicas(selectedPatient.id) }}
          onGenerate={async () => {
            const sessionState = {
              sessionId: systemState.sessionId || `temp_${Date.now()}`,
              userId: systemState.userId,
              mode: systemState.mode,
              activeAgent: systemState.activeAgent,
              history: systemState.history,
              metadata: { createdAt: new Date(), lastUpdated: new Date(), totalTokens: 0, fileReferences: [] },
              clinicalContext: { patientId: selectedPatient.id, supervisorId: undefined, sessionType: 'standard', confidentialityLevel: selectedPatient.confidentiality?.accessLevel || 'medium' }
            }
            const patientForm = {
              displayName: selectedPatient.displayName,
              demographics: selectedPatient.demographics,
              tags: selectedPatient.tags,
              notes: selectedPatient.notes,
              confidentiality: selectedPatient.confidentiality
            }
            const conversationSummary = systemState.history.slice(-6).map(m => `${m.role === 'user' ? 'Paciente' : 'Modelo'}: ${m.content}`).join('\n')
            const fichaId = `ficha_${selectedPatient.id}_${Date.now()}`
            await generateFichaClinica(selectedPatient.id, fichaId, { ...sessionState, patientForm, conversationSummary } as any)
            await loadFichasClinicas(selectedPatient.id)
          }}
        />
      )}

      {/* Patient Conversation History */}
      {selectedPatient && (
        <Dialog open={showConversationHistory} onOpenChange={setShowConversationHistory}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Historial de Conversaciones - {selectedPatient.displayName}</DialogTitle>
              <DialogDescription>
                Revisa las conversaciones anteriores con este paciente
              </DialogDescription>
            </DialogHeader>
            <PatientConversationHistory
              patient={selectedPatient}
              userId={"demo_user"}
              onConversationSelect={async (sessionId: string) => {
                  console.log('Cargando conversación:', sessionId);
                  setShowConversationHistory(false);
                  
                  try {
                    // Usar el singleton para obtener el estado de la sesión
                    const { HopeAISystemSingleton } = await import('@/lib/hopeai-system')
                    const instance = await HopeAISystemSingleton.getInitializedInstance();
                    const chatState = await instance.getChatState(sessionId);
                    console.log('✅ Estado de sesión obtenido exitosamente:', sessionId);
                    
                    // Notificar al componente padre que se ha seleccionado una conversación
                    // En lugar de recargar la página, el sistema debería actualizar el estado
                    if (onConversationSelect) {
                      onConversationSelect(sessionId);
                    }
                  } catch (error) {
                    console.error('❌ Error obteniendo estado de sesión:', error);
                  }
                }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}