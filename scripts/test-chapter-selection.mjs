import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseChapterIds } from '../server/platform/chapter-filter.mjs';
import { chapterSelectionIsValid, renderChapterSelection, selectedChapterIds } from '../public/app/domains/chapter-selection.js';

assert.deepEqual(parseChapterIds({}), []);
assert.deepEqual(parseChapterIds({ capitulo: '2' }), [2]);
assert.deepEqual(parseChapterIds({ capitulos: '2,3,2' }), [2,3]);
for (const value of ['0', '-1', '1,no', '1,', '1.2', '9007199254740992', ['1','2']]) {
    assert.throws(() => parseChapterIds({ capitulos: value }));
}
const inputs = [{ value:'2', checked:false }, { value:'3', checked:false }];
inputs.forEach(input => { input.matches = selector => selector === '[data-chapter]'; });
const all = { checked:true, matches:selector => selector === '[data-all]' };
const summary = { textContent:'', focus() {} };
const root = {
    querySelectorAll: (selector) => selector.includes(':checked') ? inputs.filter(x => x.checked) : inputs,
    querySelector: (selector) => selector === 'summary' ? summary : all,
};
const chapters = [{ id:2,nome:'Primeiro' }, { id:3,nome:'Segundo' }];
renderChapterSelection(root, chapters);
inputs[0].checked = true; root.onchange({ target:inputs[0] });
assert.deepEqual(selectedChapterIds(root), ['2']);
assert.equal(summary.textContent, 'Primeiro');
assert.equal(all.checked, false);
inputs[1].checked = true; root.onchange({ target:inputs[1] });
assert.deepEqual(selectedChapterIds(root), ['2','3']);
assert.equal(summary.textContent, '2 capítulos selecionados');
inputs[0].checked = false; root.onchange({ target:inputs[0] });
assert.deepEqual(selectedChapterIds(root), ['3']);
inputs[1].checked = false; root.onchange({ target:inputs[1] });
assert.equal(chapterSelectionIsValid(root), false);
assert.equal(summary.textContent, 'Nenhum capítulo selecionado');
all.checked = true; root.onchange({ target:all });
assert.deepEqual(selectedChapterIds(root), []);
assert.equal(all.checked, true);
assert.equal(chapterSelectionIsValid(root), true);

// Route tests with an in-memory database: no network or real student records.
let actor = { id:'student', acesso_questoes:true };
const dataset = [
    {id:1, disciplina_id:'a',capitulo_id:2,ativo:true},
    {id:2, disciplina_id:'a',capitulo_id:3,ativo:true},
    {id:3, disciplina_id:'a',capitulo_id:4,ativo:true},
    {id:4, disciplina_id:'b',capitulo_id:3,ativo:true},
    {id:5, disciplina_id:'a',capitulo_id:2,ativo:false},
];
const context = vm.createContext({ console });
const modules = new Map();
function mock(name, exports) {
    modules.set(name, new vm.SyntheticModule(Object.keys(exports), function() {
        for (const [key,value] of Object.entries(exports)) this.setExport(key,value);
    }, { context }));
}
mock('auth.mjs', { requireUser:async()=>actor });
mock('http.mjs', { json:(statusCode,body)=>({ statusCode,body }) });
mock('question-access.mjs', { questionAccessDeniedResponse:()=>({}) });
mock('chapter-filter.mjs', { parseChapterIds });
mock('rate-limit.mjs', { consumeRateLimit:async()=>({allowed:true,unavailable:false}) });
mock('db.mjs', { db:()=>({ from:(table)=>{
    let items = table === 'questoes' ? [...dataset] : [];
    let total;
    const query = {
        select:()=>query,
        eq:(key,value)=>{ items=items.filter(x=>x[key]===value); return query; },
        in:(key,values)=>{ items=items.filter(x=>values.includes(x[key])); return query; },
        order:()=>query,
        range:(start,end)=>{ total=items.length; items=items.slice(start,end+1); return query; },
        limit:(size)=>{ items=items.slice(0,size); return query; },
        then:(resolve)=>resolve({ data:items,count:total ?? items.length,error:null }),
    };
    return query;
} }) });
const route = new vm.SourceTextModule(await readFile(new URL('../server/routes/questoes.mjs', import.meta.url),'utf8'), { context });
await route.link(spec=>modules.get(spec.split('/').at(-1)));
await route.evaluate();
const call = (params={}) => route.namespace.handler({ queryStringParameters:{ disciplina:'a',...params } });
for (const params of [{ limite:'10' }, { limite:'all',por_pagina:'1' }, { revisao:'pendentes_erros',limite:'all' }]) {
    const result = await call({ capitulos:'2,3',...params });
    assert.equal(result.statusCode, 200);
    assert(result.body.questoes.length > 0);
    assert(result.body.questoes.every(x=>[1,2].includes(x.id)));
}
assert.deepEqual((await call({capitulos:'2,3',limite:'all',por_pagina:'1',pagina:'2'})).body.questoes.map(x=>x.id), [2]);
assert.equal((await call()).body.questoes.length, 3);
assert.equal((await call({capitulo:'2'})).body.questoes.length, 1);
assert.equal((await call({capitulos:'2,invalid'})).statusCode,400);
actor = { acesso_questoes:false };
assert.equal((await call()).statusCode,403);
actor = null;
assert.equal((await call()).statusCode,401);
console.log('Capítulos: seleção múltipla, Todos, validação, paginação, revisão e acesso passaram.');
