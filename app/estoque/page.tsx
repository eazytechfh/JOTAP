"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { SidebarNav } from "@/components/sidebar-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdicionarVeiculoForm } from "@/components/adicionar-veiculo-form"
import { ListaVeiculos } from "@/components/lista-veiculos"

export default function Estoque() {
  const router = useRouter()

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/")
    }
  }, [router])

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Estoque</h1>
              <p className="text-gray-600">Gerencie o estoque de veículos da sua concessionária</p>
            </div>

            <Tabs defaultValue="adicionar" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="adicionar">Adicionar Veículo ao Estoque</TabsTrigger>
                <TabsTrigger value="gerenciar">Veículo vendido ou removido</TabsTrigger>
              </TabsList>

              <TabsContent value="adicionar" className="mt-6">
                <AdicionarVeiculoForm />
              </TabsContent>

              <TabsContent value="gerenciar" className="mt-6">
                <ListaVeiculos />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
