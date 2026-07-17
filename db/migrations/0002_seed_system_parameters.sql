-- Seed opcional de parâmetros fiscais de nível SISTEMA (legislação vigente ao criar esta migration).
-- Rodar deliberadamente pelo operador — RF-CORE-005 exige que o cálculo fique SUSPENSO enquanto
-- estes parâmetros não existirem, então nada aqui é aplicado silenciosamente em runtime: é o
-- administrador quem decide popular a tabela, e pode ajustar os valores livremente depois (nunca hardcoded no engine).

insert into system_parameters (escopo, workspace_id, chave, valor) values
  ('SISTEMA', null, 'limite_mensal_adicional_irpj', 20000),
  ('SISTEMA', null, 'aliquota_irpj_base', 0.15),
  ('SISTEMA', null, 'aliquota_irpj_adicional', 0.10),
  ('SISTEMA', null, 'aliquota_csll', 0.09)
on conflict (escopo, workspace_id, chave) do nothing;

-- taxa_desconto_padrao_global fica de fora do seed de SISTEMA de propósito: é um parâmetro
-- financeiro que deve ser definido por Workspace (conta/cliente), não um default global de legislação.
