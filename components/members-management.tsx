"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  type User,
  STATUS_LABELS,
  STATUS_COLORS,
  CARGO_LABELS,
  CARGO_COLORS,
  updateMemberStatus,
  updateMemberCargo,
  deleteMember,
  canManageMembers,
} from "@/lib/auth"
import { Trash2, Shield, Clock, XCircle, UserIcon, Lock, Pencil } from "lucide-react"

interface MembersManagementProps {
  members: User[]
  currentUser: User
  onMembersUpdate: () => void
}

type EditForm = {
  nome_usuario: string
  email: string
  senha: string
}

export function MembersManagement({ members, currentUser, onMembersUpdate }: MembersManagementProps) {
  const [loading, setLoading] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null)
  const [error, setError] = useState("")

  const canManage = canManageMembers(currentUser)

  // --- Edição ---
  const [editMember, setEditMember] = useState<User | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ nome_usuario: "", email: "", senha: "" })

  const openEdit = (member: User) => {
    setError("")
    setEditMember(member)
    setEditForm({
      nome_usuario: member.nome_usuario ?? "",
      email: member.email ?? "",
      senha: "",
    })
  }

  const closeEdit = () => {
    if (editSaving) return
    setEditMember(null)
    setEditForm({ nome_usuario: "", email: "", senha: "" })
  }

  const handleSaveEdit = async () => {
    if (!editMember) return

    if (!canManage) {
      setError("Você não tem permissão para editar membros.")
      return
    }

    const nome = editForm.nome_usuario.trim()
    const email = editForm.email.trim()
    const senha = editForm.senha.trim()

    if (nome.length < 2) {
      setError("Nome precisa ter pelo menos 2 caracteres.")
      return
    }
    if (!email.includes("@")) {
      setError("E-mail inválido.")
      return
    }

    setError("")
    setEditSaving(true)

    try {
      const res = await fetch(`/api/usuarios/${editMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_usuario: nome,
          email,
          ...(senha ? { senha } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || "Erro ao salvar alterações.")
        return
      }

      closeEdit()
      onMembersUpdate()
    } catch (e) {
      setError("Erro ao salvar. Tente novamente.")
    } finally {
      setEditSaving(false)
    }
  }

  const handleStatusChange = async (memberId: number, newStatus: "ativo" | "pendente" | "inativo") => {
    if (!canManage) {
      setError("Você não tem permissão para alterar status de membros.")
      return
    }

    setLoading(memberId)
    setError("")

    try {
      const result = await updateMemberStatus(memberId, newStatus, currentUser)

      if (result.success) {
        onMembersUpdate()
      } else {
        setError(result.error || "Erro ao atualizar status do membro.")
      }
    } catch (err) {
      setError("Erro ao atualizar status. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  const handleCargoChange = async (memberId: number, newCargo: "administrador" | "convidado") => {
    if (!canManage) {
      setError("Você não tem permissão para alterar cargos.")
      return
    }

    setLoading(memberId)
    setError("")

    try {
      const result = await updateMemberCargo(memberId, newCargo, currentUser)

      if (result.success) {
        onMembersUpdate()
      } else {
        setError(result.error || "Erro ao atualizar cargo do membro.")
      }
    } catch (err) {
      setError("Erro ao atualizar cargo. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  const handleDeleteMember = async (member: User) => {
    if (!canManage) {
      setError("Você não tem permissão para excluir membros.")
      return
    }

    setLoading(member.id)
    setError("")

    try {
      const result = await deleteMember(member.id, currentUser)

      if (result.success) {
        onMembersUpdate()
        setDeleteConfirm(null)
      } else {
        setError(result.error || "Erro ao excluir membro.")
      }
    } catch (err) {
      setError("Erro ao excluir membro. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ativo":
        return <Shield className="h-3 w-3" />
      case "pendente":
        return <Clock className="h-3 w-3" />
      case "inativo":
        return <XCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const getCargoIcon = (cargo: string) => {
    return cargo === "administrador" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {!canManage && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Lock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            Apenas administradores podem gerenciar membros da equipe.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium truncate">{member.nome_usuario}</p>
                {member.id === currentUser.id && (
                  <Badge variant="outline" className="text-xs">
                    Você
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{member.email}</p>
              {member.telefone && <p className="text-xs text-gray-500">{member.telefone}</p>}
              <p className="text-xs text-gray-400">
                Criado em: {new Date(member.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div className="flex flex-col gap-2 ml-2">
              {/* Cargo */}
              <Select
                value={member.cargo}
                onValueChange={(value) => handleCargoChange(member.id, value as "administrador" | "convidado")}
                disabled={loading === member.id || !canManage || member.id === currentUser.id}
              >
                <SelectTrigger className="w-auto min-w-[120px]">
                  <div className="flex items-center gap-1">
                    {getCargoIcon(member.cargo)}
                    <Badge className={`text-xs ${CARGO_COLORS[member.cargo as keyof typeof CARGO_COLORS]}`}>
                      {CARGO_LABELS[member.cargo as keyof typeof CARGO_LABELS]}
                    </Badge>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CARGO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {getCargoIcon(key)}
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Select
                  value={member.status}
                  onValueChange={(value) => handleStatusChange(member.id, value as "ativo" | "pendente" | "inativo")}
                  disabled={loading === member.id || !canManage}
                >
                  <SelectTrigger className="w-auto min-w-[100px]">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(member.status)}
                      <Badge className={`text-xs ${STATUS_COLORS[member.status as keyof typeof STATUS_COLORS]}`}>
                        {STATUS_LABELS[member.status as keyof typeof STATUS_LABELS]}
                      </Badge>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(key)}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {member.id !== currentUser.id && canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(member)}
                    disabled={loading === member.id}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* ✅ Botão Editar (abaixo do "Ativo") */}
              <Button
                variant="outline"
                size="sm"
                className="min-w-[120px] justify-center"
                onClick={() => openEdit(member)}
                disabled={loading === member.id || !canManage}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <p>Nenhum membro encontrado.</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o membro <strong>{deleteConfirm?.nome_usuario}</strong>? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteMember(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ Edit Dialog */}
      <AlertDialog open={!!editMember} onOpenChange={(open) => (!open ? closeEdit() : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Atualize nome, e-mail e senha. (Senha é opcional: só altera se você preencher.)
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={editForm.nome_usuario}
                onChange={(e) => setEditForm((p) => ({ ...p, nome_usuario: e.target.value }))}
                disabled={editSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                disabled={editSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-senha">Senha (opcional)</Label>
              <Input
                id="edit-senha"
                type="password"
                value={editForm.senha}
                onChange={(e) => setEditForm((p) => ({ ...p, senha: e.target.value }))}
                disabled={editSaving}
                placeholder="Deixe vazio para não alterar"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeEdit} disabled={editSaving}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}