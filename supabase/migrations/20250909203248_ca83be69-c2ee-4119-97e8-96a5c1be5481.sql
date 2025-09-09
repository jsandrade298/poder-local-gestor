-- Adicionar campo de ordem na tabela eixos
ALTER TABLE public.eixos ADD COLUMN ordem INTEGER;

-- Definir ordem inicial baseada na ordem alfabética atual usando uma query separada
DO $$
DECLARE
    eixo_record RECORD;
    contador INTEGER := 1;
BEGIN
    FOR eixo_record IN 
        SELECT id FROM public.eixos ORDER BY nome
    LOOP
        UPDATE public.eixos 
        SET ordem = contador 
        WHERE id = eixo_record.id;
        
        contador := contador + 1;
    END LOOP;
END $$;