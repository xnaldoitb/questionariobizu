-- v4.21. Executar após v4.20 e antes de publicar. Não altera pagamentos/histórico.
BEGIN;
ALTER TABLE public.usuarios
 ADD COLUMN IF NOT EXISTS teste_ciclo_em timestamptz,
 ADD COLUMN IF NOT EXISTS teste_saldo_segundos numeric NOT NULL DEFAULT 1800 CHECK (teste_saldo_segundos BETWEEN 0 AND 1800),
 ADD COLUMN IF NOT EXISTS teste_ativo_ate timestamptz;

-- Premium reflete qualquer concessão de prazo, inclusive pelo painel de usuários.
CREATE OR REPLACE FUNCTION public.sincronizar_insignia_acesso() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.vip OR NEW.perfil = 'supremo' THEN
   NEW.premium := false;
   NEW.acesso_teste := false;
   NEW.teste_ativo_ate := NULL;
   NEW.teste_expira_em := NULL;
   IF NEW.vip THEN NEW.validade_ate := NULL; END IF;
 ELSIF NEW.validade_ate > now() THEN
   NEW.premium := true;
   NEW.acesso_teste := false;
   NEW.teste_ativo_ate := NULL;
   NEW.teste_expira_em := NULL;
 ELSE
   NEW.premium := false;
   NEW.acesso_teste := true;
   NEW.teste_expira_em := NULL;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS usuarios_insignia_acesso ON public.usuarios;
CREATE TRIGGER usuarios_insignia_acesso BEFORE INSERT OR UPDATE OF validade_ate,vip,perfil,premium,acesso_teste
ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.sincronizar_insignia_acesso();
-- Recalcula insígnias existentes, sem estender nenhum prazo nem iniciar testes.
UPDATE public.usuarios SET premium=premium;

-- Reservas curtas cobradas antecipadamente: não é possível estudar sem debitar
-- tempo simplesmente bloqueando os heartbeats. FOR UPDATE evita cobrança dupla
-- entre abas. Pausa devolve apenas os segundos ainda não utilizados da reserva.
CREATE OR REPLACE FUNCTION public.atualizar_teste_ativo(p_usuario_id uuid, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 u public.usuarios%rowtype;
 t timestamptz;
 reserva numeric;
 restante_reserva numeric;
BEGIN
 SELECT * INTO u FROM public.usuarios WHERE id=p_usuario_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 t := clock_timestamp();
 IF (NOT u.ativo AND NOT u.desativado_por_validade) OR u.status_aprovacao='negado' THEN RETURN; END IF;
 IF u.perfil='supremo' OR u.vip OR u.validade_ate>t THEN RETURN; END IF;
 restante_reserva := greatest(0,coalesce(extract(epoch FROM (u.teste_ativo_ate-t)),0));
 IF NOT coalesce(p_ativo,false) THEN
   UPDATE public.usuarios SET teste_saldo_segundos=least(1800,teste_saldo_segundos+restante_reserva),teste_ativo_ate=NULL
   WHERE id=p_usuario_id;
   RETURN;
 END IF;
 IF u.teste_ciclo_em IS NULL OR u.teste_ciclo_em+interval '8 hours'<=t THEN
   u.teste_ciclo_em := t;
   u.teste_saldo_segundos := 1800;
   u.teste_ativo_ate := NULL;
   restante_reserva := 0;
 END IF;
 -- Reaproveita a reserva atual. Renova apenas perto do fim.
 IF restante_reserva>10 THEN RETURN; END IF;
 reserva := least(20-restante_reserva,u.teste_saldo_segundos);
 UPDATE public.usuarios SET teste_ciclo_em=u.teste_ciclo_em,
   teste_saldo_segundos=u.teste_saldo_segundos-reserva,
   teste_ativo_ate=CASE WHEN reserva+restante_reserva>0 THEN t+make_interval(secs=>(reserva+restante_reserva)::double precision) ELSE NULL END,
   acesso_teste=true,premium=false
 WHERE id=p_usuario_id;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_teste_ativo(uuid,boolean) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_teste_ativo(uuid,boolean) TO service_role;
COMMENT ON COLUMN public.usuarios.teste_expira_em IS 'Legado. Desde v4.21, usar saldo de segundos, ciclo de 8h e reserva ativa.';
COMMIT;
