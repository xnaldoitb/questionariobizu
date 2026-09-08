import { db } from './db.mjs';
import { patentStatus } from './patents.mjs';
import { createNotification } from './notifications.mjs';

const DAY_MS = 86_400_000;

export function localDay(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(value)).reduce((result, part) => {
        if (['year', 'month', 'day'].includes(part.type)) result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function startOfLocalDay(value = new Date()) {
    // Belém usa UTC−03:00 durante todo o ano. Construir o marco diretamente
    // evita que os minutos atuais contaminem o cálculo do início do dia.
    return new Date(`${localDay(value)}T03:00:00.000Z`).toISOString();
}

export function startOfLocalWeek(value = new Date()) {
    const [year, month, day] = localDay(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return `${date.toISOString().slice(0, 10)}T03:00:00.000Z`;
}

export function sequenceMissionTarget(completedStages = 0) {
    return (Math.max(0, Number(completedStages) || 0) + 1) * 10;
}

export function roundMissionTarget(completedStages = 0) {
    const targets = [3, 6, 9, 12, 15, 18];
    return targets[Math.min(Math.max(0, Number(completedStages) || 0), targets.length - 1)];
}

export function progressiveMissionReward(basePoints, completedStages = 0, maxStages = null) {
    const nextStage = Math.max(0, Number(completedStages) || 0) + 1;
    const rewardedStage = maxStages ? Math.min(nextStage, maxStages) : nextStage;
    return Math.max(0, Number(basePoints) || 0) * rewardedStage;
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
    async function run(select) {
        return db().from('respostas').select(select).eq('usuario_id', userId)
            .gte('respondida_em', since).order('respondida_em', { ascending: false }).limit(5000);
    }
    let result = await run('id,acertou,pulada,respondida_em,disciplina_id_snapshot,capitulo_id_snapshot');
    if (result.error?.code === '42703') result = await run('id,acertou,pulada,respondida_em,disciplina_id_snapshot');
    if (result.error?.code === '42703') result = await run('id,acertou,pulada,respondida_em');
    if (result.error) throw result.error;
    return result.data || [];
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
    const since = new Date(Date.now() - 120 * DAY_MS).toISOString();
    const { data, error } = await db().from('respostas')
        .select('respondida_em').eq('usuario_id', userId).eq('pulada', false)
        .gte('respondida_em', since).order('respondida_em', { ascending: false }).limit(5000);
    if (error) throw error;
    const days = new Set((data || []).map((row) => localDay(row.respondida_em)));
    let streak = 0;
    const cursor = new Date();
    for (let index = 0; index < 120; index += 1) {
        if (!days.has(localDay(cursor))) break;
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

async function awardedMissionKeys(userId, since) {
    const { data, error } = await db().from('xp_eventos')
        .select('chave').eq('usuario_id', userId).eq('tipo', 'missao')
        .gte('criado_em', since).order('criado_em', { ascending: false }).limit(500);
    if (error) throw error;
    return new Set((data || []).map((event) => event.chave));
}

export async function missionStatus(userId, { award = false, institutional = false } = {}) {
    const day = localDay();
    const weekStart = startOfLocalWeek();
    const week = weekStart.slice(0, 10);
    const missionHistoryStart = new Date(Date.now() - 120 * DAY_MS).toISOString();
    const [weeklyResult, streakResult, keysResult] = await Promise.allSettled([
        recentResponses(userId, weekStart),
        studyStreak(userId),
        awardedMissionKeys(userId, missionHistoryStart),
    ]);
    const weeklyRows = weeklyResult.status === 'fulfilled' ? weeklyResult.value : [];
    const dailyRows = weeklyRows.filter((row) => localDay(row.respondida_em) === day);
    const streakDays = streakResult.status === 'fulfilled' ? streakResult.value : 0;
    const awardedKeys = keysResult.status === 'fulfilled' ? keysResult.value : new Set();
    const awardsAvailable = keysResult.status === 'fulfilled';
    for (const result of [weeklyResult, streakResult, keysResult]) {
        if (result.status === 'rejected') console.warn('Métrica de missão temporariamente indisponível:', result.reason?.message || result.reason);
    }
    const validDaily = dailyRows.filter((row) => !row.pulada);
    const validWeekly = weeklyRows.filter((row) => !row.pulada);
    const disciplines = new Set(validDaily.map((row) => row.disciplina_id_snapshot).filter(Boolean)).size;
    const weeklyChapters = new Set(validWeekly.map((row) => row.capitulo_id_snapshot).filter(Boolean)).size;
    const sequence = correctStreak(dailyRows);
    const dailyAnswers = validDaily.length;
    const dailyCorrect = validDaily.filter((row) => row.acertou).length;
    const dailyAccuracy = dailyAnswers ? Math.round((dailyCorrect / dailyAnswers) * 100) : 0;
    const newlyAwarded = new Set();

    async function grantMission({ id, key, title, points, details = {} }) {
        if (!award || !awardsAvailable || awardedKeys.has(key)) return false;
        let result;
        try {
            result = await awardXp(userId, key, 'missao', points, { missao: id, dia: day, ...details });
        } catch (error) {
            console.warn(`Prêmio da missão ${id} não pôde ser aplicado:`, error.message);
            return false;
        }
        // Mesmo se uma chamada paralela tiver concedido o prêmio primeiro, a
        // chave única passa a representar uma etapa concluída nesta resposta.
        awardedKeys.add(key);
        if (!result.applied) return false;
        newlyAwarded.add(id);
        try {
            await createNotification({
                usuario_id: userId,
                tipo: 'missao',
                titulo: 'Missão concluída',
                mensagem: `${title}: você ganhou ${points} XP.`,
                acao: 'missoes',
                chave: `notificacao:${key}`,
            });
        } catch (error) {
            // O XP já foi concedido de forma atômica. Uma falha secundária na
            // notificação não pode impedir a abertura do painel de missões.
            console.warn(`Notificação da missão ${id} não pôde ser criada:`, error.message);
        }
        return true;
    }

    const sequencePrefix = `missao:sequencia:${day}:`;
    let sequenceStages = [...awardedKeys].filter((key) => key.startsWith(sequencePrefix)).length;
    let sequenceTarget = sequenceMissionTarget(sequenceStages);
    let sequenceAwardedPoints = 0;
    if (sequence >= sequenceTarget) {
        const points = progressiveMissionReward(25, sequenceStages);
        const applied = await grantMission({
            id: 'sequencia-progressiva', key: `${sequencePrefix}${sequenceTarget}`,
            title: `Sequência certeira ${sequenceTarget}`, points,
            details: { meta: sequenceTarget, sequencia: sequence },
        });
        if (applied) sequenceAwardedPoints = points;
        sequenceStages = [...awardedKeys].filter((key) => key.startsWith(sequencePrefix)).length;
        sequenceTarget = sequenceMissionTarget(sequenceStages);
    }

    const roundTargets = [3, 6, 9, 12, 15, 18];
    const roundPrefix = `missao:ronda:${day}:`;
    let roundStages = [...awardedKeys].filter((key) => key.startsWith(roundPrefix)).length;
    let roundTarget = roundMissionTarget(roundStages);
    let roundAwardedPoints = 0;
    if (roundStages < roundTargets.length && disciplines >= roundTarget) {
        const points = progressiveMissionReward(40, roundStages, roundTargets.length);
        const applied = await grantMission({
            id: 'ronda-progressiva', key: `${roundPrefix}${roundTarget}`,
            title: `Ronda de ${roundTarget} disciplinas`, points,
            details: { meta: roundTarget, disciplinas: disciplines },
        });
        if (applied) roundAwardedPoints = points;
        roundStages = [...awardedKeys].filter((key) => key.startsWith(roundPrefix)).length;
        roundTarget = roundMissionTarget(roundStages);
    }

    const dailyDefinitions = [
        {
            id: 'ritmo-diario', key: `missao:ritmo-20:${day}`, titulo: 'Ritmo diário',
            descricao: 'Responda 20 questões válidas hoje.', atual: Math.min(dailyAnswers, 20), meta: 20,
            unidade: 'questões hoje', pontos: 20, ready: dailyAnswers >= 20,
        },
        {
            id: 'precisao-diaria', key: `missao:precisao-80:${day}`, titulo: 'Precisão diária',
            descricao: 'Mantenha pelo menos 80% de acertos em 10 questões no dia.', atual: Math.min(dailyAccuracy, 80), meta: 80,
            unidade: `% · ${Math.min(dailyAnswers, 10)}/10 questões`, pontos: 30, ready: dailyAnswers >= 10 && dailyAccuracy >= 80,
            progresso: Math.min(100, Math.round(Math.min(dailyAnswers / 10, dailyAccuracy / 80) * 100)),
        },
        {
            id: 'excelencia-diaria', key: `missao:excelencia-90:${day}`, titulo: 'Excelência diária',
            descricao: 'Mantenha pelo menos 90% de acertos em 20 questões no dia.', atual: Math.min(dailyAccuracy, 90), meta: 90,
            unidade: `% · ${Math.min(dailyAnswers, 20)}/20 questões`, pontos: 60, ready: dailyAnswers >= 20 && dailyAccuracy >= 90,
            progresso: Math.min(100, Math.round(Math.min(dailyAnswers / 20, dailyAccuracy / 90) * 100)),
        },
    ];
    for (const mission of dailyDefinitions) {
        if (mission.ready) await grantMission({ id: mission.id, key: mission.key, title: mission.titulo, points: mission.pontos });
    }

    const streakStart = localDay(new Date(Date.now() - Math.max(streakDays - 1, 0) * DAY_MS));
    const weeklyDefinitions = [
        {
            id: 'constancia-7', key: `missao:constancia-7:${streakStart}`, titulo: 'Constância semanal',
            descricao: 'Estude em 7 dias consecutivos. Conta um avanço por dia.', atual: Math.min(streakDays, 7), meta: 7,
            unidade: 'dias seguidos', pontos: 200, ready: streakDays >= 7,
        },
        {
            id: 'centena-semanal', key: `missao:centena-100:${week}`, titulo: 'Centena da semana',
            descricao: 'Responda 100 questões válidas entre segunda e domingo.', atual: Math.min(validWeekly.length, 100), meta: 100,
            unidade: 'questões na semana', pontos: 150, ready: validWeekly.length >= 100,
        },
        {
            id: 'explorador-semanal', key: `missao:explorador-5:${week}`, titulo: 'Explorador semanal',
            descricao: 'Estude 5 capítulos diferentes durante a semana.', atual: Math.min(weeklyChapters, 5), meta: 5,
            unidade: 'capítulos na semana', pontos: 100, ready: weeklyChapters >= 5,
        },
    ];
    for (const mission of weeklyDefinitions) {
        if (mission.ready) await grantMission({ id: mission.id, key: mission.key, title: mission.titulo, points: mission.pontos });
    }

    const missions = [
        {
            id: 'sequencia-progressiva', grupo: 'Diárias', titulo: 'Sequência certeira',
            descricao: `Próxima etapa: ${sequenceTarget} acertos seguidos. Um erro reinicia somente a sequência atual.`,
            atual: Math.min(sequence, sequenceTarget), meta: sequenceTarget, unidade: 'acertos seguidos',
            pontos: progressiveMissionReward(25, sequenceStages), pontos_premiados: sequenceAwardedPoints,
            concluida: false, premiada: newlyAwarded.has('sequencia-progressiva'), etapas_concluidas: sequenceStages,
        },
        {
            id: 'ronda-progressiva', grupo: 'Diárias', titulo: 'Ronda de disciplinas',
            descricao: roundStages >= roundTargets.length
                ? 'Todas as 6 etapas de hoje foram concluídas. A missão volta para 3 amanhã.'
                : `Próxima etapa: estudar ${roundTarget} disciplinas diferentes hoje.`,
            atual: Math.min(disciplines, roundTarget), meta: roundTarget, unidade: 'disciplinas hoje',
            pontos: progressiveMissionReward(40, roundStages, roundTargets.length), pontos_premiados: roundAwardedPoints,
            concluida: roundStages >= roundTargets.length, premiada: newlyAwarded.has('ronda-progressiva'), etapas_concluidas: roundStages,
        },
        ...dailyDefinitions.map(({ key, ready, ...mission }) => ({
            ...mission, grupo: 'Diárias', concluida: awardedKeys.has(key), premiada: newlyAwarded.has(mission.id),
        })),
        ...weeklyDefinitions.map(({ key, ready, ...mission }) => ({
            ...mission, grupo: 'Semanais', concluida: awardedKeys.has(key), premiada: newlyAwarded.has(mission.id),
        })),
    ];

    let { data: user, error } = await db().from('usuarios').select('xp_total,xp_bonus_plano').eq('id', userId).single();
    if (error?.code === '42703') {
        const fallback = await db().from('usuarios').select('xp_total').eq('id', userId).single();
        user = fallback.data;
        error = fallback.error;
    }
    if (error) {
        console.warn('Resumo de XP temporariamente indisponível:', error.message);
        user = { xp_total: 0, xp_bonus_plano: 0 };
    }
    const patent = patentStatus(user?.xp_total || 0);
    return {
        xp_total: Number(user?.xp_total || 0),
        xp_bonus_plano: Number(user?.xp_bonus_plano || 0),
        patente: patent,
        missoes: missions,
        modo_institucional: Boolean(institutional),
        concluidas_no_ciclo: dailyDefinitions.filter((item) => awardedKeys.has(item.key)).length
            + weeklyDefinitions.filter((item) => awardedKeys.has(item.key)).length + sequenceStages + roundStages,
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
            + missions.missoes.filter((item) => item.premiada)
                .reduce((sum, item) => sum + Number(item.pontos_premiados ?? item.pontos), 0),
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
