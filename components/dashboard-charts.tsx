"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts"
import { getDashboardData, type DashboardFilters } from "@/lib/dashboard-stats"
import { getCurrentUser } from "@/lib/auth"
import { TrendingUp, Users, Car, Target, Filter, RotateCcw, BarChart3, Activity } from "lucide-react"

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#84cc16",
  "#ec4899",
]

const ESTAGIO_COLORS = {
  oportunidade: "#3b82f6",
  em_qualificacao: "#f59e0b",
  qualificado: "#10b981",
  follow_up: "#8b5cf6",
  nutricao: "#f97316",
  fechado: "#059669",
  nao_fechou: "#dc2626",
}

const GRADIENT_COLORS = {
  primary: "from-purple-600 via-blue-600 to-cyan-500",
  secondary: "from-pink-500 via-red-500 to-yellow-500",
  success: "from-green-400 to-blue-500",
  warning: "from-yellow-400 to-orange-500",
  danger: "from-red-400 to-pink-500",
}

export function DashboardCharts() {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DashboardFilters>({
    periodo: "30d",
  })

  useEffect(() => {
    loadDashboardData()
  }, [filters])

  const loadDashboardData = async () => {
    setLoading(true)
    const user = getCurrentUser()
    if (user) {
      const data = await getDashboardData(user.id_empresa, filters)
      setDashboardData(data)
    }
    setLoading(false)
  }

  const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }))
  }

  const resetFilters = () => {
    setFilters({ periodo: "30d" })
  }

  if (loading || !dashboardData) {
    return (
      <div className="space-y-8">
        {/* Loading Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-lg">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-48"></div>
              </CardHeader>
              <CardContent>
                <div className="h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Filtros com Design Moderno */}
      <Card className="border-0 shadow-xl bg-gradient-to-r from-white via-blue-50 to-purple-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
              <Filter className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Filtros Inteligentes
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                Período
              </label>
              <Select value={filters.periodo || "30d"} onValueChange={(value) => handleFilterChange("periodo", value)}>
                <SelectTrigger className="border-2 border-purple-100 focus:border-purple-400 bg-white/80 backdrop-blur-sm">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">📅 Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">📊 Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">📈 Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Vendedor
              </label>
              <Select
                value={filters.vendedor || "all"}
                onValueChange={(value) => handleFilterChange("vendedor", value)}
              >
                <SelectTrigger className="border-2 border-blue-100 focus:border-blue-400 bg-white/80 backdrop-blur-sm">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">👥 Todos os vendedores</SelectItem>
                  {dashboardData.availableVendedores.map((vendedor: string) => (
                    <SelectItem key={vendedor} value={vendedor}>
                      👤 {vendedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                Origem
              </label>
              <Select value={filters.origem || "all"} onValueChange={(value) => handleFilterChange("origem", value)}>
                <SelectTrigger className="border-2 border-green-100 focus:border-green-400 bg-white/80 backdrop-blur-sm">
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Todas as origens</SelectItem>
                  {dashboardData.availableOrigens.map((origem: string) => (
                    <SelectItem key={origem} value={origem}>
                      📍 {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={resetFilters}
                className="w-full border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 bg-white/80 backdrop-blur-sm transition-all duration-300"
              >
                <RotateCcw className="h-4 w-4 mr-2 text-orange-500" />
                <span className="font-semibold">Limpar</span>
              </Button>
            </div>
          </div>

          {/* Filtros Ativos com Design Melhorado */}
          {(filters.vendedor || filters.origem) && (
            <div className="flex flex-wrap gap-3 mt-6 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Filtros ativos:</span>
              {filters.vendedor && (
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 flex items-center gap-2 hover:shadow-lg transition-shadow">
                  👤 {filters.vendedor}
                  <button
                    onClick={() => handleFilterChange("vendedor", "all")}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.origem && (
                <Badge className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-1 flex items-center gap-2 hover:shadow-lg transition-shadow">
                  📍 {filters.origem}
                  <button
                    onClick={() => handleFilterChange("origem", "all")}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid Principal de Gráficos */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Resumo dos Estágios - Design Moderno */}
        <Card className="lg:col-span-4 border-0 shadow-xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  Resumo por Estágio
                </span>
                <p className="text-xs text-gray-500 font-normal mt-1">Distribuição dos leads</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dashboardData.estagioResumo} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <defs>
                  <linearGradient id="estagioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis
                  dataKey="estagio"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                  formatter={(value, name) => [value, "Quantidade de Leads"]}
                  labelFormatter={(label) => {
                    const labels = {
                      oportunidade: "🎯 Oportunidade",
                      em_qualificacao: "⏳ Em Qualificação",
                      qualificado: "✅ Qualificado",
                      follow_up: "📞 Follow Up",
                      nutricao: "🌱 Nutrição",
                      fechado: "🎉 Fechado",
                      nao_fechou: "❌ Não Fechou",
                    }
                    return labels[label] || label
                  }}
                />
                <Bar
                  dataKey="quantidade"
                  fill="url(#estagioGradient)"
                  radius={[8, 8, 0, 0]}
                  stroke="#6366f1"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Lista compacta dos estágios */}
            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
              {dashboardData.estagioResumo
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 5)
                .map((item, index) => (
                  <div
                    key={item.estagio}
                    className="flex items-center justify-between p-2 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full bg-gradient-to-r ${
                          index === 0
                            ? "from-yellow-400 to-orange-500"
                            : index === 1
                              ? "from-green-400 to-blue-500"
                              : index === 2
                                ? "from-purple-400 to-pink-500"
                                : "from-gray-400 to-gray-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">
                        {item.estagio === "oportunidade"
                          ? "Oportunidade"
                          : item.estagio === "em_qualificacao"
                            ? "Em Qualificação"
                            : item.estagio === "qualificado"
                              ? "Qualificado"
                              : item.estagio === "follow_up"
                                ? "Follow Up"
                                : item.estagio === "nutricao"
                                  ? "Nutrição"
                                  : item.estagio === "fechado"
                                    ? "Fechado"
                                    : item.estagio === "nao_fechou"
                                      ? "Não Fechou"
                                      : item.estagio}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{item.quantidade}</div>
                      <div className="text-xs text-gray-500">{item.percentual}%</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance por Vendedor - Design Expandido */}
        <Card className="lg:col-span-8 border-0 shadow-xl bg-gradient-to-br from-blue-50 via-white to-cyan-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-bold">
                  Performance por Vendedor
                </span>
                <p className="text-xs text-gray-500 font-normal mt-1">Análise de resultados da equipe</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dashboardData.vendedorStats} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="fechadosGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="conversaoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                <XAxis
                  dataKey="vendedor"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                  formatter={(value, name) => [
                    name === "taxa_conversao" ? `${Number(value).toFixed(1)}%` : value,
                    name === "total_leads"
                      ? "📊 Total de Leads"
                      : name === "leads_fechados"
                        ? "🎉 Leads Fechados"
                        : "📈 Taxa de Conversão",
                  ]}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
                <Bar dataKey="total_leads" fill="url(#totalGradient)" name="Total de Leads" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="leads_fechados"
                  fill="url(#fechadosGradient)"
                  name="Leads Fechados"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="taxa_conversao"
                  fill="url(#conversaoGradient)"
                  name="Taxa de Conversão (%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Top 3 Vendedores */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {dashboardData.vendedorStats.slice(0, 3).map((vendedor, index) => (
                <div
                  key={vendedor.vendedor}
                  className={`p-4 rounded-xl border-2 ${
                    index === 0
                      ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200"
                      : index === 1
                        ? "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200"
                        : "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                          : index === 1
                            ? "bg-gradient-to-r from-gray-400 to-slate-500"
                            : "bg-gradient-to-r from-orange-400 to-red-500"
                      }`}
                    >
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{vendedor.vendedor}</p>
                      <p className="text-xs text-gray-600">
                        {vendedor.total_leads} leads • {vendedor.taxa_conversao.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Veículos - Design Circular Moderno */}
        <Card className="lg:col-span-5 border-0 shadow-xl bg-gradient-to-br from-green-50 via-white to-emerald-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg">
                <Car className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-bold">
                  Top Veículos
                </span>
                <p className="text-xs text-gray-500 font-normal mt-1">Modelos mais procurados</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={dashboardData.veiculoStats.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ veiculo, total_interesse, percent }) =>
                    percent > 5 ? `${veiculo.split(" ").slice(0, 2).join(" ")} (${total_interesse})` : ""
                  }
                  outerRadius={100}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="total_interesse"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {dashboardData.veiculoStats.slice(0, 8).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={`url(#pieGradient${index % COLORS.length})`} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                  formatter={(value, name) => [value, "🚗 Interesse"]}
                  labelFormatter={(label) => `Veículo: ${label}`}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Top 5 Veículos Lista */}
            <div className="mt-4 space-y-2">
              {dashboardData.veiculoStats.slice(0, 5).map((veiculo: any, index: number) => (
                <div
                  key={veiculo.veiculo}
                  className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100 hover:bg-white/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                      style={{ background: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-700 truncate">{veiculo.veiculo}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-800">{veiculo.total_interesse}</div>
                    <div className="text-xs text-gray-500">{veiculo.taxa_conversao.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance por Origem */}
        <Card className="lg:col-span-7 border-0 shadow-xl bg-gradient-to-br from-orange-50 via-white to-red-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent font-bold">
                  Performance por Origem
                </span>
                <p className="text-xs text-gray-500 font-normal mt-1">Análise de canais de aquisição</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dashboardData.origemStats} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                <defs>
                  <linearGradient id="origemTotalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="origemFechadosGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="origemConversaoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#b91c1c" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                <XAxis dataKey="origem" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                  formatter={(value, name) => [
                    name === "taxa_conversao" ? `${Number(value).toFixed(1)}%` : value,
                    name === "total_leads"
                      ? "📊 Total de Leads"
                      : name === "leads_fechados"
                        ? "🎉 Leads Fechados"
                        : "📈 Taxa de Conversão",
                  ]}
                />
                <Legend iconType="circle" />
                <Bar
                  dataKey="total_leads"
                  fill="url(#origemTotalGradient)"
                  name="Total de Leads"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="leads_fechados"
                  fill="url(#origemFechadosGradient)"
                  name="Leads Fechados"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="taxa_conversao"
                  fill="url(#origemConversaoGradient)"
                  name="Taxa de Conversão (%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Resumo das Origens */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {dashboardData.origemStats.slice(0, 4).map((origem, index) => (
                <div key={origem.origem} className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">📍 {origem.origem}</span>
                    <Badge className="bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs">
                      {origem.taxa_conversao.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {origem.total_leads} leads • {origem.leads_fechados} fechados
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolução dos Estágios - Gráfico de Área */}
        <Card className="lg:col-span-12 border-0 shadow-xl bg-gradient-to-br from-purple-50 via-white to-pink-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
                  Evolução dos Leads por Estágio
                </span>
                <p className="text-sm text-gray-500 font-normal mt-1">Tendências temporais dos últimos 30 dias</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={dashboardData.estagioEvolution} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs>
                  {Object.entries(ESTAGIO_COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`area${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                />
                <Legend iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="oportunidade"
                  stackId="1"
                  stroke={ESTAGIO_COLORS.oportunidade}
                  fill={`url(#areaoportunidade)`}
                  name="🎯 Oportunidade"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="em_qualificacao"
                  stackId="1"
                  stroke={ESTAGIO_COLORS.em_qualificacao}
                  fill={`url(#areaem_qualificacao)`}
                  name="⏳ Em Qualificação"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="qualificado"
                  stackId="1"
                  stroke={ESTAGIO_COLORS.qualificado}
                  fill={`url(#areaqualificado)`}
                  name="✅ Qualificado"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="fechado"
                  stackId="1"
                  stroke={ESTAGIO_COLORS.fechado}
                  fill={`url(#areafechado)`}
                  name="🎉 Fechado"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
