"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, parseCurrency, updateLeadValue } from "@/lib/leads"
import { Check, X, Edit3, DollarSign } from "lucide-react"

interface EditableValueFieldProps {
  leadId: number
  currentValue: number
  onValueUpdate: (newValue: number) => void
  className?: string
}

export function EditableValueField({ leadId, currentValue, onValueUpdate, className = "" }: EditableValueFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(formatCurrency(currentValue))
  const [loading, setLoading] = useState(false)

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditValue(formatCurrency(currentValue))
  }

  const handleSave = async () => {
    setLoading(true)

    try {
      const numericValue = parseCurrency(editValue)
      const success = await updateLeadValue(leadId, numericValue)

      if (success) {
        onValueUpdate(numericValue)
        setIsEditing(false)
      } else {
        // Reverter para o valor original em caso de erro
        setEditValue(formatCurrency(currentValue))
      }
    } catch (error) {
      console.error("Error updating value:", error)
      setEditValue(formatCurrency(currentValue))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(formatCurrency(currentValue))
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const formatInputValue = (value: string) => {
    // Remove caracteres não numéricos exceto vírgula e ponto
    const cleanValue = value.replace(/[^\d,.-]/g, "")

    // Se o valor estiver vazio, retorna vazio
    if (!cleanValue) return ""

    // Converte para número usando a função parseCurrency melhorada
    const numericValue = parseCurrency(cleanValue)

    // Se for um número válido (incluindo zero), formata como moeda
    if (!isNaN(numericValue) && numericValue >= 0) {
      return formatCurrency(numericValue)
    }

    // Se não conseguir converter, retorna o valor original para permitir digitação
    return value
  }

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="relative flex-1">
          <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={(e) => setEditValue(formatInputValue(e.target.value))}
            className="text-xs h-7 pl-6 pr-1 border-green-300 focus:border-green-500"
            placeholder="R$ 0,00"
            autoFocus
            disabled={loading}
            type="text" // Adicionado type="text" para permitir formatação personalizada
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
            className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="h-7 w-7 p-0 border-gray-300 hover:bg-gray-50 bg-transparent"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between group cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors ${className}`}
      onClick={handleStartEdit}
    >
      <div className="flex items-center gap-1">
        <DollarSign className="h-3 w-3 text-green-600" />
        <span className="text-xs font-semibold text-green-700">{formatCurrency(currentValue)}</span>
      </div>
      <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
