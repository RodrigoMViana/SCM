#!/usr/bin/env node
/**
 * Gera a massa da VERSÃO DE DEMONSTRAÇÃO (GitHub Pages) a partir de um back-end em execução.
 *
 *   node scripts/gerar-dados-demo.mjs [http://localhost:8080] [demo/dados.json]
 *
 * O back-end deve estar no perfil "dev" (massa fictícia do V900). O arquivo gerado é carregado
 * pelo interceptor de demonstração (src/app/demo) quando o front é compilado com
 * `ng build --configuration demo`. Nenhum dado real deve ser usado aqui.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8080';
const SAIDA = process.argv[3] ?? 'demo/dados.json';
const PERFIS = ['GESTOR', 'AUDITOR', 'GERENTE_FISCALIZACAO', 'GERENTE_COBRANCA', 'PORTAL'];

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'sergio.lages', senha: '123456' }),
});
if (!login.ok) throw new Error('Falha no login: ' + login.status);
const { token } = await login.json();

/** GET autenticado, tentando os perfis em ordem até um ter permissão. */
async function get(caminho) {
  for (const perfil of PERFIS) {
    const r = await fetch(BASE + caminho, { headers: { Authorization: `Bearer ${token}`, 'X-Perfil': perfil } });
    if (r.status === 403) continue;
    if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
    return r.json();
  }
  throw new Error(`${caminho}: nenhum perfil com permissão`);
}

async function todasPaginas(caminho, tamanho = 200) {
  const itens = [];
  for (let p = 0; ; p++) {
    const sep = caminho.includes('?') ? '&' : '?';
    const pg = await get(`${caminho}${sep}pagina=${p}&tamanho=${tamanho}`);
    itens.push(...pg.itens);
    if (itens.length >= pg.total || pg.itens.length === 0) return itens;
  }
}

const d = {};
d.config = await get('/api/public/config');
d.usuarios = await todasPaginas('/api/admin/usuarios', 100);
d.perfis = await get('/api/admin/perfis');
d.permissoes = await get('/api/admin/permissoes');
d.auditores = await get('/api/usuarios/auditores');
d.tiposMalha = await get('/api/tipos-malha');
d.grupos = await get('/api/grupos-indicadores');
d.indicadores = [];
for (const i of await get('/api/indicadores')) d.indicadores.push(await get(`/api/indicadores/${i.id}`));
d.malhas = await get('/api/malhas');
d.planos = {};
d.resultados = {};
for (const m of d.malhas) {
  d.planos[m.id] = await get(`/api/malhas/${m.id}/indicadores`);
  for (const i of d.planos[m.id]) {
    const e = i.ultimaExecucao;
    if (e && e.status === 'CONCLUIDA' && !d.resultados[e.id]) {
      d.resultados[e.id] = (await get(`/api/execucoes/${e.id}/resultados?pagina=0&tamanho=300`)).itens;
    }
  }
}
console.log('catálogo e malhas ok');

d.casos = [];
for (const m of d.malhas) {
  for (const aba of ['EM_ANALISE', 'A_NOTIFICAR', 'NOTIFICADOS', 'ENCERRADOS', 'CANCELADOS', 'EXCLUIDOS']) {
    d.casos.push(...(await todasPaginas(`/api/malhas/${m.id}/casos?aba=${aba}`, 500)));
  }
}
console.log('casos:', d.casos.length);

// detalhes completos só para os casos "interessantes" (fora da análise ou de contribuintes nomeados)
d.detalhes = {};
d.documentos = {};
d.historicos = {};
const interessantes = d.casos.filter((c) => c.status !== 'EM_ANALISE' || !c.razaoSocial.startsWith('EMPRESA DEMONSTRA'));
for (const c of interessantes) {
  d.detalhes[c.id] = await get(`/api/casos/${c.id}`);
  d.documentos[c.id] = (await get(`/api/casos/${c.id}/documentos?pagina=0&tamanho=200`)).itens;
  d.historicos[c.id] = await get(`/api/casos/${c.id}/historico`);
}
console.log('detalhes:', interessantes.length);

d.contribuintes = await todasPaginas('/api/contribuintes');
d.contestacoes = [...(await todasPaginas('/api/contestacoes?comParecer=false')), ...(await todasPaginas('/api/contestacoes?comParecer=true'))];
d.prorrogacoes = [...(await todasPaginas('/api/prorrogacoes?analisados=false')), ...(await todasPaginas('/api/prorrogacoes?analisados=true'))];
d.impedimentos = await get('/api/impedimentos');
d.acoesFiscais = await todasPaginas('/api/acoes-fiscais');
d.parametros = await get('/api/parametros');
d.historicoParametros = await get('/api/parametros/historico');
d.solicitacoes = [];
for (const s of await todasPaginas('/api/integracao/solicitacoes')) d.solicitacoes.push(await get(`/api/integracao/solicitacoes/${s.id}`));
console.log('demais módulos ok');

d.config.demonstracao = true;
d.config.cliente.tema.logoUrl = d.config.cliente.tema.logoUrl?.replace(/^\//, '');
d.geradoEm = new Date().toISOString();

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(d));
console.log('gerado', SAIDA, Math.round(JSON.stringify(d).length / 1024), 'KB');
