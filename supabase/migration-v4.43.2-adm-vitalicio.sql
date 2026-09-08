-- v4.43.2 · Administradores possuem acesso vitalício automático.
BEGIN;

CREATE OR REPLACE FUNCTION public.sincronizar_insignia_acesso() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.perfil IN ('admin', 'supremo') THEN
    NEW.vip := true;
    NEW.vip_desde := coalesce(NEW.vip_desde, now());
    NEW.plano_atual := 'vitalicio';
    NEW.validade_ate := NULL;
    NEW.premium := false;
    NEW.acesso_teste := false;
    NEW.teste_ativo_ate := NULL;
    NEW.teste_expira_em := NULL;
    NEW.desativado_por_validade := false;
  ELSIF NEW.vip THEN
    NEW.vip_desde := coalesce(NEW.vip_desde, now());
    NEW.plano_atual := coalesce(NEW.plano_atual, 'vitalicio');
    NEW.validade_ate := NULL;
    NEW.premium := false;
    NEW.acesso_teste := false;
    NEW.teste_ativo_ate := NULL;
    NEW.teste_expira_em := NULL;
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
CREATE TRIGGER usuarios_insignia_acesso
BEFORE INSERT OR UPDATE OF validade_ate,vip,perfil,premium,acesso_teste,plano_atual,vip_desde,desativado_por_validade
ON public.usuarios FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_insignia_acesso();

UPDATE public.usuarios
SET vip = true,
    vip_desde = coalesce(vip_desde, now()),
    plano_atual = 'vitalicio',
    validade_ate = NULL,
    premium = false,
    acesso_teste = false,
    teste_ativo_ate = NULL,
    teste_expira_em = NULL,
    desativado_por_validade = false
WHERE perfil IN ('admin', 'supremo');

COMMIT;
