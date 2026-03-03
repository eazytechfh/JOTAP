import { createClient } from "@/utils/supabase/client"

export interface User {
  id: number
  id_empresa: number
  nome_empresa: string
  nome_usuario: string
  email: string
  telefone?: string
  plano: string
  status: "ativo" | "pendente" | "inativo"
  cargo: "administrador" | "convidado" | "vendedor" | "gerente"
  created_at: string
  updated_at: string
}

export const STATUS_LABELS = {
  ativo: "Ativo",
  pendente: "Pendente",
  inativo: "Inativo",
}

export const STATUS_COLORS = {
  ativo: "bg-green-100 text-green-800",
  pendente: "bg-yellow-100 text-yellow-800",
  inativo: "bg-red-100 text-red-800",
}

export const CARGO_LABELS = {
  administrador: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  convidado: "Convidado",
}

export const CARGO_COLORS = {
  administrador: "bg-purple-100 text-purple-800",
  gerente: "bg-orange-100 text-orange-800",
  vendedor: "bg-green-100 text-green-800",
  convidado: "bg-blue-100 text-blue-800",
}

export async function signIn(email: string, senha: string): Promise<User | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .eq("status", "ativo") // Apenas usuários ativos podem fazer login
    .single()

  if (error || !data) {
    console.error("Login error:", error)
    return null
  }

  // Store user in localStorage for client-side access
  localStorage.setItem("eazy_click_user", JSON.stringify(data))

  return data
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  const userData = localStorage.getItem("eazy_click_user")
  return userData ? JSON.parse(userData) : null
}

export function signOut() {
  localStorage.removeItem("eazy_click_user")
}

export function isAdmin(user: User | null): boolean {
  return user?.cargo === "administrador"
}

export function canManageMembers(user: User | null): boolean {
  return isAdmin(user)
}

export async function updateUser(userId: number, userData: Partial<User>): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from("usuarios")
    .update({
      nome_usuario: userData.nome_usuario,
      email: userData.email,
      telefone: userData.telefone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("Error updating user:", error)
    return false
  }

  // Update localStorage
  const currentUser = getCurrentUser()
  if (currentUser) {
    const updatedUser = { ...currentUser, ...userData }
    localStorage.setItem("eazy_click_user", JSON.stringify(updatedUser))
  }

  return true
}

export async function getCompanyMembers(idEmpresa: number): Promise<User[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .order("cargo", { ascending: false }) // Administradores primeiro
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching company members:", error)
    return []
  }

  return data || []
}

export async function addCompanyMember(memberData: {
  id_empresa: number
  nome_empresa: string
  nome_usuario: string
  email: string
  senha: string
  telefone?: string
  status?: "ativo" | "pendente" | "inativo"
  cargo?: "administrador" | "convidado" | "vendedor" | "gerente"
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Verificar se o email já existe
  const { data: existingUser } = await supabase.from("usuarios").select("email").eq("email", memberData.email).single()

  if (existingUser) {
    return { success: false, error: "Este e-mail já está cadastrado no sistema." }
  }

  const cargoFinal = memberData.cargo || "convidado"

  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      id_empresa: memberData.id_empresa,
      nome_empresa: memberData.nome_empresa,
      nome_usuario: memberData.nome_usuario,
      email: memberData.email,
      senha: memberData.senha,
      telefone: memberData.telefone || null,
      plano: "gratuito",
      status: memberData.status || "ativo",
      cargo: cargoFinal,
    })
    .select()

  if (error) {
    console.error("Error adding company member:", error)
    return { success: false, error: "Erro ao adicionar membro. Tente novamente." }
  }

  // Se o cargo for vendedor, tambem adicionar na tabela VENDEDORES
  if (cargoFinal === "vendedor") {
    const { error: vendedorError } = await supabase
      .from("VENDEDORES")
      .insert({
        id_empresa: memberData.id_empresa,
        vendedor: memberData.nome_usuario,
        telefone: memberData.telefone || null,
        atender: "espera",
        quantos_lead: 0,
      })

    if (vendedorError) {
      console.error("Error adding to VENDEDORES table:", vendedorError)
      // Nao retorna erro pois o membro ja foi adicionado na tabela usuarios
    }
  }

  return { success: true }
}

export async function updateMemberStatus(
  memberId: number,
  status: "ativo" | "pendente" | "inativo",
  currentUser: User,
): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para alterar status de membros." }
  }

  const supabase = createClient()

  // Buscar dados do membro antes de atualizar
  const { data: memberData } = await supabase
    .from("usuarios")
    .select("nome_usuario, cargo, id_empresa")
    .eq("id", memberId)
    .single()

  const { error } = await supabase
    .from("usuarios")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("id_empresa", currentUser.id_empresa) // Garantir que só pode alterar da própria empresa

  if (error) {
    console.error("Error updating member status:", error)
    return { success: false, error: "Erro ao atualizar status do membro." }
  }

  // Se o membro for vendedor, atualizar a coluna "atender" na tabela VENDEDORES
  if (memberData && memberData.cargo === "vendedor") {
    const atenderValue = status === "inativo" ? "Inativo" : status === "ativo" ? "espera" : "espera"

    const { error: vendedorError } = await supabase
      .from("VENDEDORES")
      .update({ atender: atenderValue })
      .eq("vendedor", memberData.nome_usuario)
      .eq("id_empresa", memberData.id_empresa)

    if (vendedorError) {
      console.error("Error updating VENDEDORES atender:", vendedorError)
    }
  }

  return { success: true }
}

export async function updateMemberCargo(
  memberId: number,
  cargo: "administrador" | "convidado" | "vendedor" | "gerente",
  currentUser: User,
): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para alterar cargos." }
  }

  const supabase = createClient()

  const { error } = await supabase
    .from("usuarios")
    .update({
      cargo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("id_empresa", currentUser.id_empresa) // Garantir que só pode alterar da própria empresa

  if (error) {
    console.error("Error updating member cargo:", error)
    if (error.message.includes("último administrador")) {
      return { success: false, error: "Não é possível remover o último administrador da empresa." }
    }
    return { success: false, error: "Erro ao atualizar cargo do membro." }
  }

  return { success: true }
}

export async function deleteMember(memberId: number, currentUser: User): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para excluir membros." }
  }

  if (memberId === currentUser.id) {
    return { success: false, error: "Você não pode excluir sua própria conta." }
  }

  const supabase = createClient()

  const { error } = await supabase.from("usuarios").delete().eq("id", memberId).eq("id_empresa", currentUser.id_empresa) // Garantir que só pode excluir da própria empresa

  if (error) {
    console.error("Error deleting member:", error)
    if (error.message.includes("último administrador")) {
      return { success: false, error: "Não é possível excluir o último administrador da empresa." }
    }
    return { success: false, error: "Erro ao excluir membro." }
  }

  return { success: true }
}
