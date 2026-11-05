import { CurrencyPipe, DatePipe, DecimalPipe, Location } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { ApiService } from '../../core/api.service';
import { ConfigService } from '../../core/config.service';
import { CasoDetalhe, CasoEvento, DocumentoFiscal } from '../../core/models';
import { StatusTagComponent, TabelaServidor } from '../../shared/ui';

/** Detalhes da Inconsistência (PM-016): dados, relação de notas, histórico e integrações. */
@Component({
  selector: 'app-caso-detalhe',
  imports: [RouterLink, DatePipe, CurrencyPipe, DecimalPipe, NzTableModule, NzTabsModule, NzTimelineModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      @if (d(); as d) {
        <div class="pagina-cabecalho">
          <div>
            <a class="suave" (click)="voltar()" style="cursor: pointer"><nz-icon nzType="arrow-left" /> Voltar</a>
            <h1 style="margin-top: 6px">{{ d.caso.razaoSocial }}</h1>
            <div class="subtitulo">Detalhes da inconsistência · Malha {{ d.caso.malhaCodigo }} — {{ d.malhaNome }}</div>
          </div>
          <div class="barra-acoes">
            <mf-status [valor]="d.caso.status" [rotulo]="d.caso.statusRotulo" />
            @if (d.caso.suspenso) { <mf-status valor="Suspenso" rotulo="CAD-ICMS suspenso" /> }
          </div>
        </div>

        <div class="grade grade-4">
          <div class="cartao kpi"><span class="rotulo">ICMS destacado</span><span class="valor">{{ d.caso.icmsDestacado | currency }}</span></div>
          <div class="cartao kpi"><span class="rotulo">ICMS declarado</span><span class="valor">{{ d.caso.icmsDeclarado | currency }}</span></div>
          <div class="cartao kpi"><span class="rotulo">ICMS a recuperar</span><span class="valor">{{ d.caso.icmsDiferenca | currency }}</span></div>
          <div class="cartao kpi"><span class="rotulo">Documentos fiscais</span><span class="valor">{{ d.qtdDocumentos | number }}</span>
            <span class="detalhe">Posição no ranking: {{ d.caso.posicao }}</span></div>
        </div>

        <div class="cartao">
          <div class="cartao-titulo"><span><nz-icon nzType="idcard" />Dados do contribuinte e da malha</span></div>
          <div class="cartao-corpo dados">
            <div><div class="rotulo">Inscrição estadual</div><div class="valor mono">{{ d.caso.inscricaoEstadual }}</div></div>
            <div><div class="rotulo">CNPJ</div><div class="valor mono">{{ d.caso.cnpj }}</div></div>
            <div><div class="rotulo">Situação cadastral</div><div class="valor">{{ d.caso.situacaoCadastral }}</div></div>
            <div><div class="rotulo">Município</div><div class="valor">{{ d.municipio || '—' }}</div></div>
            <div><div class="rotulo">E-mail</div><div class="valor">{{ d.email || '—' }}</div></div>
            <div><div class="rotulo">Telefone</div><div class="valor">{{ d.telefone || '—' }}</div></div>
            <div><div class="rotulo">Período de referência</div><div class="valor">{{ d.periodoInicio | date: 'dd/MM/yyyy' }} a {{ d.periodoFim | date: 'dd/MM/yyyy' }}</div></div>
            <div><div class="rotulo">Exibição no portal</div><div class="valor">{{ (d.caso.dataExibicaoPortal | date: 'dd/MM/yyyy') || '—' }}</div></div>
            <div><div class="rotulo">Processo</div><div class="valor mono">{{ d.caso.numProcesso || '—' }}</div></div>
            <div><div class="rotulo">Notificação</div><div class="valor mono">{{ d.caso.numNotificacao || '—' }}</div></div>
            <div><div class="rotulo">Notificado por</div><div class="valor">{{ d.caso.notificadoPor || '—' }}</div></div>
            <div><div class="rotulo">Ciência</div><div class="valor">{{ d.caso.dataCienciaNotif ? (d.caso.dataCienciaNotif | date: 'dd/MM/yyyy') + ' (' + (d.caso.tipoCiencia === 'TACITA' ? 'tácita' : 'expressa') + ')' : '—' }}</div></div>
            <div><div class="rotulo">Fim do prazo</div><div class="valor">{{ (d.caso.fimPrazo | date: 'dd/MM/yyyy') || '—' }}</div></div>
            @if (d.caso.impedimento) { <div><div class="rotulo">Impedimento</div><div class="valor">{{ d.caso.impedimento }}</div></div> }
            @if (d.acaoFiscal; as af) {
              <div><div class="rotulo">Ação fiscal</div><div class="valor">{{ af.statusRotulo }}</div></div>
              <div><div class="rotulo">MPF / TIF / AI-e</div><div class="valor mono">{{ af.numMpf || '—' }} / {{ af.numTif || '—' }} / {{ af.numAuto || '—' }}</div></div>
            }
          </div>
        </div>

        <div class="cartao cartao-abas">
          <nz-tabs>
            <nz-tab [nzTitle]="'Relação de notas (' + (d.qtdDocumentos | number) + ')'">
              <nz-table #tDocs [nzData]="docs.itens()" [nzFrontPagination]="false" [nzTotal]="docs.total()" [(nzPageIndex)]="docs.pagina" [(nzPageSize)]="docs.tamanho"
                        [nzLoading]="docs.carregando()" [nzShowSizeChanger]="true" [nzPageSizeOptions]="[20, 50, 100]" (nzQueryParams)="docs.aoMudar($event)"
                       >
                <thead>
                  <tr><th>Chave de acesso</th><th>Modelo</th><th>Operação</th><th>Emissão</th><th>CFOP</th><th>Contraparte</th>
                    <th nzAlign="right">Valor total</th><th nzAlign="right">ICMS</th><th nzAlign="right">Declarado</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  @for (x of tDocs.data; track x.id) {
                    <tr>
                      <td class="mono">{{ x.chaveAcesso }}</td><td>{{ x.modelo }}</td><td>{{ x.operacao }}</td>
                      <td class="nowrap">{{ x.dataEmissao | date: 'dd/MM/yyyy' }}</td><td>{{ x.cfop }}</td><td class="mono">{{ x.cnpjContraparte }}</td>
                      <td nzAlign="right" class="num">{{ x.valorTotal | currency }}</td><td nzAlign="right" class="num">{{ x.valorIcms | currency }}</td>
                      <td nzAlign="right" class="num">{{ x.valorDeclarado | currency }}</td><td><mf-status [valor]="x.situacao" /></td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
            <nz-tab nzTitle="Histórico de evolução">
              @if (eventos().length) {
                <nz-timeline>
                  @for (e of eventos(); track e.id) {
                    <nz-timeline-item>
                      <div class="timeline-evento">
                        <strong>{{ e.descricao }}</strong>
                        <span class="quando">{{ e.dataHora | date: 'dd/MM/yyyy HH:mm' }} · {{ e.usuario }}</span>
                      </div>
                    </nz-timeline-item>
                  }
                </nz-timeline>
              } @else { <div class="vazio">Nenhum evento registrado.</div> }
            </nz-tab>
            <nz-tab nzTitle="Contestações e prorrogações">
              <h4 class="sub">Contestações</h4>
              <nz-table #tCont [nzData]="d.contestacoes" [nzShowPagination]="false" [nzNoResult]="'Nenhuma contestação.'">
                <thead><tr><th>Número</th><th>Data</th><th>Título</th><th>Situação</th><th>Parecer</th><th>Resultado</th></tr></thead>
                <tbody>@for (c of tCont.data; track c.id) {
                  <tr><td class="mono">{{ c.numero }}</td><td>{{ c.data | date: 'dd/MM/yyyy' }}</td><td>{{ c.titulo }}</td>
                    <td><mf-status [valor]="c.status" /></td><td class="mono">{{ c.numParecer || '—' }}</td><td>@if (c.resultado) { <mf-status [valor]="c.resultado" /> }</td></tr>
                }</tbody>
              </nz-table>
              <h4 class="sub">Pedidos de prorrogação</h4>
              <nz-table #tPro [nzData]="d.prorrogacoes" [nzShowPagination]="false" [nzNoResult]="'Nenhum pedido.'">
                <thead><tr><th>Pedido</th><th>Data solicitada</th><th>Situação</th><th>Prazo final</th></tr></thead>
                <tbody>@for (p of tPro.data; track $index) {
                  <tr><td>{{ p.dataPedido | date: 'dd/MM/yyyy' }}</td><td>{{ p.dataSolicitada | date: 'dd/MM/yyyy' }}</td>
                    <td><mf-status [valor]="p.status" /></td><td>{{ (p.dataFinal | date: 'dd/MM/yyyy') || '—' }}</td></tr>
                }</tbody>
              </nz-table>
            </nz-tab>
            <nz-tab nzTitle="CAD-ICMS">
              <nz-table #tMed [nzData]="d.medidas" [nzShowPagination]="false" [nzNoResult]="'Nenhuma suspensão ou reativação.'">
                <thead><tr><th>Tipo</th><th>Situação</th><th>Portaria</th><th>Publicação</th><th>Responsável</th><th>Justificativa</th></tr></thead>
                <tbody>@for (m of tMed.data; track $index) {
                  <tr><td>{{ m.tipo === 'SUSPENSAO' ? 'Suspensão (RF-05)' : 'Reativação (RF-06)' }}</td><td><mf-status [valor]="m.status" /></td>
                    <td class="mono">{{ m.numPortaria || '—' }}</td><td>{{ (m.dataPublicacao | date: 'dd/MM/yyyy') || '—' }}</td><td>{{ m.responsavel }}</td><td>{{ m.justificativa }}</td></tr>
                }</tbody>
              </nz-table>
            </nz-tab>
            <nz-tab [nzTitle]="'Integrações ' + (cfg.cliente?.sistemaLegado ?? '')">
              <nz-table #tInt [nzData]="d.integracoes" [nzShowPagination]="false" [nzNoResult]="'Nenhuma demanda enviada ao sistema legado.'">
                <thead><tr><th>#</th><th>Demanda</th><th>Situação</th><th>Etapas</th><th>Criada em</th><th>Erro</th></tr></thead>
                <tbody>@for (s of tInt.data; track s.id) {
                  <tr><td><a routerLink="/integracoes" [queryParams]="{ id: s.id }">{{ s.id }}</a></td><td>{{ s.demanda }}</td><td><mf-status [valor]="s.status" /></td>
                    <td>{{ s.etapaAtual }}/{{ s.totalEtapas }}</td><td>{{ s.criadoEm | date: 'dd/MM/yyyy HH:mm' }}</td><td class="suave">{{ s.ultimoErro || '' }}</td></tr>
                }</tbody>
              </nz-table>
            </nz-tab>
          </nz-tabs>
        </div>
      }
    </div>
  `,
  styles: `.sub { font-size: 14px; margin: 12px 0 8px; } .cartao-abas { padding: 4px 16px 16px; }`,
})
export class CasoDetalhePage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly location = inject(Location);
  readonly cfg = inject(ConfigService);

  readonly d = signal<CasoDetalhe | null>(null);
  readonly eventos = signal<CasoEvento[]>([]);
  readonly docs = new TabelaServidor<DocumentoFiscal>((c) => this.api.documentos(Number(this.id()), c.pagina, c.tamanho), { tamanho: 20 });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      this.api.caso(id).subscribe((d) => this.d.set(d));
      this.api.historico(id).subscribe((e) => this.eventos.set(e));
      this.docs.reiniciar();
    });
  }

  voltar() {
    this.location.back();
  }
}
