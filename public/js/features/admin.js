import { api } from '../core/api.js';
import { $, $$, escapeHtml, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { fillSubjectSelects, loadCatalog } from './catalog.js';

let analyzedImports = [];

export function configureAdminAccess() {
    const isSupreme = state.user?.perfil === 'supremo';
    const isManager = ['admin', 'supremo'].includes(state.user?.perfil);

    $('#navAdmin')?.classList.toggle('hidden', !isManager);
    $('[data-admin="catalogPanel"]')?.classList.toggle('hidden', !isSupreme);
    $('[data-admin="questionsPanel"]')?.classList.toggle('hidden', !isSupreme);

    if (!isSupreme) {
        $('#catalogPanel')?.classList.add('hidden');
        $('#questionsPanel')?.classList.add('hidden');
        $('[data-admin="usersPanel"]')?.classList.add('active');
        $('#usersPanel')?.classList.remove('hidden');
    }

    const roleSelect = $('#newUserRole');
    if (roleSelect) {
        roleSelect.innerHTML = isSupreme
            ? '<option value="aluno">Aluno</option><option value="admin">Administrador</option>'
            : '<option value="aluno">Aluno</option>';
    }

    const adminIntro = $('#adminPermissionInfo');
    if (adminIntro) {
        adminIntro.textContent = isSupreme
            ? 'ADM Supremo: controle total de usuários e conteúdo.'
            : 'Administrador: pode aprovar, negar, criar e apagar somente alunos comuns.';
    }
}

export function bindAdminEvents() {
    $$('.admin-tab').forEach((button) => button.addEventListener('click', () => changeAdminTab(button)));
    $('#refreshUsers').addEventListener('click', loadUsers);
    $('#userForm').addEventListener('submit', createUser);
    $('#disciplineForm').addEventListener('submit', createDiscipline);
    $('#chapterForm').addEventListener('submit', createChapter);
    $('#questionForm').addEventListener('submit', createQuestion);
    $('#questionType').addEventListener('change', renderAlternativeFields);
    $('#exportBtn').addEventListener('click', () => downloadExport($('#exportSubject').value));
    $('#exportExcelBtn').addEventListener('click', () => downloadExcelExport($('#exportSubject').value));
    $('#analyzeImportBtn').addEventListener('click', analyzeImportFile);
    $('#importBtn').addEventListener('click', confirmImport);
    $('#deleteAllDisciplinesBtn')?.addEventListener('click', deleteAllDisciplines);
    renderAlternativeFields();
}

function changeAdminTab(button) {
    if (state.user?.perfil !== 'supremo' && button.dataset.admin !== 'usersPanel') {
        toast('Somente o ADM Supremo pode gerenciar disciplinas e questões.');
        return;
    }

    $$('.admin-tab').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    ['usersPanel', 'catalogPanel', 'questionsPanel'].forEach((id) =>
        $(`#${id}`).classList.toggle('hidden', id !== button.dataset.admin)
    );
    if (button.dataset.admin === 'usersPanel') loadUsers();
}

export async function loadUsers() {
    if (!['admin', 'supremo'].includes(state.user?.perfil)) return;

    try {
        const users = (await api('admin-users')).usuarios;
        const isSupreme = state.user?.perfil === 'supremo';

        $('#usersList').innerHTML = users.map((user) => {
            const isSupremeAccount = user.perfil === 'supremo';
            const isAdmin = user.perfil === 'admin';
            const isStudent = user.perfil === 'aluno';
            const pending = user.status_aprovacao === 'pendente';
            const denied = user.status_aprovacao === 'negado';

            const statusLabel = pending
                ? 'aguardando aprovação'
                : denied
                    ? 'negado'
                    : user.ativo ? 'ativo' : 'desativado';

            const roleLabel = isSupremeAccount
                ? 'ADM Supremo'
                : isAdmin ? 'Administrador' : 'Aluno';

            const approvalActions = isStudent && (pending || denied)
                ? `
                    <button class="btn primary mini" data-user-action="approve" data-user-id="${user.id}">Aprovar</button>
                    <button class="btn ghost mini danger" data-user-action="deny" data-user-id="${user.id}">Negar</button>
                `
                : '';

            let managementActions = '';

            if (isSupremeAccount) {
                managementActions = '<span class="admin-protected-badge">ADM Supremo · protegido</span>';
            } else if (isAdmin) {
                managementActions = isSupreme
                    ? `
                        <button class="btn ghost mini" data-user-action="demote_admin" data-user-id="${user.id}">Tornar aluno</button>
                        <button class="btn ghost mini danger" data-delete-user="${user.id}">Apagar administrador</button>
                    `
                    : '<span class="admin-protected-badge">Conta administrativa protegida</span>';
            } else {
                managementActions = `
                    ${isSupreme ? `<button class="btn ghost mini" data-user-action="promote_admin" data-user-id="${user.id}">Tornar administrador</button>` : ''}
                    ${isSupreme ? `<button class="btn ghost mini" data-reset-history="${user.id}">Resetar histórico</button>` : ''}
                    ${isSupreme ? `<button class="btn ghost mini" data-reset-ranking="${user.id}">Resetar ranking</button>` : ''}
                    <button class="btn ghost mini danger" data-delete-user="${user.id}">Apagar</button>
                `;
            }

            return `
                <article class="admin-user-card ${isAdmin || isSupremeAccount ? 'is-admin' : ''} ${pending ? 'is-pending' : ''}">
                    <div class="admin-user-avatar">${initials(user.nome)}</div>
                    <div class="admin-user-copy">
                        <strong>${escapeHtml(user.nome)}</strong>
                        <span>AL SD PM Nº: ${escapeHtml(user.usuario)}</span>
                        <small>${roleLabel} · ${statusLabel}</small>
                    </div>
                    <div class="admin-user-actions">
                        ${approvalActions}
                        ${managementActions}
                    </div>
                </article>
            `;
        }).join('');

        $$('[data-user-action]').forEach((button) => button.addEventListener('click', () =>
            userAction(button.dataset.userId, button.dataset.userAction)
        ));
        $$('[data-delete-user]').forEach((button) =>
            button.addEventListener('click', () => deleteUser(button.dataset.deleteUser))
        );
        $$('[data-reset-history]').forEach((button) =>
            button.addEventListener('click', () => resetUserResults(button.dataset.resetHistory, 'reset_history', 'histórico'))
        );
        $$('[data-reset-ranking]').forEach((button) =>
            button.addEventListener('click', () => resetUserResults(button.dataset.resetRanking, 'reset_ranking', 'ranking'))
        );
    } catch (error) {
        toast(error.message);
    }
}

function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'AL';
}

