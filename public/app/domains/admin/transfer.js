import { requestJson } from '../../foundation/request.js';
import { IMPORT_BODY_LIMIT } from '../../foundation/import-limits.js';
import { one, safeText, notify } from '../../foundation/selectors.js';
import { refreshCatalog } from '../catalog.js';
import { refreshAdminCatalog } from './content.js';

let analyzedImports = [];
let spreadsheetLibraryPromise = null;

function ensureSpreadsheetLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (spreadsheetLibraryPromise) return spreadsheetLibraryPromise;

    spreadsheetLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = () => window.XLSX
            ? resolve(window.XLSX)
            : reject(new Error('A biblioteca de Excel retornou uma resposta inválida.'));
        script.onerror = () => reject(new Error('Não foi possível carregar o recurso de Excel. Verifique a conexão e tente novamente.'));
        document.head.appendChild(script);
    }).catch((error) => {
        spreadsheetLibraryPromise = null;
        throw error;
    });

    return spreadsheetLibraryPromise;
}

function normalizeHeader(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function slug(value) {
    return normalizeHeader(value).replace(/_/g, '-') || 'disciplina';
}

function text(value) {
    return String(value ?? '').trim();
}

function truthy(value) {
    return !['nao', 'não', 'false', '0', 'inativo'].includes(text(value).toLowerCase());
}

function answerIndex(value, type) {
    const normalized = text(value).toUpperCase();
    if (type === 'certo_errado') {
        if (['C', 'CERTO', 'V', 'VERDADEIRO', '0'].includes(normalized)) return 0;
        if (['E', 'ERRADO', 'F', 'FALSO', '1'].includes(normalized)) return 1;
    }
    if (['A', 'B', 'C', 'D', 'E'].includes(normalized)) return 'ABCDE'.indexOf(normalized);
    const number = Number(normalized);
    return Number.isInteger(number) && number >= 0 && number <= 4 ? number : -1;
}

function questionType(value, row) {
    const normalized = normalizeHeader(value);
    if (normalized.includes('certo') || normalized.includes('errado') || normalized === 'ce' || normalized === 'c_e') {
        return 'certo_errado';
    }
    if (!text(row.alternativa_c) && !text(row.c) && text(row.alternativa_a || row.a).toLowerCase() === 'certo') {
        return 'certo_errado';
    }
    return 'multipla_escolha';
}

function rowsToImports(rows) {
    if (!rows.length) throw new Error('A planilha não possui linhas de dados.');

    const normalizedRows = rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
    ));
    const groups = new Map();
    const errors = [];

    normalizedRows.forEach((row, index) => {
        const line = index + 2;
        const name = text(row.disciplina || row.nome_disciplina);
        const chapter = text(row.capitulo || row.titulo_capitulo);
        const statement = text(row.enunciado || row.questao);

        if (!name || !chapter || !statement) {
            errors.push(`Linha ${line}: disciplina, capítulo e enunciado são obrigatórios.`);
            return;
        }

        const id = text(row.codigo_disciplina || row.id_disciplina) || slug(name);
        const type = questionType(row.tipo || row.tipo_questao, row);
        let alternatives;

        if (type === 'certo_errado') {
            alternatives = ['Certo', 'Errado'];
        } else {
            const raw = [
                row.alternativa_a ?? row.a,
                row.alternativa_b ?? row.b,
                row.alternativa_c ?? row.c,
                row.alternativa_d ?? row.d,
                row.alternativa_e ?? row.e,
            ].map(text);

            if (raw.slice(0, 4).some((item) => !item)) {
                errors.push(`Linha ${line}: em múltipla escolha, preencha pelo menos as alternativas A, B, C e D.`);
                return;
            }

            alternatives = raw.slice(0, 4);
            if (raw[4]) alternatives.push(raw[4]);
        }

        const correct = answerIndex(row.gabarito || row.resposta_correta, type);
        if (correct < 0 || correct >= alternatives.length) {
            errors.push(`Linha ${line}: gabarito inválido.`);
            return;
        }

        if (!groups.has(id)) {
            groups.set(id, {
                disciplina: {
                    id,
                    nome: name,
                    descricao: text(row.descricao_disciplina) || null,
                    ordem: Number(row.ordem_disciplina) || 0,
                    ativo: true,
                },
                chapters: new Map(),
                questions: [],
            });
        }

        const group = groups.get(id);
        const chapterOrder = Number(row.ordem_capitulo) || group.chapters.size + 1;
        const chapterKey = normalizeHeader(chapter);

        if (!group.chapters.has(chapterKey)) {
            group.chapters.set(chapterKey, {
                id: chapterKey,
                disciplina_id: id,
                indice: chapterOrder,
                nome: chapter,
                ativo: true,
            });
        }

        const chapterData = group.chapters.get(chapterKey);
        group.questions.push({
            capitulo_id: chapterData.id,
            capitulo_indice: chapterData.indice,
            tipo: type,
            enunciado: statement,
            alternativas: alternatives,
            resposta_correta: correct,
            resolucao: text(row.resolucao) || 'Sem resolução comentada.',
            dificuldade: ['facil', 'media', 'dificil'].includes(normalizeHeader(row.dificuldade))
                ? normalizeHeader(row.dificuldade)
                : 'media',
            fonte: text(row.fonte) || null,
            ativo: truthy(row.ativo),
        });
    });

    const imports = [...groups.values()].map((group) => ({
        versao: 2,
        disciplina: group.disciplina,
        capitulos: [...group.chapters.values()],
        questoes: group.questions,
    }));

    return { imports, errors };
}

