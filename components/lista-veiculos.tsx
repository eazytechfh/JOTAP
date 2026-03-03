"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { listarVeiculos, excluirVeiculo, marcarComoVendido, type Veiculo } from "@/lib/estoque"
import { Trash2, CheckCircle, Car, Fuel, Calendar, Palette, Gauge, Loader2 } from "lucide-react"
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

export function ListaVeiculos() {
  const { toast } = useToast()
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const carregarVeiculos = async () => {
    setLoading(true)
    try {
      const result = await listarVeiculos()
      if (result.error) {
        toast({
          title: "Erro",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setVeiculos(result.veiculos)
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar veículos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarVeiculos()
  }, [])

  const handleExcluir = async (id: number) => {
    setActionLoading(id)
    try {
      const result = await excluirVeiculo(id)
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Veículo excluído com sucesso!",
        })
        await carregarVeiculos()
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao excluir veículo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarcarVendido = async (id: number) => {
    setActionLoading(id)
    try {
      const result = await marcarComoVendido(id)
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Veículo marcado como vendido!",
        })
        await carregarVeiculos()
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao marcar veículo como vendido",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (veiculos.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Car className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum veículo no estoque</h3>
          <p className="text-gray-500">Adicione veículos ao estoque para começar a gerenciar.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {veiculos.map((veiculo) => (
        <Card key={veiculo.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">
                  {veiculo.marca} {veiculo.modelo}
                </CardTitle>
                <CardDescription>Ano {veiculo.ano}</CardDescription>
              </div>
              <Badge variant={veiculo.status === "Vendido" ? "secondary" : "default"}>{veiculo.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-gray-500" />
                <span>{veiculo.cor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-gray-500" />
                <span>{veiculo.combustivel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-500" />
                <span>{veiculo.quilometragem.toLocaleString()} km</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{new Date(veiculo.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            {veiculo.status !== "Vendido" && (
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarcarVendido(veiculo.id)}
                  disabled={actionLoading === veiculo.id}
                  className="flex-1"
                >
                  {actionLoading === veiculo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar como Vendido
                    </>
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === veiculo.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Veículo</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir este veículo do estoque? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleExcluir(veiculo.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
