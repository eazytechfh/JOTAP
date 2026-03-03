"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { addCompanyMember, STATUS_LABELS, CARGO_LABELS, type User } from "@/lib/auth"
import { Loader2, UserPlus, Shield, UserIcon } from "lucide-react"

interface AddMemberFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: User
}

export function AddMemberForm({ isOpen, onClose, onSuccess, currentUser }: AddMemberFormProps) {
  const [formData, setFormData] = useState({
    nome_usuario: "",
    email: "",
    senha: "",
    telefone: "",
    status: "ativo" as "ativo" | "pendente" | "inativo",
    cargo: "convidado" as "administrador" | "convidado" | "vendedor" | "gerente",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await addCompanyMember({
        id_empresa: currentUser.id_empresa,
        nome_empresa: currentUser.nome_empresa,
        ...formData,
      })

      if (result.success) {
        setFormData({
          nome_usuario: "",
          email: "",
          senha: "",
          telefone: "",
          status: "ativo",
          cargo: "convidado",
        })
        onSuccess()
        onClose()
      } else {
        setError(result.error || "Erro ao adicionar membro.")
      }
    } catch (err) {
      setError("Erro ao adicionar membro. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      nome_usuario: "",
      email: "",
      senha: "",
      telefone: "",
      status: "ativo",
      cargo: "convidado",
    })
    setError("")
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Membro
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome_usuario">Nome do Usuário *</Label>
            <Input
              id="nome_usuario"
              value={formData.nome_usuario}
              onChange={(e) => handleChange("nome_usuario", e.target.value)}
              required
              placeholder="Nome completo"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => handleChange("telefone", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <Label htmlFor="senha">Senha *</Label>
            <Input
              id="senha"
              type="password"
              value={formData.senha}
              onChange={(e) => handleChange("senha", e.target.value)}
              required
              placeholder="Senha de acesso"
              minLength={6}
            />
          </div>

          <div>
            <Label htmlFor="cargo">Cargo *</Label>
            <Select value={formData.cargo} onValueChange={(value) => handleChange("cargo", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CARGO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {key === "administrador" ? (
                        <Shield className="h-4 w-4 text-purple-600" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-blue-600" />
                      )}
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status *</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