async function userAction(id, action) {
    const labels = {
        approve: 'Aprovar este cadastro?',
        deny: 'Negar este cadastro?',
        promote_admin: 'Tornar este aluno administrador? Ele poderá gerenciar apenas contas de alunos.',
        demote_admin: 'Remover os privilégios administrativos desta conta?',
    };

    if (labels[action] && !confirm(labels[action])) return;

    try {
        await api('admin-users', {
            method: 'PUT',
            body: JSON.stringify({ id, action }),
        });
        toast(action === 'approve' ? 'Cadastro aprovado.' : action === 'deny' ? 'Cadastro negado.' : 'Permissão atualizada.');
        await loadUsers();
    } catch (error) {
        toast(error.message);
    }
}

async function resetUserResults(id, action, label) {
    if (!confirm(`Resetar o ${label} deste usuário?`)) return;
    try {
        await api('admin-users', {
            method: 'PUT',
            body: JSON.stringify({ id, action })
        });
        toast(`${label[0].toUpperCase()}${label.slice(1)} resetado.`);
        loadUsers();
    } catch (error) {
        toast(error.message);
    }
}

async function createUser(event) {
    event.preventDefault();
    try {
        await api('admin-users', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(new FormData(event.target))),
        });
        event.target.reset();
        configureAdminAccess();
        toast('Usuário cadastrado e aprovado.');
        loadUsers();
    } catch (error) {
        toast(error.message);
    }
}

async function deleteUser(id) {
    if (!confirm('Apagar esta conta e todo o histórico dela? Esta ação é definitiva.')) return;
    try {
        await api(`admin-users?id=${id}`, { method: 'DELETE' });
        toast('Conta apagada.');
        loadUsers();
    } catch (error) {
        toast(error.message);
    }
}

