"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { type Lead, ESTAGIO_LABELS, ESTAGIO_COLORS, updateLeadStage, generateResumoComercial, getLeadById } from "@/lib/leads"
import {
  Search,
  Filter,
  Phone,
  Mail,
  User,
  Calendar,
  MapPin,
  Car,
  Eye,
  DollarSign,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
  MessageCircle,
  Download,
} from "lucide-react"
import { EditableValueField } from "./editable-value-field"
import { EditableObservacaoField } from "./editable-observacao-field"
import { EditableVeiculoField } from "./editable-veiculo-field"
import { EditableEmailField } from "./editable-email-field"
import { ScrollArea } from "@/components/ui/scroll-area"

interface LeadsListViewProps {
  leads: Lead[]
  onLeadsUpdate: () => void
}

const ESTAGIO_LABELS_NEGOCIACOES = {
  oportunidade: "Oportunidade",
  em_qualificacao: "Em Qualificação",
  transferidos: "Transferidos",
  em_negociacao: "Em Negociação",
  fechado: "Fechado",
  nao_fechou: "Não Fechou",
  follow_up: "Follow Up",
  pos_venda: "Pós Venda",
} satisfies Record<string, string>

export function LeadsListView({ leads, onLeadsUpdate }: LeadsListViewProps) {
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>(leads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOrigem, setFilterOrigem] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [filterDataInicio, setFilterDataInicio] = useState("")
  const [filterDataFim, setFilterDataFim] = useState("")
  const [updatingStage, setUpdatingStage] = useState<number | null>(null)
  const [generatingResumo, setGeneratingResumo] = useState(false)
  const [resumoMessage, setResumoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  React.useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, filterOrigem, filterEstagio, filterDataInicio, filterDataFim])

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

    if (filterDataInicio) {
      const inicio = new Date(filterDataInicio)
      inicio.setHours(0, 0, 0, 0)
      filtered = filtered.filter((lead) => new Date(lead.created_at) >= inicio)
    }

    if (filterDataFim) {
      const fim = new Date(filterDataFim)
      fim.setHours(23, 59, 59, 999)
      filtered = filtered.filter((lead) => new Date(lead.created_at) <= fim)
    }

    setFilteredLeads(filtered)
  }

  const handleStageChange = async (leadId: number, newStage: string, currentStage: string) => {
    if (newStage === currentStage) return

    setUpdatingStage(leadId)

    try {
      const success = await updateLeadStage(leadId, newStage)

      if (success) {
        // Atualizar localmente para feedback imediato
        setFilteredLeads((prevLeads) =>
          prevLeads.map((lead) =>
            lead.id === leadId ? { ...lead, estagio_lead: newStage, updated_at: new Date().toISOString() } : lead,
          ),
        )

        // Atualizar o lead selecionado se for o mesmo
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, estagio_lead: newStage })
        }

        // Chamar callback para atualizar dados principais
        onLeadsUpdate()
      } else {
        setResumoMessage({
          type: "error",
          text: "Erro ao atualizar estágio do lead. Tente novamente.",
        })
        setTimeout(() => setResumoMessage(null), 3000)
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro de conexão. Verifique sua internet e tente novamente.",
      })
      setTimeout(() => setResumoMessage(null), 3000)
    } finally {
      setUpdatingStage(null)
    }
  }

  const handleValueUpdate = (leadId: number, newValue: number) => {
    // Atualizar localmente para feedback imediato
    setFilteredLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, valor: newValue } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, valor: newValue })
    }

    // Chamar callback para atualizar dados principais
    onLeadsUpdate()
  }

  const handleObservacaoUpdate = (leadId: number, newObservacao: string) => {
    // Atualizar localmente para feedback imediato
    setFilteredLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, observacao_vendedor: newObservacao } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, observacao_vendedor: newObservacao })
    }

    // Chamar callback para atualizar dados principais
    onLeadsUpdate()
  }

  const handleVeiculoUpdate = (leadId: number, newVeiculo: string) => {
    // Atualizar localmente para feedback imediato
    setFilteredLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, veiculo_interesse: newVeiculo } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, veiculo_interesse: newVeiculo })
    }

    // Chamar callback para atualizar dados principais
    onLeadsUpdate()
  }

  const handleEmailUpdate = (leadId: number, newEmail: string) => {
    // Atualizar localmente para feedback imediato
    setFilteredLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, email: newEmail } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, email: newEmail })
    }

    // Chamar callback para atualizar dados principais
    onLeadsUpdate()
  }

  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead)
    const full = await getLeadById(lead.id)
    if (full) setSelectedLead(full)
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

  const handleExportCSV = () => {
    // Prepare CSV headers
    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "Origem",
      "Vendedor",
      "Veículo Interesse",
      "Valor",
      "Estágio",
      "Data Criação",
      "Cidade",
      "Estado",
      "Observações",
    ]

    // Prepare CSV rows
    const rows = filteredLeads.map((lead) => [
      lead.nome_lead || "",
      lead.telefone || "",
      lead.email || "",
      lead.origem || "",
      lead.vendedor_responsavel || "",
      lead.veiculo_interesse || "",
      lead.valor ? `R$ ${lead.valor.toLocaleString("pt-BR")}` : "",
      ESTAGIO_LABELS[lead.estagio_lead as keyof typeof ESTAGIO_LABELS] || lead.estagio_lead,
      lead.data_criacao ? new Date(lead.data_criacao).toLocaleDateString("pt-BR") : "",
      lead.cidade || "",
      lead.estado || "",
      (lead.observacoes || "").replace(/\n/g, " ").replace(/"/g, '""'),
    ])

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `leads_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const origens = [...new Set(leads.map((lead) => lead.origem).filter(Boolean))]

  return (
    <div className="space-y-6">
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

      {/* Mensagem de Status */}
      {resumoMessage && (
        <Alert
          className={`${resumoMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <AlertDescription className={resumoMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {resumoMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                💡 <strong>Como usar:</strong> Clique no dropdown de estágio para alterar o status do lead
              </p>
              <p className="text-xs text-green-700 mt-1">As alterações são salvas automaticamente no banco de dados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Leads ({filteredLeads.length})</CardTitle>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Origem</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
                  <TableHead className="hidden xl:table-cell">Veículo</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{lead.nome_lead}</div>
                        <div className="text-sm text-gray-500 md:hidden">
                          {lead.telefone && (
                            <span className="flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableValueField
                          leadId={lead.id}
                          currentValue={lead.valor || 0}
                          onValueUpdate={(newValue) => handleValueUpdate(lead.id, newValue)}
                          className="min-w-[120px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{lead.telefone}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.origem && (
                        <Badge variant="outline" className="text-xs">
                          {lead.origem}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{lead.vendedor}</TableCell>
                    <TableCell className="hidden xl:table-cell">{lead.veiculo_interesse}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.estagio_lead}
                        onValueChange={(value) => handleStageChange(lead.id, value, lead.estagio_lead)}
                        disabled={updatingStage === lead.id}
                      >
                        <SelectTrigger className="w-auto min-w-[140px]">
                          <div className="flex items-center gap-2">
                            {updatingStage === lead.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            <Badge className={ESTAGIO_COLORS[lead.estagio_lead as keyof typeof ESTAGIO_COLORS]}>
                              {ESTAGIO_LABELS[lead.estagio_lead as keyof typeof ESTAGIO_LABELS]}
                            </Badge>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTAGIO_LABELS_NEGOCIACOES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <Badge className={`${ESTAGIO_COLORS[key as keyof typeof ESTAGIO_COLORS]} text-xs`}>
                                  {label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleSelectLead(lead)} className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum lead encontrado com os filtros aplicados.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Lead - Com Campos Editáveis */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] overflow-hidden">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <User className="h-6 w-6" />
              Detalhes do Lead
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
                        onObservacaoUpdate={(newObservacao) => handleObservacaoUpdate(selectedLead.id, newObservacao)}
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
    </div>
  )
}
