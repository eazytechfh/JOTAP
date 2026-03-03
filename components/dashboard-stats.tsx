"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLeadStats, ESTAGIO_LABELS } from "@/lib/leads"
import { getCurrentUser } from "@/lib/auth"
import { Users, TrendingUp, Award, Zap, Activity, DollarSign } from "lucide-react"

// Função para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Função para formatar números com separador de milhares
function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function DashboardStats() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsPorEstagio: {},
    leadsPorOrigem: {},
    conversao: "0",
    valorTotal: 0,
    valorMedio: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      const user = getCurrentUser()
      if (user) {
        const data = await getLeadStats(user.id_empresa)
        setStats(data)
      }
      setLoading(false)
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl"></div>
                <div className="space-y-3 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: "Total de Leads",
      value: formatNumber(stats.totalLeads),
      subtitle: "Leads cadastrados",
      icon: Users,
      gradient: "from-purple-500 to-blue-500",
      bgGradient: "from-purple-50 via-white to-blue-50",
      borderColor: "border-purple-200",
      change: "+12%",
      changeType: "positive",
    },
    {
      title: "Taxa de Conversão",
      value: `${stats.conversao}%`,
      subtitle: "Leads fechados",
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 via-white to-cyan-50",
      borderColor: "border-blue-200",
      change: "+2.3%",
      changeType: "positive",
    },
    {
      title: "Valor Total",
      value: formatCurrency(stats.valorTotal || 0),
      subtitle: "Pipeline de vendas",
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-50 via-white to-emerald-50",
      borderColor: "border-green-200",
      change: "+15%",
      changeType: "positive",
    },
    {
      title: "Fechados",
      value: formatNumber(stats.leadsPorEstagio.fechado || 0),
      subtitle: "Vendas realizadas",
      icon: Award,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-50 via-white to-red-50",
      borderColor: "border-orange-200",
      change: "+5",
      changeType: "positive",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Cards Principais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <Card
            key={card.title}
            className={`border-0 shadow-xl bg-gradient-to-br ${card.bgGradient} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 bg-gradient-to-r ${card.gradient} rounded-xl shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">{card.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={`text-xs ${card.changeType === "positive" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {card.change}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                    <p className="text-sm text-gray-500">{card.subtitle}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards de Resumo Expandidos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Distribuição por Estágio
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsPorEstagio)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([estagio, count], index) => (
                  <div
                    key={estagio}
                    className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index === 0
                            ? "bg-gradient-to-r from-green-400 to-blue-500"
                            : index === 1
                              ? "bg-gradient-to-r from-blue-400 to-purple-500"
                              : index === 2
                                ? "bg-gradient-to-r from-purple-400 to-pink-500"
                                : index === 3
                                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                                  : "bg-gradient-to-r from-gray-400 to-gray-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">
                        {ESTAGIO_LABELS[estagio as keyof typeof ESTAGIO_LABELS]}
                      </span>
                    </div>
                    <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-semibold">
                      {count as number}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-bold">
                Canais de Origem
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsPorOrigem)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([origem, count], index) => (
                  <div
                    key={origem}
                    className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index === 0
                            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                            : index === 1
                              ? "bg-gradient-to-r from-blue-400 to-cyan-500"
                              : index === 2
                                ? "bg-gradient-to-r from-purple-400 to-indigo-500"
                                : index === 3
                                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                                  : "bg-gradient-to-r from-gray-400 to-gray-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{origem}</span>
                    </div>
                    <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-semibold">
                      {count as number}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
