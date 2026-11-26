-- ============================================================
-- Data real de conclusão das demandas (Análises, 26/11/2026)
--
-- Antes não havia registro de QUANDO a demanda foi concluída; as Análises
-- usavam a última alteração (updated_at), que muda a cada edição.
--  - concluida_em: preenchida quando o status passa a ser final;
--    apagada se a demanda voltar a um status não final.
--  - conclusao_estimada: true nas que já estavam concluídas antes desta
--    mudança (a data vem da última alteração, como antes).
-- O preenchimento inicial não mexe em updated_at nem dispara avisos
-- (os avisos só saem quando o status muda).
-- ============================================================

alter table public.demandas
  add column if not exists concluida_em timestamptz,
  add column if not exists conclusao_estimada boolean not null default false;

create index if not exists idx_demandas_concluida_em on public.demandas (tenant_id, concluida_em) where concluida_em is not null;

create or replace function public.demandas_registrar_conclusao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  final_novo boolean;
  final_antigo boolean;
begin
  -- Preenchimento inicial (abaixo): só grava a data, sem mudar a "última alteração"
  if current_setting('jorgeus.preencher_conclusao', true) = '1' then
    if tg_op = 'UPDATE' then new.updated_at := old.updated_at; end if;
    return new;
  end if;

  select exists (select 1 from demanda_status s where s.slug = new.status and s.tenant_id = new.tenant_id and s.is_final)
    into final_novo;

  if tg_op = 'INSERT' then
    if final_novo then
      new.concluida_em := coalesce(new.concluida_em, now());
      new.conclusao_estimada := false;
    else
      new.concluida_em := null;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new; -- status igual: mantém a data como está
  end if;

  select exists (select 1 from demanda_status s where s.slug = old.status and s.tenant_id = old.tenant_id and s.is_final)
    into final_antigo;

  if final_novo and not final_antigo then
    new.concluida_em := now();
    new.conclusao_estimada := false;
  elsif not final_novo then
    new.concluida_em := null;
    new.conclusao_estimada := false;
  end if;
  -- final -> outro final: mantém a data da primeira conclusão
  return new;
end;
$$;

-- "zy_" roda depois de update_demandas_updated_at (ordem alfabética dos BEFORE)
drop trigger if exists zy_demandas_conclusao on public.demandas;
create trigger zy_demandas_conclusao
  before insert or update on public.demandas
  for each row execute function public.demandas_registrar_conclusao();

-- Preenchimento inicial: as já concluídas recebem a última alteração, marcada como estimada
select set_config('jorgeus.preencher_conclusao', '1', true);
update public.demandas d
   set concluida_em = d.updated_at, conclusao_estimada = true
  from public.demanda_status s
 where s.slug = d.status and s.tenant_id = d.tenant_id and s.is_final
   and d.concluida_em is null;
select set_config('jorgeus.preencher_conclusao', '', true);
