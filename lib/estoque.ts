import { createClient } from "@/utils/supabase/client"

export interface Veiculo {
  id: number
  marca: string
  modelo: string
  ano: number
  cor: string
  combustivel: string
  quilometragem: number
  status: string
  created_at: string
  updated_at: string
}

export interface NovoVeiculo {
  marca: string
  modelo: string
  ano: number
  cor: string
  combustivel: string
  quilometragem: number
}

export async function adicionarVeiculo(veiculo: NovoVeiculo): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase.from("estoque").insert([veiculo])

    if (error) {
      console.error("Erro ao adicionar veículo:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Erro ao adicionar veículo:", error)
    return { success: false, error: "Erro interno do servidor" }
  }
}

export async function listarVeiculos(): Promise<{ veiculos: Veiculo[]; error?: string }> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.from("estoque").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao listar veículos:", error)
      return { veiculos: [], error: error.message }
    }

    return { veiculos: data || [] }
  } catch (error) {
    console.error("Erro ao listar veículos:", error)
    return { veiculos: [], error: "Erro interno do servidor" }
  }
}

export async function excluirVeiculo(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase.from("estoque").delete().eq("id", id)

    if (error) {
      console.error("Erro ao excluir veículo:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Erro ao excluir veículo:", error)
    return { success: false, error: "Erro interno do servidor" }
  }
}

export async function marcarComoVendido(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase.from("estoque").update({ status: "Vendido" }).eq("id", id)

    if (error) {
      console.error("Erro ao marcar veículo como vendido:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Erro ao marcar veículo como vendido:", error)
    return { success: false, error: "Erro interno do servidor" }
  }
}
