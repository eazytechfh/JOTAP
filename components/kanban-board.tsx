"use client"

import { useEffect, useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getLeads,
  updateLeadStage,
  generateResumoComercial,
  sendPesquisaAtendimentoWebhook,
  deleteLead,
  type Lead,
  ESTAGIO_LABELS,
  ESTAGIO_COLORS,
  VALID_ESTAGIOS,
  formatCurrency,
} from "@/lib/leads"
import { getCurrentUser } from "@/lib/auth"
import {
  Search,
  Filter,
  Phone,
  Mail,
  User,
  Calendar,
  MapPin,
  Car,
  LayoutGrid,
  List,
  DollarSign,
  FileText,
  Sparkles,
  Loader2,
  Move,
  AlertTriangle,
  Trash2,
  MessageCircle,
} from "lucide-react"
import { LeadsListView } from "./leads-list-view"
import { EditableValueField } from "./editable-value-field"
import { EditableObservacaoField } from "./editable-observacao-field"
import { EditableVeiculoField } from "./editable-veiculo-field"
import { EditableEmailField } from "./editable-email-field"

// Nova ordem das colunas conforme solicitado
const COLUNAS_KANBAN = [
  "oportunidade",
  "em_qualificacao",
  "em_negociacao",
  "fechado",
  "nao_fechou",
  "pesquisa_atendimento",
  "follow_up",
  "pos_venda",
]

export function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOrigem, setFilterOrigem] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
  const [generatingResumo, setGeneratingResumo] = useState(false)
  const [resumoMessage, setResumoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [movingLead, setMovingLead] = useState<number | null>(null)
  const [deletingLead, setDeletingLead] = useState<number | null>(null)

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, filterOrigem, filterEstagio])

