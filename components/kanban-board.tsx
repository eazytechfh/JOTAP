"use client"

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react"
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useVirtualizer } from "@tanstack/react-virtual"
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
  getLeadById,
  updateLeadStage,
  generateResumoComercial,
  deleteLead,
  type Lead,
  ESTAGIO_LABELS,
  ESTAGIO_COLORS,
  formatCurrency,
} from "@/lib/leads"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/utils/supabase/client"
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
  Clock3,
  ArrowRightLeft,
} from "lucide-react"
import { LeadsListView } from "./leads-list-view"
import { EditableValueField } from "./editable-value-field"
import { EditableObservacaoField } from "./editable-observacao-field"
import { EditableVeiculoField } from "./editable-veiculo-field"
import { EditableEmailField } from "./editable-email-field"

const COLUNAS_KANBAN = [
  "oportunidade",
  "em_qualificacao",
  "transferidos",
  "em_negociacao",
  "fechado",
  "nao_fechou",
  "follow_up",
  "pos_venda",
] as const

type NegociacaoStage = (typeof COLUNAS_KANBAN)[number]

const ESTAGIOS_NEGOCIACOES: NegociacaoStage[] = [...COLUNAS_KANBAN]
const ESTAGIO_LABELS_NEGOCIACOES = {
  oportunidade: "Oportunidade",
  em_qualificacao: "Em Qualificação",
  transferidos: "Transferidos",
  em_negociacao: "Em Negociação",
  fechado: "Fechado",
  nao_fechou: "Não Fechou",
  follow_up: "Follow Up",
  pos_venda: "Pós Venda",
} satisfies Record<NegociacaoStage, string>

function isNegociacaoStage(stage: string): stage is NegociacaoStage {
  return ESTAGIOS_NEGOCIACOES.includes(stage as NegociacaoStage)
}

const TRANSFER_TIMEOUT_MS = 30 * 60 * 1000

function normalizeStage(stage?: string | null) {
  return String(stage || "").trim().toLowerCase()
}

function normalizeLead(lead: Lead): Lead {
  return {
    ...lead,
    telefone: lead.telefone ? String(lead.telefone).trim() : "",
    vendedor: lead.vendedor ? String(lead.vendedor).trim() : "",
    transferido_vendedor: lead.transferido_vendedor ? String(lead.transferido_vendedor).trim() : "",
    estagio_lead: normalizeStage(lead.estagio_lead),
  }
}