async function parseSpreadsheet(file) {
    await ensureSpreadsheetLibrary();
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    return rowsToImports(rows);
}

async function analyzeImportFile() {
    const file = one('#importFile')?.files?.[0];
    const status = one('#importStatus');
    const preview = one('#importPreview');

    analyzedImports = [];
    one('#importBtn').disabled = true;
    preview.classList.add('hidden');

    if (!file) {
        notify('Selecione um arquivo.');
        return;
    }

    try {
        status.textContent = 'Lendo e validando o arquivo...';
        let result;

        if (file.name.toLowerCase().endsWith('.json')) {
            const content = JSON.parse(await file.text());
            const packages = Array.isArray(content.disciplinas) ? content.disciplinas : [content];
            result = { imports: packages, errors: [] };
        } else {
            result = await parseSpreadsheet(file);
        }

        if (!result.imports.length) throw new Error('Nenhuma disciplina válida foi encontrada.');
        if (result.imports.some((item) => !item?.disciplina || !Array.isArray(item?.capitulos) || !Array.isArray(item?.questoes))) {
            throw new Error('O JSON não está no formato de importação do Questionário Bizu.');
        }

        analyzedImports = result.imports;
        const totalChapters = analyzedImports.reduce((sum, item) => sum + item.capitulos.length, 0);
        const totalQuestions = analyzedImports.reduce((sum, item) => sum + item.questoes.length, 0);

        preview.innerHTML = `
            <div class="import-summary">
                <strong>${analyzedImports.length}</strong><span>disciplinas</span>
                <strong>${totalChapters}</strong><span>capítulos</span>
                <strong>${totalQuestions}</strong><span>questões válidas</span>
                <strong>${result.errors.length}</strong><span>erros</span>
            </div>
            ${result.errors.length ? `<details><summary>Ver erros encontrados</summary><ul>${result.errors.slice(0, 100).map((error) => `<li>${safeText(error)}</li>`).join('')}</ul></details>` : ''}
            <div class="import-disciplines">
                ${analyzedImports.map((item) => `<div><strong>${safeText(item.disciplina.nome)}</strong><span>${item.capitulos.length} capítulos · ${item.questoes.length} questões</span></div>`).join('')}
            </div>
        `;
        preview.classList.remove('hidden');
        status.textContent = 'Análise concluída. Revise o resumo e confirme a importação.';
        one('#importBtn').disabled = false;
    } catch (error) {
        status.textContent = `Erro: ${error.message}`;
        notify(error.message, 4200);
    }
}

