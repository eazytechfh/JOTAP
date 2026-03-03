-- Limpar e recriar usuário admin da JOTAP Veículos
-- Email: jotapveiculos@admin.com.br
-- Senha: jveiculos2023@

-- Primeiro, deletar se já existir
DELETE FROM usuarios WHERE email = 'jotapveiculos@admin.com.br';

-- Inserir novo usuário admin
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
  '+5511999999999',
  'premium',
  'ativo',
  'administrador',
  NOW(),
  NOW()
);

-- Verificar se foi criado
SELECT 
  email, 
  nome_usuario, 
  cargo, 
  status,
  'Usuário criado com sucesso!' as mensagem
FROM usuarios 
WHERE email = 'jotapveiculos@admin.com.br';
