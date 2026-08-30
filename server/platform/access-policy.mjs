export function resolveQuestionAccess(record, nowMs = Date.now()) {
    if (!record) return { permitido: false, codigo: 'NAO_AUTENTICADO', tipo: 'indisponivel', mensagem: 'Não autenticado.' };
    if (record.perfil === 'supremo' || record.vip) return { permitido: true, codigo: 'ACESSO_VITALICIO', tipo: 'vitalicio', mensagem: 'Acesso vitalício.' };
    if (Date.parse(record.validade_ate || '') > nowMs) return { permitido: true, codigo: 'ACESSO_ATIVO', tipo: 'regular', validade_ate: record.validade_ate, mensagem: 'Acesso Premium ativo.' };
    const cycle = Date.parse(record.teste_ciclo_em || '');
    const next = Number.isFinite(cycle) ? cycle + 8 * 60 * 60 * 1000 : null;
    const lease = Math.max(0, Date.parse(record.teste_ativo_ate || '') - nowMs) || 0;
    const remaining = Math.max(0, Number(record.teste_saldo_segundos || 0) * 1000) + lease;
    const available = !next || nowMs >= next;
    const base = { restante_ms: remaining, teste_ativo_ate: record.teste_ativo_ate || null, teste_proximo_em: next ? new Date(next).toISOString() : null };
    if (lease > 0) return { ...base, permitido: true, codigo: 'TESTE_ATIVO', tipo: 'teste', mensagem: 'Teste de 30 minutos de uso ativo. Novo ciclo a cada 8 horas.' };
    if (remaining > 0 || available) return { ...base, restante_ms: available ? 1800000 : remaining, permitido: false, codigo: 'TESTE_PAUSADO', tipo: 'teste', mensagem: 'Teste disponível. Retome a atividade para iniciar ou continuar.' };
    return { ...base, permitido: false, codigo: record.validade_ate ? 'ACESSO_VENCIDO' : 'TESTE_EXPIRADO', tipo: 'teste_expirado', mensagem: 'Teste encerrado. Aguarde o próximo ciclo de 8 horas ou escolha um plano.' };
}
