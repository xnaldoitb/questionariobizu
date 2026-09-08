import { db } from './db.mjs';
import { patentStatus } from './patents.mjs';
import { createNotification } from './notifications.mjs';

const DAY_MS = 86_400_000;

function localDay(value = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(value));
}

function startOfLocalDay() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour));
    const offset = localAsUtc - now.getTime();
    return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - offset).toISOString();
}

export async function awardXp(userId, key, type, points, details = {}) {
    const { data, error } = await db().rpc('conceder_xp', {
        p_usuario_id: userId,
        p_chave: key,
        p_tipo: type,
        p_pontos: points,
        p_detalhes: details,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    const applied = Boolean(result?.aplicado);
    const xpTotal = Number(result?.xp_total || 0);
    if (applied) {
        const before = patentStatus(Math.max(0, xpTotal - points));
        const after = patentStatus(xpTotal);
        if (after.nivel > before.nivel) await createNotification({
            usuario_id: userId,
            tipo: 'patente',
            titulo: 'Nova patente conquistada',
            mensagem: `Você alcançou ${after.nome}. Toque para ver sua insígnia.`,
            acao: 'patente',
            chave: `patente-nivel:${after.nivel}`,
        });
    }
    return { applied, xpTotal, points };
}

async function recentResponses(userId, since = startOfLocalDay()) {
    const { data, error } = await db().from('respostas')
        .select('id,acertou,pulada,respondida_em,disciplina_id_snapshot')
        .eq('usuario_id', userId)
        .gte('respondida_em', since)
        .order('respondida_em', { ascending: false })
        .limit(5000);
    if (error) throw error;
    return data || [];
}

function correctStreak(rows) {
    let total = 0;
    for (const row of rows.filter((item) => !item.pulada)) {
        if (!row.acertou) break;
        total += 1;
    }
    return total;
}

async function studyStreak(userId) {
    const since = new Date(Date.now() - 12 * DAY_MS).toISOString();
    const { data, error } = await db().from('respostas')
        .select('respondida_em').eq('usuario_id', userId).eq('pulada', false)
        .gte('respondida_em', since).order('respondida_em', { ascending: false }).limit(5000);
    if (error) throw error;
    const days = new Set((data || []).map((row) => localDay(row.respondida_em)));
    let streak = 0;
    const cursor = new Date();
    for (let index = 0; index < 12; index += 1) {
        if (!days.has(localDay(cursor))) break;
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

export async function missionStatus(userId, { award = false } = {}) {
    const [rows, streakDays] = await Promise.all([recentResponses(userId), studyStreak(userId)]);
    const valid = rows.filter((row) => !row.pulada);
    const disciplines = new Set(valid.map((row) => row.disciplina_id_snapshot).filter(Boolean)).size;
    const sequence = correctStreak(rows);
    const day = localDay();
    const missions = [
        { id: 'sequencia-10', titulo: 'Sequência certeira', descricao: 'Acerte 10 questões seguidas.', atual: Math.min(sequence, 10), meta: 10, pontos: 25, concluida: sequence >= 10 },
        { id: 'disciplinas-3', titulo: 'Ronda de disciplinas', descricao: 'Estude 3 disciplinas no mesmo dia.', atual: Math.min(disciplines, 3), meta: 3, pontos: 40, concluida: disciplines >= 3 },
        { id: 'constancia-7', titulo: 'Constância semanal', descricao: 'Responda questões por 7 dias seguidos.', atual: Math.min(streakDays, 7), meta: 7, pontos: 200, concluida: streakDays >= 7 },
    ];

    if (award) {
        for (const mission of missions.filter((item) => item.concluida)) {
            const suffix = mission.id === 'constancia-7'
                ? localDay(new Date(Date.now() - Math.max(streakDays - 1, 0) * DAY_MS))
                : day;
            const result = await awardXp(userId, `missao:${mission.id}:${suffix}`, 'missao', mission.pontos, { missao: mission.id, dia: day });
            mission.premiada = result.applied;
            if (result.applied) {
                await createNotification({
                    usuario_id: userId,
                    tipo: 'missao',
                    titulo: 'Missão concluída',
                    mensagem: `${mission.titulo}: você ganhou ${mission.pontos} XP.`,
                    acao: 'missoes',
                    chave: `notificacao:missao:${mission.id}:${day}`,
                });
            }
        }
    }

    const { data: user, error } = await db().from('usuarios').select('xp_total,xp_bonus_plano').eq('id', userId).single();
    if (error) throw error;
    const patent = patentStatus(user?.xp_total || 0);
    return {
        xp_total: Number(user?.xp_total || 0),
        xp_bonus_plano: Number(user?.xp_bonus_plano || 0),
        patente: patent,
        missoes: missions,
    };
}

async function awardChapterMastery(userId, chapterId) {
    if (!chapterId) return null;
    const { data, error } = await db().from('respostas')
        .select('questao_id,acertou,respondida_em').eq('usuario_id', userId)
        .eq('capitulo_id_snapshot', chapterId).eq('pulada', false)
        .order('respondida_em', { ascending: false }).limit(5000);
    if (error) throw error;
    const latest = new Map();
    for (const row of data || []) if (row.questao_id && !latest.has(row.questao_id)) latest.set(row.questao_id, row);
    const rows = [...latest.values()];
    const correct = rows.filter((row) => row.acertou).length;
    if (rows.length < 30 || correct / rows.length < 0.8) return null;
    const result = await awardXp(userId, `dominio-capitulo:${chapterId}`, 'dominio', 150, {
        capitulo_id: chapterId, questoes: rows.length, acertos: correct,
    });
    if (result.applied) await createNotification({
        usuario_id: userId,
        tipo: 'missao',
        titulo: 'Domínio de capítulo',
        mensagem: 'Você dominou um capítulo com pelo menos 30 questões e 80% de acertos: +150 XP.',
        acao: 'missoes',
        chave: `notificacao:dominio:${chapterId}`,
    });
    return result;
}

export async function awardAnswerXp({ userId, questionId, chapterId, correct, previous = [] }) {
    const awarded = [];
    if (correct) {
        const previousCorrect = previous.filter((row) => row.acertou && !row.pulada);
        if (!previousCorrect.length) {
            awarded.push(await awardXp(userId, `primeiro-acerto:${questionId}`, 'primeiro_acerto', 10, { questao_id: questionId }));
            if (previous.some((row) => !row.acertou && !row.pulada)) {
                awarded.push(await awardXp(userId, `correcao:${questionId}`, 'correcao', 4, { questao_id: questionId }));
            }
        } else {
            const latest = new Date(previousCorrect[0].respondida_em).getTime();
            if (Number.isFinite(latest) && Date.now() - latest >= DAY_MS) {
                awarded.push(await awardXp(userId, `revisao:${questionId}:${localDay()}`, 'revisao', 3, { questao_id: questionId }));
            }
        }
    }
    const mastery = await awardChapterMastery(userId, chapterId);
    if (mastery) awarded.push(mastery);
    const missions = await missionStatus(userId, { award: true });
    return {
        xp_ganho: awarded.filter((item) => item.applied).reduce((sum, item) => sum + item.points, 0)
            + missions.missoes.filter((item) => item.premiada).reduce((sum, item) => sum + item.pontos, 0),
        xp_total: missions.xp_total,
        missoes_concluidas: missions.missoes.filter((item) => item.premiada).map((item) => item.id),
    };
}

export async function awardSessionXp(userId, session) {
    const awards = [];
    if (Number(session.respondidas || 0) >= 20) {
        awards.push(await awardXp(userId, `sessao-completa:${session.id}`, 'sessao', 20, { sessao_id: session.id }));
    }
    const percentage = Number(session.percentual || 0);
    if (percentage >= 90) awards.push(await awardXp(userId, `sessao-precisao:${session.id}`, 'precisao', 60, { percentual: percentage }));
    else if (percentage >= 80) awards.push(await awardXp(userId, `sessao-precisao:${session.id}`, 'precisao', 30, { percentual: percentage }));
    return awards.filter((item) => item.applied).reduce((sum, item) => sum + item.points, 0);
}
