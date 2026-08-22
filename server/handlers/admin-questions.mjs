import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';
export const handler = async (event) => {
  if (!(await requireUser(event,'supremo'))) return json(403,{erro:'Acesso restrito.'});
  if (event.httpMethod === 'GET') {
    const p=event.queryStringParameters||{}; let q=db().from('questoes').select('*,capitulos(nome),disciplinas(nome)').order('id',{ascending:false}).limit(200);
    if(p.disciplina) q=q.eq('disciplina_id',p.disciplina); const {data,error}=await q;
    return error?json(500,{erro:error.message}):json(200,{questoes:data});
  }
  const b=parseBody(event);
  if (event.httpMethod === 'POST') {
    const tipo = b.tipo === 'certo_errado' ? 'certo_errado' : 'multipla_escolha';
    const alternativas = Array.isArray(b.alternativas)
      ? b.alternativas.map(a => String(a ?? '').trim()).filter(Boolean)
      : [];
    const quantidadeValida = tipo === 'certo_errado'
      ? alternativas.length === 2
      : [4, 5].includes(alternativas.length);
    if (!quantidadeValida) {
      return json(400, {
        erro: tipo === 'certo_errado'
          ? 'A questão de certo/errado deve ter 2 alternativas.'
          : 'A questão de múltipla escolha deve ter 4 ou 5 alternativas.'
      });
    }
    const correta = Number(b.resposta_correta);
    if (!Number.isInteger(correta) || correta < 0 || correta >= alternativas.length) {
      return json(400, { erro: 'Gabarito inválido para a quantidade de alternativas informada.' });
    }
    const payload={disciplina_id:b.disciplina_id,capitulo_id:Number(b.capitulo_id),tipo,enunciado:b.enunciado,alternativas,resposta_correta:correta,resolucao:b.resolucao,dificuldade:b.dificuldade||'media',fonte:b.fonte||null,ativo:true};
    const {data,error}=await db().from('questoes').insert(payload).select().single();
    return error?json(400,{erro:error.message}):json(201,{questao:data});
  }
  if (event.httpMethod === 'DELETE') {
    const id=Number((event.queryStringParameters||{}).id); const {error}=await db().from('questoes').update({ativo:false}).eq('id',id);
    return error?json(400,{erro:error.message}):json(200,{ok:true});
  }
  return json(405,{erro:'Método não permitido.'});
};
