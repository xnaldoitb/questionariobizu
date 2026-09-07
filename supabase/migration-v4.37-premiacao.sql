-- ============================================================
-- QUESTIONÁRIO BIZU v4.37
-- Premiação de usuários com plano e aviso individual
-- ============================================================

begin;

create table if not exists public.premios_usuario (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references public.usuarios(id) on delete cascade,
    plano text not null,
    plano_nome text not null,
    mensagem text not null,
    criado_por_admin_id uuid references public.usuarios(id) on delete set null,
    criado_em timestamptz not null default now(),
    visualizado_em timestamptz
);

create index if not exists premios_usuario_pendentes_idx
    on public.premios_usuario(usuario_id, criado_em)
    where visualizado_em is null;

alter table public.premios_usuario enable row level security;
revoke all on public.premios_usuario from public, anon, authenticated;
grant select, insert, update on public.premios_usuario to service_role;

create or replace function public.premiar_usuario_plano(
    p_usuario_id uuid,
    p_plano_id text,
    p_admin_id uuid,
    p_mensagem text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_plano public.planos_acesso%rowtype;
    v_resultado jsonb;
    v_pagamento_id uuid;
    v_premio_id uuid;
    v_mensagem text;
begin
    select * into v_plano
      from public.planos_acesso
     where id = p_plano_id and ativo = true;
    if not found then raise exception 'Plano não encontrado ou inativo.'; end if;

    v_mensagem := nullif(trim(coalesce(p_mensagem, '')), '');
    if v_mensagem is null then
        v_mensagem := 'Seu esforço foi reconhecido. Você recebeu acesso ao plano ' || v_plano.nome || '.';
    end if;
    if char_length(v_mensagem) > 180 then raise exception 'Mensagem do prêmio muito longa.'; end if;

    v_resultado := public.conceder_acesso_plano(p_usuario_id, p_plano_id, p_admin_id);
    v_pagamento_id := (v_resultado->>'pagamento_id')::uuid;

    update public.pagamentos
       set origem = 'premio', atualizado_em = now()
     where id = v_pagamento_id;

    insert into public.premios_usuario (
        usuario_id, plano, plano_nome, mensagem, criado_por_admin_id
    ) values (
        p_usuario_id, v_plano.id, v_plano.nome, v_mensagem, p_admin_id
    ) returning id into v_premio_id;

    return v_resultado || jsonb_build_object(
        'premio_id', v_premio_id,
        'mensagem', v_mensagem
    );
end;
$$;

revoke all on function public.premiar_usuario_plano(uuid,text,uuid,text)
    from public, anon, authenticated;
grant execute on function public.premiar_usuario_plano(uuid,text,uuid,text)
    to service_role;

commit;
