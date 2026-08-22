/**
 * Insígnias visuais de conta.
 *
 * Regras:
 * - ADM Supremo: usa somente a insígnia exclusiva de Supremo.
 * - Administrador: recebe a insígnia ADM e, como identificação de plano,
 *   também VIP quando marcado VIP ou Premium quando não VIP.
 * - Aluno VIP: VIP.
 * - Aluno não VIP: Premium (apenas visual, sem qualquer privilégio extra).
 */
export function accountBadges(entry = {}) {
    const profile = String(entry?.perfil || 'aluno').toLowerCase();
    const vip = Boolean(entry?.vip);

    if (profile === 'supremo') {
        return '<span class="account-insignia supreme-insignia" title="ADM Supremo" aria-label="ADM Supremo">♛ SUPREMO</span>';
    }

    const badges = [];

    if (profile === 'admin') {
        badges.push('<span class="account-insignia admin-insignia" title="Administrador" aria-label="Administrador">◆ ADM</span>');
    }

    if (vip) {
        badges.push('<span class="account-insignia vip-insignia" title="Usuário VIP · acesso vitalício" aria-label="VIP">✦ VIP</span>');
    } else {
        badges.push('<span class="account-insignia premium-insignia" title="Insígnia Premium · identificação visual, sem privilégios adicionais" aria-label="Premium">◇ PREMIUM</span>');
    }

    return badges.join(' ');
}

export function roleConnectedLabel(profile) {
    if (profile === 'supremo') return 'ADM Supremo conectado';
    if (profile === 'admin') return 'Administrador conectado';
    return 'Aluno conectado';
}
