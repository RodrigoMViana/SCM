import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AcaoFiscal, CasoDetalhe, CasoEvento, CasoResumo, Contadores, Contestacao, Contribuinte, Dashboard,
  DocumentoFiscal, Execucao, GrupoIndicador, Impedimento, Indicador, IndicadorPlano, Malha, MalhaPortal, Pagina,
  Parametro, ParametroHistorico, PerfilDetalhe, Permissao, Prorrogacao, ResultadoIndicador, ResultadoLote,
  Solicitacao, TipoMalha, UsuarioAdmin, UsuarioResumo,
} from './models';

type Params = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

function params(p: Params = {}): HttpParams {
  let hp = new HttpParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => (hp = hp.append(k, String(x))));
    else hp = hp.set(k, String(v));
  }
  return hp;
}

/** Cliente tipado da API REST (um ponto único facilita versionamento e testes). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // --------------------------------------------------------------- painel
  contadores(): Observable<Contadores> {
    return this.http.get<Contadores>('/api/painel/contadores');
  }
  dashboard(malhaId?: number): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/dashboard', { params: params({ malhaId }) });
  }
  contribuintes(filtro: string, pagina: number, tamanho: number): Observable<Pagina<Contribuinte>> {
    return this.http.get<Pagina<Contribuinte>>('/api/contribuintes', { params: params({ filtro, pagina, tamanho }) });
  }

  // --------------------------------------------------------------- malhas e casos
  malhas(): Observable<Malha[]> {
    return this.http.get<Malha[]>('/api/malhas');
  }
  malha(id: number): Observable<Malha> {
    return this.http.get<Malha>(`/api/malhas/${id}`);
  }
  salvarMalha(id: number | null, f: Partial<Malha> & { tipoMalhaId?: number }): Observable<Malha> {
    return id ? this.http.put<Malha>(`/api/malhas/${id}`, f) : this.http.post<Malha>('/api/malhas', f);
  }
  casos(malhaId: number, p: Params): Observable<Pagina<CasoResumo>> {
    return this.http.get<Pagina<CasoResumo>>(`/api/malhas/${malhaId}/casos`, { params: params(p) });
  }
  pesquisarCasos(p: Params): Observable<Pagina<CasoResumo>> {
    return this.http.get<Pagina<CasoResumo>>('/api/casos', { params: params(p) });
  }
  urlExportacao(malhaId: number, aba?: string, texto?: string): string {
    return `/api/malhas/${malhaId}/casos/exportar?${params({ aba, texto }).toString()}`;
  }
  exportar(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
  caso(id: number): Observable<CasoDetalhe> {
    return this.http.get<CasoDetalhe>(`/api/casos/${id}`);
  }
  documentos(casoId: number, pagina: number, tamanho: number, portal = false): Observable<Pagina<DocumentoFiscal>> {
    const base = portal ? '/api/portal/casos' : '/api/casos';
    return this.http.get<Pagina<DocumentoFiscal>>(`${base}/${casoId}/documentos`, { params: params({ pagina, tamanho }) });
  }
  historico(casoId: number): Observable<CasoEvento[]> {
    return this.http.get<CasoEvento[]>(`/api/casos/${casoId}/historico`);
  }
  acaoCaso(acao: string, corpo: { ids: number[]; justificativa?: string; tipo?: string; valorRecuperado?: number }): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>(`/api/casos/${acao}`, corpo);
  }
  simularCienciaCaso(id: number): Observable<void> {
    return this.http.post<void>(`/api/casos/${id}/simular-ciencia`, {});
  }

  // --------------------------------------------------------------- contestação / prorrogação
  contestacoes(comParecer: boolean, pagina: number, tamanho: number): Observable<Pagina<Contestacao>> {
    return this.http.get<Pagina<Contestacao>>('/api/contestacoes', { params: params({ comParecer, pagina, tamanho }) });
  }
  contestacao(id: number): Observable<Contestacao> {
    return this.http.get<Contestacao>(`/api/contestacoes/${id}`);
  }
  emitirParecer(id: number, p: { resultado: string; texto: string; novoValor?: number | null }): Observable<Contestacao> {
    return this.http.post<Contestacao>(`/api/contestacoes/${id}/parecer`, p);
  }
  prorrogacoes(analisados: boolean, pagina: number, tamanho: number): Observable<Pagina<Prorrogacao>> {
    return this.http.get<Pagina<Prorrogacao>>('/api/prorrogacoes', { params: params({ analisados, pagina, tamanho }) });
  }
  analisarProrrogacao(id: number, a: { deferido: boolean; dataFinal?: string | null; justificativa?: string }): Observable<Prorrogacao> {
    return this.http.post<Prorrogacao>(`/api/prorrogacoes/${id}/analisar`, a);
  }

  // --------------------------------------------------------------- impedimentos
  impedimentos(origem?: string): Observable<Impedimento[]> {
    return this.http.get<Impedimento[]>('/api/impedimentos', { params: params({ origem }) });
  }
  incluirImpedimento(inscricaoEstadual: string, justificativa: string): Observable<Impedimento> {
    return this.http.post<Impedimento>('/api/impedimentos', { inscricaoEstadual, justificativa });
  }
  liberarImpedimento(id: number): Observable<void> {
    return this.http.delete<void>(`/api/impedimentos/${id}`);
  }

  // --------------------------------------------------------------- ação fiscal
  acoesFiscais(p: Params): Observable<Pagina<AcaoFiscal>> {
    return this.http.get<Pagina<AcaoFiscal>>('/api/acoes-fiscais', { params: params(p) });
  }
  minhasAcoes(): Observable<AcaoFiscal[]> {
    return this.http.get<AcaoFiscal[]>('/api/acoes-fiscais/minhas');
  }
  solicitarAcaoFiscal(r: { casoId: number; auditorIds: number[]; excecao: boolean; justificativa?: string }): Observable<AcaoFiscal> {
    return this.http.post<AcaoFiscal>('/api/acoes-fiscais', r);
  }
  abrirMpf(ids: number[], auditorIds: number[]): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>('/api/acoes-fiscais/abrir-mpf', { ids, auditorIds });
  }
  indeferirAcao(id: number, justificativa: string): Observable<AcaoFiscal> {
    return this.http.post<AcaoFiscal>(`/api/acoes-fiscais/${id}/indeferir`, { justificativa });
  }
  cienciaAuditor(id: number): Observable<AcaoFiscal> {
    return this.http.post<AcaoFiscal>(`/api/acoes-fiscais/${id}/ciencia-auditor`, {});
  }
  homologar(ids: number[]): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>('/api/acoes-fiscais/homologar', { ids });
  }
  ratificar(ids: number[]): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>('/api/acoes-fiscais/ratificar', { ids });
  }
  simularCienciaAcao(id: number): Observable<void> {
    return this.http.post<void>(`/api/acoes-fiscais/${id}/simular-ciencia`, {});
  }
  auditores(): Observable<UsuarioResumo[]> {
    return this.http.get<UsuarioResumo[]>('/api/usuarios/auditores');
  }

  // --------------------------------------------------------------- catálogo e planejamento
  tiposMalha(): Observable<TipoMalha[]> {
    return this.http.get<TipoMalha[]>('/api/tipos-malha');
  }
  salvarTipoMalha(t: Partial<TipoMalha>): Observable<TipoMalha> {
    return this.http.post<TipoMalha>('/api/tipos-malha', t);
  }
  grupos(): Observable<GrupoIndicador[]> {
    return this.http.get<GrupoIndicador[]>('/api/grupos-indicadores');
  }
  salvarGrupo(g: Partial<GrupoIndicador>): Observable<GrupoIndicador> {
    return this.http.post<GrupoIndicador>('/api/grupos-indicadores', g);
  }
  indicadores(): Observable<Indicador[]> {
    return this.http.get<Indicador[]>('/api/indicadores');
  }
  indicador(id: number): Observable<Indicador> {
    return this.http.get<Indicador>(`/api/indicadores/${id}`);
  }
  salvarIndicador(i: Indicador): Observable<Indicador> {
    return this.http.post<Indicador>('/api/indicadores', i);
  }
  indicadoresDoPlano(malhaId: number): Observable<IndicadorPlano[]> {
    return this.http.get<IndicadorPlano[]>(`/api/malhas/${malhaId}/indicadores`);
  }
  adicionarIndicadores(malhaId: number, indicadorIds: number[], parametros: Record<string, string>): Observable<void> {
    return this.http.post<void>(`/api/malhas/${malhaId}/indicadores`, { indicadorIds, parametros });
  }
  removerIndicador(malhaId: number, indicadorId: number): Observable<void> {
    return this.http.delete<void>(`/api/malhas/${malhaId}/indicadores/${indicadorId}`);
  }
  executarIndicador(malhaId: number, indicadorId: number): Observable<Execucao> {
    return this.http.post<Execucao>(`/api/malhas/${malhaId}/indicadores/${indicadorId}/executar`, {});
  }
  execucoes(malhaId: number): Observable<Execucao[]> {
    return this.http.get<Execucao[]>(`/api/malhas/${malhaId}/execucoes`);
  }
  resultados(execucaoId: number, pagina: number, tamanho: number): Observable<Pagina<ResultadoIndicador>> {
    return this.http.get<Pagina<ResultadoIndicador>>(`/api/execucoes/${execucaoId}/resultados`, { params: params({ pagina, tamanho }) });
  }
  selecionar(execucaoId: number, todos: boolean, ids: number[], selecionado: boolean): Observable<number> {
    return this.http.put<number>(`/api/execucoes/${execucaoId}/selecao`, { todos, ids, selecionado });
  }
  prioridades(malhaId: number, mapa: Record<number, number>): Observable<void> {
    return this.http.put<void>(`/api/malhas/${malhaId}/prioridades`, mapa);
  }
  consolidar(malhaId: number): Observable<{ contribuintes: number; novos: number; atualizados: number; regra: string }> {
    return this.http.post<{ contribuintes: number; novos: number; atualizados: number; regra: string }>(`/api/malhas/${malhaId}/consolidar`, {});
  }

  // --------------------------------------------------------------- parametrizações
  parametros(aba?: string): Observable<Parametro[]> {
    return this.http.get<Parametro[]>('/api/parametros', { params: params({ aba }) });
  }
  alterarParametro(id: number, a: { valor: string; vigenteAPartir?: string | null; justificativa: string }): Observable<Parametro> {
    return this.http.put<Parametro>(`/api/parametros/${id}`, a);
  }
  cancelarProgramacao(id: number, justificativa: string): Observable<Parametro> {
    return this.http.post<Parametro>(`/api/parametros/${id}/cancelar-programacao`, { justificativa });
  }
  historicoParametros(parametroId?: number): Observable<ParametroHistorico[]> {
    return this.http.get<ParametroHistorico[]>('/api/parametros/historico', { params: params({ parametroId }) });
  }

  // --------------------------------------------------------------- integração
  solicitacoes(p: Params): Observable<Pagina<Solicitacao>> {
    return this.http.get<Pagina<Solicitacao>>('/api/integracao/solicitacoes', { params: params(p) });
  }
  solicitacao(id: number): Observable<Solicitacao> {
    return this.http.get<Solicitacao>(`/api/integracao/solicitacoes/${id}`);
  }
  reprocessar(id: number): Observable<Solicitacao> {
    return this.http.post<Solicitacao>(`/api/integracao/solicitacoes/${id}/reprocessar`, {});
  }
  executarCiencia(): Observable<{ notificacoes: number; tifs: number; autos: number }> {
    return this.http.post<{ notificacoes: number; tifs: number; autos: number }>('/api/integracao/ciencia/executar', {});
  }
  resumoIntegracao(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>('/api/integracao/resumo');
  }

  // --------------------------------------------------------------- administração
  usuarios(filtro: string, pagina: number, tamanho: number): Observable<Pagina<UsuarioAdmin>> {
    return this.http.get<Pagina<UsuarioAdmin>>('/api/admin/usuarios', { params: params({ filtro, pagina, tamanho }) });
  }
  atualizarPerfisUsuario(id: number, perfis: string[]): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`/api/admin/usuarios/${id}/perfis`, perfis);
  }
  perfisAdmin(): Observable<PerfilDetalhe[]> {
    return this.http.get<PerfilDetalhe[]>('/api/admin/perfis');
  }
  permissoes(): Observable<Permissao[]> {
    return this.http.get<Permissao[]>('/api/admin/permissoes');
  }
  atualizarPermissoesPerfil(codigo: string, permissoes: string[]): Observable<PerfilDetalhe> {
    return this.http.put<PerfilDetalhe>(`/api/admin/perfis/${codigo}/permissoes`, permissoes);
  }

  // --------------------------------------------------------------- portal (contribuinte)
  portalMalhas(ie: string): Observable<MalhaPortal[]> {
    return this.http.get<MalhaPortal[]>('/api/portal/malhas', { params: params({ ie }) });
  }
  portalContestar(casoId: number, c: { tipoJustificativa: string; titulo: string; descricao: string; documentoIds: number[] }): Observable<Contestacao> {
    return this.http.post<Contestacao>(`/api/portal/casos/${casoId}/contestacoes`, c);
  }
  portalProrrogar(casoId: number, p: { dataSolicitada: string; motivo: string }): Observable<Prorrogacao> {
    return this.http.post<Prorrogacao>(`/api/portal/casos/${casoId}/prorrogacoes`, p);
  }
}
