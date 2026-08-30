-- Execute uma vez no SQL Editor do Supabase para habilitar questões de Certo/Errado.
alter table public.questoes add column if not exists tipo text not null default 'multipla_escolha';
alter table public.questoes drop constraint if exists questoes_tipo_check;
alter table public.questoes add constraint questoes_tipo_check check (tipo in ('multipla_escolha','certo_errado'));

alter table public.questoes drop constraint if exists questoes_alternativas_check;
alter table public.questoes add constraint questoes_alternativas_check check (jsonb_array_length(alternativas) between 2 and 5);

update public.questoes set tipo='certo_errado' where jsonb_array_length(alternativas)=2;
