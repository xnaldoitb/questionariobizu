-- ============================================================
-- QUESTIONARIO BIZU v4.11
-- Liberação automática para Pix e saldo Mercado Pago
-- ============================================================

create or replace function public.confirmar_pagamento_pix(
    p_pagamento_id uuid,
    p_mercado_pago_payment_id text,
    p_status text,
    p_valor_recebido numeric,
    p_moeda text,
    p_meio_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pagamento public.pagamentos%rowtype;
    v_validade timestamptz;
begin
    select * into v_pagamento from public.pagamentos where id = p_pagamento_id for update;
    if not found then return jsonb_build_object('aplicado', false, 'motivo', 'pagamento_nao_encontrado'); end if;
    if v_pagamento.aplicado_em is not null then return jsonb_build_object('aplicado', false, 'motivo', 'ja_aplicado'); end if;

    if p_status <> 'approved' then
        update public.pagamentos
           set status = left(coalesce(p_status, 'desconhecido'), 40),
               mercado_pago_payment_id = coalesce(mercado_pago_payment_id, p_mercado_pago_payment_id),
               atualizado_em = now()
         where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'nao_aprovado');
    end if;

    -- Checkout Pro identifica pagamento com saldo como account_money.
    -- Ambos os meios abaixo são liquidados pelo Mercado Pago antes de approved.
    if p_moeda <> 'BRL'
       or p_meio_pagamento not in ('pix', 'account_money')
       or p_valor_recebido <> v_pagamento.valor then
        update public.pagamentos set status = 'revisao', atualizado_em = now()
         where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'dados_divergentes');
    end if;

    v_validade := public.aplicar_periodo_acesso(
        v_pagamento.usuario_id,
        v_pagamento.duracao_dias,
        v_pagamento.acesso_permanente
    );

    update public.pagamentos
       set status = 'approved',
           mercado_pago_payment_id = p_mercado_pago_payment_id,
           atualizado_em = now(),
           aprovado_em = now(),
           aplicado_em = now()
     where id = p_pagamento_id;

    return jsonb_build_object(
        'aplicado', true,
        'plano', v_pagamento.plano,
        'validade_ate', v_validade,
        'meio_pagamento', p_meio_pagamento
    );
end;
$$;

revoke all on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) from public;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) to service_role;
