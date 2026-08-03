# Atualização de design e responsividade

Esta versão mantém a arquitetura modular da versão 3.0 e aplica o padrão visual do HTML de referência em todas as áreas principais.

## Alterações

- Cabeçalho em azul-marinho com filete interno, bandeira do Pará e tipografia Bitter/JetBrains Mono.
- Paleta baseada em papel, azul PMPA e vermelho do Pará.
- Botões de navegação com ícones SVG vetoriais e textos visíveis.
- Botões de modo claro/escuro e saída com área de toque maior.
- Menu lateral responsivo para celular e tablet.
- Fechamento do menu por botão, clique no fundo, tecla Esc ou seleção de uma opção.
- Cards de questões, resoluções, formulários e painel administrativo preservando o mesmo padrão visual.
- Estados correto, incorreto, selecionado e desabilitado legíveis nos dois temas.

## Arquivos principais

- `public/components/topbar.html`: cabeçalho, ícones e menu móvel.
- `public/components/dashboard.html`: cabeçalho principal e preparação do simulado.
- `public/css/layout.css`: estrutura do cabeçalho e conteúdo.
- `public/css/components.css`: botões, ícones, cards e componentes.
- `public/css/pages.css`: telas e questões.
- `public/css/responsive.css`: menu móvel e adaptação para telas pequenas.
- `public/js/app.js`: tema e abertura/fechamento do menu responsivo.

## Atualização do projeto existente

Preserve o arquivo `.env`, substitua os demais arquivos e execute:

```powershell
npm install
npm run check
npm run dev
```

Use `Ctrl + F5` no navegador após a atualização.
