"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser, signOut, CARGO_LABELS, CARGO_COLORS } from "@/lib/auth"
import { LayoutDashboard, Users, Settings, LogOut, Zap, Menu, X, Shield, Car } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Negociações", href: "/negociacoes", icon: Users },
  { name: "Estoque", href: "/estoque", icon: Car }, // Adicionada nova aba Estoque
  { name: "Configurações", href: "/configuracoes", icon: Settings },
]

export function SidebarNav() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const user = getCurrentUser()

  const handleSignOut = () => {
    signOut()
    router.push("/")
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white shadow-md"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-blue-500">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-white" />
              <span className="text-xl font-bold text-white">Eazy Click</span>
            </div>
          </div>

          {/* User info */}
          {user && (
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-900">{user.nome_usuario}</div>
              <div className="text-xs text-gray-500">{user.nome_empresa}</div>
              <div className="mt-2">
                <Badge className={`text-xs ${CARGO_COLORS[user.cargo]}`}>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {CARGO_LABELS[user.cargo]}
                  </div>
                </Badge>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border-r-2 border-purple-500"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </>
  )
}
