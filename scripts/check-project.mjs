import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
    'public/index.html',
    'public/components/auth.html',
    'public/components/topbar.html',
    'public/components/dashboard.html',
    'public/components/quiz.html',
    'public/components/admin.html',
    'public/js/app.js',
    'api/[...route].js',
    'supabase/schema.sql'
];

for (const file of requiredFiles) {
    await access(file);
}

const index = await readFile('public/index.html', 'utf8');
if (!index.includes('id="appRoot"')) {
    throw new Error('O ponto de montagem #appRoot não foi encontrado.');
}

console.log('Estrutura do projeto validada com sucesso.');
