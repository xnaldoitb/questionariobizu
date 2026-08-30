-- Executar após v4.20/v4.21 e antes de publicar. Não aprova pagamentos.
BEGIN;
CREATE INDEX IF NOT EXISTS pagamentos_fila_reconciliacao
 ON public.pagamentos(ultima_consulta_em NULLS FIRST,criado_em,id)
 WHERE origem='mercado_pago' AND aplicado_em IS NULL;

CREATE OR REPLACE FUNCTION public.reservar_pagamentos_reconciliacao()
RETURNS SETOF public.pagamentos LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH fila AS (
   SELECT id FROM public.pagamentos
   WHERE origem='mercado_pago' AND aplicado_em IS NULL
     AND (ultima_consulta_em IS NULL OR ultima_consulta_em < now()-interval '4 minutes')
   ORDER BY ultima_consulta_em ASC NULLS FIRST,criado_em ASC,id ASC
   LIMIT 10 FOR UPDATE SKIP LOCKED
 )
 UPDATE public.pagamentos p SET ultima_consulta_em=now()
 FROM fila WHERE p.id=fila.id RETURNING p.*;
$$;
REVOKE ALL ON FUNCTION public.reservar_pagamentos_reconciliacao() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_pagamentos_reconciliacao() TO service_role;
COMMIT;
