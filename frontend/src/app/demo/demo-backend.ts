/**
 * Back-end SIMULADO da versão de demonstração (GitHub Pages).
 *
 * Reproduz, em memória e de forma simplificada, as regras da API Java para que o front-end
 * funcione sem servidor. Os dados iniciais vêm de `demo/dados.json` (massa fictícia gerada por
 * scripts/gerar-dados-demo.mjs). Alterações valem até recarregar a página.
 * NÃO é usado no build normal: só entra com `ng build --configuration demo`.
 */
import type {
  AcaoFiscal, CasoDetalhe, CasoEvento, CasoResumo, ConfiguracaoCliente, Contestacao, Contribuinte, DocumentoFiscal,
  Execucao, GrupoIndicador, Impedimento, Indicador, IndicadorPlano, Malha, Parametro, ParametroHistorico, PerfilDetalhe,
  Permissao, Prorrogacao, ResultadoIndicador, ResultadoLote, Solicitacao, TipoMalha, UsuarioAdmin, UsuarioResumo,
} from '../core/models';

export interface DadosDemo {
  config: ConfiguracaoCliente;
  usuarios: UsuarioAdmin[];
  perfis: PerfilDetalhe[];
  permissoes: Permissao[];
  auditores: UsuarioResumo[];
  tiposMalha: TipoMalha[];
  grupos: GrupoIndicador[];
  indicadores: Indicador[];
  malhas: Malha[];
  planos: Record<number, IndicadorPlano[]>;
  resultados: Record<number, ResultadoIndicador[]>;
  casos: CasoResumo[];
  detalhes: Record<number, CasoDetalhe>;
  documentos: Record<number, DocumentoFiscal[]>;
  historicos: Record<number, CasoEvento[]>;
  contribuintes: Contribuinte[];
  contestacoes: Contestacao[];
  prorrogacoes: Prorrogacao[];
  impedimentos: Impedimento[];
  acoesFiscais: AcaoFiscal[];
  parametros: Parametro[];
  historicoParametros: ParametroHistorico[];
  solicitacoes: Solicitacao[];
}

export class ErroDemo {
  constructor(readonly status: number, readonly title: string, readonly detail: string) {}
}

export interface Requisicao {
  metodo: string;
  caminho: string;
  params: URLSearchParams;
  corpo: any;
  token: string | null;
  perfil: string | null;
}

const ROTULO_CASO: Record<string, string> = {
  EM_ANALISE: 'Contribuintes em análise', A_NOTIFICAR: 'Monitorado (a notificar)', NOTIFICACAO_EM_EMISSAO: 'Notificação em emissão',
  NOTIFICACAO_EMITIDA: 'Notificação emitida', NOTIFICADO: 'Notificado', ENCERRADO: 'Encerrado', CANCELADO: 'Cancelado', EXCLUIDO: 'Excluído pelo Gestor',
};
const ABAS: Record<string, string[]> = {
  EM_ANALISE: ['EM_ANALISE'], A_NOTIFICAR: ['A_NOTIFICAR'], NOTIFICADOS: ['NOTIFICACAO_EM_EMISSAO', 'NOTIFICACAO_EMITIDA', 'NOTIFICADO'],
  ENCERRADOS: ['ENCERRADO'], CANCELADOS: ['CANCELADO'], EXCLUIDOS: ['EXCLUIDO'],
};
const ROTULO_ACAO: Record<string, string> = {
  SOLICITADA: 'Aguardando abertura de MPF', MPF_EM_ABERTURA: 'MPF em abertura no SATE', MPF_ABERTO: 'MPF aberto - aguardando ciência dos auditores',
  TIF_EM_EMISSAO: 'TIF em emissão no SATE', TIF_AGUARDANDO_CIENCIA: 'TIF aguardando ciência do contribuinte', AUTO_EM_LAVRATURA: 'Auto de Infração em lavratura',
  AUTO_LAVRADO: 'Auto lavrado - aguardando homologação', AUTO_EM_HOMOLOGACAO: 'Auto em homologação/envio DT-e',
  AUTO_AGUARDANDO_CIENCIA: 'Auto aguardando ciência do contribuinte', ENCERRAMENTO_EM_INCLUSAO: 'Termo de encerramento em inclusão',
  AGUARDANDO_RATIFICACAO: 'Termo de encerramento aguardando ratificação', RATIFICACAO_EM_ANDAMENTO: 'Ratificação em andamento',
  CONCLUIDA: 'Concluída', INDEFERIDA: 'Indeferida',
};
const SENHA_DEMO = '123456';

