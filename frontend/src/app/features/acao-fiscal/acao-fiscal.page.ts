import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfigService } from '../../core/config.service';
import { ConfirmacaoService, MensagemService } from '../../core/mensagens';
import { MenuService } from '../../core/menu.service';
import { AcaoFiscal, ResultadoLote, UsuarioResumo } from '../../core/models';
import { Selecao, StatusTagComponent, TabelaServidor, informarLote } from '../../shared/ui';

type Etapa = 'mpf' | 'fisc' | 'auto' | 'enc' | 'fim';

const ETAPAS: { valor: Etapa; rotulo: string }[] = [
  { valor: 'mpf', rotulo: 'Aguardando MPF' },
  { valor: 'fisc', rotulo: 'Em fiscalização (MPF/TIF)' },
  { valor: 'auto', rotulo: 'Autos de Infração' },
  { valor: 'enc', rotulo: 'Encerramento' },
  { valor: 'fim', rotulo: 'Concluídas' },
];
const STATUS: Record<Etapa, string[]> = {
  mpf: ['SOLICITADA'],
  fisc: ['MPF_EM_ABERTURA', 'MPF_ABERTO', 'TIF_EM_EMISSAO', 'TIF_AGUARDANDO_CIENCIA', 'AUTO_EM_LAVRATURA'],
  auto: ['AUTO_LAVRADO', 'AUTO_EM_HOMOLOGACAO', 'AUTO_AGUARDANDO_CIENCIA'],
  enc: ['ENCERRAMENTO_EM_INCLUSAO', 'AGUARDANDO_RATIFICACAO', 'RATIFICACAO_EM_ANDAMENTO'],
  fim: ['CONCLUIDA', 'INDEFERIDA'],
};
const EM_PROCESSAMENTO = ['MPF_EM_ABERTURA', 'TIF_EM_EMISSAO', 'AUTO_EM_LAVRATURA', 'AUTO_EM_HOMOLOGACAO', 'ENCERRAMENTO_EM_INCLUSAO', 'RATIFICACAO_EM_ANDAMENTO'];

