# Atualização: importação Excel e Certo/Errado

Antes de iniciar o site, execute `supabase/migration-tipo-questao.sql` no SQL Editor do Supabase.

O painel agora aceita `.xlsx`, `.xls`, `.csv` e `.json`. A planilha é analisada no navegador, mostra disciplinas, capítulos, questões válidas e erros antes da confirmação.

A biblioteca SheetJS é carregada do CDN oficial no `index.html`. Para produção sem dependência externa, baixe `xlsx.full.min.js` e salve em `public/vendor/`, alterando o script para o caminho local.