async function createDiscipline(event) { event.preventDefault(); try { await api('admin-catalogo',{method:'POST',body:JSON.stringify({tipo:'disciplina',...Object.fromEntries(new FormData(event.target))})}); event.target.reset(); await loadCatalog(); toast('Disciplina adicionada.'); } catch(error){toast(error.message);} }
async function createChapter(event) { event.preventDefault(); try { await api('admin-catalogo',{method:'POST',body:JSON.stringify({tipo:'capitulo',...Object.fromEntries(new FormData(event.target))})}); event.target.reset(); await loadCatalog(); toast('Capítulo adicionado.'); } catch(error){toast(error.message);} }

export function renderCatalogAdmin() {
    const container = $('#catalogAdminList');
    if (!container) return;

    container.innerHTML = state.catalog.disciplinas.map((discipline) => `
        <div class="catalog-group">
            <div class="panel-head">
                <div class="catalog-discipline-title">
                    <strong>${escapeHtml(discipline.nome)}</strong>
                    <small>${escapeHtml(discipline.id)}</small>
                </div>
                <div class="data-actions">
                    <button class="btn ghost mini" data-export="${discipline.id}">Exportar</button>
                    <button class="btn ghost mini danger" data-delete-discipline="${discipline.id}">Desativar</button>
                    <button
                        class="btn danger-fill mini"
                        data-purge-discipline="${discipline.id}"
                        data-discipline-name="${escapeHtml(discipline.nome)}"
                        type="button"
                    >
                        Excluir completa
                    </button>
                </div>
            </div>
            <div class="catalog-chapters">${renderChapters(discipline.id)}</div>
        </div>
    `).join('');

    $$('[data-export]').forEach((button) =>
        button.addEventListener('click', () => downloadExport(button.dataset.export))
    );

    $$('[data-delete-discipline]').forEach((button) =>
        button.addEventListener('click', () => deleteCatalog('disciplina', button.dataset.deleteDiscipline))
    );

    $$('[data-purge-discipline]').forEach((button) =>
        button.addEventListener('click', () => deleteDisciplineCompletely(
            button.dataset.purgeDiscipline,
            button.dataset.disciplineName,
        ))
    );

    $$('[data-delete-chapter]').forEach((button) =>
        button.addEventListener('click', () => deleteCatalog('capitulo', button.dataset.deleteChapter))
    );
}

function renderChapters(id) {
    const chapters = state.catalog.capitulos.filter((chapter) => chapter.disciplina_id === id);

    return chapters.length
        ? chapters.map((chapter) => `
            <div class="data-row">
                <span>${escapeHtml(chapter.nome)}</span>
                <button class="btn ghost mini danger" data-delete-chapter="${chapter.id}">Desativar</button>
            </div>
        `).join('')
        : '<span class="muted">Sem capítulos</span>';
}

async function deleteCatalog(tipo, id) {
    if (!confirm('Desativar este item? Ele deixará de aparecer para os alunos, mas continuará no banco.')) return;

    try {
        await api(`admin-catalogo?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadCatalog();
        toast('Item desativado.');
    } catch (error) {
        toast(error.message);
    }
}

async function deleteDisciplineCompletely(id, name) {
    const firstConfirmation = confirm(
        `ATENÇÃO: excluir "${name}" removerá permanentemente a disciplina, capítulos, questões e dados de histórico vinculados.\n\nEsta ação não pode ser desfeita. Deseja continuar?`,
    );

    if (!firstConfirmation) return;

    const typedName = prompt(
        `Para confirmar a exclusão definitiva, digite exatamente o nome da disciplina:\n\n${name}`,
    );

    if (typedName === null) return;

    if (typedName.trim() !== name) {
        toast('Nome de confirmação incorreto. A disciplina não foi excluída.');
        return;
    }

    try {
        const result = await api(
            `admin-catalogo?tipo=disciplina&acao=excluir-completa&id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                body: JSON.stringify({ confirmacao: typedName.trim() }),
            },
        );

        await loadCatalog();

        const removed = result.removidos || {};
        toast(
            `Disciplina excluída: ${removed.capitulos || 0} capítulos e ${removed.questoes || 0} questões removidos.`,
        );
    } catch (error) {
        toast(error.message);
    }
}

