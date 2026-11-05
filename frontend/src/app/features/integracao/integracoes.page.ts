import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfigService } from '../../core/config.service';
import { MensagemService } from '../../core/mensagens';
import { Solicitacao } from '../../core/models';
import { StatusTagComponent, TabelaServidor } from '../../shared/ui';

/** Monitor da fila de integração com o legado: demandas, etapas (RF), erros e reprocessamento. */
@Component({
  selector: 'app-integracoes',
  imports: [RouterLink, DatePipe, NzTableModule, NzButtonModule, NzModalModule, NzTooltipModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Integrações com o {{ cfg.cliente?.sistemaLegado }}</h1>
          <div class="subtitulo">Cada clique no painel gera uma demanda; cada serviço (RF) é uma etapa executada de forma assíncrona, com novas tentativas automáticas.</div></div>
        <div class="barra-acoes">
          <button nz-button (click)="ciencia()" nz-tooltip nzTooltipTitle="Job diário RF-04 / RF-13 / RF-19"><nz-icon nzType="clock-circle" />Executar verificação de ciência agora</button>
          <button nz-button nzType="text" (click)="recarregar()" aria-label="Atualizar"><nz-icon nzType="reload" /></button>
        </div>
      </div>
      <div class="grade grade-4">
        @for (s of cartoes; track s.status) {
          <button class="cartao kpi cartao-filtro" [class.ativo]="filtro.includes(s.status)" (click)="alternarFiltro(s.status)">
            <span class="rotulo">{{ s.rotulo }}</span><span class="valor" [style.color]="s.cor">{{ resumo()[s.status] ?? 0 }}</span>
          </button>
        }
      </div>
      <div class="cartao">
        <nz-table #tab [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" (nzQueryParams)="t.aoMudar($event)" [nzNoResult]="vazio">
          <thead><tr><th>#</th><th>Demanda</th><th>Caso</th><th>Lote</th><th>Situação</th><th>Etapas</th><th>Tentativas</th><th>Criada</th><th>Por</th><th>Último erro</th><th></th></tr></thead>
          <tbody>
            @for (s of tab.data; track s.id) {
              <tr>
                <td class="mono">{{ s.id }}</td><td>{{ s.demandaDescricao }}</td>
                <td>@if (s.casoId) { <a [routerLink]="['/casos', s.casoId]">{{ s.casoId }}</a> }</td>
                <td class="mono">{{ s.loteId ?? '—' }}</td><td><mf-status [valor]="s.status" /></td>
                <td>{{ s.etapaAtual }}/{{ s.totalEtapas }}</td><td>{{ s.tentativas }}</td>
                <td class="nowrap">{{ s.criadoEm | date: 'dd/MM/yyyy HH:mm:ss' }}</td><td>{{ s.criadoPor }}</td>
                <td class="erro">{{ s.ultimoErro ?? '' }}</td>
                <td class="nowrap"><button nz-button nzType="text" (click)="abrir(s.id)" aria-label="Detalhes"><nz-icon nzType="eye" /></button>
                  @if (s.status === 'ERRO') { <button nz-button nzType="text" nz-tooltip nzTooltipTitle="Reprocessar" (click)="reprocessar(s.id)" aria-label="Reprocessar"><nz-icon nzType="redo" /></button> }</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="sync" />Nenhuma demanda.</div></ng-template>
      </div>
    </div>

    <nz-modal [nzVisible]="!!atual()" [nzTitle]="'Demanda #' + (atual()?.id ?? '') + ' — ' + (atual()?.demandaDescricao ?? '')" (nzOnCancel)="atual.set(null)" nzWidth="56rem" [nzFooter]="null">
      <ng-container *nzModalContent>
        @if (atual(); as s) {
          <nz-table #tEt [nzData]="s.etapas" [nzShowPagination]="false">
            <thead><tr><th>RF</th><th>Serviço / caminho no {{ cfg.cliente?.sistemaLegado }}</th><th>Situação</th><th>Fim</th><th>Retorno / erro</th></tr></thead>
            <tbody>
              @for (e of tEt.data; track $index) {
                <tr><td class="mono">{{ e.servico }}</td><td>{{ e.descricao }}<div class="suave">{{ e.caminho }}</div></td><td><mf-status [valor]="e.status" /></td>
                  <td class="nowrap">{{ e.fim | date: 'dd/MM HH:mm:ss' }}</td><td class="mono retorno">{{ e.erro ?? e.retorno ?? '' }}</td></tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .cartao-filtro { text-align: left; cursor: pointer; font: inherit; }
    .cartao-filtro.ativo { border-color: var(--mf-primaria); box-shadow: inset 0 0 0 1px var(--mf-primaria); }
    .erro { color: #dc2626; font-size: 12px; max-width: 260px; }
    .retorno { max-width: 320px; word-break: break-all; font-size: 11px; }
  `,
})
export class IntegracoesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly cfg = inject(ConfigService);
  readonly cartoes = [
    { status: 'PENDENTE', rotulo: 'Pendentes', cor: '#475569' },
    { status: 'EM_EXECUCAO', rotulo: 'Em execução', cor: '#1d4ed8' },
    { status: 'CONCLUIDA', rotulo: 'Concluídas', cor: '#16a34a' },
    { status: 'ERRO', rotulo: 'Com erro', cor: '#dc2626' },
  ];
  readonly resumo = signal<Record<string, number>>({});
  readonly atual = signal<Solicitacao | null>(null);
  filtro: string[] = [];
  readonly t = new TabelaServidor<Solicitacao>((c) => this.api.solicitacoes({ status: this.filtro, pagina: c.pagina, tamanho: c.tamanho }));

  ngOnInit() {
    this.recarregar();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) this.abrir(Number(id));
  }

  alternarFiltro(s: string) {
    this.filtro = this.filtro.includes(s) ? this.filtro.filter((x) => x !== s) : [...this.filtro, s];
    this.t.reiniciar();
  }

  recarregar() {
    this.t.recarregar();
    this.api.resumoIntegracao().subscribe((r) => this.resumo.set(r));
  }

  abrir(id: number) {
    this.api.solicitacao(id).subscribe((s) => this.atual.set(s));
  }

  reprocessar(id: number) {
    this.api.reprocessar(id).subscribe(() => { this.msg.add({ severity: 'success', summary: 'Demanda devolvida à fila' }); this.recarregar(); });
  }

  ciencia() {
    this.api.executarCiencia().subscribe((r) => {
      this.msg.add({ severity: 'success', summary: 'Verificação de ciência concluída', detail: `${r.notificacoes} notificação(ões), ${r.tifs} TIF(s), ${r.autos} auto(s) com ciência registrada.` });
      this.recarregar();
    });
  }
}