const loadLeads = async () => {
  const user = getCurrentUser()
  if (user) {
    const data = await getLeads(user.id_empresa)

    const isAdmin = user.cargo === "administrador"

    if (isAdmin) {
      setLeads(data)
    } else {
      const vendedorNome = (user.nome_usuario || "").trim().toLowerCase()

      const onlyMine = data.filter((lead) => {
        const leadVendedor = (lead.vendedor || "").trim().toLowerCase()
        return leadVendedor !== "" && leadVendedor === vendedorNome
      })

      setLeads(onlyMine)
    }
  }
  setLoading(false)
}

  const filterLeads = () => {
    let filtered = [...leads]

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.nome_lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.telefone?.includes(searchTerm) ||
          lead.vendedor?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterOrigem && filterOrigem !== "all") {
      filtered = filtered.filter((lead) => lead.origem === filterOrigem)
    }

    if (filterEstagio && filterEstagio !== "all") {
      filtered = filtered.filter((lead) => lead.estagio_lead === filterEstagio)
    }

    setFilteredLeads(filtered)
  }

  const handleDragStart = (start: any) => {
    const leadId = Number.parseInt(start.draggableId)
    const lead = leads.find((l) => l.id === leadId)
    setDraggedLead(lead || null)
  }

  const handleDragEnd = async (result: any) => {
    setDraggedLead(null)

    if (!result.destination) {
      return
    }

    const { source, destination, draggableId } = result

    // Se foi solto na mesma coluna, não faz nada
    if (source.droppableId === destination.droppableId) {
      return
    }

    const leadId = Number.parseInt(draggableId)
    const newStage = destination.droppableId
    const oldStage = source.droppableId

    // Validar se o novo estágio é válido
    if (!VALID_ESTAGIOS.includes(newStage)) {
      console.error("Invalid stage:", newStage)
      setResumoMessage({
        type: "error",
        text: `Estágio inválido: ${newStage}. Recarregue a página e tente novamente.`,
      })
      setTimeout(() => setResumoMessage(null), 5000)
      return
    }

    console.log("Moving lead:", {
      leadId,
      from: oldStage,
      to: newStage,
      validStages: VALID_ESTAGIOS,
    })

    setMovingLead(leadId)

    const leadData = leads.find((lead) => lead.id === leadId)

    // Atualização otimista da UI
    setLeads((prevLeads) =>
      prevLeads.map((lead) =>
        lead.id === leadId ? { ...lead, estagio_lead: newStage, updated_at: new Date().toISOString() } : lead,
      ),
    )

    try {
      // Atualizar no banco de dados
      const success = await updateLeadStage(leadId, newStage)

      if (!success) {
        // Reverter se falhou
        setLeads((prevLeads) =>
          prevLeads.map((lead) => (lead.id === leadId ? { ...lead, estagio_lead: oldStage } : lead)),
        )

        // Mostrar erro
        setResumoMessage({
          type: "error",
          text: "Erro ao mover o lead. Verifique o console para mais detalhes e tente novamente.",
        })

        setTimeout(() => setResumoMessage(null), 5000)
      } else {
        console.log("Lead moved successfully")

        if (newStage === "pesquisa_atendimento" && leadData) {
          console.log("[v0] Lead moved to Pesquisa de Atendimento, triggering webhook")

          try {
            const webhookSuccess = await sendPesquisaAtendimentoWebhook(leadData)

            if (webhookSuccess) {
              setResumoMessage({
                type: "success",
                text: "Lead movido para Pesquisa de Atendimento e webhook enviado com sucesso!",
              })
            } else {
              setResumoMessage({
                type: "error",
                text: "Lead movido, mas houve erro ao enviar webhook de Pesquisa de Atendimento.",
              })
            }

            setTimeout(() => setResumoMessage(null), 5000)
          } catch (webhookError) {
            console.error("[v0] Error sending pesquisa atendimento webhook:", webhookError)
            setResumoMessage({
              type: "error",
              text: "Lead movido, mas houve erro ao processar webhook de Pesquisa de Atendimento.",
            })
            setTimeout(() => setResumoMessage(null), 5000)
          }
        }
      }
    } catch (error) {
      console.error("Unexpected error moving lead:", error)

      // Reverter se falhou
      setLeads((prevLeads) =>
        prevLeads.map((lead) => (lead.id === leadId ? { ...lead, estagio_lead: oldStage } : lead)),
      )

      setResumoMessage({
        type: "error",
        text: "Erro inesperado ao mover o lead. Tente novamente.",
      })

      setTimeout(() => setResumoMessage(null), 5000)
    } finally {
      setMovingLead(null)
    }
  }

  const handleValueUpdate = (leadId: number, newValue: number) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, valor: newValue } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, valor: newValue })
    }
  }

  const handleObservacaoUpdate = (leadId: number, newObservacao: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, observacao_vendedor: newObservacao } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, observacao_vendedor: newObservacao })
    }
  }

  const handleVeiculoUpdate = (leadId: number, newVeiculo: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, veiculo_interesse: newVeiculo } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, veiculo_interesse: newVeiculo })
    }
  }

  const handleEmailUpdate = (leadId: number, newEmail: string) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, email: newEmail } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, email: newEmail })
    }
  }

  const handleGenerateResumo = async () => {
    if (!selectedLead) return

    setGeneratingResumo(true)
    setResumoMessage(null)

    try {
      const success = await generateResumoComercial(selectedLead)

      if (success) {
        setResumoMessage({
          type: "success",
          text: "Webhook enviado com sucesso! O resumo comercial será gerado em breve.",
        })
      } else {
        setResumoMessage({
          type: "error",
          text: "Erro ao enviar webhook. Tente novamente.",
        })
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro ao processar solicitação. Verifique sua conexão.",
      })
    } finally {
      setGeneratingResumo(false)

      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setResumoMessage(null)
      }, 5000)
    }
  }

  const handleWhatsAppClick = () => {
    if (!selectedLead || !selectedLead.telefone) {
      setResumoMessage({
        type: "error",
        text: "Este lead não possui número de telefone cadastrado.",
      })
      setTimeout(() => setResumoMessage(null), 3000)
      return
    }

    // Remove caracteres não numéricos do telefone
    const phoneNumber = selectedLead.telefone.replace(/\D/g, "")

    // Abre WhatsApp com o número do lead
    const whatsappUrl = `https://wa.me/55${phoneNumber}`
    window.open(whatsappUrl, "_blank")
  }

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm("Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.")) {
      return
    }

    setDeletingLead(leadId)

    try {
      const success = await deleteLead(leadId)

      if (success) {
        // Remover o lead da lista local
        setLeads((prevLeads) => prevLeads.filter((lead) => lead.id !== leadId))

        // Fechar o modal se o lead excluído estava selecionado
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(null)
        }

        setResumoMessage({
          type: "success",
          text: "Lead excluído com sucesso!",
        })
      } else {
        setResumoMessage({
          type: "error",
          text: "Erro ao excluir o lead. Tente novamente.",
        })
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro inesperado ao excluir o lead.",
      })
    } finally {
      setDeletingLead(null)

      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setResumoMessage(null)
      }, 5000)
    }
  }

  const getLeadsByStage = (stage: string) => {
    return filteredLeads.filter((lead) => lead.estagio_lead === stage)
  }

  const getStageTotal = (stage: string) => {
    const stageLeads = getLeadsByStage(stage)
    return stageLeads.reduce((total, lead) => total + (lead.valor || 0), 0)
  }

  const origens = [...new Set(leads.map((lead) => lead.origem).filter(Boolean))]

  const handleLeadsUpdate = () => {
    loadLeads()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {COLUNAS_KANBAN.map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Visualização
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="flex items-center gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Lista
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mensagem de Status Global */}
      {resumoMessage && (
        <Alert
          className={`${resumoMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className={resumoMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {resumoMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {viewMode === "list" ? (
        <LeadsListView leads={leads} onLeadsUpdate={handleLeadsUpdate} />
      ) : (
        <>
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, telefone ou vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    {origens.map((origem) => (
                      <SelectItem key={origem} value={origem!}>
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterEstagio} onValueChange={setFilterEstagio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estágios</SelectItem>
                    {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Instruções de Uso */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Move className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    💡 <strong>Como usar:</strong> Arraste e solte os cards dos leads entre as colunas para alterar o
                    estágio
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    As alterações são salvas automaticamente no banco de dados
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug Info - Remover em produção */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600">
                <strong>Debug:</strong> Estágios válidos: {VALID_ESTAGIOS.join(", ")}
                {movingLead && <span className="ml-4 text-orange-600">Movendo lead ID: {movingLead}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Kanban Board */}
          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-4">
                {COLUNAS_KANBAN.map((stage) => (
                  <Droppable key={stage} droppableId={stage}>
                    {(provided, snapshot) => (
                      <Card
                        className={`w-80 min-h-[500px] flex-shrink-0 transition-all duration-200 ${
                          snapshot.isDraggingOver
                            ? "bg-gradient-to-b from-blue-50 to-blue-100 border-blue-300 shadow-lg transform scale-105"
                            : "hover:shadow-md"
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              {snapshot.isDraggingOver && <Move className="h-4 w-4 text-blue-500 animate-pulse" />}
                              {ESTAGIO_LABELS[stage as keyof typeof ESTAGIO_LABELS]}
                            </span>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {getLeadsByStage(stage).length}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                {formatCurrency(getStageTotal(stage))}
                              </Badge>
                            </div>
                          </CardTitle>
                          {snapshot.isDraggingOver && (
                            <div className="text-xs text-blue-600 font-medium animate-pulse">
                              ↓ Solte aqui para mover
                            </div>
                          )}
                        </CardHeader>
                        <CardContent ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {getLeadsByStage(stage).map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-grab active:cursor-grabbing transition-all duration-200 ${
                                    snapshot.isDragging
                                      ? "shadow-2xl rotate-3 scale-105 bg-white border-blue-300 z-50"
                                      : "hover:shadow-md hover:-translate-y-1"
                                  } ${movingLead === lead.id ? "opacity-50" : ""}`}
                                  onClick={(e) => {
                                    // Só abre o modal se não estiver arrastando
                                    if (!snapshot.isDragging) {
                                      setSelectedLead(lead)
                                    }
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm text-gray-900 truncate flex-1">
                                          {lead.nome_lead}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                          {movingLead === lead.id && (
                                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                          )}
                                          <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        </div>
                                      </div>

                                      {/* Campo de Valor Editável */}
                                      <div
                                        className="border border-gray-200 rounded p-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <EditableValueField
                                          leadId={lead.id}
                                          currentValue={lead.valor || 0}
                                          onValueUpdate={(newValue) => handleValueUpdate(lead.id, newValue)}
                                        />
                                      </div>

                                      {lead.telefone && (
                                        <p className="text-xs text-gray-600 flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {lead.telefone}
                                        </p>
                                      )}
                                      {lead.veiculo_interesse && (
                                        <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
                                          <Car className="h-3 w-3 flex-shrink-0" />
                                          <span className="truncate">{lead.veiculo_interesse}</span>
                                        </p>
                                      )}
                                      <div className="flex justify-between items-center">
                                        {lead.origem && (
                                          <Badge variant="outline" className="text-xs">
                                            {lead.origem}
                                          </Badge>
                                        )}
                                        {lead.vendedor && (
                                          <span className="text-xs text-gray-500 truncate ml-2">{lead.vendedor}</span>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Placeholder quando vazio */}
                          {getLeadsByStage(stage).length === 0 && (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                              <div className="text-xs">Nenhum lead neste estágio</div>
                              <div className="text-xs mt-1">Arraste leads aqui</div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Droppable>
                ))}
              </div>
            </div>
          </DragDropContext>

          {/* Modal de Detalhes do Lead - Com Botão Gerar Resumo */}
          <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
            <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] overflow-hidden">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center gap-2">
                    <User className="h-6 w-6" />
                    Detalhes do Lead
                  </div>
                  {selectedLead && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteLead(selectedLead.id)}
                      disabled={deletingLead === selectedLead.id}
                      className="flex items-center gap-2"
                    >
                      {deletingLead === selectedLead.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Excluir Lead
                        </>
                      )}
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedLead && (
                <div className="flex flex-col h-full max-h-[80vh]">
                  {/* Header Info - Fixed */}
                  <div className="flex-shrink-0 space-y-4 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-2xl">{selectedLead.nome_lead}</h3>
                        <Badge
                          className={`mt-2 ${ESTAGIO_COLORS[selectedLead.estagio_lead as keyof typeof ESTAGIO_COLORS]}`}
                        >
                          {ESTAGIO_LABELS[selectedLead.estagio_lead as keyof typeof ESTAGIO_LABELS]}
                        </Badge>
                      </div>
                    </div>

                    {/* Informações Básicas em Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedLead.telefone && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.telefone}</span>
                        </div>
                      )}

                      {selectedLead.email && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium truncate">{selectedLead.email}</span>
                        </div>
                      )}

                      {selectedLead.origem && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.origem}</span>
                        </div>
                      )}

                      {selectedLead.vendedor && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.vendedor}</span>
                        </div>
                      )}

                      {selectedLead.veiculo_interesse && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Car className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.veiculo_interesse}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          {new Date(selectedLead.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <ScrollArea className="flex-1 mt-4">
                    <div className="space-y-6 pr-4">
                      {/* Campos Editáveis */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Valor do Lead - Editável */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <span className="text-lg font-semibold text-green-800">Valor do Negócio</span>
                          </div>
                          <EditableValueField
                            leadId={selectedLead.id}
                            currentValue={selectedLead.valor || 0}
                            onValueUpdate={(newValue) => handleValueUpdate(selectedLead.id, newValue)}
                            className="text-xl"
                          />
                        </div>

                        {/* Observação do Vendedor - Editável */}
                        <div>
                          <EditableObservacaoField
                            leadId={selectedLead.id}
                            currentObservacao={selectedLead.observacao_vendedor || ""}
                            onObservacaoUpdate={(newObservacao) =>
                              handleObservacaoUpdate(selectedLead.id, newObservacao)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Veículo - Editável */}
                        <div>
                          <EditableVeiculoField
                            leadId={selectedLead.id}
                            currentVeiculo={selectedLead.veiculo_interesse || ""}
                            onVeiculoUpdate={(newVeiculo) => handleVeiculoUpdate(selectedLead.id, newVeiculo)}
                          />
                        </div>

                        {/* E-mail - Editável */}
                        <div>
                          <EditableEmailField
                            leadId={selectedLead.id}
                            currentEmail={selectedLead.email || ""}
                            onEmailUpdate={(newEmail) => handleEmailUpdate(selectedLead.id, newEmail)}
                          />
                        </div>
                      </div>

                      {/* Resumos - Somente Leitura */}
                      {selectedLead.resumo_qualificacao && (
                        <div>
                          <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            Resumo de Qualificação
                          </h4>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                              {selectedLead.resumo_qualificacao}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Resumo Comercial com Botão Gerar */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-500" />
                            Resumo Comercial
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleWhatsAppClick}
                              className="bg-green-500 hover:bg-green-600 text-white"
                              size="sm"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              WhatsApp
                            </Button>
                            <Button
                              onClick={handleGenerateResumo}
                              disabled={generatingResumo}
                              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                              size="sm"
                            >
                              {generatingResumo ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Gerando...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Gerar Resumo Comercial
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                            {selectedLead.resumo_comercial || (
                              <span className="text-gray-500 italic">
                                Nenhum resumo comercial disponível. Clique em "Gerar Resumo Comercial" para criar um.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Espaço extra no final para scroll confortável */}
                      <div className="h-4"></div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