const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toISOString().slice(0, 19);
const somarDias = (iso: string, dias: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diasAte = (iso: string) => Math.round((new Date(iso + 'T12:00:00').getTime() - new Date(hoje() + 'T12:00:00').getTime()) / 86_400_000);
const num = (v: string | null) => (v === null || v === '' ? null : Number(v));
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function paginar<T>(lista: T[], p: URLSearchParams, padrao = 25) {
  const pagina = Number(p.get('pagina') ?? 0);
  const tamanho = Number(p.get('tamanho') ?? padrao);
  return { itens: lista.slice(pagina * tamanho, pagina * tamanho + tamanho), total: lista.length, pagina, tamanho };
}

export class DemoBackend {
  private seq = 900_000;
  private seqNotif = 500;
  private eventosExtras = new Map<number, CasoEvento[]>();

  constructor(private readonly d: DadosDemo) {
    this.d.casos.forEach((c) => this.atualizarPrazo(c));
  }

  // ===================================================================== roteamento
  tratar(r: Requisicao): unknown {
    const rotas: [string, RegExp, (m: RegExpMatchArray) => unknown][] = [
      ['GET', /^\/api\/public\/config$/, () => this.d.config],
      ['POST', /^\/api\/auth\/login$/, () => this.login(r.corpo)],
      ['GET', /^\/api\/auth\/sessao$/, () => this.sessao(r)],
      ['GET', /^\/api\/painel\/contadores$/, () => this.contadores(r)],
      ['GET', /^\/api\/dashboard$/, () => this.dashboard(num(r.params.get('malhaId')))],
      ['GET', /^\/api\/contribuintes$/, () => this.contribuintes(r.params)],
      // malhas e casos
      ['GET', /^\/api\/malhas$/, () => this.d.malhas.map((m) => this.malhaComContagem(m))],
      ['POST', /^\/api\/malhas$/, () => this.criarMalha(r)],
      ['GET', /^\/api\/malhas\/(\d+)$/, (m) => this.malhaComContagem(this.malha(+m[1]))],
      ['GET', /^\/api\/malhas\/(\d+)\/casos\/exportar$/, () => { throw new ErroDemo(422, 'Indisponível na demonstração', 'A exportação XLSX é gerada pelo servidor e não está disponível na versão de demonstração.'); }],
      ['GET', /^\/api\/malhas\/(\d+)\/casos$/, (m) => this.casosDaMalha(+m[1], r.params)],
      ['GET', /^\/api\/malhas\/(\d+)\/indicadores$/, (m) => this.d.planos[+m[1]] ?? []],
      ['POST', /^\/api\/malhas\/(\d+)\/indicadores$/, (m) => this.adicionarAoPlano(+m[1], r.corpo)],
      ['DELETE', /^\/api\/malhas\/(\d+)\/indicadores\/(\d+)$/, (m) => { this.d.planos[+m[1]] = (this.d.planos[+m[1]] ?? []).filter((i) => i.indicadorId !== +m[2]); return null; }],
      ['POST', /^\/api\/malhas\/(\d+)\/indicadores\/(\d+)\/executar$/, (m) => this.executar(+m[1], +m[2], r)],
      ['PUT', /^\/api\/malhas\/(\d+)\/prioridades$/, () => null],
      ['POST', /^\/api\/malhas\/(\d+)\/consolidar$/, (m) => this.consolidar(+m[1])],
      ['GET', /^\/api\/execucoes\/(\d+)\/resultados$/, (m) => paginar(this.d.resultados[+m[1]] ?? [], r.params, 20)],
      ['PUT', /^\/api\/execucoes\/(\d+)\/selecao$/, (m) => this.selecionar(+m[1], r.corpo)],
      ['GET', /^\/api\/casos$/, () => this.pesquisarCasos(r.params)],
      ['GET', /^\/api\/casos\/(\d+)$/, (m) => this.detalhe(+m[1])],
      ['GET', /^\/api\/(?:portal\/)?casos\/(\d+)\/documentos$/, (m) => paginar(this.documentos(+m[1]), r.params, 20)],
      ['GET', /^\/api\/casos\/(\d+)\/historico$/, (m) => this.historico(+m[1])],
      ['POST', /^\/api\/casos\/(\d+)\/simular-ciencia$/, (m) => this.cienciaCaso(+m[1], r)],
      ['POST', /^\/api\/casos\/([a-z-]+)$/, (m) => this.acaoCasos(m[1], r)],
      // contestação / prorrogação
      ['GET', /^\/api\/contestacoes$/, () => paginar(this.d.contestacoes.filter((c) => (c.status === 'COM_PARECER') === (r.params.get('comParecer') === 'true')), r.params)],
      ['GET', /^\/api\/contestacoes\/(\d+)$/, (m) => { const c = this.contestacao(+m[1]); c.lida = true; return c; }],
      ['POST', /^\/api\/contestacoes\/(\d+)\/parecer$/, (m) => this.parecer(+m[1], r)],
      ['GET', /^\/api\/prorrogacoes$/, () => paginar(this.d.prorrogacoes.filter((p) => (p.status !== 'EM_ANALISE') === (r.params.get('analisados') === 'true')), r.params)],
      ['POST', /^\/api\/prorrogacoes\/(\d+)\/analisar$/, (m) => this.analisarProrrogacao(+m[1], r)],
      // impedimentos
      ['GET', /^\/api\/impedimentos$/, () => this.d.impedimentos.map((i) => ({ ...i, podeLiberar: this.pode(r, 'IMPEDIMENTO_GERIR') && i.origem === this.perfilAtivo(r) }))],
      ['POST', /^\/api\/impedimentos$/, () => this.incluirImpedimento(r)],
      ['DELETE', /^\/api\/impedimentos\/(\d+)$/, (m) => { this.d.impedimentos = this.d.impedimentos.filter((i) => i.id !== +m[1]); this.sincronizarImpedimentos(); return null; }],
      // ação fiscal
      ['GET', /^\/api\/acoes-fiscais$/, () => this.acoes(r)],
      ['GET', /^\/api\/acoes-fiscais\/minhas$/, () => this.minhas(r)],
      ['POST', /^\/api\/acoes-fiscais$/, () => this.solicitarAcao(r)],
      ['POST', /^\/api\/acoes-fiscais\/abrir-mpf$/, () => this.abrirMpf(r)],
      ['POST', /^\/api\/acoes-fiscais\/homologar$/, () => this.lote(r, 'AUTO_LAVRADO', (a) => { a.dataHomologacao = hoje(); a.dataEnvioDte = hoje(); this.mudar(a, 'AUTO_AGUARDANDO_CIENCIA'); this.solicitacao(r, 'HOMOLOGAR_AUTO', 'IX — Homologar Auto de Infração', ['RF-17', 'RF-18'], a.casoId, a.id); })],
      ['POST', /^\/api\/acoes-fiscais\/ratificar$/, () => this.lote(r, 'AGUARDANDO_RATIFICACAO', (a) => { a.dataRatificacao = hoje(); this.mudar(a, 'CONCLUIDA'); this.solicitacao(r, 'RATIFICAR_ENCERRAMENTO', 'XII — Ratificar encerramento', ['RF-22'], a.casoId, a.id); })],
      ['POST', /^\/api\/acoes-fiscais\/(\d+)\/indeferir$/, (m) => { const a = this.acao(+m[1]); this.mudar(a, 'INDEFERIDA'); return this.comCiencia(a, r); }],
      ['POST', /^\/api\/acoes-fiscais\/(\d+)\/ciencia-auditor$/, (m) => this.cienciaAuditor(+m[1], r)],
      ['POST', /^\/api\/acoes-fiscais\/(\d+)\/simular-ciencia$/, (m) => this.cienciaAcao(+m[1], r)],
      ['GET', /^\/api\/usuarios\/auditores$/, () => this.d.auditores],
      // catálogo
      ['GET', /^\/api\/tipos-malha$/, () => this.d.tiposMalha],
      ['GET', /^\/api\/grupos-indicadores$/, () => this.d.grupos],
      ['POST', /^\/api\/grupos-indicadores$/, () => { const g = { ...r.corpo, id: this.novoId() }; this.d.grupos.push(g); return g; }],
      ['GET', /^\/api\/indicadores$/, () => this.d.indicadores],
      ['GET', /^\/api\/indicadores\/(\d+)$/, (m) => this.indicador(+m[1])],
      ['POST', /^\/api\/indicadores$/, () => this.salvarIndicador(r.corpo)],
      // parametrizações
      ['GET', /^\/api\/parametros\/historico$/, () => [...this.d.historicoParametros].sort((a, b) => b.dataHora.localeCompare(a.dataHora))],
      ['GET', /^\/api\/parametros$/, () => this.d.parametros.filter((p) => !r.params.get('aba') || p.aba === r.params.get('aba'))],
      ['PUT', /^\/api\/parametros\/(\d+)$/, (m) => this.alterarParametro(+m[1], r)],
      ['POST', /^\/api\/parametros\/(\d+)\/cancelar-programacao$/, (m) => this.cancelarProgramacao(+m[1], r)],
      // integração
      ['GET', /^\/api\/integracao\/solicitacoes$/, () => this.solicitacoes(r.params)],
      ['GET', /^\/api\/integracao\/solicitacoes\/(\d+)$/, (m) => this.solicitacaoPorId(+m[1])],
      ['POST', /^\/api\/integracao\/solicitacoes\/(\d+)\/reprocessar$/, (m) => { const s = this.solicitacaoPorId(+m[1]); s.status = 'CONCLUIDA'; s.ultimoErro = undefined; s.etapaAtual = s.totalEtapas; s.etapas.forEach((e) => (e.status = 'CONCLUIDA')); return s; }],
      ['POST', /^\/api\/integracao\/ciencia\/executar$/, () => ({ notificacoes: 0, tifs: 0, autos: 0 })],
      ['GET', /^\/api\/integracao\/resumo$/, () => this.d.solicitacoes.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {})],
      // administração
      ['GET', /^\/api\/admin\/usuarios$/, () => this.usuarios(r.params)],
      ['PUT', /^\/api\/admin\/usuarios\/(\d+)\/perfis$/, (m) => { const u = this.d.usuarios.find((x) => x.id === +m[1])!; u.perfis = r.corpo; return u; }],
      ['GET', /^\/api\/admin\/perfis$/, () => this.d.perfis],
      ['GET', /^\/api\/admin\/permissoes$/, () => this.d.permissoes],
      ['PUT', /^\/api\/admin\/perfis\/([A-Z_]+)\/permissoes$/, (m) => { const p = this.d.perfis.find((x) => x.codigo === m[1])!; p.permissoes = r.corpo; return p; }],
      // portal
      ['GET', /^\/api\/portal\/malhas$/, () => this.portalMalhas(r.params.get('ie') ?? '')],
      ['POST', /^\/api\/portal\/casos\/(\d+)\/contestacoes$/, (m) => this.contestar(+m[1], r)],
      ['POST', /^\/api\/portal\/casos\/(\d+)\/prorrogacoes$/, (m) => this.pedirProrrogacao(+m[1], r)],
    ];
    const publica = r.caminho.startsWith('/api/public/') || r.caminho === '/api/auth/login';
    if (!publica && !this.usuario(r)) throw new ErroDemo(401, 'Não autenticado', 'Sessão expirada.');
    for (const [metodo, re, fn] of rotas) {
      const m = r.caminho.match(re);
      if (m && metodo === r.metodo) return fn(m);
    }
    throw new ErroDemo(404, 'Não encontrado', `Recurso não disponível na demonstração: ${r.metodo} ${r.caminho}`);
  }

  // ===================================================================== sessão
  private usuario(r: Requisicao): UsuarioAdmin | undefined {
    const login = r.token?.startsWith('demo.') ? r.token.slice(5) : null;
    return login ? this.d.usuarios.find((u) => u.login === login) : undefined;
  }
  private perfilAtivo(r: Requisicao): string {
    const u = this.usuario(r)!;
    return r.perfil && u.perfis.includes(r.perfil) ? r.perfil : u.perfis[0];
  }
  private pode(r: Requisicao, permissao: string) {
    return !!this.d.perfis.find((p) => p.codigo === this.perfilAtivo(r))?.permissoes.includes(permissao);
  }
  private nomeUsuario(r: Requisicao) {
    return this.usuario(r)?.nome ?? 'Usuário';
  }

  private login(c: { login: string; senha: string }) {
    const u = this.d.usuarios.find((x) => x.login === c.login?.trim());
    if (!u || c.senha !== SENHA_DEMO) throw new ErroDemo(401, 'Falha na autenticação', 'Login ou senha inválidos. Na demonstração a senha é 123456.');
    return { token: 'demo.' + u.login, perfis: this.perfisDe(u) };
  }
  private perfisDe(u: UsuarioAdmin) {
    return this.d.perfis.filter((p) => u.perfis.includes(p.codigo)).map((p) => ({ codigo: p.codigo, nome: p.nome }));
  }
  private sessao(r: Requisicao) {
    const u = this.usuario(r)!;
    const ativo = this.perfilAtivo(r);
    return { login: u.login, nome: u.nome, perfis: this.perfisDe(u), perfilAtivo: ativo, permissoes: this.d.perfis.find((p) => p.codigo === ativo)?.permissoes ?? [] };
  }

  // ===================================================================== painel
  private contadores(r: Requisicao) {
    return {
      contestacoesNaoLidas: this.d.contestacoes.filter((c) => c.status === 'SEM_PARECER' && !c.lida).length,
      prorrogacoesPendentes: this.d.prorrogacoes.filter((p) => p.status === 'EM_ANALISE').length,
      mpfPendentes: this.d.acoesFiscais.filter((a) => a.status === 'SOLICITADA').length,
      autosPendentes: this.d.acoesFiscais.filter((a) => a.status === 'AUTO_LAVRADO').length,
      mpfsDesignados: this.minhas(r).filter((a) => a.minhaCienciaPendente).length,
      aguardandoRatificacao: this.d.acoesFiscais.filter((a) => a.status === 'AGUARDANDO_RATIFICACAO').length,
    };
  }

  private dashboard(malhaId: number | null) {
    const casos = this.d.casos.filter((c) => !malhaId || c.malhaId === malhaId);
    const porStatus: Record<string, number> = {};
    casos.forEach((c) => (porStatus[c.status] = (porStatus[c.status] ?? 0) + 1));
    const em = (s: string[]) => casos.filter((c) => s.includes(c.status)).length;
    return {
      totalContribuintes: casos.length,
      emAnalise: em(['EM_ANALISE']),
      aNotificar: em(['A_NOTIFICAR']),
      notificados: em(ABAS['NOTIFICADOS']),
      encerrados: em(['ENCERRADO']),
      suspensos: casos.filter((c) => c.suspenso).length,
      potencialTotal: casos.filter((c) => !['EXCLUIDO', 'CANCELADO'].includes(c.status)).reduce((s, c) => s + (c.icmsDiferenca ?? 0), 0),
      valorRecuperado: casos.reduce((s, c) => s + (c.valorRecuperado ?? 0), 0),
      prazosVencidos: casos.filter((c) => c.status === 'NOTIFICADO' && (c.diasRestantes ?? 0) < 0).length,
      acoesFiscaisAtivas: this.d.acoesFiscais.filter((a) => !['CONCLUIDA', 'INDEFERIDA'].includes(a.status) && (!malhaId || casos.some((c) => c.id === a.casoId))).length,
      porStatus,
      malhas: this.d.malhas.filter((m) => m.situacao !== 'RASCUNHO' && (!malhaId || m.id === malhaId)).map((m) => this.malhaComContagem(m)),
    };
  }

  private contribuintes(p: URLSearchParams) {
    const f = normalizar(p.get('filtro') ?? '');
    const lista = this.d.contribuintes
      .filter((c) => !f || normalizar(c.razaoSocial).includes(f) || c.inscricaoEstadual.includes(f) || c.cnpj.includes(f))
      .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
    return paginar(lista, p);
  }

  // ===================================================================== malhas
  private malha(id: number) {
    const m = this.d.malhas.find((x) => x.id === id);
    if (!m) throw new ErroDemo(404, 'Não encontrado', 'Malha inexistente.');
    return m;
  }
  private malhaComContagem(m: Malha): Malha {
    const casos = this.d.casos.filter((c) => c.malhaId === m.id);
    const contagem: Record<string, number> = {};
    for (const [aba, st] of Object.entries(ABAS)) contagem[aba] = casos.filter((c) => st.includes(c.status)).length;
    return { ...m, contagemPorAba: contagem, total: casos.length };
  }
  private criarMalha(r: Requisicao) {
    const t = this.d.tiposMalha.find((x) => x.id === r.corpo.tipoMalhaId)!;
    const m: Malha = { id: this.novoId(), tipoMalhaId: t.id, tipoCodigo: t.codigo, tipoNome: t.nome, nome: r.corpo.nome,
      periodoInicio: r.corpo.periodoInicio, periodoFim: r.corpo.periodoFim, situacao: 'RASCUNHO', contagemPorAba: {}, total: 0 };
    this.d.malhas.push(m);
    this.d.planos[m.id] = [];
    return m;
  }

  private filtrar(lista: CasoResumo[], p: URLSearchParams) {
    const aba = p.get('aba');
    const texto = normalizar(p.get('texto') ?? '');
    const min = num(p.get('valorMin'));
    const max = num(p.get('valorMax'));
    let r = lista.filter((c) => (!aba || ABAS[aba]?.includes(c.status))
      && (!texto || normalizar(c.razaoSocial).includes(texto) || c.inscricaoEstadual.includes(texto) || c.cnpj.includes(texto) || (c.numNotificacao ?? '').includes(texto))
      && (min === null || c.icmsDiferenca >= min) && (max === null || c.icmsDiferenca <= max));
    const campo = (p.get('ordenarPor') ?? 'posicao') as keyof CasoResumo;
    const desc = p.get('desc') === 'true' ? -1 : 1;
    r = [...r].sort((a, b) => {
      const x = a[campo] ?? '';
      const y = b[campo] ?? '';
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * desc;
    });
    return r;
  }
  private casosDaMalha(malhaId: number, p: URLSearchParams) {
    return paginar(this.filtrar(this.d.casos.filter((c) => c.malhaId === malhaId), p), p);
  }
  private pesquisarCasos(p: URLSearchParams) {
    const contrib = num(p.get('contribuinteId'));
    const ie = contrib ? this.d.contribuintes.find((c) => c.id === contrib)?.inscricaoEstadual : null;
    return paginar(this.filtrar(this.d.casos.filter((c) => !ie || c.inscricaoEstadual === ie), p), p);
  }

  private caso(id: number) {
    const c = this.d.casos.find((x) => x.id === id);
    if (!c) throw new ErroDemo(404, 'Não encontrado', 'Caso inexistente.');
    return c;
  }
  private atualizarPrazo(c: CasoResumo) {
    c.statusRotulo = ROTULO_CASO[c.status] ?? c.status;
    c.diasRestantes = c.fimPrazo ? diasAte(c.fimPrazo) : undefined;
  }

  private detalhe(id: number): CasoDetalhe {
    const c = this.caso(id);
    this.atualizarPrazo(c);
    const base: Partial<CasoDetalhe> | undefined = this.d.detalhes[id];
    const contrib = this.d.contribuintes.find((x) => x.inscricaoEstadual === c.inscricaoEstadual);
    const malha = this.malha(c.malhaId);
    const acao = this.d.acoesFiscais.find((a) => a.casoId === id && a.status !== 'INDEFERIDA');
    return {
      malhaNome: malha.nome, periodoInicio: malha.periodoInicio, periodoFim: malha.periodoFim,
      municipio: contrib?.municipio ?? 'MACAPÁ', email: contrib?.email ?? '', telefone: contrib?.telefone ?? '',
      medidas: [], ...base,
      caso: c,
      qtdDocumentos: this.documentos(id).length,
      contestacoes: this.d.contestacoes.filter((x) => x.casoId === id).map((x) => ({ id: x.id, numero: x.numero, data: x.dataContestacao, titulo: x.titulo, status: x.status, numParecer: x.numParecer ?? '', resultado: x.resultadoParecer ?? '' })),
      prorrogacoes: this.d.prorrogacoes.filter((x) => x.casoId === id).map((x) => ({ id: x.id, dataPedido: x.dataPedido, dataSolicitada: x.dataSolicitada, status: x.status, dataFinal: x.dataFinal ?? '' })),
      acaoFiscal: acao ? { id: acao.id, status: acao.status, statusRotulo: acao.statusRotulo, numMpf: acao.numMpf ?? '', numTif: acao.numTif ?? '', numAuto: acao.numAuto ?? '', valorAuto: acao.valorAuto ?? 0, numTermoEnc: acao.numTermoEnc ?? '' } : null,
      integracoes: this.d.solicitacoes.filter((s) => s.casoId === id).map((s) => ({ id: s.id, demanda: s.demandaDescricao, status: s.status, etapaAtual: s.etapaAtual, totalEtapas: s.totalEtapas, ultimoErro: s.ultimoErro ?? '', criadoEm: s.criadoEm })),
    };
  }

  /** Documentos reais da massa; para os demais casos, gera NF-e fictícias determinísticas. */
  private documentos(casoId: number): DocumentoFiscal[] {
    if (this.d.documentos[casoId]) return this.d.documentos[casoId];
    const c = this.caso(casoId);
    const qtd = Math.max(3, Math.min(25, c.potencialQtd || Math.round(c.icmsDiferenca / 20000) || 5));
    const malha = this.malha(c.malhaId);
    const ano = malha.periodoInicio.slice(0, 4);
    const docs: DocumentoFiscal[] = [];
    let restante = c.icmsDiferenca;
    for (let i = 0; i < qtd; i++) {
      const icms = i === qtd - 1 ? Math.max(restante, 1) : Math.round((c.icmsDiferenca / qtd) * (0.6 + ((i * 37) % 80) / 100));
      restante -= icms;
      const mes = String((i % 12) + 1).padStart(2, '0');
      const n = String(casoId * 100 + i).padStart(9, '0');
      docs.push({
        id: casoId * 1000 + i, casoId, chaveAcesso: `16${ano.slice(2)}${mes}${c.cnpj.replace(/\D/g, '')}55001${n}1${n.slice(0, 8)}`.slice(0, 44),
        modelo: 'NF-e', operacao: i % 3 === 0 ? 'ENTRADA' : 'SAIDA', numero: n, dataEmissao: `${ano}-${mes}-${String((i % 27) + 1).padStart(2, '0')}`,
        cnpjContraparte: `${String(10000000 + ((casoId * 7 + i) % 89999999)).padStart(8, '0')}/0001-${String(10 + (i % 89))}`, cfop: i % 3 === 0 ? '1102' : '5102',
        valorTotal: Math.round(icms / 0.17), valorIcms: icms, valorDeclarado: 0, indicador: malha.tipoNome, situacao: 'PENDENTE',
      });
    }
    this.d.documentos[casoId] = docs;
    return docs;
  }

  private historico(id: number): CasoEvento[] {
    return [...(this.eventosExtras.get(id) ?? []), ...(this.d.historicos[id] ?? [])];
  }
  private evento(r: Requisicao, casoId: number, tipo: string, descricao: string) {
    const lista = this.eventosExtras.get(casoId) ?? [];
    lista.unshift({ id: this.novoId(), dataHora: agora(), tipo, descricao, usuario: this.nomeUsuario(r), perfil: this.perfilAtivo(r) });
    this.eventosExtras.set(casoId, lista);
  }

  // ===================================================================== ações sobre casos
  private acaoCasos(acao: string, r: Requisicao): ResultadoLote {
    const ids: number[] = r.corpo.ids ?? [];
    const res: ResultadoLote = { processados: 0, ignorados: [], loteId: ids.length > 1 ? this.novoId() : null };
    const ignorar = (c: CasoResumo, motivo: string) => res.ignorados.push({ id: c.id, descricao: c.razaoSocial, motivo });
    for (const id of ids) {
      const c = this.caso(id);
      switch (acao) {
        case 'exibir-portal':
          if (c.status !== 'EM_ANALISE') { ignorar(c, 'Somente contribuintes em análise podem ser exibidos no portal.'); continue; }
          c.status = 'A_NOTIFICAR';
          c.dataExibicaoPortal = hoje();
          this.evento(r, id, 'EXIBICAO_PORTAL', 'Divergências exibidas no Portal de Autorregularização');
          break;
        case 'excluir':
          if (!['EM_ANALISE', 'A_NOTIFICAR'].includes(c.status)) { ignorar(c, 'Só é possível excluir antes da notificação.'); continue; }
          c.status = 'EXCLUIDO';
          c.excluidoPor = this.nomeUsuario(r);
          c.dataExclusao = hoje();
          c.justifExclusao = r.corpo.justificativa;
          this.evento(r, id, 'EXCLUSAO', 'Excluído da malha: ' + r.corpo.justificativa);
          break;
        case 'notificar':
          if (c.status !== 'A_NOTIFICAR') { ignorar(c, 'O contribuinte precisa estar em "Monitorados (a notificar)".'); continue; }
          if (c.impedimento) { ignorar(c, 'Contribuinte impedido de notificação (' + c.impedimento + ').'); continue; }
          c.status = 'NOTIFICACAO_EMITIDA';
          c.numProcesso = `${String(++this.seqNotif).padStart(6, '0')}/${hoje().slice(0, 4)}`;
          c.numNotificacao = `${String(this.seqNotif).padStart(6, '0')}/${hoje().slice(0, 4)}`;
          c.dataEmissaoNotif = hoje();
          c.notificadoPor = this.nomeUsuario(r);
          this.solicitacao(r, 'NOTIFICAR', 'I — Notificar contribuinte', ['RF-01', 'RF-02', 'RF-03'], id, undefined, res.loteId);
          this.evento(r, id, 'NOTIFICACAO', `Notificação ${c.numNotificacao} emitida e assinada no SATE (RF-01 a RF-03)`);
          break;
        case 'encerrar':
        case 'cancelar':
          if (!ABAS['NOTIFICADOS'].includes(c.status)) { ignorar(c, 'Somente contribuintes notificados.'); continue; }
          c.status = acao === 'encerrar' ? 'ENCERRADO' : 'CANCELADO';
          c.dataEncerramento = hoje();
          if (acao === 'encerrar') { c.tipoEncerramento = r.corpo.tipo; c.valorRecuperado = r.corpo.valorRecuperado ?? 0; }
          this.evento(r, id, acao.toUpperCase(), (acao === 'encerrar' ? 'Notificação encerrada: ' : 'Notificação cancelada: ') + r.corpo.justificativa);
          break;
        case 'suspender':
        case 'reativar': {
          const suspender = acao === 'suspender';
          if (c.suspenso === suspender) { ignorar(c, suspender ? 'CAD-ICMS já está suspenso.' : 'CAD-ICMS não está suspenso.'); continue; }
          c.suspenso = suspender;
          c.situacaoCadastral = suspender ? 'Suspenso' : 'Ativo';
          const sol = this.solicitacao(r, suspender ? 'SUSPENDER_CADASTRO' : 'REATIVAR_CADASTRO', suspender ? 'III — Suspender CAD-ICMS' : 'IV — Reativar CAD-ICMS', [suspender ? 'RF-05' : 'RF-06'], id, undefined, res.loteId);
          const det = this.d.detalhes[id] ?? (this.d.detalhes[id] = {} as CasoDetalhe);
          det.medidas = [...(det.medidas ?? []), { id: sol.id, tipo: suspender ? 'SUSPENSAO' : 'REATIVACAO', status: 'CONCLUIDA', numPortaria: `${String(400 + (sol.id % 500)).padStart(6, '0')}/${hoje().slice(0, 4)}/006`, dataPublicacao: hoje(), justificativa: r.corpo.justificativa, responsavel: this.nomeUsuario(r) }];
          this.evento(r, id, acao.toUpperCase(), suspender ? 'CAD-ICMS suspenso (RF-05)' : 'CAD-ICMS reativado (RF-06)');
          break;
        }
        default:
          throw new ErroDemo(404, 'Não encontrado', 'Ação desconhecida: ' + acao);
      }
      this.atualizarPrazo(c);
      res.processados++;
    }
    return res;
  }

  private cienciaCaso(id: number, r: Requisicao) {
    const c = this.caso(id);
    if (c.status !== 'NOTIFICACAO_EMITIDA') throw new ErroDemo(422, 'Operação não permitida', 'A notificação precisa estar emitida.');
    c.status = 'NOTIFICADO';
    c.dataCienciaNotif = hoje();
    c.tipoCiencia = 'EXPRESSA';
    c.fimPrazo = somarDias(hoje(), Number(this.parametro('prazo.notificacao.atendimento_dias') ?? 30));
    this.atualizarPrazo(c);
    this.evento(r, id, 'CIENCIA', 'Ciência expressa da notificação pelo DT-e (RF-04)');
    return null;
  }

  private parametro(chave: string) {
    return this.d.parametros.find((p) => p.chave === chave)?.valor;
  }

  // ===================================================================== contestação / prorrogação
  private contestacao(id: number) {
    const c = this.d.contestacoes.find((x) => x.id === id);
    if (!c) throw new ErroDemo(404, 'Não encontrado', 'Contestação inexistente.');
    return c;
  }
  private parecer(id: number, r: Requisicao) {
    const c = this.contestacao(id);
    Object.assign(c, {
      status: 'COM_PARECER', numParecer: `${String(this.novoId() % 1000).padStart(3, '0')}/${hoje().slice(0, 4)}`, dataParecer: hoje(),
      resultadoParecer: r.corpo.resultado, textoParecer: r.corpo.texto, auditorParecer: this.nomeUsuario(r), novoValor: r.corpo.novoValor ?? undefined,
      prazoPosParecer: somarDias(hoje(), 30),
    });
    this.evento(r, c.casoId, 'PARECER', `Parecer ${c.numParecer} emitido: ${r.corpo.resultado}`);
    return c;
  }
  private analisarProrrogacao(id: number, r: Requisicao) {
    const p = this.d.prorrogacoes.find((x) => x.id === id)!;
    p.status = r.corpo.deferido ? 'DEFERIDO' : 'INDEFERIDO';
    p.dataFinal = r.corpo.deferido ? r.corpo.dataFinal : undefined;
    p.justifAnalise = r.corpo.justificativa;
    p.analisadoPor = this.nomeUsuario(r);
    p.dataAnalise = hoje();
    if (r.corpo.deferido) {
      const c = this.caso(p.casoId);
      c.fimPrazo = r.corpo.dataFinal;
      this.atualizarPrazo(c);
    }
    this.evento(r, p.casoId, 'PRORROGACAO', `Pedido de prorrogação ${p.status === 'DEFERIDO' ? 'deferido' : 'indeferido'}`);
    return p;
  }

  // ===================================================================== impedimentos
  private incluirImpedimento(r: Requisicao) {
    const c = this.d.contribuintes.find((x) => x.inscricaoEstadual === r.corpo.inscricaoEstadual);
    if (!c) throw new ErroDemo(422, 'Contribuinte não encontrado', 'Inscrição estadual inexistente no cadastro.');
    const origem = this.perfilAtivo(r);
    const i: Impedimento = { id: this.novoId(), contribuinteId: c.id, inscricaoEstadual: c.inscricaoEstadual, cnpj: c.cnpj, razaoSocial: c.razaoSocial,
      origem, origemRotulo: this.d.perfis.find((p) => p.codigo === origem)?.nome ?? origem, data: hoje(), justificativa: r.corpo.justificativa,
      criadoPor: this.usuario(r)!.login, podeLiberar: true };
    this.d.impedimentos.push(i);
    this.sincronizarImpedimentos();
    return i;
  }
  private sincronizarImpedimentos() {
    this.d.casos.forEach((c) => {
      const i = this.d.impedimentos.find((x) => x.inscricaoEstadual === c.inscricaoEstadual);
      c.impedimento = i ? 'Impedido pelo ' + i.origemRotulo : undefined;
    });
  }

  // ===================================================================== ação fiscal
  private acao(id: number) {
    const a = this.d.acoesFiscais.find((x) => x.id === id);
    if (!a) throw new ErroDemo(404, 'Não encontrado', 'Ação fiscal inexistente.');
    return a;
  }
  private comCiencia(a: AcaoFiscal, r: Requisicao): AcaoFiscal {
    const u = this.usuario(r);
    const meu = a.auditores.find((x) => x.usuarioId === u?.id);
    return { ...a, minhaCienciaPendente: a.status === 'MPF_ABERTO' && !!meu && !meu.dataCiencia };
  }
  private mudar(a: AcaoFiscal, status: string) {
    a.status = status;
    a.statusRotulo = ROTULO_ACAO[status];
    const c = this.d.casos.find((x) => x.id === a.casoId);
    if (c) c.acaoFiscalStatus = a.statusRotulo;
  }
  private acoes(r: Requisicao) {
    const st = r.params.getAll('status');
    const lista = this.d.acoesFiscais.filter((a) => !st.length || st.includes(a.status)).sort((a, b) => b.id - a.id).map((a) => this.comCiencia(a, r));
    return paginar(lista, r.params);
  }
  private minhas(r: Requisicao) {
    const u = this.usuario(r);
    return this.d.acoesFiscais.filter((a) => a.numMpf && a.auditores.some((x) => x.usuarioId === u?.id) && !['CONCLUIDA', 'INDEFERIDA'].includes(a.status)).map((a) => this.comCiencia(a, r));
  }
  private solicitarAcao(r: Requisicao) {
    const c = this.caso(r.corpo.casoId);
    if (this.d.acoesFiscais.some((a) => a.casoId === c.id && !['CONCLUIDA', 'INDEFERIDA'].includes(a.status))) {
      throw new ErroDemo(422, 'Operação não permitida', 'Já existe ação fiscal em andamento para este contribuinte.');
    }
    const malha = this.malha(c.malhaId);
    const a: AcaoFiscal = {
      id: this.novoId(), casoId: c.id, malhaCodigo: c.malhaCodigo, malha: malha.tipoNome, razaoSocial: c.razaoSocial, inscricaoEstadual: c.inscricaoEstadual,
      numNotificacao: c.numNotificacao ?? '', status: 'SOLICITADA', statusRotulo: ROTULO_ACAO['SOLICITADA'], dataSolicitacao: hoje(), solicitante: this.nomeUsuario(r),
      excecao: !!r.corpo.excecao, justifExcecao: r.corpo.excecao ? r.corpo.justificativa : undefined,
      auditores: this.d.auditores.filter((x) => (r.corpo.auditorIds as number[]).includes(x.id)).map((x) => ({ usuarioId: x.id, nome: x.nome, matricula: x.matricula })),
      minhaCienciaPendente: false,
    };
    this.d.acoesFiscais.push(a);
    this.mudar(a, 'SOLICITADA');
    this.evento(r, c.id, 'ACAO_FISCAL', 'Ação fiscal solicitada ao Gerente NUFES');
    return a;
  }
  private lote(r: Requisicao, exigido: string, fazer: (a: AcaoFiscal) => void): ResultadoLote {
    const res: ResultadoLote = { processados: 0, ignorados: [], loteId: null };
    for (const id of r.corpo.ids as number[]) {
      const a = this.acao(id);
      if (a.status !== exigido) { res.ignorados.push({ id, descricao: a.razaoSocial, motivo: `Situação atual: ${a.statusRotulo}.` }); continue; }
      fazer(a);
      res.processados++;
    }
    return res;
  }
  private abrirMpf(r: Requisicao) {
    const equipe = r.corpo.auditorIds as number[];
    return this.lote(r, 'SOLICITADA', (a) => {
      if (equipe?.length) a.auditores = this.d.auditores.filter((x) => equipe.includes(x.id)).map((x) => ({ usuarioId: x.id, nome: x.nome, matricula: x.matricula }));
      a.auditores.forEach((x) => (x.dataCiencia = undefined));
      a.numMpf = `${String(this.novoId() % 100000).padStart(5, '0')}/${hoje().slice(0, 4)}`;
      a.dataAberturaMpf = hoje();
      a.prazoExecucao = somarDias(hoje(), Number(this.parametro('prazo.mpf.execucao_dias') ?? 120));
      this.mudar(a, 'MPF_ABERTO');
      this.solicitacao(r, 'ABRIR_MPF', 'V — Abrir MPF', ['RF-07', 'RF-08'], a.casoId, a.id);
    });
  }
  private cienciaAuditor(id: number, r: Requisicao) {
    const a = this.acao(id);
    const u = this.usuario(r)!;
    const meu = a.auditores.find((x) => x.usuarioId === u.id);
    if (!meu || a.status !== 'MPF_ABERTO') throw new ErroDemo(422, 'Operação não permitida', 'Você não está designado neste MPF ou a ciência já foi registrada.');
    meu.dataCiencia = hoje();
    if (a.auditores.every((x) => x.dataCiencia)) {
      a.numTif = `${String(this.novoId() % 100000).padStart(5, '0')}/${hoje().slice(0, 4)}`;
      a.dataTif = hoje();
      this.mudar(a, 'TIF_AGUARDANDO_CIENCIA');
      this.solicitacao(r, 'CIENTIFICAR_MPF', 'V — Cientificar MPF', ['RF-09', 'RF-10', 'RF-11', 'RF-12'], a.casoId, a.id);
      return { ...this.comCiencia(a, r), status: 'TIF_EM_EMISSAO' };
    }
    return this.comCiencia(a, r);
  }
  private cienciaAcao(id: number, r: Requisicao) {
    const a = this.acao(id);
    if (a.status === 'TIF_AGUARDANDO_CIENCIA') {
      a.dataCienciaTif = hoje();
      a.numAuto = `${String(this.novoId() % 100000).padStart(5, '0')}/${hoje().slice(0, 4)}`;
      a.dataLavratura = hoje();
      a.valorAuto = this.caso(a.casoId).icmsDiferenca;
      this.mudar(a, 'AUTO_LAVRADO');
      this.solicitacao(r, 'CIENCIA_TIF', 'VI — Ciência do TIF e lavratura do AI-e', ['RF-13', 'RF-14', 'RF-15', 'RF-16'], a.casoId, a.id);
    } else if (a.status === 'AUTO_AGUARDANDO_CIENCIA') {
      a.dataCienciaAuto = hoje();
      a.numTermoEnc = `${String(this.novoId() % 100000).padStart(5, '0')}/${hoje().slice(0, 4)}`;
      a.dataTermoEnc = hoje();
      this.mudar(a, 'AGUARDANDO_RATIFICACAO');
      this.solicitacao(r, 'CIENCIA_AUTO', 'X — Ciência do AI-e e termo de encerramento', ['RF-19', 'RF-20', 'RF-21'], a.casoId, a.id);
    } else {
      throw new ErroDemo(422, 'Operação não permitida', 'A ação fiscal não está aguardando ciência do contribuinte.');
    }
    return null;
  }

  // ===================================================================== catálogo e planejamento
  private indicador(id: number) {
    const i = this.d.indicadores.find((x) => x.id === id);
    if (!i) throw new ErroDemo(404, 'Não encontrado', 'Indicador inexistente.');
    return i;
  }
  private salvarIndicador(i: Indicador) {
    const g = this.d.grupos.find((x) => x.id === i.grupoId);
    const t = this.d.tiposMalha.find((x) => x.id === i.tipoMalhaId);
    const novo = { ...i, grupoNome: g?.nome, tipoMalhaCodigo: t?.codigo };
    if (i.id) this.d.indicadores = this.d.indicadores.map((x) => (x.id === i.id ? novo : x));
    else this.d.indicadores.push({ ...novo, id: this.novoId(), codigo: i.codigo || 'IND-' + (this.d.indicadores.length + 1) });
    return novo;
  }
  private adicionarAoPlano(malhaId: number, c: { indicadorIds: number[]; parametros: Record<string, string> }) {
    const plano = (this.d.planos[malhaId] ??= []);
    for (const id of c.indicadorIds) {
      if (plano.some((p) => p.indicadorId === id)) continue;
      const i = this.indicador(id);
      plano.push({ id: this.novoId(), indicadorId: id, nome: i.nome, grupo: i.grupoNome ?? '', grupoId: i.grupoId, metrica: i.metrica, provisorio: i.provisorio, parametros: { ...c.parametros } });
    }
    return null;
  }
  private executar(malhaId: number, indicadorId: number, r: Requisicao): Execucao {
    const item = (this.d.planos[malhaId] ?? []).find((p) => p.indicadorId === indicadorId)!;
    const id = this.novoId();
    // amostra fictícia de contribuintes apontados, ordenada pelo potencial
    const amostra = [...this.d.contribuintes].sort((a, b) => ((a.id * 7919 + indicadorId) % 997) - ((b.id * 7919 + indicadorId) % 997)).slice(0, 120 + (indicadorId % 5) * 40);
    this.d.resultados[id] = amostra.map((c, k) => ({
      id: id * 1000 + k, inscricaoEstadual: c.inscricaoEstadual, razaoSocial: c.razaoSocial,
      quantidade: 1 + ((c.id * 13) % 40), valor: Math.round(5000 + ((c.id * 7717) % 450000)), selecionado: true,
    })).sort((a, b) => (item.metrica === 'QUANTIDADE' ? b.quantidade! - a.quantidade! : b.valor! - a.valor!));
    const e: Execucao = { id, indicadorId, status: 'CONCLUIDA', inicio: agora(), fim: agora(), qtdResultados: amostra.length, selecionados: amostra.length, executadoPor: this.usuario(r)!.login };
    item.ultimaExecucao = e;
    return e;
  }
  private selecionar(execId: number, c: { todos: boolean; ids: number[]; selecionado: boolean }) {
    const lista = this.d.resultados[execId] ?? [];
    lista.forEach((x) => { if (c.todos || c.ids.includes(x.id)) x.selecionado = c.selecionado; });
    const n = lista.filter((x) => x.selecionado).length;
    Object.values(this.d.planos).flat().forEach((p) => { if (p.ultimaExecucao?.id === execId) p.ultimaExecucao.selecionados = n; });
    return n;
  }
  private consolidar(malhaId: number) {
    const m = this.malha(malhaId);
    m.situacao = 'ATIVA';
    m.consolidadaEm = agora();
    const total = this.d.casos.filter((c) => c.malhaId === malhaId).length;
    return { contribuintes: total, novos: 0, atualizados: total, regra: 'maior potencial; desempate pela prioridade do grupo (simulação)' };
  }

  // ===================================================================== parametrizações
  private alterarParametro(id: number, r: Requisicao) {
    const p = this.d.parametros.find((x) => x.id === id)!;
    const vigencia: string = r.corpo.vigenteAPartir ?? hoje();
    const anterior = p.valor;
    if (vigencia > hoje()) {
      p.valorProgramado = r.corpo.valor;
      p.vigenciaProgramada = vigencia;
    } else {
      p.valor = r.corpo.valor;
      p.vigenteDesde = vigencia;
    }
    p.atualizadoEm = agora();
    p.atualizadoPor = this.usuario(r)!.login;
    this.d.historicoParametros.push({ id: this.novoId(), parametroId: id, dataHora: agora(), usuario: this.nomeUsuario(r), operacao: vigencia > hoje() ? 'PROGRAMACAO' : 'ALTERACAO',
      valorAnterior: anterior, valorNovo: r.corpo.valor, vigencia, justificativa: r.corpo.justificativa });
    return p;
  }
  private cancelarProgramacao(id: number, r: Requisicao) {
    const p = this.d.parametros.find((x) => x.id === id)!;
    this.d.historicoParametros.push({ id: this.novoId(), parametroId: id, dataHora: agora(), usuario: this.nomeUsuario(r), operacao: 'CANCELAMENTO',
      valorAnterior: p.valorProgramado ?? '', valorNovo: p.valor, vigencia: p.vigenciaProgramada ?? hoje(), justificativa: r.corpo.justificativa });
    p.valorProgramado = undefined;
    p.vigenciaProgramada = undefined;
    return p;
  }

  // ===================================================================== integração
  private solicitacoes(p: URLSearchParams) {
    const st = p.getAll('status');
    return paginar(this.d.solicitacoes.filter((s) => !st.length || st.includes(s.status)).sort((a, b) => b.id - a.id), p);
  }
  private solicitacaoPorId(id: number) {
    const s = this.d.solicitacoes.find((x) => x.id === id);
    if (!s) throw new ErroDemo(404, 'Não encontrado', 'Demanda inexistente.');
    return s;
  }
  /** Registra uma demanda já concluída (na demonstração o SATE responde na hora). */
  private solicitacao(r: Requisicao, demanda: string, descricao: string, servicos: string[], casoId?: number, acaoFiscalId?: number, loteId?: number | null) {
    const s: Solicitacao = {
      id: this.novoId(), loteId: loteId ?? undefined, demanda, demandaDescricao: descricao, casoId, acaoFiscalId, status: 'CONCLUIDA',
      etapaAtual: servicos.length, totalEtapas: servicos.length, tentativas: 1, criadoEm: agora(), criadoPor: this.usuario(r)!.login, atualizadoEm: agora(),
      etapas: servicos.map((rf, ordem) => ({ ordem, servico: rf, descricao: 'Serviço ' + rf + ' (simulado)', caminho: 'SATE — ambiente de demonstração', status: 'CONCLUIDA', inicio: agora(), fim: agora(), retorno: '{"simulado":true}' })),
    };
    this.d.solicitacoes.push(s);
    return s;
  }

  // ===================================================================== administração
  private usuarios(p: URLSearchParams) {
    const f = normalizar(p.get('filtro') ?? '');
    return paginar(this.d.usuarios.filter((u) => !f || normalizar(u.nome).includes(f) || u.login.includes(f) || (u.matricula ?? '').includes(f)).sort((a, b) => a.nome.localeCompare(b.nome)), p, 20);
  }

  // ===================================================================== portal
  private portalMalhas(ie: string) {
    const visiveis = ['A_NOTIFICAR', ...ABAS['NOTIFICADOS']];
    return this.d.casos.filter((c) => c.inscricaoEstadual === ie.trim() && visiveis.includes(c.status)).map((c) => {
      const m = this.malha(c.malhaId);
      return { casoId: c.id, malhaCodigo: c.malhaCodigo, malhaNome: m.tipoNome, periodoInicio: m.periodoInicio, periodoFim: m.periodoFim,
        dataExibicao: c.dataExibicaoPortal ?? hoje(), situacao: c.statusRotulo, numNotificacao: c.numNotificacao, fimPrazo: c.fimPrazo,
        valor: c.icmsDiferenca, razaoSocial: c.razaoSocial, inscricaoEstadual: c.inscricaoEstadual, cnpj: c.cnpj };
    });
  }
  private contestar(casoId: number, r: Requisicao) {
    const c = this.caso(casoId);
    const ids: number[] = r.corpo.documentoIds;
    this.documentos(casoId).forEach((d) => { if (ids.includes(d.id)) d.situacao = 'CONTESTADA'; });
    const x: Contestacao = {
      id: this.novoId(), numero: `CONT-${hoje().slice(0, 4)}-${String(this.d.contestacoes.length + 300)}`, casoId, malha: c.malhaCodigo, razaoSocial: c.razaoSocial,
      inscricaoEstadual: c.inscricaoEstadual, numNotificacao: c.numNotificacao ?? '', dataContestacao: hoje(), prazoAnalise: somarDias(hoje(), 30),
      tipoJustificativa: r.corpo.tipoJustificativa, titulo: r.corpo.titulo, descricao: r.corpo.descricao, lida: false, status: 'SEM_PARECER', qtdDocumentos: ids.length,
    };
    this.d.contestacoes.unshift(x);
    this.evento(r, casoId, 'CONTESTACAO', `Contestação ${x.numero} recebida pelo portal (${ids.length} NF-e)`);
    return x;
  }
  private pedirProrrogacao(casoId: number, r: Requisicao) {
    const c = this.caso(casoId);
    const p: Prorrogacao = {
      id: this.novoId(), casoId, malha: c.malhaCodigo, razaoSocial: c.razaoSocial, inscricaoEstadual: c.inscricaoEstadual, numNotificacao: c.numNotificacao ?? '',
      fimPrazoAtual: c.fimPrazo ?? hoje(), dataPedido: hoje(), dataSolicitada: r.corpo.dataSolicitada, origem: 'PORTAL', motivo: r.corpo.motivo, status: 'EM_ANALISE',
    };
    this.d.prorrogacoes.unshift(p);
    this.evento(r, casoId, 'PRORROGACAO', 'Pedido de prorrogação de prazo recebido pelo portal');
    return p;
  }

  private novoId() {
    return ++this.seq;
  }
}
