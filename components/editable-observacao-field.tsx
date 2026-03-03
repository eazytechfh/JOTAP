"use client"

import type React from "react"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateLeadObservacao } from "@/lib/leads"
import { Check, X, Edit3, MessageSquare } from "lucide-react"

interface EditableObservacaoFieldProps {
  leadId: number
  currentObservacao: string
  onObservacaoUpdate: (newObservacao: string) => void
  className?: string
}

export function EditableObservacaoField({
  leadId,
  currentObservacao,
  onObservacaoUpdate,
  className = "",
}: EditableObservacaoFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentObservacao || "")
  const [loading, setLoading] = useState(false)

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditValue(currentObservacao || "")
  }

  const handleSave = async () => {
    setLoading(true)

    try {
      const success = await updateLeadObservacao(leadId, editValue)

      if (success) {
        onObservacaoUpdate(editValue)
        setIsEditing(false)
      } else {
        // Reverter para o valor original em caso de erro
        setEditValue(currentObservacao || "")
      }
    } catch (error) {
      console.error("Error updating observacao:", error)
      setEditValue(currentObservacao || "")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(currentObservacao || "")
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    }
    // Ctrl+Enter para salvar
    if (e.key === "Enter" && e.ctrlKey) {
      handleSave()
    }
  }

  if (isEditing) {
    return (
      <div className={`space-y-3 ${className}`}>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="min-h-[120px] border-orange-300 focus:border-orange-500 resize-none"
          placeholder="Digite suas observações sobre este lead..."
          autoFocus
          disabled={loading}
        />
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="border-gray-300 hover:bg-gray-50 bg-transparent"
          >
            <X className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
        </div>
        <p className="text-xs text-gray-500">💡 Dica: Use Ctrl+Enter para salvar rapidamente</p>
      </div>
    )
  }

  return (
    <div
      className={`group cursor-pointer hover:bg-orange-50 rounded-lg p-3 border border-orange-200 transition-colors ${className}`}
      onClick={handleStartEdit}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Observação do Vendedor</span>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed min-h-[60px]">
            {currentObservacao || (
              <span className="text-gray-400 italic">Clique para adicionar observações sobre este lead...</span>
            )}
          </div>
        </div>
        <Edit3 className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
      </div>
    </div>
  )
}