/** Ação Fiscal: MPF (RF-07/08), TIF (RF-09 a RF-14), AI-e (RF-15 a RF-20) e encerramento (RF-21/22). */
@Component({
  selector: 'app-acao-fiscal',
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, NzTableModule, NzTabsModule, NzButtonModule, NzModalModule, NzSelectModule, NzInputModule, NzTooltipModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Ação Fiscal / MPF</h1>
          <div class="subtitulo">Do pedido do Auditor/Fiscal à ratificação do termo de encerramento, com os serviços executados no {{ cfg.cliente?.sistemaLegado }}.</div></div>
      </div>
      <nz-tabs [nzSelectedIndex]="indice()" (nzSelectedIndexChange)="trocar(etapas[$event].valor)" class="abas-filtro">
        @for (e of etapas; track e.valor) { <nz-tab [nzTitle]="e.rotulo" /> }
      </nz-tabs>
      <div class="cartao">
        <div class="barra-acoes acoes">
          <span class="suave">{{ sel.quantidade() }} selecionada(s)</span><span class="espaco"></span>
          @switch (etapa()) {
            @case ('mpf') {
              @if (auth.pode('MPF_ABRIR')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="abrirDialogoMpf()"><nz-icon nzType="file-add" />Abrir MPF</button>
                <button nz-button nzDanger [disabled]="sel.quantidade() !== 1" (click)="dlgIndeferir.set(true)"><nz-icon nzType="close" />Indeferir</button>
              }
            }
            @case ('auto') {
              @if (auth.pode('AUTO_HOMOLOGAR')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="homologar()" nz-tooltip nzTooltipTitle="RF-17 Homologar → RF-18 Enviar pelo DT-e"><nz-icon nzType="safety-certificate" />Homologar AI-e</button>
              }
            }
            @case ('enc') {
              @if (auth.pode('TERMO_RATIFICAR')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="ratificar()"><nz-icon nzType="check-circle" />Ratificar termo de encerramento</button>
              }
            }
          }
          @if (auth.pode('CIENCIA_SIMULAR') && (etapa() === 'fisc' || etapa() === 'auto')) {
            <button nz-button [disabled]="sel.quantidade() !== 1 || !aguardaCiencia(sel.itens()[0])" (click)="simularCiencia()">
              <nz-icon nzType="check-square" />Ciência do contribuinte (simulação {{ cfg.cliente?.canalEletronico }})</button>
          }
        </div>
        <nz-table #tab [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" (nzQueryParams)="t.aoMudar($event)" [nzNoResult]="vazio">
          <thead>
            <tr>
              @if (etapa() !== 'fim') {
                <th nzWidth="44px" [nzChecked]="sel.todos(t.itens())" [nzIndeterminate]="sel.parcial(t.itens())" (nzCheckedChange)="sel.marcarTodos(t.itens(), $event)"></th>
              }
              <th>Contribuinte</th><th>Malha</th><th>Situação</th><th>Solicitação</th><th>MPF</th><th>Prazo MPF</th><th>TIF</th><th>Auto de Infração</th>
              <th nzAlign="right">Valor</th><th>Equipe</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (a of tab.data; track a.id) {
              <tr>
                @if (etapa() !== 'fim') { <td [nzChecked]="sel.tem(a)" (nzCheckedChange)="sel.alternar(a, $event)"></td> }
                <td><a [routerLink]="['/casos', a.casoId]">{{ a.razaoSocial }}</a><div class="suave mono">{{ a.inscricaoEstadual }}</div></td>
                <td>{{ a.malhaCodigo }}</td>
                <td><mf-status [valor]="a.status" [rotulo]="a.statusRotulo" />
                  @if (processando(a)) { <nz-icon nzType="loading" class="suave" /> }
                  @if (a.excecao) { <div class="suave">por exceção</div> }</td>
                <td class="nowrap">{{ a.dataSolicitacao | date: 'dd/MM/yyyy' }}<div class="suave">{{ a.solicitante }}</div></td>
                <td class="mono nowrap">{{ a.numMpf || '—' }}</td>
                <td class="nowrap">{{ (a.prazoExecucao | date: 'dd/MM/yyyy') || '—' }}</td>
                <td class="mono nowrap">{{ a.numTif || '—' }}@if (a.dataCienciaTif) { <div class="suave">ciência {{ a.dataCienciaTif | date: 'dd/MM/yyyy' }}</div> }</td>
                <td class="mono nowrap">{{ a.numAuto || '—' }}@if (a.dataCienciaAuto) { <div class="suave">ciência {{ a.dataCienciaAuto | date: 'dd/MM/yyyy' }}</div> }</td>
                <td nzAlign="right" class="num nowrap">{{ a.valorAuto != null ? (a.valorAuto | currency) : '—' }}</td>
                <td>@for (x of a.auditores; track x.usuarioId) { <div class="nowrap">{{ x.nome }} @if (x.dataCiencia) { <nz-icon nzType="check" style="color: #16a34a" /> }</div> }</td>
                <td><button nz-button nzType="text" nzShape="circle" nz-tooltip nzTooltipTitle="Detalhes" (click)="detalhe.set(a)"><nz-icon nzType="eye" /></button></td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="audit" />Nenhuma ação fiscal nesta etapa.</div></ng-template>
      </div>
    </div>

    <nz-modal [nzVisible]="dlgMpf()" nzTitle="Abrir MPF e designar auditores (RF-07 → RF-08)" (nzOnCancel)="dlgMpf.set(false)" nzWidth="34rem" [nzFooter]="rodapeMpf">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div>{{ sel.quantidade() }} solicitação(ões) selecionada(s).</div>
          <div class="campo"><label>Equipe de Auditores/Fiscais</label>
            <nz-select nzMode="multiple" [(ngModel)]="equipe" nzShowSearch nzPlaceHolder="Manter a equipe proposta">
              @for (a of auditores(); track a.id) { <nz-option [nzValue]="a.id" [nzLabel]="a.nome" /> }
            </nz-select>
            <span class="ajuda">Em branco, mantém a equipe proposta pelo solicitante.</span></div>
        </div>
      </ng-container>
      <ng-template #rodapeMpf>
        <button nz-button (click)="dlgMpf.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [nzLoading]="enviando()" (click)="abrirMpf()"><nz-icon nzType="check" />Abrir MPF</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="dlgIndeferir()" nzTitle="Indeferir solicitação de ação fiscal" (nzOnCancel)="dlgIndeferir.set(false)" nzWidth="30rem" [nzFooter]="rodapeInd">
      <ng-container *nzModalContent>
        <div class="campo"><label class="obrigatorio">Justificativa</label><textarea nz-input rows="4" [(ngModel)]="justificativa"></textarea></div>
      </ng-container>
      <ng-template #rodapeInd>
        <button nz-button (click)="dlgIndeferir.set(false)">Cancelar</button>
        <button nz-button nzType="primary" nzDanger [disabled]="!justificativa.trim()" (click)="indeferir()">Indeferir</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="!!detalhe()" [nzTitle]="'Ação fiscal — ' + (detalhe()?.razaoSocial ?? '')" (nzOnCancel)="detalhe.set(null)" nzWidth="44rem" [nzFooter]="null">
      <ng-container *nzModalContent>
        @if (detalhe(); as a) {
          <div class="linha-tempo">
            @for (p of passos(a); track p.rotulo) {
              <div class="passo" [class.feito]="!!p.data">
                <nz-icon [nzType]="p.data ? 'check-circle' : 'clock-circle'" />
                <div><strong>{{ p.rotulo }}</strong> <span class="suave">{{ p.rf }}</span>
                  <div class="suave">{{ p.data ? (p.data | date: 'dd/MM/yyyy') : 'pendente' }} {{ p.extra || '' }}</div></div>
              </div>
            }
          </div>
          @if (a.justifExcecao) { <div class="aviso-simulacao" style="margin-top: 12px">{{ a.justifExcecao }}</div> }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .acoes { padding: 10px 16px; border-bottom: 1px solid var(--mf-borda); }
    .corpo { display: flex; flex-direction: column; gap: 14px; }
    .linha-tempo { display: flex; flex-direction: column; gap: 10px; }
    .passo { display: flex; gap: 10px; align-items: flex-start; color: #94a3b8; }
    .passo.feito { color: var(--mf-texto); }
    .passo.feito nz-icon { color: #16a34a; }
    .passo nz-icon { margin-top: 4px; }
  `,
})
export class AcaoFiscalPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly confirm = inject(ConfirmacaoService);
  private readonly menu = inject(MenuService);
  readonly auth = inject(AuthService);
  readonly cfg = inject(ConfigService);

  readonly etapas = ETAPAS;
  readonly etapa = signal<Etapa>(this.auth.pode('MPF_ABRIR') ? 'mpf' : this.auth.pode('AUTO_HOMOLOGAR') ? 'auto' : 'mpf');
  readonly indice = computed(() => ETAPAS.findIndex((e) => e.valor === this.etapa()));
  readonly enviando = signal(false);
  readonly dlgMpf = signal(false);
  readonly dlgIndeferir = signal(false);
  readonly detalhe = signal<AcaoFiscal | null>(null);
  readonly auditores = signal<UsuarioResumo[]>([]);
  readonly sel = new Selecao<AcaoFiscal>();
  equipe: number[] = [];
  justificativa = '';
  private refresco?: ReturnType<typeof setTimeout>;

  readonly t = new TabelaServidor<AcaoFiscal>(
    (c) => this.api.acoesFiscais({ status: STATUS[this.etapa()], pagina: c.pagina, tamanho: c.tamanho }),
    {
      aoCarregar: (p) => {
        clearTimeout(this.refresco);
        if (p.itens.some((a) => this.processando(a))) this.refresco = setTimeout(() => this.t.recarregar(), 4000);
      },
    },
  );

  ngOnInit() {
    this.t.reiniciar();
  }

  ngOnDestroy() {
    clearTimeout(this.refresco);
  }

  trocar(e: Etapa) {
    if (e === this.etapa()) return;
    this.etapa.set(e);
    this.sel.limpar();
    this.t.reiniciar();
  }

  processando(a: AcaoFiscal) {
    return EM_PROCESSAMENTO.includes(a.status);
  }

  aguardaCiencia(a: AcaoFiscal | undefined) {
    return !!a && (a.status === 'TIF_AGUARDANDO_CIENCIA' || a.status === 'AUTO_AGUARDANDO_CIENCIA');
  }

  private fim(titulo: string) {
    return {
      next: (r: ResultadoLote) => {
        informarLote(this.msg, titulo, r);
        this.enviando.set(false);
        this.dlgMpf.set(false);
        this.sel.limpar();
        this.menu.atualizarContadores();
        this.t.recarregar();
      },
      error: () => this.enviando.set(false),
    };
  }

  abrirDialogoMpf() {
    this.equipe = [];
    if (!this.auditores().length) this.api.auditores().subscribe((a) => this.auditores.set(a));
    this.dlgMpf.set(true);
  }

  abrirMpf() {
    this.enviando.set(true);
    this.api.abrirMpf(this.sel.ids(), this.equipe).subscribe(this.fim('Abertura de MPF'));
  }

  indeferir() {
    this.api.indeferirAcao(this.sel.ids()[0], this.justificativa).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Solicitação indeferida' });
      this.dlgIndeferir.set(false);
      this.justificativa = '';
      this.sel.limpar();
      this.t.recarregar();
    });
  }

  homologar() {
    this.confirm.confirm({
      header: 'Homologar Auto de Infração',
      message: `Homologar e enviar pelo ${this.cfg.cliente?.canalEletronico} ${this.sel.quantidade()} auto(s) de infração? (RF-17 → RF-18)`,
      acceptLabel: 'Homologar',
      accept: () => this.api.homologar(this.sel.ids()).subscribe(this.fim('Homologação de AI-e')),
    });
  }

  ratificar() {
    this.confirm.confirm({
      header: 'Ratificar termo de encerramento',
      message: `Ratificar ${this.sel.quantidade()} termo(s) de encerramento? (RF-22)`,
      acceptLabel: 'Ratificar',
      accept: () => this.api.ratificar(this.sel.ids()).subscribe(this.fim('Ratificação')),
    });
  }

  simularCiencia() {
    const a = this.sel.itens()[0];
    this.api.simularCienciaAcao(a.id).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Ciência registrada', detail: a.status === 'TIF_AGUARDANDO_CIENCIA' ? 'Lavratura do AI-e iniciada (RF-14 → RF-16).' : 'Comprovante e termo de encerramento em inclusão (RF-20 → RF-21).' });
      this.sel.limpar();
      this.t.recarregar();
    });
  }

  passos(a: AcaoFiscal) {
    return [
      { rotulo: 'Solicitação de ação fiscal', rf: '', data: a.dataSolicitacao, extra: '— ' + a.solicitante },
      { rotulo: 'Abertura do MPF', rf: 'RF-07/08', data: a.dataAberturaMpf, extra: a.numMpf ? '— ' + a.numMpf : '' },
      { rotulo: 'Termo de Início de Fiscalização', rf: 'RF-09 a RF-12', data: a.dataTif, extra: a.numTif ? '— ' + a.numTif : '' },
      { rotulo: 'Ciência do TIF', rf: 'RF-13/14', data: a.dataCienciaTif, extra: '' },
      { rotulo: 'Lavratura do Auto de Infração', rf: 'RF-15/16', data: a.dataLavratura, extra: a.numAuto ? '— ' + a.numAuto : '' },
      { rotulo: 'Homologação e envio pelo DT-e', rf: 'RF-17/18', data: a.dataHomologacao, extra: '' },
      { rotulo: 'Ciência do AI-e', rf: 'RF-19/20', data: a.dataCienciaAuto, extra: '' },
      { rotulo: 'Termo de encerramento', rf: 'RF-21', data: a.dataTermoEnc, extra: a.numTermoEnc ? '— ' + a.numTermoEnc : '' },
      { rotulo: 'Ratificação', rf: 'RF-22', data: a.dataRatificacao, extra: '' },
    ];
  }
}
