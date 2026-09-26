import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile('public/views/dashboard.html', 'utf8');
const adminView = await readFile('public/views/admin.html', 'utf8');
const client = await readFile('public/app/domains/summaries.js', 'utf8');
const adminClient = await readFile('public/app/domains/admin/summaries.js', 'utf8');
const management = await readFile('public/app/domains/management.js', 'utf8');
const publicRoute = await readFile('server/routes/resumos.mjs', 'utf8');
const adminRoute = await readFile('server/routes/admin-resumos.mjs', 'utf8');
const fileRoute = await readFile('server/routes/resumo-arquivo.mjs', 'utf8');
const router = await readFile('api/[...route].js', 'utf8');
const migration = await readFile('supabase/migration-v4.54-resumos-pdf.sql', 'utf8');
const styles = await readFile('public/styles/17-summaries.css', 'utf8');

assert(dashboard.indexOf('summaries-dashboard-section') < dashboard.indexOf('hymns-dashboard-section'));
assert(dashboard.includes('id="summaryPicker"') && dashboard.includes('id="summaryModal"'));
assert(dashboard.includes('id="summaryAccessModal"') && dashboard.includes('id="summaryAccessPlans"'));
assert(client.includes("fetch('/api/resumos'") && client.includes('/api/resumo-arquivo?slug=') && client.includes('target="_blank"'));
assert(client.includes('if (error.status === 403) showAccessNotice()') && client.includes("one('#accountPlansBtn')?.click()"));
assert(adminView.includes('data-admin="summariesPanel"') && adminView.includes('id="adminSummaryForm"'));
assert(adminView.includes('id="adminSummaryFile"') && adminView.includes('accept="application/pdf,.pdf"'));
assert(!adminView.includes('adminSummaryFileUrl'), 'Não deve existir campo para endereço público permanente.');
assert(management.includes("'summariesPanel'") && management.includes('bindSummaryManagement'));
assert(adminClient.includes('preparar-pdf') && adminClient.includes('finalizar-pdf') && adminClient.includes("method: 'DELETE'") && adminClient.includes("method: 'PUT'"));
assert(adminRoute.includes("requireUser(event, 'supremo')") && adminRoute.includes('createSignedUploadUrl'));
assert(adminRoute.includes('PDFDocument.load') && adminRoute.includes('QUESTIONARIO BIZU - MATERIAL EXCLUSIVO PARA ASSINANTES'));
assert(adminRoute.includes('30 * 1024 * 1024') && publicRoute.includes(".eq('ativo', true)"));
assert(publicRoute.includes('ACESSO_ATIVO') && publicRoute.includes('ACESSO_VITALICIO'));
assert(fileRoute.includes('requireUser(event)') && fileRoute.includes('PAID_ACCESS') && fileRoute.includes("cache-control', 'private, no-store"));
assert(fileRoute.includes("db().storage.from(BUCKET).download(path)") && !fileRoute.includes('createSignedUrl'));
assert(router.includes("['resumos'") && router.includes("['resumo-arquivo'") && router.includes("['admin-resumos'"));
assert(migration.includes('create table if not exists public.resumos') && migration.includes("'resumos-pdf'") && migration.includes("false, 31457280"));
assert(styles.includes('margin-top: 12px') && styles.includes('#dashboard > .study-panel { margin-top: 8px; }'));
assert(styles.includes('.summary-access-modal') && styles.includes('width: min(92vw, 390px)'));

console.log('Resumos v4.54: seletor, PDFs, administração e espaçamento compacto verificados.');
