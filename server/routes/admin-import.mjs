import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';

const texto = (v, campo) => {
  const valor = String(v ?? '').trim();
  if (!valor) throw new Error(`Campo obrigatório ausente: ${campo}.`);
  return valor;
};

const normalizarId = (v) => texto(v, 'disciplina.id')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '');

function validarArquivo(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Arquivo JSON inválido.');
  const disciplina = payload.disciplina;
  const capitulos = payload.capitulos;
  const questoes = payload.questoes;
  if (!disciplina || !Array.isArray(capitulos) || !Array.isArray(questoes)) {
    throw new Error('O arquivo deve conter disciplina, capitulos e questoes.');
  }
  const id = normalizarId(disciplina.id);
  const capitulosValidados = capitulos.map((c, i) => ({
    origem_id: c.id ?? null,
    disciplina_id: id,
    indice: Number.isInteger(Number(c.indice)) ? Number(c.indice) : i + 1,
    nome: texto(c.nome, `capitulos[${i}].nome`),
    ativo: c.ativo !== false,
  }));
  const indices = new Set();
  for (const c of capitulosValidados) {
    if (c.indice < 1) throw new Error('A ordem dos capítulos deve começar em 1.');
    if (indices.has(c.indice)) throw new Error(`Ordem de capítulo repetida: ${c.indice}.`);
    indices.add(c.indice);
  }
  const origemPorId = new Map(capitulosValidados.filter(c => c.origem_id != null).map(c => [String(c.origem_id), c]));
  const origemPorIndice = new Map(capitulosValidados.map(c => [String(c.indice), c]));
  const questoesValidadas = questoes.map((q, i) => {
    const tipo = q.tipo === 'certo_errado' ? 'certo_errado' : 'multipla_escolha';
    const alternativas = Array.isArray(q.alternativas)
      ? q.alternativas.map(a => String(a ?? '').trim()).filter(Boolean)
      : [];
    const quantidadeValida = tipo === 'certo_errado'
      ? alternativas.length === 2
      : [4, 5].includes(alternativas.length);
    if (!quantidadeValida) {
      throw new Error(
        tipo === 'certo_errado'
          ? `A questão ${i + 1} deve possuir 2 alternativas preenchidas.`
          : `A questão ${i + 1} deve possuir 4 ou 5 alternativas preenchidas.`
      );
    }
    const correta = Number(q.resposta_correta);
    if (!Number.isInteger(correta) || correta < 0 || correta >= alternativas.length) {
      throw new Error(`Gabarito inválido na questão ${i + 1}.`);
    }
    const ref = q.capitulo_id != null ? origemPorId.get(String(q.capitulo_id)) : null;
    const porIndice = q.capitulo_indice != null ? origemPorIndice.get(String(q.capitulo_indice)) : null;
    const capitulo = ref || porIndice;
    if (!capitulo) throw new Error(`Capítulo não encontrado para a questão ${i + 1}.`);
    return {
      disciplina_id: id,
      tipo,
      capitulo_indice: capitulo.indice,
      enunciado: texto(q.enunciado, `questoes[${i}].enunciado`),
      alternativas,
      resposta_correta: correta,
      resolucao: texto(q.resolucao, `questoes[${i}].resolucao`),
      dificuldade: ['facil','media','dificil'].includes(q.dificuldade) ? q.dificuldade : 'media',
      fonte: q.fonte ? String(q.fonte).trim() : null,
      ativo: q.ativo !== false,
    };
  });
  return {
    disciplina: {
      id,
      nome: texto(disciplina.nome, 'disciplina.nome'),
      descricao: disciplina.descricao ? String(disciplina.descricao).trim() : null,
      ordem: Number(disciplina.ordem) || 0,
      ativo: disciplina.ativo !== false,
    },
    capitulos: capitulosValidados,
    questoes: questoesValidadas,
  };
}

function replaceMigrationMissing(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('substituir_disciplina_completa') ||
    message.includes('function public.substituir_disciplina_completa') ||
    message.includes('could not find the function');
}

async function replaceDisciplineAtomically(banco, dados) {
  const { data, error } = await banco.rpc('substituir_disciplina_completa', {
    p_disciplina: dados.disciplina,
    p_capitulos: dados.capitulos.map(({ origem_id, disciplina_id, ...capitulo }) => capitulo),
    p_questoes: dados.questoes.map(({ disciplina_id, ...questao }) => questao),
  });

  if (error) {
    if (replaceMigrationMissing(error)) {
      throw new Error('A substituição definitiva requer a migration v4.3. Execute supabase/migration-v4.3-vip-auditoria-ranking.sql no Supabase.');
    }
    throw error;
  }

  return data || {};
}

async function mergeDiscipline(banco, dados) {
  const { error: erroDisciplina } = await banco.from('disciplinas').upsert(dados.disciplina, { onConflict: 'id' });
  if (erroDisciplina) throw erroDisciplina;

  const capitulosBanco = [];
  for (const capitulo of dados.capitulos) {
    const { data: existente, error: erroBusca } = await banco.from('capitulos')
      .select('id').eq('disciplina_id', dados.disciplina.id).eq('indice', capitulo.indice).maybeSingle();
    if (erroBusca) throw erroBusca;
    if (existente) {
      const { data, error } = await banco.from('capitulos').update({ nome: capitulo.nome, ativo: capitulo.ativo })
        .eq('id', existente.id).select('id,indice').single();
      if (error) throw error;
      capitulosBanco.push(data);
    } else {
      const { data, error } = await banco.from('capitulos').insert({
        disciplina_id: dados.disciplina.id,
        indice: capitulo.indice,
        nome: capitulo.nome,
        ativo: capitulo.ativo,
      }).select('id,indice').single();
      if (error) throw error;
      capitulosBanco.push(data);
    }
  }

  const capituloIdPorIndice = new Map(capitulosBanco.map(c => [c.indice, c.id]));
  const lotes = [];
  for (let i = 0; i < dados.questoes.length; i += 100) lotes.push(dados.questoes.slice(i, i + 100));
  let inseridas = 0;
  for (const lote of lotes) {
    const registros = lote.map(q => ({
      disciplina_id: q.disciplina_id,
      capitulo_id: capituloIdPorIndice.get(q.capitulo_indice),
      tipo: q.tipo,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      resposta_correta: q.resposta_correta,
      resolucao: q.resolucao,
      dificuldade: q.dificuldade,
      fonte: q.fonte,
      ativo: q.ativo,
    }));
    const { error } = await banco.from('questoes').insert(registros);
    if (error) throw error;
    inseridas += registros.length;
  }

  return { capitulos: dados.capitulos.length, questoes: inseridas };
}

export const handler = async (event) => {
  if (!(await requireUser(event, 'supremo'))) return json(403, { erro: 'Acesso restrito.' });
  if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });

  try {
    const body = parseBody(event);
    const modo = body.modo === 'replace' ? 'replace' : 'merge';
    const dados = validarArquivo(body.arquivo);
    const banco = db();

    const result = modo === 'replace'
      ? await replaceDisciplineAtomically(banco, dados)
      : await mergeDiscipline(banco, dados);

    return json(201, {
      ok: true,
      disciplina: dados.disciplina.nome,
      capitulos: Number(result.capitulos ?? dados.capitulos.length),
      questoes: Number(result.questoes ?? dados.questoes.length),
      modo,
      substituicao_definitiva: modo === 'replace',
      historico_preservado: modo === 'replace',
    });
  } catch (erro) {
    console.error('ERRO NA IMPORTAÇÃO:', erro);
    return json(400, { erro: erro?.message || 'Não foi possível importar o arquivo.' });
  }
};