function parseSupabaseTimestamp(value?: string | null) {
  if (!value) return null

  const raw = String(value).trim()
  if (!raw) return null

  const hasTimezone = /z$|[+-]\d{2}:\d{2}$/i.test(raw)

  if (hasTimezone) {
    const parsed = new Date(raw).getTime()
    return Number.isNaN(parsed) ? null : parsed
  }

  const utcValue = raw.replace(" ", "T") + "Z"
  const parsed = new Date(utcValue).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function formatRemainingTime(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

// Timer isolado: só este componente re-renderiza a cada segundo.
// O KanbanBoard e os outros 900+ cards ficam intocados.
const TransferCountdown = memo(function TransferCountdown({
  transferidoEm,
}: {
  transferidoEm: string
}) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const startedAt = parseSupabaseTimestamp(transferidoEm)
  if (!startedAt) return null

  const remainingMs = startedAt + TRANSFER_TIMEOUT_MS - now
  const expired = remainingMs <= 0
  const urgent = remainingMs > 0 && remainingMs <= 60_000

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-2 py-1 text-xs ${
        expired
          ? "border-red-200 bg-red-50 text-red-700"
          : urgent
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-orange-200 bg-orange-50 text-orange-700"
      }`}
    >
      <div className="flex items-center gap-1">
        <Clock3 className="h-3 w-3" />
        <span>Tempo restante</span>
      </div>
      <span className="font-semibold">{formatRemainingTime(remainingMs)}</span>
    </div>
  )
})

interface KanbanCardProps {
  lead: Lead
  movingLead: number | null
  onValueUpdate: (leadId: number, newValue: number) => void
  onAtender: (leadId: number) => void
  onSelect: (lead: Lead) => void
}

const KanbanCard = memo(function KanbanCard({ lead, movingLead, onValueUpdate, onAtender, onSelect }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id.toString(),
    data: { stage: lead.estagio_lead },
  })

  const isMoving = movingLead === lead.id
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-shadow duration-200 touch-none ${
        isDragging ? "opacity-0" : "hover:shadow-md hover:-translate-y-1"
      } ${isMoving ? "opacity-50" : ""}`}
      onClick={() => { if (!isDragging) onSelect(lead) }}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-gray-900 truncate flex-1">{lead.nome_lead}</h4>
            <div className="flex items-center gap-1">
              {isMoving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          {lead.estagio_lead === "transferidos" && lead.transferido_em && (
            <TransferCountdown transferidoEm={lead.transferido_em} />
          )}

          <div className="border border-gray-200 rounded p-1" onClick={(e) => e.stopPropagation()}>
            <EditableValueField leadId={lead.id} currentValue={lead.valor || 0} onValueUpdate={onValueUpdate} />
          </div>

          {lead.telefone && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {lead.telefone}
              </p>
              {lead.estagio_lead === "transferidos" && (
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isMoving}
                  onClick={(e) => { e.stopPropagation(); onAtender(lead.id) }}
                >
                  {isMoving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atender"}
                </Button>
              )}
            </div>
          )}

          {lead.veiculo_interesse && (
            <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
              <Car className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.veiculo_interesse}</span>
            </p>
          )}

          <div className="flex justify-between items-center">
            {lead.origem && <Badge variant="outline" className="text-xs">{lead.origem}</Badge>}
            {lead.vendedor && <span className="text-xs text-gray-500 truncate ml-2">{lead.vendedor}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

interface KanbanColumnProps {
  stage: NegociacaoStage
  leads: Lead[]
  total: number
  movingLead: number | null
  onValueUpdate: (leadId: number, newValue: number) => void
  onAtender: (leadId: number) => void
  onSelect: (lead: Lead) => void
}

const KanbanColumn = memo(function KanbanColumn({
  stage, leads, total, movingLead, onValueUpdate, onAtender, onSelect,
}: KanbanColumnProps) {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    setScrollEl(el)
    setNodeRef(el)
  }, [setNodeRef])

  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 138,
    overscan: 5,
  })

  return (
    <Card className={`flex h-full w-80 flex-shrink-0 flex-col transition-colors duration-150 ${
      isOver ? "bg-blue-50 border-blue-300 shadow-lg" : "hover:shadow-md"
    }`}>
      <CardHeader className="flex-none pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isOver && <Move className="h-4 w-4 text-blue-500 animate-pulse" />}
            {ESTAGIO_LABELS_NEGOCIACOES[stage] || ESTAGIO_LABELS[stage as keyof typeof ESTAGIO_LABELS] || stage}
          </span>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">{formatCurrency(total)}</Badge>
          </div>
        </CardTitle>
        {isOver && <div className="text-xs text-blue-600 font-medium animate-pulse">↓ Solte aqui para mover</div>}
      </CardHeader>

      <CardContent
        ref={setRefs}
        className="kanban-column-scroll flex-1 overflow-y-auto px-4 pb-4 pt-0"
      >
        {leads.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-xs">Nenhum lead neste estágio</div>
            <div className="text-xs mt-1">Arraste leads aqui</div>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const lead = leads[virtualItem.index]
              return (
                <div
                  key={lead.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: "8px",
                  }}
                >
                  <KanbanCard
                    lead={lead}
                    movingLead={movingLead}
                    onValueUpdate={onValueUpdate}
                    onAtender={onAtender}
                    onSelect={onSelect}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export function KanbanBoard() {
  const columnViewportHeight = "64rem"
  const [leads, setLeads] = useState<Lead[]>([])
  // filteredLeads é derivado — não precisa de estado separado

  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOrigem, setFilterOrigem] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [filterDataInicio, setFilterDataInicio] = useState("")
  const [filterDataFim, setFilterDataFim] = useState("")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
  const [generatingResumo, setGeneratingResumo] = useState(false)
  const [resumoMessage, setResumoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [movingLead, setMovingLead] = useState<number | null>(null)
  const [deletingLead, setDeletingLead] = useState<number | null>(null)
  const [showMoveStageOptions, setShowMoveStageOptions] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  )

  const loadLeads = useCallback(async () => {
    const user = getCurrentUser()

    if (!user) {
      setLoading(false)
      return
    }

    try {
      const data = await getLeads(user.id_empresa)
      const normalizedData = data.map(normalizeLead)

      const isAdmin = user.cargo === "administrador"

      const incoming = isAdmin
        ? normalizedData
        : (() => {
            const vendedorNome = (user.nome_usuario || "").trim().toLowerCase()
            return normalizedData.filter((lead) => {
              const leadVendedor = (lead.vendedor || "").trim().toLowerCase()
              return leadVendedor !== "" && leadVendedor === vendedorNome
            })
          })()

      // Preserva referências de leads que não mudaram — mantém React.memo efetivo
      setLeads((prev) => {
        const prevMap = new Map(prev.map((l) => [l.id, l]))
        return incoming.map((lead) => {
          const old = prevMap.get(lead.id)
          return old && old.updated_at === lead.updated_at ? old : lead
        })
      })
    } catch (error) {
      console.error("Erro ao carregar leads:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const filteredLeads = useMemo(() => {
    let filtered = leads

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (lead) =>
          lead.nome_lead.toLowerCase().includes(term) ||
          String(lead.telefone || "").includes(searchTerm) ||
          lead.vendedor?.toLowerCase().includes(term),
      )
    }

    if (filterOrigem && filterOrigem !== "all") {
      filtered = filtered.filter((lead) => lead.origem === filterOrigem)
    }

    if (filterEstagio && filterEstagio !== "all") {
      const normalizedEstagio = normalizeStage(filterEstagio)
      filtered = filtered.filter((lead) => normalizeStage(lead.estagio_lead) === normalizedEstagio)
    }

    if (filterDataInicio) {
      const [y, m, d] = filterDataInicio.split("-").map(Number)
      const inicio = new Date(y, m - 1, d, 0, 0, 0, 0)
      filtered = filtered.filter((lead) => new Date(lead.created_at) >= inicio)
    }

    if (filterDataFim) {
      const [y, m, d] = filterDataFim.split("-").map(Number)
      const fim = new Date(y, m - 1, d, 23, 59, 59, 999)
      filtered = filtered.filter((lead) => new Date(lead.created_at) <= fim)
    }

    return filtered
  }, [leads, searchTerm, filterOrigem, filterEstagio, filterDataInicio, filterDataFim])

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) return

    const isAdmin = user.cargo === "administrador"
    const vendedorNome = (user.nome_usuario || "").trim().toLowerCase()

    const supabase = createClient()

    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "BASE_DE_LEADS",
          filter: `id_empresa=eq.${user.id_empresa}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const lead = normalizeLead(payload.new as Lead)
            const belongs = isAdmin || (lead.vendedor || "").trim().toLowerCase() === vendedorNome
            if (belongs) {
              setLeads((prev) => [lead, ...prev])
            }
          }

          if (payload.eventType === "UPDATE") {
            const updated = normalizeLead(payload.new as Lead)
            setLeads((prev) => {
              const exists = prev.some((l) => l.id === updated.id)
              if (!exists) return prev
              return prev.map((l) => (l.id === updated.id ? updated : l))
            })
            setSelectedLead((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
          }

          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: number }).id
            setLeads((prev) => prev.filter((l) => l.id !== deletedId))
            setSelectedLead((prev) => (prev?.id === deletedId ? null : prev))
          }
        },
      )
      .subscribe((status) => {
        // Reconexão: recarrega tudo para garantir sincronia
        if (status === "SUBSCRIBED") return
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          loadLeads()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadLeads])


  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveLeadId(event.active.id as string)
  }, [])

  const moveLeadToStage = useCallback(
    async (leadId: number, newStage: NegociacaoStage, successMessage?: string) => {
      const updatedAt = new Date().toISOString()
      let leadData: Lead | undefined

      // Aplica update otimista e captura leadData para rollback — tudo em uma passagem
      setLeads((prevLeads) => {
        leadData = prevLeads.find((l) => l.id === leadId)
        if (!leadData) return prevLeads
        return prevLeads.map((lead) => {
          if (lead.id !== leadId) return lead
          return {
            ...lead,
            estagio_lead: newStage,
            updated_at: updatedAt,
            transferido_em: newStage === "transferidos" ? updatedAt : lead.transferido_em,
            transferido_vendedor: newStage === "transferidos" ? lead.vendedor || "" : lead.transferido_vendedor,
          }
        })
      })

      if (!leadData) {
        setResumoMessage({
          type: "error",
          text: "Não foi possível localizar o lead. Atualize a tela e tente novamente.",
        })
        setTimeout(() => setResumoMessage(null), 5000)
        return false
      }

      const snapshot = leadData

      setMovingLead(leadId)
      setSelectedLead((prev) => {
        if (!prev || prev.id !== leadId) return prev
        return {
          ...prev,
          estagio_lead: newStage,
          updated_at: updatedAt,
          transferido_em: newStage === "transferidos" ? updatedAt : prev.transferido_em,
          transferido_vendedor: newStage === "transferidos" ? prev.vendedor || "" : prev.transferido_vendedor,
        }
      })

      try {
        const success = await updateLeadStage(leadId, newStage)

        if (!success) {
          setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? snapshot : lead)))
          setSelectedLead((prev) => (prev?.id === leadId ? snapshot : prev))
          setResumoMessage({
            type: "error",
            text: "Erro ao mover o lead. Verifique o console para mais detalhes e tente novamente.",
          })
          setTimeout(() => setResumoMessage(null), 5000)
          return false
        }

        if (successMessage) {
          setResumoMessage({ type: "success", text: successMessage })
          setTimeout(() => setResumoMessage(null), 5000)
        }

        return true
      } catch (error) {
        console.error("Unexpected error moving lead:", error)
        setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? snapshot : lead)))
        setSelectedLead((prev) => (prev?.id === leadId ? snapshot : prev))
        setResumoMessage({
          type: "error",
          text: "Erro inesperado ao mover o lead. Tente novamente.",
        })
        setTimeout(() => setResumoMessage(null), 5000)
        return false
      } finally {
        setMovingLead(null)
      }
    },
    [],
  )



  const handleKanbanDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveLeadId(null)

    const { active, over } = event
    if (!over) return

    const sourceStage = normalizeStage(active.data.current?.stage as string)
    const newStage = normalizeStage(over.id as string)

    if (sourceStage === newStage) return

    if (!isNegociacaoStage(newStage)) return

    const leadId = Number.parseInt(active.id as string)
    await moveLeadToStage(leadId, newStage)
  }, [moveLeadToStage])

  const handleMoveLeadToStage = async (leadId: number, stage: NegociacaoStage) => {
    const stageLabel = ESTAGIO_LABELS_NEGOCIACOES[stage]
    await moveLeadToStage(leadId, stage, `Lead movido para ${stageLabel} com sucesso!`)
  }

  const handleAtenderLeadAction = async (leadId: number) => {
    await moveLeadToStage(leadId, "em_negociacao", "Lead movido para Em NegociaÃ§Ã£o com sucesso!")
  }

  const handleValueUpdate = useCallback((leadId: number, newValue: number) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, valor: newValue } : lead)))
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, valor: newValue } : prev))
  }, [])

  const handleObservacaoUpdate = useCallback((leadId: number, newObservacao: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, observacao_vendedor: newObservacao } : lead)),
    )
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, observacao_vendedor: newObservacao } : prev))
  }, [])

  const handleVeiculoUpdate = useCallback((leadId: number, newVeiculo: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, veiculo_interesse: newVeiculo } : lead)),
    )
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, veiculo_interesse: newVeiculo } : prev))
  }, [])

  const handleEmailUpdate = useCallback((leadId: number, newEmail: string) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, email: newEmail } : lead)))
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, email: newEmail } : prev))
  }, [])

  const handleSelectLead = useCallback(async (lead: Lead) => {
    setSelectedLead(lead)
    const full = await getLeadById(lead.id)
    if (full) setSelectedLead(full)
  }, [])

  const handleGenerateResumo = async () => {
    if (!selectedLead) return

    setGeneratingResumo(true)
    setResumoMessage(null)

    try {
      const success = await generateResumoComercial(selectedLead)

      setResumoMessage({
        type: success ? "success" : "error",
        text: success
          ? "Webhook enviado com sucesso! O resumo comercial será gerado em breve."
          : "Erro ao enviar webhook. Tente novamente.",
      })
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro ao processar solicitação. Verifique sua conexão.",
      })
    } finally {
      setGeneratingResumo(false)
      setTimeout(() => setResumoMessage(null), 5000)
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

    const phoneNumber = String(selectedLead.telefone).replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/55${phoneNumber}`
    window.open(whatsappUrl, "_blank")
  }

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm("Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.")) return

    setDeletingLead(leadId)

    try {
      const success = await deleteLead(leadId)

      if (success) {
        setLeads((prevLeads) => prevLeads.filter((lead) => lead.id !== leadId))

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
      setTimeout(() => setResumoMessage(null), 5000)
    }
  }

  // Um único forEach distribui todos os leads nas 8 colunas de uma vez.
  // Recalcula apenas quando filteredLeads muda — não a cada render.
  const leadsByStage = useMemo(() => {
    const map = {} as Record<NegociacaoStage, Lead[]>
    for (const stage of COLUNAS_KANBAN) map[stage] = []

    for (const lead of filteredLeads) {
      const s = lead.estagio_lead as NegociacaoStage
      if (map[s]) map[s].push(lead)
    }

    // Ordenação de em_negociacao por mais recente
    map["em_negociacao"] = map["em_negociacao"].sort(
      (a, b) => (parseSupabaseTimestamp(b.updated_at) ?? 0) - (parseSupabaseTimestamp(a.updated_at) ?? 0),
    )

    return map
  }, [filteredLeads])

  const stageTotals = useMemo(() => {
    const totals = {} as Record<NegociacaoStage, number>
    for (const stage of COLUNAS_KANBAN) {
      totals[stage] = leadsByStage[stage].reduce((sum, lead) => sum + (lead.valor || 0), 0)
    }
    return totals
  }, [leadsByStage])

  const origens = useMemo(
    () => [...new Set(leads.map((lead) => lead.origem).filter(Boolean))],
    [leads],
  )

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
    <div className="flex h-full min-h-0 flex-col gap-6">
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
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <LeadsListView leads={leads} onLeadsUpdate={handleLeadsUpdate} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6">
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
                    {Object.entries(ESTAGIO_LABELS_NEGOCIACOES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data de entrada — De
                  </label>
                  <Input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data de entrada — Até
                  </label>
                  <Input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                  />
                </div>
                {(filterDataInicio || filterDataFim) && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setFilterDataInicio(""); setFilterDataFim("") }}
                      className="text-xs text-gray-500"
                    >
                      Limpar datas
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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

          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600">
                <strong>Debug:</strong> Estágios válidos: {ESTAGIOS_NEGOCIACOES.join(", ")}
                {movingLead && <span className="ml-4 text-orange-600">Movendo lead ID: {movingLead}</span>}
              </div>
            </CardContent>
          </Card>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleKanbanDragEnd}>
            <div
              className="overflow-x-auto overflow-y-hidden pb-2"
              style={{ height: columnViewportHeight, minHeight: columnViewportHeight }}
            >
              <div className="flex h-full min-w-max gap-4 pb-2">
                {COLUNAS_KANBAN.map((stage) => (
                  <KanbanColumn
                    key={stage}
                    stage={stage}
                    leads={leadsByStage[stage]}
                    total={stageTotals[stage]}
                    movingLead={movingLead}
                    onValueUpdate={handleValueUpdate}
                    onAtender={handleAtenderLeadAction}
                    onSelect={handleSelectLead}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeLeadId ? (() => {
                const lead = leads.find((l) => l.id.toString() === activeLeadId)
                if (!lead) return null
                return (
                  <Card className="w-72 cursor-grabbing shadow-2xl rotate-2 border-blue-300 bg-white">
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{lead.nome_lead}</h4>
                        {lead.telefone && (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{lead.telefone}
                          </p>
                        )}
                        {lead.origem && <Badge variant="outline" className="text-xs">{lead.origem}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })() : null}
            </DragOverlay>
          </DndContext>

          <Dialog
            open={!!selectedLead}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedLead(null)
                setShowMoveStageOptions(false)
              }
            }}
          >
            <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] overflow-hidden">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center gap-2">
                    <User className="h-6 w-6" />
                    Detalhes do Lead
                  </div>
                  {selectedLead && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMoveStageOptions((prev) => !prev)}
                        className="flex items-center gap-2"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Mover Etapa
                      </Button>

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
                    </div>
                  )}
                </DialogTitle>
              </DialogHeader>

              {selectedLead && (
                <div className="flex flex-col h-full max-h-[80vh]">
                  {showMoveStageOptions && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/70 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                        <h4 className="text-lg font-semibold text-blue-900">Mover Etapa</h4>
                      </div>

                      <div className="space-y-2">
                        {COLUNAS_KANBAN.map((stage) => {
                          const isCurrentStage = normalizeStage(selectedLead.estagio_lead) === stage

                          return (
                            <div
                              key={stage}
                              className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-4 py-3"
                            >
                              <Badge className={ESTAGIO_COLORS[stage as keyof typeof ESTAGIO_COLORS]}>
                                {ESTAGIO_LABELS_NEGOCIACOES[stage]}
                              </Badge>

                              {isCurrentStage ? (
                                <span className="text-sm font-medium text-gray-500">Atual</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={movingLead === selectedLead.id}
                                  onClick={async () => {
                                    await handleMoveLeadToStage(selectedLead.id, stage)
                                    setShowMoveStageOptions(false)
                                  }}
                                >
                                  {movingLead === selectedLead.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Mover"
                                  )}
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

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

                  <ScrollArea className="flex-1 mt-4">
                    <div className="space-y-6 pr-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <div>
                          <EditableVeiculoField
                            leadId={selectedLead.id}
                            currentVeiculo={selectedLead.veiculo_interesse || ""}
                            onVeiculoUpdate={(newVeiculo) => handleVeiculoUpdate(selectedLead.id, newVeiculo)}
                          />
                        </div>

                        <div>
                          <EditableEmailField
                            leadId={selectedLead.id}
                            currentEmail={selectedLead.email || ""}
                            onEmailUpdate={(newEmail) => handleEmailUpdate(selectedLead.id, newEmail)}
                          />
                        </div>
                      </div>

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

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-500" />
                            Resumo Comercial
                          </h4>
                          <div className="flex gap-2">
                            {normalizeStage(selectedLead.estagio_lead) === "transferidos" && (
                              <Button
                                onClick={() => handleAtenderLeadAction(selectedLead.id)}
                                disabled={movingLead === selectedLead.id}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                              >
                                {movingLead === selectedLead.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Atendendo...
                                  </>
                                ) : (
                                  "Atender"
                                )}
                              </Button>
                            )}

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

                      <div className="h-4"></div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}
