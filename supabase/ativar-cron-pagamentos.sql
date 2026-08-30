-- Executar SOMENTE depois do deploy e da configuração dos dois segredos no Vault.
-- Não cole valores secretos neste arquivo, nem os publique no Git.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
 endpoint text;
 token text;
BEGIN
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='bizu_reconciliacao_url';
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='bizu_cron_secret';
 IF endpoint IS NULL OR endpoint !~ '^https://[^/?#]+/api/pagamentos-reconciliar$' THEN
   RAISE EXCEPTION 'Configure bizu_reconciliacao_url no Vault com a URL HTTPS da rota.';
 END IF;
 IF token IS NULL OR length(token)<32 THEN
   RAISE EXCEPTION 'Configure bizu_cron_secret no Vault com o mesmo CRON_SECRET da Vercel (32+ caracteres).';
 END IF;
END;
$$;

-- O mesmo nome atualiza o agendamento, sem criar um segundo job.
SELECT cron.schedule('bizu-reconciliar-pagamentos','*/5 * * * *',$job$
 SELECT net.http_get(
   url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bizu_reconciliacao_url'),
   headers := jsonb_build_object('Authorization','Bearer ' ||
     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bizu_cron_secret')),
   timeout_milliseconds := 25000
 );
$job$);
COMMIT;
