// Contratos da API do Painel de Malhas Fiscais

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface ResultadoLote {
  processados: number;
  ignorados: { id: number; descricao: string; motivo: string }[];
  loteId: number | null;
}

export interface ConfiguracaoCliente {
  cliente: {
    sigla: string;
    nomeOrgao: string;
    nomeCurto: string;
    uf: string;
    municipioSede: string;
    nomeSistema: string;
    sistemaLegado: string;
    canalEletronico: string;
    portalAutorregularizacao: string;
    unidadeFiscalizacao: string;
    unidadeCobranca: string;
    endereco: string;
    tema: { corPrimaria: string; corPrimariaHover: string; logoUrl: string };
  };
  modoAutenticacao: string;
  versao: string;
  /** Verdadeiro na versão de demonstração (GitHub Pages), que roda sem back-end. */
  demonstracao?: boolean;
}

export interface PerfilResumo {
  codigo: string;
  nome: string;
}

export interface Sessao {
  login: string;
  nome: string;
  perfilAtivo: string | null;
  perfis: PerfilResumo[];
  permissoes: string[];
}

export type Aba = 'EM_ANALISE' | 'A_NOTIFICAR' | 'NOTIFICADOS' | 'ENCERRADOS' | 'CANCELADOS' | 'EXCLUIDOS';

export interface Malha {
  id: number;
  tipoMalhaId: number;
  tipoCodigo: string;
  tipoNome: string;
  nome: string;
  periodoInicio: string;
  periodoFim: string;
  situacao: string;
  observacao?: string;
  consolidadaEm?: string;
  contagemPorAba: Partial<Record<Aba, number>>;
  total: number;
}

export interface CasoResumo {
  id: number;
  malhaId: number;
  malhaCodigo: string;
  posicao: number;
  inscricaoEstadual: string;
  cnpj: string;
  razaoSocial: string;
  situacaoCadastral: string;
  potencialQtd: number;
  potencialValor: number;
  icmsDestacado: number;
  icmsDeclarado: number;
  icmsDiferenca: number;
  status: string;
  statusRotulo: string;
  suspenso: boolean;
  dataExibicaoPortal?: string;
  numProcesso?: string;
  numNotificacao?: string;
  notificadoPor?: string;
  dataEmissaoNotif?: string;
  dataCienciaNotif?: string;
  tipoCiencia?: string;
  fimPrazo?: string;
  diasRestantes?: number;
  dataEncerramento?: string;
  tipoEncerramento?: string;
  valorRecuperado?: number;
  excluidoPor?: string;
  dataExclusao?: string;
  justifExclusao?: string;
  impedimento?: string;
  acaoFiscalStatus?: string;
  numMpf?: string;
  integracaoEmAndamento: boolean;
  integracaoComErro: boolean;
}

export interface CasoDetalhe {
  caso: CasoResumo;
  malhaNome: string;
  periodoInicio: string;
  periodoFim: string;
  municipio: string;
  email: string;
  telefone: string;
  qtdDocumentos: number;
  medidas: { id: number; tipo: string; status: string; numPortaria: string; dataPublicacao: string; justificativa: string; responsavel: string }[];
  contestacoes: { id: number; numero: string; data: string; titulo: string; status: string; numParecer: string; resultado: string }[];
  prorrogacoes: { id: number; dataPedido: string; dataSolicitada: string; status: string; dataFinal: string }[];
  acaoFiscal: { id: number; status: string; statusRotulo: string; numMpf: string; numTif: string; numAuto: string; valorAuto: number; numTermoEnc: string } | null;
  integracoes: { id: number; demanda: string; status: string; etapaAtual: number; totalEtapas: number; ultimoErro: string; criadoEm: string }[];
}

export interface DocumentoFiscal {
  id: number;
  casoId: number;
  chaveAcesso: string;
  modelo: string;
  operacao: string;
  numero: string;
  dataEmissao: string;
  cnpjContraparte: string;
  cfop: string;
  valorTotal: number;
  valorIcms: number;
  valorDeclarado: number;
  indicador: string;
  situacao: string;
}

export interface CasoEvento {
  id: number;
  dataHora: string;
  tipo: string;
  descricao: string;
  usuario: string;
  perfil: string;
}

export interface Contestacao {
  id: number;
  numero: string;
  casoId: number;
  malha: string;
  razaoSocial: string;
  inscricaoEstadual: string;
  numNotificacao: string;
  dataContestacao: string;
  prazoAnalise: string;
  tipoJustificativa: string;
  titulo: string;
  descricao: string;
  lida: boolean;
  status: string;
  numParecer?: string;
  dataParecer?: string;
  resultadoParecer?: string;
  textoParecer?: string;
  auditorParecer?: string;
  novoValor?: number;
  prazoPosParecer?: string;
  qtdDocumentos: number;
}

export interface Prorrogacao {
  id: number;
  casoId: number;
  malha: string;
  razaoSocial: string;
  inscricaoEstadual: string;
  numNotificacao: string;
  fimPrazoAtual: string;
  dataPedido: string;
  dataSolicitada: string;
  origem: string;
  motivo: string;
  status: string;
  dataFinal?: string;
  justifAnalise?: string;
  analisadoPor?: string;
  dataAnalise?: string;
}

