"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { SidebarNav } from "@/components/sidebar-nav"
import { DashboardStats } from "@/components/dashboard-stats"
import { DashboardCharts } from "@/components/dashboard-charts"

export default function Dashboard() {
  const router = useRouter()

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/")
    }
  }, [router])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header com Gradiente */}
        <header className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Dashboard Inteligente
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Análise completa dos seus leads e performance em tempo real
                </p>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-lg">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">EC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {/* Cards de Estatísticas Básicas com Espaçamento */}
            <div className="mb-12">
              <DashboardStats />
            </div>

            {/* Gráficos Interativos */}
            <DashboardCharts />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200/50 py-4">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <p>© 2024 Eazy Click - Plataforma de Leads</p>
              <p>Última atualização: {new Date().toLocaleString("pt-BR")}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
