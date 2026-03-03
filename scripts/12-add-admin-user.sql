-- Adicionar usuário administrador
-- Email: jotapveiculos@admin.com.br
-- Senha: jveiculos2023@

INSERT INTO usuarios (
  id_empresa,
  nome_empresa,
  nome_usuario,
  email,
  senha,
  telefone,
  plano,
  status,
  cargo,
  created_at,
  updated_at
) VALUES (
  1,
  'JOTAP Veículos',
  'Administrador',
  'jotapveiculos@admin.com.br',
  'jveiculos2023@',
  NULL,
  'premium',
  'ativo',
  'administrador',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  senha = EXCLUDED.senha,
  status = EXCLUDED.status,
  cargo = EXCLUDED.cargo,
  updated_at = NOW();
