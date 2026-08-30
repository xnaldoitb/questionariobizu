/**
 * Insígnias visuais de conta.
 *
 * Regras:
 * - Desenvolvedor: usa somente a insígnia exclusiva de Desenvolvedor.
 * - Administrador: recebe a insígnia ADM e também a identificação do plano, quando houver.
 * - Aluno VIP: VIP.
 * - Aluno Premium: plano pago com prazo ainda ativo.
 * - Testes gratuitos e acessos vencidos não recebem insígnia de plano.
 */
export function accountBadges(entry = {}) {
    const profile = String(entry?.perfil || 'aluno').toLowerCase();
    const vip = Boolean(entry?.vip);
    const premium = Boolean(entry?.premium);

    if (profile === 'supremo') {
        return '<span class="account-insignia supreme-insignia" title="Desenvolvedor" aria-label="Desenvolvedor">♛ DESENVOLVEDOR</span>';
    }

    const badges = [];

    if (profile === 'admin') {
        badges.push('<span class="account-insignia admin-insignia" title="Administrador" aria-label="Administrador">◆ ADM</span>');
    }

    if (vip) {
        badges.push('<span class="account-insignia vip-insignia" title="Usuário VIP · acesso vitalício" aria-label="VIP">✦ VIP</span>');
    } else if (premium) {
        badges.push('<span class="account-insignia premium-insignia" title="Insígnia Premium · identificação visual, sem privilégios adicionais" aria-label="Premium">◇ PREMIUM</span>');
    }

    return badges.join(' ');
}

export function roleConnectedLabel(profile) {
    if (profile === 'supremo') return 'Desenvolvedor conectado';
    if (profile === 'admin') return 'Administrador conectado';
    return 'Aluno conectado';
}
