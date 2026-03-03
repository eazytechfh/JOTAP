"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { adicionarVeiculo, type NovoVeiculo } from "@/lib/estoque"
import { Loader2 } from "lucide-react"

const combustiveis = ["Gasolina", "Etanol", "Flex", "Diesel", "Elétrico", "Híbrido"]

export function AdicionarVeiculoForm() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<NovoVeiculo>({
    marca: "",
    modelo: "",
    ano: new Date().getFullYear(),
    cor: "",
    combustivel: "",
    quilometragem: 0,
  })

  const handleInputChange = (field: keyof NovoVeiculo, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const isFormValid = () => {
    return (
      formData.marca.trim() !== "" &&
      formData.modelo.trim() !== "" &&
      formData.ano > 1900 &&
      formData.cor.trim() !== "" &&
      formData.combustivel !== "" &&
      formData.quilometragem >= 0
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid()) {
      toast({
        title: "Erro",
        description: "Todos os campos devem ser preenchidos corretamente.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const result = await adicionarVeiculo(formData)

      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Veículo adicionado ao estoque com sucesso!",
        })

        // Limpar formulário
        setFormData({
          marca: "",
          modelo: "",
          ano: new Date().getFullYear(),
          cor: "",
          combustivel: "",
          quilometragem: 0,
        })
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao adicionar veículo",
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
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Adicionar Novo Veículo</CardTitle>
        <CardDescription>Preencha todos os campos para adicionar um veículo ao estoque</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={formData.marca}
                onChange={(e) => handleInputChange("marca", e.target.value)}
                placeholder="Ex: Toyota, Honda, Ford..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={formData.modelo}
                onChange={(e) => handleInputChange("modelo", e.target.value)}
                placeholder="Ex: Corolla, Civic, Focus..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ano">Ano</Label>
              <Input
                id="ano"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.ano}
                onChange={(e) => handleInputChange("ano", Number.parseInt(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cor">Cor</Label>
              <Input
                id="cor"
                value={formData.cor}
                onChange={(e) => handleInputChange("cor", e.target.value)}
                placeholder="Ex: Branco, Preto, Prata..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="combustivel">Combustível</Label>
              <Select
                value={formData.combustivel}
                onValueChange={(value) => handleInputChange("combustivel", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o combustível" />
                </SelectTrigger>
                <SelectContent>
                  {combustiveis.map((combustivel) => (
                    <SelectItem key={combustivel} value={combustivel}>
                      {combustivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quilometragem">Quilometragem</Label>
              <Input
                id="quilometragem"
                type="number"
                min="0"
                value={formData.quilometragem}
                onChange={(e) => handleInputChange("quilometragem", Number.parseInt(e.target.value) || 0)}
                placeholder="Ex: 50000"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!isFormValid() || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              "Adicionar Veículo"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
