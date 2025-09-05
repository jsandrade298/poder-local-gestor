-- Adicionar coluna para posição no kanban (separada do status)
ALTER TABLE demandas 
ADD COLUMN kanban_position TEXT DEFAULT 'a_fazer' CHECK (kanban_position IN ('a_fazer', 'em_progresso', 'feito'));

-- Migrar dados existentes baseado no status atual
UPDATE demandas 
SET kanban_position = CASE 
  WHEN status = 'aberta' THEN 'a_fazer'
  WHEN status = 'em_andamento' THEN 'em_progresso' 
  WHEN status = 'resolvida' THEN 'feito'
  ELSE 'a_fazer'
END;

-- Criar índice para performance
CREATE INDEX idx_demandas_kanban_position ON demandas(kanban_position);