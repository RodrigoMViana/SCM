import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfigService } from '../../core/config.service';
import { ConfirmacaoService, MensagemService } from '../../core/mensagens';
import { MenuService } from '../../core/menu.service';
import { Aba, CasoResumo, Malha, ResultadoLote, UsuarioResumo } from '../../core/models';
import { Selecao, StatusTagComponent, TabelaServidor, baixarBlob, fmtMoeda, informarLote, lerMoeda } from '../../shared/ui';

interface AcaoJustificada {
  acao: 'excluir' | 'encerrar' | 'cancelar' | 'suspender' | 'reativar';
  titulo: string;
  botao: string;
  comTipo?: boolean;
  comValor?: boolean;
}

@Component({
  selector: 'app-malha-casos',
  imports: [
    FormsModule, RouterLink, DatePipe, CurrencyPipe, DecimalPipe, NzTableModule, NzTabsModule, NzButtonModule, NzInputModule,
    NzInputNumberModule, NzIconModule, NzModalModule, NzSelectModule, NzCheckboxModule, NzTagModule, NzTooltipModule, StatusTagComponent,
  ],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div>
          <a routerLink="/malhas" class="suave"><nz-icon nzType="arrow-left" /> Malhas Fiscais</a>
          <h1 style="margin-top: 6px">Malha Fiscal {{ malha()?.tipoCodigo }} — {{ malha()?.tipoNome }}</h1>
          <div class="subtitulo">{{ malha()?.nome }} · {{ malha()?.periodoInicio | date: 'dd/MM/yyyy' }} a {{ malha()?.periodoFim | date: 'dd/MM/yyyy' }}
            · Ranqueado por {{ metricaRotulo() }}</div>
        </div>
        <button nz-button (click)="exportar()" [nzLoading]="exportando()"><nz-icon nzType="file-excel" />Exportar XLSX</button>
      </div>

      <nz-tabs [nzSelectedIndex]="indiceAba()" (nzSelectedIndexChange)="trocarAba(abas[$event].valor)" class="abas-filtro">
        @for (a of abas; track a.valor) {
          <nz-tab [nzTitle]="a.rotulo + ' (' + ((malha()?.contagemPorAba?.[a.valor] ?? 0) | number) + ')'" />
        }
      </nz-tabs>

      <div class="cartao">
        <div class="cartao-corpo filtros">
          <nz-input-wrapper style="width: 320px">
            <nz-icon nzInputPrefix nzType="search" />
            <input nz-input placeholder="Razão social, IE, CNPJ ou nº notificação" [(ngModel)]="texto" (keyup.enter)="pesquisar()" />
          </nz-input-wrapper>
          <nz-input-number [(ngModel)]="valorMin" [nzMin]="0" [nzStep]="1000" [nzFormatter]="fmtMoeda" [nzParser]="lerMoeda" nzPlaceHolder="Potencial mínimo (R$)" style="width: 190px" />
          <nz-input-number [(ngModel)]="valorMax" [nzMin]="0" [nzStep]="1000" [nzFormatter]="fmtMoeda" [nzParser]="lerMoeda" nzPlaceHolder="Potencial máximo (R$)" style="width: 190px" />
          <button nz-button nzType="primary" (click)="pesquisar()"><nz-icon nzType="filter" />Pesquisar</button>
          <button nz-button nzType="text" (click)="limpar()">Limpar</button>
        </div>

        <div class="barra-acoes acoes">
          <span class="suave">{{ sel.quantidade() }} selecionado(s)</span>
          <span class="espaco"></span>
          @switch (aba()) {
            @case ('EM_ANALISE') {
              @if (auth.pode('CASO_EXIBIR_PORTAL')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="exibirPortal()"><nz-icon nzType="global" />Exibir no Portal</button>
              }
              @if (auth.pode('CASO_EXCLUIR')) {
                <button nz-button nzDanger [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.excluir)"><nz-icon nzType="delete" />Excluir da malha</button>
              }
            }
            @case ('A_NOTIFICAR') {
              @if (auth.pode('NOTIFICAR')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="notificar()"><nz-icon nzType="send" />Notificar</button>
              }
              @if (auth.pode('CASO_EXCLUIR')) {
                <button nz-button nzDanger [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.excluir)"><nz-icon nzType="delete" />Excluir da malha</button>
              }
            }
            @case ('NOTIFICADOS') {
              @if (auth.pode('CIENCIA_SIMULAR')) {
                <button nz-button [disabled]="!podeSimularCiencia()" (click)="simularCiencia()"><nz-icon nzType="check-square" />Dar ciência (simulação {{ cfg.cliente?.canalEletronico }})</button>
              }
              @if (auth.pode('NOTIFICACAO_ENCERRAR')) {
                <button nz-button nzType="primary" [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.encerrar)"><nz-icon nzType="flag" />Encerrar</button>
                <button nz-button [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.cancelar)"><nz-icon nzType="close" />Cancelar notificação</button>
              }
              @if (auth.pode('CADASTRO_SUSPENDER')) {
                <button nz-button class="botao-alerta" [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.suspender)"><nz-icon nzType="pause-circle" />Suspender CAD-ICMS</button>
                <button nz-button [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.reativar)"><nz-icon nzType="play-circle" />Reativar CAD-ICMS</button>
              }
              @if (auth.pode('ACAO_FISCAL_SOLICITAR')) {
                <button nz-button nzType="primary" nzDanger [disabled]="sel.quantidade() !== 1" (click)="abrirAcaoFiscal()"><nz-icon nzType="form" />Solicitar Ação Fiscal</button>
              }
            }
            @case ('ENCERRADOS') {
              @if (auth.pode('CADASTRO_SUSPENDER')) {
                <button nz-button class="botao-alerta" [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.suspender)"><nz-icon nzType="pause-circle" />Suspender CAD-ICMS</button>
                <button nz-button [disabled]="!sel.quantidade()" (click)="abrirJustificativa(acoes.reativar)"><nz-icon nzType="play-circle" />Reativar CAD-ICMS</button>
              }
              @if (auth.pode('ACAO_FISCAL_SOLICITAR')) {
                <button nz-button nzType="primary" nzDanger [disabled]="sel.quantidade() !== 1" (click)="abrirAcaoFiscal()"><nz-icon nzType="form" />Solicitar Ação Fiscal</button>
              }
            }
          }
        </div>

        <nz-table #tabela [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" [nzShowSizeChanger]="true" [nzPageSizeOptions]="[25, 50, 100, 200]" [nzShowTotal]="totalTpl"
                  (nzQueryParams)="t.aoMudar($event)" [nzNoResult]="vazioTpl">
          <thead>
            <tr>
              @if (selecionavel()) {
                <th nzWidth="44px" [nzChecked]="sel.todos(t.itens())" [nzIndeterminate]="sel.parcial(t.itens())" (nzCheckedChange)="sel.marcarTodos(t.itens(), $event)"></th>
              }
              <th nzColumnKey="posicao" [nzSortFn]="true" nzWidth="90px">Posição</th>
              <th nzColumnKey="razaoSocial" [nzSortFn]="true" class="col-nome">Contribuinte</th>
              <th>CAD-ICMS</th>
              <th>Situação cad.</th>
              @if (metrica() === 'QUANTIDADE') { <th nzColumnKey="potencialQtd" [nzSortFn]="true" nzAlign="right">Qtd. NF-e</th> }
              <th nzColumnKey="icmsDestacado" [nzSortFn]="true" nzAlign="right">ICMS destacado</th>
              <th nzColumnKey="icmsDeclarado" [nzSortFn]="true" nzAlign="right">ICMS declarado</th>
              <th nzColumnKey="icmsDiferenca" [nzSortFn]="true" nzAlign="right">ICMS a recuperar</th>
              @switch (aba()) {
                @case ('A_NOTIFICAR') { <th nzColumnKey="dataExibicaoPortal" [nzSortFn]="true">Exibição portal</th> }
                @case ('NOTIFICADOS') {
                  <th>Situação</th><th nzColumnKey="numNotificacao" [nzSortFn]="true">Notificação</th>
                  <th>Ciência</th><th nzColumnKey="fimPrazo" [nzSortFn]="true">Fim do prazo</th><th>Suspenso</th><th>Ação fiscal</th>
                }
                @case ('ENCERRADOS') { <th>Encerramento</th><th>Tipo</th><th nzAlign="right">Valor recuperado</th><th>Ação fiscal</th> }
                @case ('CANCELADOS') { <th>Cancelamento</th><th>Justificativa</th> }
                @case ('EXCLUIDOS') { <th>Excluído por</th><th>Data</th><th>Justificativa</th> }
              }
              <th nzWidth="52px"></th>
            </tr>
          </thead>
          <tbody>
            @for (c of tabela.data; track c.id) {
              <tr>
                @if (selecionavel()) { <td [nzChecked]="sel.tem(c)" (nzCheckedChange)="sel.alternar(c, $event)"></td> }
                <td class="num centro">{{ c.posicao }}</td>
                <td>
                  <a [routerLink]="['/casos', c.id]">{{ c.razaoSocial }}</a>
                  <div class="marcadores">
                    @if (c.impedimento) { <nz-tag><nz-icon nzType="stop" /> {{ c.impedimento }}</nz-tag> }
                    @if (c.integracaoEmAndamento) { <nz-tag nzColor="processing"><nz-icon nzType="sync" nzSpin /> Processando no {{ cfg.cliente?.sistemaLegado }}</nz-tag> }
                    @if (c.integracaoComErro) { <nz-tag nzColor="error"><nz-icon nzType="warning" /> Falha de integração</nz-tag> }
                  </div>
                </td>
                <td class="mono nowrap">{{ c.inscricaoEstadual }}</td>
                <td><mf-status [valor]="c.situacaoCadastral" [rotulo]="c.situacaoCadastral" /></td>
                @if (metrica() === 'QUANTIDADE') { <td nzAlign="right" class="num">{{ c.potencialQtd | number }}</td> }
                <td nzAlign="right" class="num nowrap">{{ c.icmsDestacado | currency }}</td>
                <td nzAlign="right" class="num nowrap">{{ c.icmsDeclarado | currency }}</td>
                <td nzAlign="right" class="num nowrap"><strong>{{ c.icmsDiferenca | currency }}</strong></td>
                @switch (aba()) {
                  @case ('A_NOTIFICAR') { <td class="nowrap">{{ c.dataExibicaoPortal | date: 'dd/MM/yyyy' }}</td> }
                  @case ('NOTIFICADOS') {
                    <td><mf-status [valor]="c.status" [rotulo]="c.statusRotulo" /></td>
                    <td class="mono">{{ c.numNotificacao ?? '—' }}</td>
                    <td class="nowrap">{{ c.dataCienciaNotif ? (c.dataCienciaNotif | date: 'dd/MM/yyyy') + ' (' + (c.tipoCiencia === 'TACITA' ? 'tácita' : 'expressa') + ')' : 'Aguardando' }}</td>
                    <td class="nowrap">
                      @if (c.fimPrazo) {
                        {{ c.fimPrazo | date: 'dd/MM/yyyy' }}
                        <nz-tag [nzColor]="c.diasRestantes! < 0 ? 'error' : c.diasRestantes! <= 5 ? 'warning' : 'default'">{{ c.diasRestantes! < 0 ? 'vencido' : c.diasRestantes + ' dia(s)' }}</nz-tag>
                      } @else { — }
                    </td>
                    <td>{{ c.suspenso ? 'SIM' : 'NÃO' }}</td>
                    <td>{{ c.acaoFiscalStatus ?? '—' }}</td>
                  }
                  @case ('ENCERRADOS') {
                    <td class="nowrap">{{ c.dataEncerramento | date: 'dd/MM/yyyy' }}</td><td>{{ c.tipoEncerramento }}</td>
                    <td nzAlign="right" class="num">{{ c.valorRecuperado | currency }}</td><td>{{ c.acaoFiscalStatus ?? '—' }}</td>
                  }
                  @case ('CANCELADOS') { <td>{{ c.dataEncerramento | date: 'dd/MM/yyyy' }}</td><td>—</td> }
                  @case ('EXCLUIDOS') { <td>{{ c.excluidoPor }}</td><td>{{ c.dataExclusao | date: 'dd/MM/yyyy' }}</td><td>{{ c.justifExclusao }}</td> }
                }
                <td><button nz-button nzType="text" nzShape="circle" nz-tooltip nzTooltipTitle="Detalhes da inconsistência" (click)="abrir(c)"><nz-icon nzType="eye" /></button></td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #totalTpl let-total let-range="range">{{ range[0] | number }}–{{ range[1] | number }} de {{ total | number }}</ng-template>
        <ng-template #vazioTpl><div class="vazio"><nz-icon nzType="inbox" />Nenhum contribuinte nesta lista.</div></ng-template>
      </div>
    </div>

    <!-- Diálogo de justificativa (excluir, encerrar, cancelar, suspender, reativar) -->
    <nz-modal [nzVisible]="!!dialogo()" [nzTitle]="dialogo()?.titulo" (nzOnCancel)="dialogo.set(null)" nzWidth="34rem" [nzFooter]="rodapeJust">
      <ng-container *nzModalContent>
        <div class="formulario">
          <div class="suave">{{ sel.quantidade() }} contribuinte(s) selecionado(s).</div>
          @if (dialogo()?.comTipo) {
            <div class="campo">
              <label>Tipo de encerramento</label>
              <nz-select [(ngModel)]="tipoEncerramento">@for (t of tiposEncerramento; track t) { <nz-option [nzValue]="t" [nzLabel]="t" /> }</nz-select>
            </div>
          }
          @if (dialogo()?.comValor) {
            <div class="campo">
              <label>Valor recuperado (R$)</label>
              <nz-input-number [(ngModel)]="valorRecuperado" [nzMin]="0" [nzFormatter]="fmtMoeda" [nzParser]="lerMoeda" style="width: 100%" />
            </div>
          }
          <div class="campo">
            <label class="obrigatorio">Justificativa</label>
            <textarea nz-input rows="4" [(ngModel)]="justificativa"></textarea>
          </div>
        </div>
      </ng-container>
      <ng-template #rodapeJust>
        <button nz-button (click)="dialogo.set(null)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!justificativa.trim()" [nzLoading]="enviando()" (click)="confirmarJustificativa()">{{ dialogo()?.botao ?? 'Confirmar' }}</button>
      </ng-template>
    </nz-modal>

    <!-- Diálogo de solicitação de ação fiscal -->
    <nz-modal [nzVisible]="dlgAcao()" nzTitle="Solicitar Ação Fiscal" (nzOnCancel)="dlgAcao.set(false)" nzWidth="36rem" [nzFooter]="rodapeAcao">
      <ng-container *nzModalContent>
        <div class="formulario">
          <div>Contribuinte: <strong>{{ sel.itens()[0]?.razaoSocial }}</strong></div>
          <div class="campo">
            <label class="obrigatorio">Equipe proposta (Auditores/Fiscais)</label>
            <nz-select nzMode="multiple" [(ngModel)]="equipe" nzPlaceHolder="Selecione" nzShowSearch>
              @for (a of auditores(); track a.id) { <nz-option [nzValue]="a.id" [nzLabel]="a.nome" /> }
            </nz-select>
            <span class="ajuda">A solicitação será encaminhada ao Gerente {{ cfg.cliente?.unidadeFiscalizacao }} para abertura do MPF.</span>
          </div>
          <label nz-checkbox [(ngModel)]="excecao">Solicitação por exceção (fora do fluxo regular)</label>
          @if (excecao) {
            <div class="campo">
              <label class="obrigatorio">Justificativa da exceção</label>
              <textarea nz-input rows="3" [(ngModel)]="justificativa"></textarea>
            </div>
          }
        </div>
      </ng-container>
      <ng-template #rodapeAcao>
        <button nz-button (click)="dlgAcao.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!equipe.length || (excecao && !justificativa.trim())" [nzLoading]="enviando()" (click)="solicitarAcaoFiscal()"><nz-icon nzType="send" />Solicitar</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid var(--mf-borda); }
    .acoes { padding: 10px 16px; border-bottom: 1px solid var(--mf-borda); }
    .marcadores { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
    .marcadores nz-tag { font-size: 11px; margin: 0; }
    .formulario { display: flex; flex-direction: column; gap: 14px; }
  `,
})
export class MalhaCasosPage implements OnDestroy {
  readonly malhaId = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly msg = inject(MensagemService);
  private readonly confirm = inject(ConfirmacaoService);
  private readonly menu = inject(MenuService);
  readonly auth = inject(AuthService);
  readonly cfg = inject(ConfigService);
  readonly fmtMoeda = fmtMoeda;
  readonly lerMoeda = lerMoeda;

  readonly abas: { valor: Aba; rotulo: string }[] = [
    { valor: 'EM_ANALISE', rotulo: 'Contribuintes em análise' },
    { valor: 'A_NOTIFICAR', rotulo: 'Monitorados (a notificar)' },
    { valor: 'NOTIFICADOS', rotulo: 'Notificados' },
    { valor: 'ENCERRADOS', rotulo: 'Encerrados' },
    { valor: 'CANCELADOS', rotulo: 'Cancelados' },
    { valor: 'EXCLUIDOS', rotulo: 'Excluídos pelo Gestor' },
  ];
  readonly acoes = {
    excluir: <AcaoJustificada>{ acao: 'excluir', titulo: 'Excluir contribuinte(s) da malha', botao: 'Excluir' },
    encerrar: <AcaoJustificada>{ acao: 'encerrar', titulo: 'Encerrar notificação', botao: 'Encerrar', comTipo: true, comValor: true },
    cancelar: <AcaoJustificada>{ acao: 'cancelar', titulo: 'Cancelar notificação', botao: 'Cancelar notificação' },
    suspender: <AcaoJustificada>{ acao: 'suspender', titulo: 'Suspender CAD-ICMS (RF-05)', botao: 'Suspender' },
    reativar: <AcaoJustificada>{ acao: 'reativar', titulo: 'Reativar CAD-ICMS (RF-06)', botao: 'Reativar' },
  };
  readonly tiposEncerramento = ['Por retificação EFD', 'Pelo Auditor', 'Por recolhimento', 'Não definido'];

  readonly malha = signal<Malha | null>(null);
  readonly aba = signal<Aba>('EM_ANALISE');
  readonly indiceAba = computed(() => this.abas.findIndex((a) => a.valor === this.aba()));
  readonly selecionavel = computed(() => this.aba() !== 'EXCLUIDOS' && this.aba() !== 'CANCELADOS');
  readonly exportando = signal(false);
  readonly enviando = signal(false);
  readonly sel = new Selecao<CasoResumo>();
  readonly dialogo = signal<AcaoJustificada | null>(null);
  readonly dlgAcao = signal(false);
  readonly auditores = signal<UsuarioResumo[]>([]);
  readonly metrica = computed(() => (this.malha()?.tipoCodigo === 'A1' || this.malha()?.tipoCodigo === 'A4' ? 'QUANTIDADE' : 'VALOR'));
  readonly metricaRotulo = computed(() => (this.metrica() === 'QUANTIDADE' ? 'quantidade de documentos' : 'valor (R$)'));
  readonly podeSimularCiencia = computed(() => this.sel.quantidade() === 1 && this.sel.itens()[0].status === 'NOTIFICACAO_EMITIDA');

  texto = '';
  valorMin: number | null = null;
  valorMax: number | null = null;
  justificativa = '';
  tipoEncerramento = 'Pelo Auditor';
  valorRecuperado: number | null = null;
  equipe: number[] = [];
  excecao = false;
  private refresco?: ReturnType<typeof setTimeout>;

  readonly t = new TabelaServidor<CasoResumo>(
    (c) => this.api.casos(Number(this.malhaId()), { aba: this.aba(), texto: this.texto, valorMin: this.valorMin, valorMax: this.valorMax, ...c }),
    {
      ordemPadrao: 'posicao',
      aoCarregar: (p) => {
        clearTimeout(this.refresco);
        if (p.itens.some((c) => c.integracaoEmAndamento)) this.refresco = setTimeout(() => this.recarregar(), 4000);
      },
    },
  );

  constructor() {
    effect(() => {
      const id = Number(this.malhaId());
      this.api.malha(id).subscribe((m) => this.malha.set(m));
      this.sel.limpar();
      this.t.reiniciar();
    });
  }

  ngOnDestroy() {
    clearTimeout(this.refresco);
  }

  trocarAba(a: Aba) {
    if (a === this.aba()) return;
    this.aba.set(a);
    this.sel.limpar();
    this.t.reiniciar();
  }

  pesquisar() {
    this.t.reiniciar();
  }

  limpar() {
    this.texto = '';
    this.valorMin = this.valorMax = null;
    this.pesquisar();
  }

  recarregar() {
    this.t.recarregar();
    this.api.malha(Number(this.malhaId())).subscribe((m) => this.malha.set(m));
    this.menu.atualizarContadores();
  }

  abrir(c: CasoResumo) {
    this.router.navigate(['/casos', c.id]);
  }

  private concluir(titulo: string) {
    return {
      next: (r: ResultadoLote) => {
        informarLote(this.msg, titulo, r);
        this.sel.limpar();
        this.enviando.set(false);
        this.dialogo.set(null);
        this.recarregar();
      },
      error: () => this.enviando.set(false),
    };
  }

  exibirPortal() {
    this.confirm.confirm({
      header: 'Exibir no Portal de Autorregularização',
      message: `Publicar as divergências de ${this.sel.quantidade()} contribuinte(s) no ${this.cfg.cliente?.portalAutorregularizacao ?? 'Portal'}?`,
      acceptLabel: 'Sim, exibir',
      accept: () => this.api.acaoCaso('exibir-portal', { ids: this.sel.ids() }).subscribe(this.concluir('Exibição no Portal')),
    });
  }

  notificar() {
    const legado = this.cfg.cliente?.sistemaLegado ?? 'sistema legado';
    this.confirm.confirm({
      header: 'Notificar contribuinte(s)',
      message: `Serão acionados no ${legado}, para cada contribuinte: RF-01 Criar processo → RF-02 Criar notificação → RF-03 Assinar digitalmente. Confirmar a notificação de ${this.sel.quantidade()} contribuinte(s)?`,
      acceptLabel: 'Sim, notificar',
      accept: () => this.api.acaoCaso('notificar', { ids: this.sel.ids() }).subscribe(this.concluir('Notificação')),
    });
  }

  simularCiencia() {
    const c = this.sel.itens()[0];
    this.api.simularCienciaCaso(c.id).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Ciência registrada', detail: `Ciência expressa registrada para ${c.razaoSocial} (RF-04).` });
      this.sel.limpar();
      this.recarregar();
    });
  }

  abrirJustificativa(a: AcaoJustificada) {
    this.justificativa = '';
    this.valorRecuperado = null;
    this.dialogo.set(a);
  }

  confirmarJustificativa() {
    const d = this.dialogo();
    if (!d) return;
    this.enviando.set(true);
    this.api
      .acaoCaso(d.acao, { ids: this.sel.ids(), justificativa: this.justificativa, tipo: d.comTipo ? this.tipoEncerramento : undefined, valorRecuperado: this.valorRecuperado ?? undefined })
      .subscribe(this.concluir(d.titulo));
  }

  abrirAcaoFiscal() {
    this.equipe = [];
    this.excecao = false;
    this.justificativa = '';
    if (!this.auditores().length) this.api.auditores().subscribe((a) => this.auditores.set(a));
    this.dlgAcao.set(true);
  }

  solicitarAcaoFiscal() {
    this.enviando.set(true);
    this.api
      .solicitarAcaoFiscal({ casoId: this.sel.itens()[0].id, auditorIds: this.equipe, excecao: this.excecao, justificativa: this.justificativa })
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Ação fiscal solicitada', detail: `Encaminhada ao Gerente ${this.cfg.cliente?.unidadeFiscalizacao}.` });
          this.enviando.set(false);
          this.dlgAcao.set(false);
          this.sel.limpar();
          this.recarregar();
        },
        error: () => this.enviando.set(false),
      });
  }

  exportar() {
    this.exportando.set(true);
    this.api.exportar(this.api.urlExportacao(Number(this.malhaId()), this.aba(), this.texto)).subscribe({
      next: (b) => {
        baixarBlob(b, `malha-${this.malha()?.tipoCodigo}-${this.aba().toLowerCase()}.xlsx`);
        this.exportando.set(false);
      },
      error: () => this.exportando.set(false),
    });
  }
}
