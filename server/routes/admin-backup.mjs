import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';

const PAGE_SIZE = 500;

async function fetchAll(table, columns, orderColumn = 'id') {
    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await db()
            .from(table)
            .select(columns)
            .order(orderColumn, { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return rows;
}

export const handler = async (event) => {
    if (!(await requireUser(event, 'supremo'))) {
        return json(403, { erro: 'Acesso restrito.' });
    }

    if (event.httpMethod !== 'GET') {
        return json(405, { erro: 'Método não permitido.' });
    }

    try {
        const [disciplinas, capitulos, questoes] = await Promise.all([
            fetchAll('disciplinas', 'id,nome,descricao,ordem,ativo', 'ordem'),
            fetchAll('capitulos', 'id,disciplina_id,indice,nome,ativo', 'id'),
            fetchAll(
                'questoes',
                'id,disciplina_id,capitulo_id,tipo,enunciado,alternativas,resposta_correta,resolucao,dificuldade,fonte,ativo',
                'id',
            ),
        ]);

        const pacotes = disciplinas.map((disciplina) => ({
            versao: 2,
            disciplina,
            capitulos: capitulos.filter((capitulo) => capitulo.disciplina_id === disciplina.id),
            questoes: questoes.filter((questao) => questao.disciplina_id === disciplina.id),
        }));

        return json(200, {
            formato: 'questionario-bizu-backup-conteudo',
            versao: 2,
            gerado_em: new Date().toISOString(),
            observacao: 'Backup de conteúdo compatível com a importação. Contas, senhas, sessões e resultados não são incluídos.',
            disciplinas: pacotes,
        });
    } catch (error) {
        console.error('Falha ao gerar backup:', error.message);
        return json(500, { erro: 'Não foi possível gerar o backup.' });
    }
};
