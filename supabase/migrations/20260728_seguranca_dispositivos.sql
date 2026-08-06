create table if not exists public.sessoes_dispositivos (
  id uuid primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  navegador text not null default 'Navegador desconhecido',
  sistema text not null default 'Sistema desconhecido',
  tipo_dispositivo text not null default 'dispositivo',
  atualizada_em timestamptz not null default now(),
  criada_em timestamptz not null default now(),
  ultimo_acesso_em timestamptz not null default now(),
  revogada_em timestamptz null
);

comment on table public.sessoes_dispositivos is
  'Dispositivos e sessoes reconhecidos pelo backend do Vivo AdaptAI, sem armazenar IP ou user-agent bruto';

create index if not exists idx_sessoes_dispositivos_usuario
  on public.sessoes_dispositivos (auth_user_id, revogada_em, ultimo_acesso_em desc);

alter table public.sessoes_dispositivos enable row level security;
revoke all on table public.sessoes_dispositivos from anon, authenticated;
grant select, insert, update, delete on table public.sessoes_dispositivos to service_role;
