import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ApiService } from '../../core/api.service';
import { ConfirmacaoService, MensagemService } from '../../core/mensagens';
import { GrupoIndicador, Indicador, IndicadorPlano, Malha, ResultadoIndicador } from '../../core/models';
import { StatusTagComponent, TabelaServidor } from '../../shared/ui';

/** Plano da malha (PM-008 a PM-013): indicadores, execução, seleção, prioridade dos grupos e consolidação. */
@Component({
  selector: 'app-plano-malha',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CurrencyPipe, NzTableModule, NzButtonModule, NzModalModule, NzSelectModule, NzCheckboxModule, NzInputNumberModule, NzInputModule, NzTagModule, NzTooltipModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div>
          <a routerLink="/planejamento" class="suave"><nz-icon nzType="arrow-left" /> Planejamento</a>
          <h1 style="margin-top: 6px">{{ malha()?.nome }}</h1>
          <div class="subtitulo">Malha {{ malha()?.tipoCodigo }} — {{ malha()?.tipoNome }} · {{ malha()?.periodoInicio | date: 'dd/MM/yyyy' }} a {{ malha()?.periodoFim | date: 'dd/MM/yyyy' }}
            · <mf-status [valor]="malha()?.situacao ?? ''" /></div>
        </div>
        <div class="barra-acoes">
          <button nz-button (click)="abrirAdicionar()"><nz-icon nzType="plus" />Adicionar indicador</button>
          <button nz-button nzType="primary" [nzLoading]="consolidando()" (click)="consolidar()" nz-tooltip nzTooltipTitle="Gera o ranking com os contribuintes selecionados nas últimas execuções">
            <nz-icon nzType="sort-descending" />Consolidar contribuintes</button>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><span><nz-icon nzType="sliders" />Indicadores aplicados ao plano</span></div>
        <nz-table #tab [nzData]="plano()" [nzShowPagination]="false" [nzNoResult]="vazio">
          <thead>
            <tr><th>Indicador</th><th>Grupo</th><th>Métrica</th><th>Parâmetros</th><th>Última execução</th><th nzAlign="right">Apontados</th><th nzAlign="right">Selecionados</th><th></th></tr>
          </thead>
          <tbody>
            @for (i of tab.data; track i.id) {
              <tr>
                <td>{{ i.nome }} @if (i.provisorio) { <nz-tag nzColor="warning">provisório</nz-tag> }</td>
                <td class="suave">{{ i.grupo }}</td>
                <td>{{ i.metrica === 'QUANTIDADE' ? 'Qtd. documentos' : 'Valor (R$)' }}</td>
                <td class="mono">{{ parametrosTexto(i) }}</td>
                <td>
                  @if (i.ultimaExecucao; as e) {
                    <mf-status [valor]="e.status" /> <span class="suave">{{ e.inicio | date: 'dd/MM/yyyy HH:mm' }}</span>
                    @if (e.erro) { <div class="erro">{{ e.erro }}</div> }
                  } @else { <span class="suave">nunca executado</span> }
                </td>
                <td nzAlign="right" class="num">{{ i.ultimaExecucao?.qtdResultados ?? 0 | number }}</td>
                <td nzAlign="right" class="num">{{ i.ultimaExecucao?.selecionados ?? 0 | number }}</td>
                <td class="nowrap">
                  <button nz-button nzType="text" nz-tooltip nzTooltipTitle="Executar" [disabled]="i.provisorio || i.ultimaExecucao?.status === 'EXECUTANDO'" (click)="executar(i)"><nz-icon nzType="caret-right" /></button>
                  <button nz-button nzType="text" nz-tooltip nzTooltipTitle="Contribuintes apontados" [disabled]="i.ultimaExecucao?.status !== 'CONCLUIDA'" (click)="abrirResultados(i)"><nz-icon nzType="unordered-list" /></button>
                  <button nz-button nzType="text" nzDanger nz-tooltip nzTooltipTitle="Remover do plano" (click)="remover(i)"><nz-icon nzType="delete" /></button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="sliders" />Nenhum indicador aplicado ainda.</div></ng-template>
      </div>

      @if (gruposDoPlano().length) {
        <div class="cartao">
          <div class="cartao-titulo"><span><nz-icon nzType="ordered-list" />Prioridade de classificação dos grupos</span>
            <button nz-button nzType="primary" nzSize="small" (click)="salvarPrioridades()">Confirmar prioridade</button></div>
          <div class="cartao-corpo">
            <p class="suave" style="margin-top: 0">A prioridade pertence ao grupo (1, 2, 3…, sem repetição nem lacunas) e desempata contribuintes com o mesmo potencial.</p>
            <div class="prioridades">
              @for (g of gruposDoPlano(); track g.id) {
                <div class="campo"><label>{{ g.nome }}</label><nz-input-number [(ngModel)]="prioridades[g.id]" [nzMin]="1" [nzMax]="gruposDoPlano().length" [nzStep]="1" /></div>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <nz-modal [nzVisible]="dlgAdd()" nzTitle="Adicionar indicador ao plano" (nzOnCancel)="dlgAdd.set(false)" nzWidth="40rem" [nzFooter]="rodapeAdd">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div class="campo"><label>Grupo de indicadores</label>
            <nz-select [(ngModel)]="grupoFiltro" nzAllowClear nzPlaceHolder="Todos os grupos">@for (g of grupos(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.nome" /> }</nz-select></div>
          <div class="lista-ind">
            @for (i of indicadoresFiltrados(); track i.id) {
              <label nz-checkbox class="ind" [ngModel]="marcados.includes(i.id!)" (ngModelChange)="marcar(i.id!, $event)" [nzDisabled]="i.provisorio || jaNoPlano(i.id!)">
                {{ i.nome }} @if (i.provisorio) { <nz-tag nzColor="warning">provisório</nz-tag> } @if (jaNoPlano(i.id!)) { <span class="suave">(já no plano)</span> }</label>
            }
          </div>
          <div class="campo"><label>Exercício (parâmetro :exercicio)</label><input nz-input [(ngModel)]="exercicio" style="width: 120px" /></div>
        </div>
      </ng-container>
      <ng-template #rodapeAdd>
        <button nz-button (click)="dlgAdd.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!marcados.length" (click)="adicionar()">Adicionar {{ marcados.length || '' }}</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="!!resInd()" [nzTitle]="'Contribuintes apontados — ' + (resInd()?.nome ?? '')" (nzOnCancel)="fecharResultados()" nzWidth="60rem" [nzFooter]="null">
      <ng-container *nzModalContent>
        <div class="barra-acoes" style="margin-bottom: 10px">
          <span><strong>{{ selecionados() | number }}</strong> de {{ res.total() | number }} selecionado(s) para o plano</span><span class="espaco"></span>
          <button nz-button nzSize="small" (click)="marcarTodos(true)">Marcar todos</button>
          <button nz-button nzType="text" nzSize="small" (click)="marcarTodos(false)">Desmarcar todos</button>
        </div>
        <nz-table #tRes [nzData]="res.itens()" [nzFrontPagination]="false" [nzTotal]="res.total()" [(nzPageIndex)]="res.pagina" [(nzPageSize)]="res.tamanho"
                  [nzLoading]="res.carregando()" (nzQueryParams)="res.aoMudar($event)">
          <thead><tr><th nzWidth="44px"></th><th>Contribuinte</th><th>CAD-ICMS</th><th nzAlign="right">Quantidade</th><th nzAlign="right">Valor</th></tr></thead>
          <tbody>
            @for (r of tRes.data; track r.id) {
              <tr>
                <td [nzChecked]="r.selecionado" (nzCheckedChange)="alternar(r, $event)"></td>
                <td>{{ r.razaoSocial ?? '(cadastro a sincronizar)' }}</td><td class="mono">{{ r.inscricaoEstadual }}</td>
                <td nzAlign="right" class="num">{{ r.quantidade | number }}</td><td nzAlign="right" class="num">{{ r.valor | currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: 14px; }
    .lista-ind { max-height: 320px; overflow-y: auto; border: 1px solid var(--mf-borda); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .ind { margin-left: 0 !important; font-size: 13px; }
    .prioridades { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .erro { color: #dc2626; font-size: 12px; max-width: 280px; }
  `,
})
export class PlanoMalhaPage implements OnDestroy {
  readonly malhaId = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly confirm = inject(ConfirmacaoService);

  readonly malha = signal<Malha | null>(null);
  readonly plano = signal<IndicadorPlano[]>([]);
  readonly catalogo = signal<Indicador[]>([]);
  readonly grupos = signal<GrupoIndicador[]>([]);
  readonly dlgAdd = signal(false);
  readonly consolidando = signal(false);
  readonly resInd = signal<IndicadorPlano | null>(null);
  readonly selecionados = signal(0);
  readonly gruposDoPlano = computed(() => {
    const vistos = new Map<number, string>();
    this.plano().forEach((i) => i.grupoId && vistos.set(i.grupoId, i.grupo));
    return [...vistos].map(([id, nome]) => ({ id, nome }));
  });

  grupoFiltro: number | null = null;
  marcados: number[] = [];
  exercicio = String(new Date().getFullYear() - 1);
  prioridades: Record<number, number> = {};
  private poll?: ReturnType<typeof setTimeout>;

  readonly res = new TabelaServidor<ResultadoIndicador>(
    (c) => this.api.resultados(this.resInd()!.ultimaExecucao!.id, c.pagina, c.tamanho),
    { tamanho: 20 },
  );

  constructor() {
    effect(() => {
      const id = Number(this.malhaId());
      this.api.malha(id).subscribe((m) => this.malha.set(m));
      this.carregarPlano();
    });
    this.api.indicadores().subscribe((i) => this.catalogo.set(i.filter((x) => x.ativo)));
    this.api.grupos().subscribe((g) => this.grupos.set(g));
  }

  ngOnDestroy() {
    clearTimeout(this.poll);
  }

  carregarPlano() {
    this.api.indicadoresDoPlano(Number(this.malhaId())).subscribe((p) => {
      this.plano.set(p);
      const prio: Record<number, number> = {};
      let n = 1;
      p.forEach((i) => { if (i.grupoId && prio[i.grupoId] === undefined) prio[i.grupoId] = i.prioridadeGrupo ?? n; n++; });
      this.prioridades = prio;
      clearTimeout(this.poll);
      if (p.some((i) => i.ultimaExecucao?.status === 'EXECUTANDO')) this.poll = setTimeout(() => this.carregarPlano(), 2000);
    });
  }

  parametrosTexto(i: IndicadorPlano) {
    return Object.entries(i.parametros ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '—';
  }

  indicadoresFiltrados() {
    return this.catalogo().filter((i) => !this.grupoFiltro || i.grupoId === this.grupoFiltro);
  }

  jaNoPlano(id: number) {
    return this.plano().some((p) => p.indicadorId === id);
  }

  marcar(id: number, v: boolean) {
    this.marcados = v ? [...this.marcados, id] : this.marcados.filter((x) => x !== id);
  }

  abrirAdicionar() {
    this.marcados = [];
    this.dlgAdd.set(true);
  }

  adicionar() {
    this.api.adicionarIndicadores(Number(this.malhaId()), this.marcados, { exercicio: this.exercicio }).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Indicadores adicionados' });
      this.dlgAdd.set(false);
      this.carregarPlano();
    });
  }

  executar(i: IndicadorPlano) {
    this.api.executarIndicador(Number(this.malhaId()), i.indicadorId).subscribe(() => {
      this.msg.add({ severity: 'info', summary: 'Execução iniciada', detail: i.nome });
      this.carregarPlano();
    });
  }

  remover(i: IndicadorPlano) {
    this.confirm.confirm({
      header: 'Remover indicador', message: `Remover "${i.nome}" do plano? As execuções anteriores são preservadas.`, acceptLabel: 'Remover', perigo: true,
      accept: () => this.api.removerIndicador(Number(this.malhaId()), i.indicadorId).subscribe(() => this.carregarPlano()),
    });
  }

  abrirResultados(i: IndicadorPlano) {
    this.resInd.set(i);
    this.selecionados.set(i.ultimaExecucao?.selecionados ?? 0);
    this.res.reiniciar();
  }

  fecharResultados() {
    this.resInd.set(null);
    this.carregarPlano();
  }

  alternar(r: ResultadoIndicador, v: boolean) {
    const exec = this.resInd()!.ultimaExecucao!;
    this.api.selecionar(exec.id, false, [r.id], v).subscribe((n) => { r.selecionado = v; this.selecionados.set(n); });
  }

  marcarTodos(v: boolean) {
    const exec = this.resInd()!.ultimaExecucao!;
    this.api.selecionar(exec.id, true, [], v).subscribe((n) => { this.selecionados.set(n); this.res.recarregar(); });
  }

  salvarPrioridades() {
    this.api.prioridades(Number(this.malhaId()), this.prioridades).subscribe(() => this.msg.add({ severity: 'success', summary: 'Prioridade dos grupos confirmada' }));
  }

  consolidar() {
    this.confirm.confirm({
      header: 'Consolidar contribuintes',
      message: 'Gerar o ranking da malha com os contribuintes selecionados nas últimas execuções? Contribuintes já em andamento mantêm sua situação.',
      acceptLabel: 'Consolidar',
      accept: () => {
        this.consolidando.set(true);
        this.api.consolidar(Number(this.malhaId())).subscribe({
          next: (r) => {
            this.consolidando.set(false);
            this.msg.add({ severity: 'success', summary: 'Ranking consolidado', detail: `${r.contribuintes} contribuinte(s) (${r.novos} novo(s)). Regra: ${r.regra}.`, life: 8000 });
            this.api.malha(Number(this.malhaId())).subscribe((m) => this.malha.set(m));
          },
          error: () => this.consolidando.set(false),
        });
      },
    });
  }
}
