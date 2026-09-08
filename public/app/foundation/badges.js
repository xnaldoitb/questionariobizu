/**
 * Insígnias visuais de conta.
 *
 * Regras:
 * - Desenvolvedor: usa somente a insígnia exclusiva de Desenvolvedor.
 * - Administrador: usa somente ADM; o acesso vitalício é inerente ao perfil.
 * - Aluno VIP: VIP.
 * - Aluno Plus: plano trimestral ainda ativo.
 * - Aluno Premium: plano mensal pago ainda ativo.
 * - Testes gratuitos e acessos vencidos não recebem insígnia de plano.
 */
export function accountBadges(entry = {}) {
    const profile = String(entry?.perfil || 'aluno').toLowerCase();
    const vip = Boolean(entry?.vip);
    const premium = Boolean(entry?.premium);
    const plus = premium && String(entry?.plano_atual || '').toLowerCase() === 'trimestral';

    if (profile === 'supremo') {
        return '<span class="account-insignia supreme-insignia" title="Desenvolvedor" aria-label="Desenvolvedor">♛ DEV</span>';
    }

    if (profile === 'admin') {
        return '<span class="account-insignia admin-insignia" title="Administrador · Oficial de Instrução" aria-label="Administrador">◆ ADM</span>';
    }

    const badges = [];

    if (vip) {
        badges.push('<span class="account-insignia vip-insignia" title="Usuário VIP · acesso vitalício" aria-label="VIP">✦ VIP</span>');
    } else if (plus) {
        badges.push('<span class="account-insignia plus-insignia" title="Usuário Plus · plano trimestral" aria-label="Plus">✚ PLUS</span>');
    } else if (premium) {
        badges.push('<span class="account-insignia premium-insignia" title="Usuário Premium · plano mensal" aria-label="Premium">◇ PREMIUM</span>');
    }

    return badges.join(' ');
}

export function roleConnectedLabel(profile) {
    if (profile === 'supremo') return 'Desenvolvedor conectado';
    if (profile === 'admin') return 'Administrador conectado';
    return 'Aluno conectado';
}