export interface AcaoFiscal {
  id: number;
  casoId: number;
  malhaCodigo: string;
  malha: string;
  razaoSocial: string;
  inscricaoEstadual: string;
  numNotificacao: string;
  status: string;
  statusRotulo: string;
  dataSolicitacao: string;
  solicitante: string;
  excecao: boolean;
  justifExcecao?: string;
  numMpf?: string;
  dataAberturaMpf?: string;
  prazoExecucao?: string;
  numTif?: string;
  dataTif?: string;
  dataCienciaTif?: string;
  numAuto?: string;
  dataLavratura?: string;
  valorAuto?: number;
  dataHomologacao?: string;
  dataEnvioDte?: string;
  dataCienciaAuto?: string;
  numTermoEnc?: string;
  dataTermoEnc?: string;
  dataRatificacao?: string;
  auditores: { usuarioId: number; nome: string; matricula: string; dataCiencia?: string }[];
  minhaCienciaPendente: boolean;
}

export interface Impedimento {
  id: number;
  contribuinteId: number;
  inscricaoEstadual: string;
  cnpj: string;
  razaoSocial: string;
  origem: string;
  origemRotulo: string;
  data: string;
  justificativa: string;
  criadoPor: string;
  podeLiberar: boolean;
}

export interface Parametro {
  id: number;
  chave: string;
  aba: string;
  secao: string;
  nome: string;
  natureza: 'FIXO' | 'PROCEDIMENTO' | 'RETORNO' | 'REFERENCIA';
  tipoValor: string;
  valor: string;
  editavel: boolean;
  vigenteDesde?: string;
  valorProgramado?: string;
  vigenciaProgramada?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface ParametroHistorico {
  id: number;
  parametroId: number;
  dataHora: string;
  usuario: string;
  operacao: string;
  valorAnterior: string;
  valorNovo: string;
  vigencia: string;
  justificativa: string;
}

export interface TipoMalha {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  metrica: 'QUANTIDADE' | 'VALOR';
  ativo: boolean;
  ordem: number;
}

export interface GrupoIndicador {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface ParametroIndicador {
  id?: number;
  nome: string;
  tipo: 'INTEIRO' | 'DECIMAL' | 'TEXTO' | 'DATA';
  obrigatorio: boolean;
  valorPadrao?: string;
}

export interface Indicador {
  id?: number;
  codigo?: string;
  nome: string;
  grupoId?: number;
  grupoNome?: string;
  tipoMalhaId?: number;
  tipoMalhaCodigo?: string;
  metrica: 'QUANTIDADE' | 'VALOR';
  origem: 'VIEW' | 'SQL';
  viewOrigem?: string;
  consultaSql?: string;
  riscoPadrao: 'BAIXO' | 'MEDIO' | 'ALTO';
  descricao?: string;
  ativo: boolean;
  provisorio: boolean;
  parametros: ParametroIndicador[];
}

export interface Execucao {
  id: number;
  indicadorId: number;
  status: 'EXECUTANDO' | 'CONCLUIDA' | 'ERRO';
  inicio: string;
  fim?: string;
  qtdResultados: number;
  selecionados: number;
  erro?: string;
  executadoPor: string;
}

export interface IndicadorPlano {
  id: number;
  indicadorId: number;
  nome: string;
  grupo: string;
  grupoId?: number;
  metrica: 'QUANTIDADE' | 'VALOR';
  provisorio: boolean;
  parametros: Record<string, string>;
  prioridadeGrupo?: number;
  ultimaExecucao?: Execucao;
}

export interface ResultadoIndicador {
  id: number;
  inscricaoEstadual: string;
  razaoSocial?: string;
  quantidade?: number;
  valor?: number;
  selecionado: boolean;
}

export interface Solicitacao {
  id: number;
  loteId?: number;
  demanda: string;
  demandaDescricao: string;
  casoId?: number;
  acaoFiscalId?: number;
  status: string;
  etapaAtual: number;
  totalEtapas: number;
  tentativas: number;
  ultimoErro?: string;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm?: string;
  etapas: { ordem: number; servico: string; descricao: string; caminho: string; status: string; inicio?: string; fim?: string; retorno?: string; erro?: string }[];
}

export interface Contadores {
  contestacoesNaoLidas: number;
  prorrogacoesPendentes: number;
  mpfPendentes: number;
  autosPendentes: number;
  mpfsDesignados: number;
  aguardandoRatificacao: number;
}

export interface Dashboard {
  totalContribuintes: number;
  emAnalise: number;
  aNotificar: number;
  notificados: number;
  encerrados: number;
  suspensos: number;
  potencialTotal: number;
  valorRecuperado: number;
  prazosVencidos: number;
  acoesFiscaisAtivas: number;
  porStatus: Record<string, number>;
  malhas: Malha[];
}

export interface UsuarioAdmin {
  id: number;
  login: string;
  nome: string;
  cargo: string;
  matricula: string;
  email: string;
  ativo: boolean;
  perfis: string[];
}

export interface PerfilDetalhe {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  permissoes: string[];
}

export interface Permissao {
  codigo: string;
  modulo: string;
  descricao: string;
}

export interface Contribuinte {
  id: number;
  inscricaoEstadual: string;
  cnpj: string;
  razaoSocial: string;
  situacaoCadastral: string;
  municipio: string;
  email: string;
  telefone: string;
}

export interface MalhaPortal {
  casoId: number;
  malhaCodigo: string;
  malhaNome: string;
  periodoInicio: string;
  periodoFim: string;
  dataExibicao: string;
  situacao: string;
  numNotificacao?: string;
  fimPrazo?: string;
  valor: number;
  razaoSocial: string;
  inscricaoEstadual: string;
  cnpj: string;
}

export interface UsuarioResumo {
  id: number;
  nome: string;
  matricula: string;
  cargo: string;
}
