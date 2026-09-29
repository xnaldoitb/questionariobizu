-- Questionário Bizu v4.56.6 · alta concorrência
-- Consolida o carregamento do simulado e a confirmação de resposta.
-- Não remove nem recalcula respostas, XP ou usuários existentes.

begin;

create or replace function public.listar_questoes_simulado_v4566(
  p_usuario_id uuid,
  p_disciplina_id text,
  p_capitulos bigint[] default '{}'::bigint[],
  p_revisao boolean default false
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'disciplina_id', q.disciplina_id,
    'capitulo_id', q.capitulo_id,
    'tipo', q.tipo,
    'enunciado', q.enunciado,
    'alternativas', q.alternativas,
    'dificuldade', q.dificuldade
  ) order by q.id), '[]'::jsonb)
  from public.questoes q
  where q.ativo = true
    and q.disciplina_id = p_disciplina_id
    and (coalesce(cardinality(p_capitulos), 0) = 0 or q.capitulo_id = any(p_capitulos))
    and (
      p_revisao is false
      or coalesce((
        select r.acertou
        from public.respostas r
        where r.usuario_id = p_usuario_id
          and r.questao_id = q.id
          and r.pulada = false
        order by r.respondida_em desc, r.id desc
        limit 1
      ), false) = false
    );
$$;

