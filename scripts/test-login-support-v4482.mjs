import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [view, identity, css] = await Promise.all([
    readFile(new URL('../public/views/auth.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/identity.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/styles/13-visual-refinement.css', import.meta.url), 'utf8'),
]);

for (const id of ['recoverPasswordWhatsapp', 'loginSupportWhatsapp']) {
    assert(view.includes(`id="${id}"`));
}
assert.equal((view.match(/wa\.me\/5593992048088/g) || []).length, 2);
assert(view.includes('Nunca envie sua senha atual'));
assert(view.includes('rel="noopener noreferrer"'));
assert(identity.includes("const SUPPORT_WHATSAPP = '5593992048088'"));
assert(identity.includes("whatsappHelpUrl('password')"));
assert(identity.includes("whatsappHelpUrl('support')"));
assert(identity.includes("String(one('#loginUser')?.value || '').replace(/\\D/g, '')"));
assert(!identity.match(/whatsappHelpUrl[\s\S]{0,700}loginPass/));
assert(css.includes('.login-help-actions'));
assert(css.includes('.login-help-note'));

console.log('Login v4.48.2: recuperação de senha e suporte seguro pelo WhatsApp validados.');