async function confirmImport() {
    if (!analyzedImports.length) {
        notify('Analise um arquivo antes de importar.');
        return;
    }
    // Valida todas as disciplinas antes de enviar a primeira, inclusive no modo replace.
    const oversized = analyzedImports.find((item) => new TextEncoder().encode(
        JSON.stringify({ modo: one('#importMode').value, arquivo: item }),
    ).byteLength > IMPORT_BODY_LIMIT);
    if (oversized) {
        const message = `A disciplina "${oversized.disciplina.nome}" ultrapassa 4 MiB de dados. Divida o conteúdo em disciplinas menores. Nenhuma disciplina foi importada.`;
        one('#importStatus').textContent = message;
        notify(message, 6500);
        return;
    }
    const replaceMode = one('#importMode').value === 'replace';
    const confirmation = replaceMode
        ? `SUBSTITUIR ${analyzedImports.length} disciplina(s)? As questões e capítulos anteriores serão DELETADOS do banco. O histórico e o ranking já registrados serão preservados.`
        : `Importar ${analyzedImports.length} disciplina(s) para o banco?`;
    if (!confirm(confirmation)) return;

    const button = one('#importBtn');
    const status = one('#importStatus');
    button.disabled = true;

    try {
        let questions = 0;
        let chapters = 0;
        for (let index = 0; index < analyzedImports.length; index += 1) {
            const item = analyzedImports[index];
            status.textContent = `Importando ${index + 1} de ${analyzedImports.length}: ${item.disciplina.nome}...`;
            const response = await requestJson('admin-import', {
                method: 'POST',
                body: JSON.stringify({ modo: one('#importMode').value, arquivo: item }),
            });
            questions += response.questoes;
            chapters += response.capitulos;
        }

        status.textContent = `Importação concluída: ${analyzedImports.length} disciplinas, ${chapters} capítulos e ${questions} questões.`;
        analyzedImports = [];
        one('#importFile').value = '';
        one('#importPreview').classList.add('hidden');
        await Promise.all([refreshCatalog(), refreshAdminCatalog({ quiet: true })]);
        notify('Importação concluída.');
    } catch (error) {
        status.textContent = `Erro: ${error.message}`;
        notify(error.message, 4200);
    } finally {
        button.disabled = analyzedImports.length === 0;
    }
}

function downloadJsonExport(id) {
    if (!id) return notify('Selecione uma disciplina.');
    const link = document.createElement('a');
    link.href = `/api/admin-export?disciplina=${encodeURIComponent(id)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

async function downloadExcelExport(id) {
    if (!id) return notify('Selecione uma disciplina.');

    try {
        await ensureSpreadsheetLibrary();
        const response = await fetch(`/api/admin-export?disciplina=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || 'Falha na exportação.');

        const chapterById = new Map(data.capitulos.map((chapter) => [chapter.id, chapter]));
        const rows = data.questoes.map((question) => {
            const chapter = chapterById.get(question.capitulo_id);
            return {
                Disciplina: data.disciplina.nome,
                'Código Disciplina': data.disciplina.id,
                'Descrição Disciplina': data.disciplina.descricao || '',
                'Ordem Disciplina': data.disciplina.ordem || 0,
                Capítulo: chapter?.nome || '',
                'Ordem Capítulo': chapter?.indice || 0,
                Tipo: question.tipo === 'certo_errado' ? 'Certo ou Errado' : 'Múltipla Escolha',
                Enunciado: question.enunciado,
                'Alternativa A': question.alternativas?.[0] || '',
                'Alternativa B': question.alternativas?.[1] || '',
                'Alternativa C': question.alternativas?.[2] || '',
                'Alternativa D': question.alternativas?.[3] || '',
                'Alternativa E': question.alternativas?.[4] || '',
                Gabarito: question.tipo === 'certo_errado'
                    ? (question.resposta_correta === 0 ? 'Certo' : 'Errado')
                    : 'ABCDE'[question.resposta_correta],
                Resolução: question.resolucao,
                Fonte: question.fonte || '',
                Dificuldade: question.dificuldade,
                Ativo: question.ativo ? 'Sim' : 'Não',
            };
        });

        const workbook = window.XLSX.utils.book_new();
        const sheet = window.XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = [24, 20, 28, 14, 30, 14, 20, 60, 34, 34, 34, 34, 34, 12, 65, 28, 14, 10].map((wch) => ({ wch }));
        window.XLSX.utils.book_append_sheet(workbook, sheet, 'Questoes');
        window.XLSX.writeFile(workbook, `${id}-completo.xlsx`);
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function downloadGeneralBackup() {
    const button = one('#backupContentBtn');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Gerando backup...';

    try {
        const response = await fetch('/api/admin-backup', { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || 'Não foi possível gerar o backup.');

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `questionario-bizu-backup-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        notify('Backup geral gerado.');
    } catch (error) {
        notify(error.message, 4200);
    } finally {
        button.disabled = false;
        button.textContent = original;
    }
}

export function bindTransferManagement() {
    one('#exportBtn')?.addEventListener('click', () => downloadJsonExport(one('#exportSubject').value));
    one('#exportExcelBtn')?.addEventListener('click', () => downloadExcelExport(one('#exportSubject').value));
    one('#analyzeImportBtn')?.addEventListener('click', analyzeImportFile);
    one('#importBtn')?.addEventListener('click', confirmImport);
    one('#backupContentBtn')?.addEventListener('click', downloadGeneralBackup);
}