create or replace function public.registrar_resposta_v4566(
  p_usuario_id uuid,
  p_sessao_id uuid,
  p_questao_id bigint,
  p_resposta smallint,
  p_pulada boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao public.sessoes%rowtype;
  v_questao public.questoes%rowtype;
  v_existente public.respostas%rowtype;
  v_acertou boolean := false;
  v_respondidas_antes integer := 0;
  v_acertos_antes integer := 0;
  v_erros_antes integer := 0;
  v_ultimo_acerto timestamptz;
  v_ganho integer := 0;
  v_total bigint := 0;
  v_item record;
begin
  select * into v_sessao
  from public.sessoes s
  where s.id = p_sessao_id and s.usuario_id = p_usuario_id
  for update;

  if not found or v_sessao.finalizada_em is not null then
    return jsonb_build_object('erro', 'Sessão inválida ou já finalizada.', 'status', 403);
  end if;
  if not (p_questao_id = any(coalesce(v_sessao.questoes_ids, '{}'::bigint[]))) then
    return jsonb_build_object('erro', 'Esta questão não pertence ao simulado atual.', 'status', 403);
  end if;

  select * into v_questao
  from public.questoes q
  where q.id = p_questao_id and q.ativo = true;
  if not found then
    return jsonb_build_object('erro', 'Questão não encontrada.', 'status', 404);
  end if;

  if not p_pulada and (
    p_resposta is null or p_resposta < 0
    or p_resposta >= jsonb_array_length(v_questao.alternativas)
  ) then
    return jsonb_build_object('erro', 'Resposta marcada inválida.', 'status', 400);
  end if;

  select * into v_existente
  from public.respostas r
  where r.sessao_id = p_sessao_id and r.questao_id = p_questao_id
  for update;

  if found and not (v_existente.pulada and not p_pulada) then
    if v_existente.pulada = p_pulada
       and (p_pulada or v_existente.resposta_marcada = p_resposta) then
      return case when p_pulada then
        jsonb_build_object('ok', true, 'pulada', true, 'repetida', true, 'xp_ganho', 0)
      else jsonb_build_object(
        'correta', v_questao.resposta_correta,
        'acertou', v_existente.acertou,
        'resolucao', v_questao.resolucao,
        'repetida', true,
        'xp_ganho', 0
      ) end;
    end if;
    return jsonb_build_object('erro', 'Esta questão já foi respondida neste simulado.', 'status', 409);
  end if;

  select count(*)::integer,
         count(*) filter (where r.acertou)::integer,
         count(*) filter (where not r.acertou)::integer,
         max(r.respondida_em) filter (where r.acertou)
    into v_respondidas_antes, v_acertos_antes, v_erros_antes, v_ultimo_acerto
  from public.respostas r
  where r.usuario_id = p_usuario_id
    and r.questao_id = p_questao_id
    and r.pulada = false;

  v_acertou := not p_pulada and p_resposta = v_questao.resposta_correta;
  if v_existente.id is not null then
    update public.respostas
       set resposta_marcada = p_resposta, acertou = v_acertou,
           pulada = p_pulada, respondida_em = now()
     where id = v_existente.id;
  else
    insert into public.respostas(
      sessao_id, usuario_id, questao_id, resposta_marcada, acertou, pulada, respondida_em
    ) values (
      p_sessao_id, p_usuario_id, p_questao_id,
      case when p_pulada then null else p_resposta end,
      v_acertou, p_pulada, now()
    );
  end if;

  if not p_pulada then
    select * into v_item from public.conceder_xp_questao_limitado(
      p_usuario_id, 'resposta-valida:' || p_sessao_id || ':' || p_questao_id,
      'resposta_valida', 10,
      jsonb_build_object('sessao_id', p_sessao_id, 'questao_id', p_questao_id), 5000
    );
    v_ganho := v_ganho + coalesce(v_item.pontos_aplicados, 0);
    v_total := coalesce(v_item.novo_xp_total, v_total);

    if v_acertou then
      select * into v_item from public.conceder_xp_questao_limitado(
        p_usuario_id, 'resposta-correta:' || p_sessao_id || ':' || p_questao_id,
        'resposta_correta', 15,
        jsonb_build_object('sessao_id', p_sessao_id, 'questao_id', p_questao_id), 5000
      );
      v_ganho := v_ganho + coalesce(v_item.pontos_aplicados, 0);
      v_total := coalesce(v_item.novo_xp_total, v_total);

      if v_acertos_antes = 0 then
        select * into v_item from public.conceder_xp_questao_limitado(
          p_usuario_id, 'primeiro-acerto:' || p_questao_id,
          'primeiro_acerto', 25, jsonb_build_object('questao_id', p_questao_id), 5000
        );
        v_ganho := v_ganho + coalesce(v_item.pontos_aplicados, 0);
        v_total := coalesce(v_item.novo_xp_total, v_total);
        if v_erros_antes > 0 then
          select * into v_item from public.conceder_xp_questao_limitado(
            p_usuario_id, 'correcao:' || p_questao_id,
            'correcao', 15, jsonb_build_object('questao_id', p_questao_id), 5000
          );
          v_ganho := v_ganho + coalesce(v_item.pontos_aplicados, 0);
          v_total := coalesce(v_item.novo_xp_total, v_total);
        end if;
      elsif v_ultimo_acerto <= now() - interval '1 day' then
        select * into v_item from public.conceder_xp_questao_limitado(
          p_usuario_id,
          'revisao:' || p_questao_id || ':' || (now() at time zone 'America/Belem')::date,
          'revisao', 10, jsonb_build_object('questao_id', p_questao_id), 5000
        );
        v_ganho := v_ganho + coalesce(v_item.pontos_aplicados, 0);
        v_total := coalesce(v_item.novo_xp_total, v_total);
      end if;
    end if;
  end if;

  if v_total = 0 then
    select coalesce(u.xp_total, 0) into v_total from public.usuarios u where u.id = p_usuario_id;
  end if;

  if p_pulada then
    return jsonb_build_object('ok', true, 'pulada', true, 'xp_ganho', 0, 'xp_total', v_total);
  end if;
  return jsonb_build_object(
    'correta', v_questao.resposta_correta,
    'acertou', v_acertou,
    'resolucao', v_questao.resolucao,
    'xp_ganho', v_ganho,
    'xp_total', v_total
  );
end;
$$;

create or replace function public.catalogo_admin_v4566()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'disciplinas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'nome', d.nome, 'descricao', d.descricao,
        'ordem', d.ordem, 'ativo', d.ativo,
        'questoes_total', coalesce(c.total, 0),
        'questoes_ativas', coalesce(c.ativas, 0)
      ) order by d.ordem, d.nome)
      from public.disciplinas d
      left join (
        select q.disciplina_id, count(*)::integer total,
               count(*) filter (where q.ativo)::integer ativas
        from public.questoes q group by q.disciplina_id
      ) c on c.disciplina_id = d.id
    ), '[]'::jsonb),
    'capitulos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'disciplina_id', c.disciplina_id, 'indice', c.indice,
        'nome', c.nome, 'ativo', c.ativo,
        'questoes_total', coalesce(q.total, 0),
        'questoes_ativas', coalesce(q.ativas, 0)
      ) order by c.id)
      from public.capitulos c
      left join (
        select x.capitulo_id, count(*)::integer total,
               count(*) filter (where x.ativo)::integer ativas
        from public.questoes x group by x.capitulo_id
      ) q on q.capitulo_id = c.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.listar_questoes_simulado_v4566(uuid,text,bigint[],boolean)
  from public, anon, authenticated;
revoke all on function public.registrar_resposta_v4566(uuid,uuid,bigint,smallint,boolean)
  from public, anon, authenticated;
revoke all on function public.catalogo_admin_v4566()
  from public, anon, authenticated;
grant execute on function public.listar_questoes_simulado_v4566(uuid,text,bigint[],boolean)
  to service_role;
grant execute on function public.registrar_resposta_v4566(uuid,uuid,bigint,smallint,boolean)
  to service_role;
grant execute on function public.catalogo_admin_v4566()
  to service_role;

commit;