async function deleteAllDisciplines() {
    if (!state.catalog.disciplinas?.length) {
        toast('Não há disciplinas cadastradas para excluir.');
        return;
    }

    const total = state.catalog.disciplinas.length;
    const firstConfirmation = confirm(
        `ATENÇÃO MÁXIMA: você está prestes a excluir TODAS as ${total} disciplina(s) do sistema.\n\nTambém serão removidos todos os capítulos, questões, respostas e históricos/sessões vinculados. Usuários e administradores serão preservados.\n\nEsta ação é IRREVERSÍVEL. Deseja continuar?`,
    );

    if (!firstConfirmation) return;

    const requiredText = 'EXCLUIR TODAS AS DISCIPLINAS';
    const typedConfirmation = prompt(
        `CONFIRMAÇÃO FINAL\n\nDigite exatamente a frase abaixo para apagar todo o banco de disciplinas:\n\n${requiredText}`,
    );

    if (typedConfirmation === null) return;

    if (typedConfirmation.trim().toUpperCase() !== requiredText) {
        toast('Frase de confirmação incorreta. Nada foi excluído.');
        return;
    }

    const finalConfirmation = confirm(
        'Última confirmação: excluir definitivamente TODAS as disciplinas e todo o conteúdo relacionado?',
    );

    if (!finalConfirmation) return;

    const button = $('#deleteAllDisciplinesBtn');
    if (button) {
        button.disabled = true;
        button.textContent = 'Excluindo...';
    }

    try {
        const result = await api('admin-catalogo', {
            method: 'POST',
            body: JSON.stringify({
                tipo: 'disciplina',
                acao: 'excluir-todas',
                confirmacao: requiredText,
            }),
        });

        await loadCatalog();

        const removed = result.removidos || {};
        toast(
            `Exclusão geral concluída: ${removed.disciplinas || 0} disciplinas, ${removed.capitulos || 0} capítulos, ${removed.questoes || 0} questões, ${removed.sessoes || 0} sessões e ${removed.respostas || 0} respostas removidas.`,
        );
    } catch (error) {
        toast(error.message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Excluir todas / geral';
        }
    }
}

function downloadExport(id){const a=document.createElement('a');a.href=`/api/admin-export?disciplina=${encodeURIComponent(id)}`;document.body.appendChild(a);a.click();a.remove();}

function renderAlternativeFields() {
    const type=$('#questionType').value;
    const alternatives=type==='certo_errado'?['Certo','Errado']:['A','B','C','D','E'];
    $('#alternativeInputs').innerHTML=alternatives.map((label,index)=>{
        const optional=type!=='certo_errado'&&label==='E';
        return `<label>Alternativa ${label}${optional?' (opcional)':''}<input name="alt${index}" value="${type==='certo_errado'?label:''}" ${type==='certo_errado'?'readonly':''} ${optional?'':'required'}></label>`;
    }).join('');
    $('#correctAnswer').innerHTML=alternatives.map((label,index)=>`<option value="${index}">${label}</option>`).join('');
}

async function createQuestion(event) {
    event.preventDefault();
    const form=Object.fromEntries(new FormData(event.target));
    const alternativas=form.tipo==='certo_errado'
        ? ['Certo','Errado']
        : [form.alt0,form.alt1,form.alt2,form.alt3,form.alt4].map(text).filter(Boolean);
    if(form.tipo!=='certo_errado'&&![4,5].includes(alternativas.length)){
        toast('Preencha as alternativas A, B, C e D. A alternativa E é opcional.');
        return;
    }
    if(Number(form.resposta_correta)>=alternativas.length){
        toast('Selecione um gabarito compatível com as alternativas preenchidas.');
        return;
    }
    try { await api('admin-questions',{method:'POST',body:JSON.stringify({...form,alternativas})}); event.target.reset(); $('#questionType').value='multipla_escolha'; renderAlternativeFields(); fillSubjectSelects(); toast('Questão cadastrada.'); }
    catch(error){toast(error.message);}
}

