import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabaseServer"

type Body = {
  nome_usuario?: string
  email?: string
  senha?: string
}

// 👇 IMPORTANTE: tipagem correta do params
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const body: Body = await request.json()

    const payload: Record<string, string> = {}

    if (body.nome_usuario && body.nome_usuario.trim().length >= 2) {
      payload.nome_usuario = body.nome_usuario.trim()
    }

    if (body.email && body.email.includes("@")) {
      payload.email = body.email.trim()
    }

    // senha opcional
    if (body.senha && body.senha.trim().length >= 4) {
      payload.senha = body.senha.trim()
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualizar" },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    const { data, error } = await supabase
      .from("usuarios")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, user: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Erro interno" },
      { status: 500 }
    )
  }
}