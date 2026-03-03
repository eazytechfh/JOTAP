"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateUser, type User } from "@/lib/auth"
import { Loader2, Save, X } from "lucide-react"

interface EditProfileFormProps {
  user: User
  onCancel: () => void
  onSuccess: () => void
}

export function EditProfileForm({ user, onCancel, onSuccess }: EditProfileFormProps) {
  const [formData, setFormData] = useState({
    nome_usuario: user.nome_usuario,
    email: user.email,
    telefone: user.telefone || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const success = await updateUser(user.id, formData)

      if (success) {
        onSuccess()
      } else {
        setError("Erro ao atualizar perfil. Tente novamente.")
      }
    } catch (err) {
      setError("Erro ao atualizar perfil. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          value={formData.nome_usuario}
          onChange={(e) => handleChange("nome_usuario", e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
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
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </form>
  )
}