function normalizeHeader(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function slug(value){return normalizeHeader(value).replace(/_/g,'-')||'disciplina';}
function text(value){return String(value??'').trim();}
function truthy(value){return !['nao','não','false','0','inativo'].includes(text(value).toLowerCase());}
function answerIndex(value,type){const v=text(value).toUpperCase();if(type==='certo_errado'){if(['C','CERTO','V','VERDADEIRO','0'].includes(v))return 0;if(['E','ERRADO','F','FALSO','1'].includes(v))return 1;}if(['A','B','C','D','E'].includes(v))return 'ABCDE'.indexOf(v);const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=4?n:-1;}
function questionType(value,row){const v=normalizeHeader(value);if(v.includes('certo')||v.includes('errado')||v==='ce'||v==='c_e')return'certo_errado';if(!text(row.alternativa_c)&&!text(row.c)&&text(row.alternativa_a||row.a).toLowerCase()==='certo')return'certo_errado';return'multipla_escolha';}

function rowsToImports(rows){
    if(!rows.length)throw new Error('A planilha não possui linhas de dados.');
    const normalized=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[normalizeHeader(k),v])));
    const groups=new Map(); const errors=[];
    normalized.forEach((row,index)=>{
        const line=index+2; const name=text(row.disciplina||row.nome_disciplina);
        const chapter=text(row.capitulo||row.titulo_capitulo); const statement=text(row.enunciado||row.questao);
        if(!name||!chapter||!statement){errors.push(`Linha ${line}: disciplina, capítulo e enunciado são obrigatórios.`);return;}
        const id=text(row.codigo_disciplina||row.id_disciplina)||slug(name);
        const type=questionType(row.tipo||row.tipo_questao,row);
        let alternatives;
        if(type==='certo_errado'){
            alternatives=['Certo','Errado'];
        }else{
            const rawAlternatives=[row.alternativa_a??row.a,row.alternativa_b??row.b,row.alternativa_c??row.c,row.alternativa_d??row.d,row.alternativa_e??row.e].map(text);
            if(rawAlternatives.slice(0,4).some(a=>!a)){
                errors.push(`Linha ${line}: em múltipla escolha, preencha pelo menos as alternativas A, B, C e D.`);
                return;
            }
            alternatives=rawAlternatives.slice(0,4);
            if(rawAlternatives[4]) alternatives.push(rawAlternatives[4]);
        }
        const correct=answerIndex(row.gabarito||row.resposta_correta,type);
        if(correct<0||correct>=alternatives.length){errors.push(`Linha ${line}: gabarito inválido.`);return;}
        if(!groups.has(id))groups.set(id,{disciplina:{id,nome:name,descricao:text(row.descricao_disciplina)||null,ordem:Number(row.ordem_disciplina)||0,ativo:true},chapters:new Map(),questions:[]});
        const g=groups.get(id); const chapterOrder=Number(row.ordem_capitulo)||g.chapters.size+1;
        const chapterKey=normalizeHeader(chapter);
        if(!g.chapters.has(chapterKey))g.chapters.set(chapterKey,{id:chapterKey,disciplina_id:id,indice:chapterOrder,nome:chapter,ativo:true});
        const cap=g.chapters.get(chapterKey);
        g.questions.push({capitulo_id:cap.id,capitulo_indice:cap.indice,tipo:type,enunciado:statement,alternativas:alternatives,resposta_correta:correct,resolucao:text(row.resolucao)||'Sem resolução comentada.',dificuldade:['facil','media','dificil'].includes(normalizeHeader(row.dificuldade))?normalizeHeader(row.dificuldade):'media',fonte:text(row.fonte)||null,ativo:truthy(row.ativo)});
    });
    const imports=[...groups.values()].map(g=>({versao:2,disciplina:g.disciplina,capitulos:[...g.chapters.values()],questoes:g.questions}));
    return {imports,errors};
}

async function parseSpreadsheet(file){
    if(!window.XLSX)throw new Error('A biblioteca de Excel não foi carregada. Verifique sua conexão e recarregue a página.');
    const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const rows=window.XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
    return rowsToImports(rows);
}

