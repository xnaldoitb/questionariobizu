-- v4.20: consultas de cobranças antigas e compensação manual por pagamento.
-- Executar antes de publicar. Não marca nenhuma cobrança como paga.
BEGIN;
ALTER TABLE public.pagamentos
    ADD COLUMN IF NOT EXISTS compensacao_manual_id uuid REFERENCES public.pagamentos(id),
    ADD COLUMN IF NOT EXISTS mp_payment_id_informado text,
    ADD COLUMN IF NOT EXISTS ultima_consulta_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_compensacao_manual_unica
    ON public.pagamentos(compensacao_manual_id) WHERE compensacao_manual_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.confirmar_pagamento_pix(
    p_pagamento_id uuid, p_mercado_pago_payment_id text, p_status text,
    p_valor_recebido numeric, p_moeda text, p_meio_pagamento text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_pagamento public.pagamentos%rowtype;
    v_manual public.pagamentos%rowtype;
    v_validade timestamptz;
BEGIN
    SELECT * INTO v_pagamento FROM public.pagamentos WHERE id = p_pagamento_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('aplicado',false,'motivo','pagamento_nao_encontrado'); END IF;
    IF v_pagamento.origem IS DISTINCT FROM 'mercado_pago' THEN
        RETURN jsonb_build_object('aplicado',false,'motivo','origem_invalida');
    END IF;
    IF v_pagamento.aplicado_em IS NOT NULL THEN
        RETURN jsonb_build_object('aplicado',false,'motivo','ja_aplicado');
    END IF;
    IF p_mercado_pago_payment_id IS NULL OR p_mercado_pago_payment_id !~ '^[0-9]+$'
       OR (v_pagamento.mp_payment_id_informado IS NOT NULL
           AND v_pagamento.mp_payment_id_informado <> p_mercado_pago_payment_id) THEN
        RETURN jsonb_build_object('aplicado',false,'motivo','id_divergente');
    END IF;
    IF p_status IS DISTINCT FROM 'approved' THEN
        UPDATE public.pagamentos SET status = left(coalesce(p_status,'desconhecido'),40),
            mercado_pago_payment_id = p_mercado_pago_payment_id, atualizado_em = now()
        WHERE id = p_pagamento_id;
        RETURN jsonb_build_object('aplicado',false,'motivo','nao_aprovado');
    END IF;
    IF p_moeda IS DISTINCT FROM 'BRL' OR p_meio_pagamento IS NULL
       OR p_meio_pagamento NOT IN ('pix','account_money')
       OR p_valor_recebido IS DISTINCT FROM v_pagamento.valor THEN
        UPDATE public.pagamentos SET status='revisao', atualizado_em=now() WHERE id=p_pagamento_id;
        RETURN jsonb_build_object('aplicado',false,'motivo','dados_divergentes');
    END IF;
    IF v_pagamento.compensacao_manual_id IS NOT NULL THEN
        SELECT * INTO v_manual FROM public.pagamentos WHERE id=v_pagamento.compensacao_manual_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Liberação manual não encontrada.'; END IF;
        IF v_manual.origem IS DISTINCT FROM 'manual' OR v_manual.status IS DISTINCT FROM 'approved'
           OR v_manual.aplicado_em IS NULL OR v_manual.usuario_id IS DISTINCT FROM v_pagamento.usuario_id
           OR v_manual.plano IS DISTINCT FROM v_pagamento.plano
           OR v_manual.duracao_dias IS DISTINCT FROM v_pagamento.duracao_dias
           OR v_manual.acesso_permanente IS DISTINCT FROM v_pagamento.acesso_permanente THEN
            RAISE EXCEPTION 'Liberação manual incompatível com a cobrança.';
        END IF;
        -- O benefício já foi concedido. Não altera a validade nem chama aplicar_periodo_acesso.
        SELECT validade_ate INTO v_validade FROM public.usuarios WHERE id=v_pagamento.usuario_id;
    ELSE
        -- Toda compra nova, sem vínculo de compensação, continua acumulando normalmente.
        v_validade := public.aplicar_periodo_acesso(v_pagamento.usuario_id, v_pagamento.duracao_dias, v_pagamento.acesso_permanente);
    END IF;
    UPDATE public.pagamentos SET status='approved', mercado_pago_payment_id=p_mercado_pago_payment_id,
        atualizado_em=now(), aprovado_em=now(), aplicado_em=coalesce(v_manual.aplicado_em,now())
    WHERE id=p_pagamento_id;
    RETURN jsonb_build_object('aplicado',true,'compensado_manualmente',v_pagamento.compensacao_manual_id IS NOT NULL,
        'plano',v_pagamento.plano,'validade_ate',v_validade,'meio_pagamento',p_meio_pagamento);
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_pagamento_pix(uuid,text,text,numeric,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_pix(uuid,text,text,numeric,text,text) TO service_role;
COMMIT;
