alter table public.notificacoes
  add column if not exists auth_user_id uuid null;

update public.notificacoes n
set auth_user_id = c.auth_user_id
from public.clientes c
where c.id = n.cliente_id
  and n.auth_user_id is null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.preencher_auth_user_notificacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.auth_user_id is null then
    select c.auth_user_id into new.auth_user_id
    from public.clientes c
    where c.id = new.cliente_id;
  end if;
  return new;
end;
$$;

revoke all on function private.preencher_auth_user_notificacao() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.preencher_auth_user_notificacao() to service_role;

drop trigger if exists trg_notificacoes_auth_user on public.notificacoes;
create trigger trg_notificacoes_auth_user
before insert or update of cliente_id on public.notificacoes
for each row execute function private.preencher_auth_user_notificacao();

grant select on table public.notificacoes to authenticated;
drop policy if exists notificacoes_select_proprias on public.notificacoes;
create policy notificacoes_select_proprias
on public.notificacoes
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end
$$;