async function analyzeImportFile(){
    const file=$('#importFile')?.files?.[0]; const status=$('#importStatus'); const preview=$('#importPreview');
    analyzedImports=[]; $('#importBtn').disabled=true; preview.classList.add('hidden');
    if(!file){toast('Selecione um arquivo.');return;}
    try{
        status.textContent='Lendo e validando o arquivo...';
        let result;
        if(file.name.toLowerCase().endsWith('.json')){const content=JSON.parse(await file.text());result={imports:Array.isArray(content.disciplinas)?content.disciplinas:[content],errors:[]};}
        else result=await parseSpreadsheet(file);
        if(!result.imports.length)throw new Error('Nenhuma disciplina válida foi encontrada.');
        analyzedImports=result.imports;
        const totalChapters=analyzedImports.reduce((n,i)=>n+i.capitulos.length,0); const totalQuestions=analyzedImports.reduce((n,i)=>n+i.questoes.length,0);
        preview.innerHTML=`<div class="import-summary"><strong>${analyzedImports.length}</strong><span>disciplinas</span><strong>${totalChapters}</strong><span>capítulos</span><strong>${totalQuestions}</strong><span>questões válidas</span><strong>${result.errors.length}</strong><span>erros</span></div>${result.errors.length?`<details><summary>Ver erros encontrados</summary><ul>${result.errors.slice(0,100).map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul></details>`:''}<div class="import-disciplines">${analyzedImports.map(i=>`<div><strong>${escapeHtml(i.disciplina.nome)}</strong><span>${i.capitulos.length} capítulos · ${i.questoes.length} questões</span></div>`).join('')}</div>`;
        preview.classList.remove('hidden'); status.textContent='Análise concluída. Revise o resumo e confirme a importação.'; $('#importBtn').disabled=false;
    }catch(error){status.textContent=`Erro: ${error.message}`;toast(error.message);}
}

async function confirmImport(){
    if(!analyzedImports.length){toast('Analise um arquivo antes de importar.');return;}
    if(!confirm(`Importar ${analyzedImports.length} disciplina(s) para o banco?`))return;
    const button=$('#importBtn'); const status=$('#importStatus'); button.disabled=true;
    try{
        let questions=0,chapters=0;
        for(let i=0;i<analyzedImports.length;i++){
            status.textContent=`Importando ${i+1} de ${analyzedImports.length}: ${analyzedImports[i].disciplina.nome}...`;
            const r=await api('admin-import',{method:'POST',body:JSON.stringify({modo:$('#importMode').value,arquivo:analyzedImports[i]})});questions+=r.questoes;chapters+=r.capitulos;
        }
        status.textContent=`Importação concluída: ${analyzedImports.length} disciplinas, ${chapters} capítulos e ${questions} questões.`;
        analyzedImports=[]; $('#importFile').value=''; $('#importPreview').classList.add('hidden'); await loadCatalog(); toast('Importação concluída.');
    }catch(error){status.textContent=`Erro: ${error.message}`;toast(error.message);}
    finally{button.disabled=analyzedImports.length===0;}
}

async function downloadExcelExport(id){
    if(!id)return toast('Selecione uma disciplina.');
    try{
        if(!window.XLSX)throw new Error('A biblioteca de Excel não foi carregada.');
        const response=await fetch(`/api/admin-export?disciplina=${encodeURIComponent(id)}`,{credentials:'same-origin'});
        const data=await response.json(); if(!response.ok)throw new Error(data.erro||'Falha na exportação.');
        const chapterById=new Map(data.capitulos.map(c=>[c.id,c]));
        const rows=data.questoes.map(q=>{const c=chapterById.get(q.capitulo_id);return{'Disciplina':data.disciplina.nome,'Código Disciplina':data.disciplina.id,'Descrição Disciplina':data.disciplina.descricao||'','Ordem Disciplina':data.disciplina.ordem||0,'Capítulo':c?.nome||'','Ordem Capítulo':c?.indice||0,'Tipo':q.tipo==='certo_errado'?'Certo ou Errado':'Múltipla Escolha','Enunciado':q.enunciado,'Alternativa A':q.alternativas?.[0]||'','Alternativa B':q.alternativas?.[1]||'','Alternativa C':q.alternativas?.[2]||'','Alternativa D':q.alternativas?.[3]||'','Alternativa E':q.alternativas?.[4]||'','Gabarito':q.tipo==='certo_errado'?(q.resposta_correta===0?'Certo':'Errado'):'ABCDE'[q.resposta_correta],'Resolução':q.resolucao,'Fonte':q.fonte||'','Dificuldade':q.dificuldade,'Ativo':q.ativo?'Sim':'Não'};});
        const wb=window.XLSX.utils.book_new(); const ws=window.XLSX.utils.json_to_sheet(rows); ws['!cols']=[24,20,28,14,30,14,20,60,34,34,34,34,34,12,65,28,14,10].map(wch=>({wch})); window.XLSX.utils.book_append_sheet(wb,ws,'Questoes'); window.XLSX.writeFile(wb,`${id}-completo.xlsx`);
    }catch(error){toast(error.message);}
}
