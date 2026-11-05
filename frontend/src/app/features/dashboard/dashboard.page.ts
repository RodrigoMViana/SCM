import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../core/api.service';
import { Dashboard } from '../../core/models';
import { BarrasComponent } from '../../shared/ui';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, CurrencyPipe, DecimalPipe, NzSelectModule, NzSkeletonModule, NzIconModule, BarrasComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Dashboard</h1><div class="subtitulo">Acompanhamento das malhas fiscais e resultados da recuperação.</div></div>
        <nz-select [(ngModel)]="malhaId" (ngModelChange)="carregar()" nzPlaceHolder="Todas as malhas" nzAllowClear style="min-width: 280px">
          @for (o of opcoesMalha(); track o.id) { <nz-option [nzValue]="o.id" [nzLabel]="o.rotulo" /> }
        </nz-select>
      </div>
      @if (dash(); as d) {
        <div class="grade grade-4">
          <div class="cartao kpi"><span class="rotulo">Contribuintes nas malhas</span><span class="valor">{{ d.totalContribuintes | number }}</span>
            <span class="detalhe">{{ d.emAnalise | number }} em análise</span></div>
          <div class="cartao kpi"><span class="rotulo">Potencial de recuperação</span><span class="valor">{{ d.potencialTotal | currency: 'BRL' : 'symbol' : '1.0-0' }}</span></div>
          <div class="cartao kpi"><span class="rotulo">Valor recuperado</span><span class="valor" style="color: #16a34a">{{ d.valorRecuperado | currency: 'BRL' : 'symbol' : '1.0-0' }}</span>
            <span class="detalhe">{{ d.encerrados | number }} caso(s) encerrado(s)</span></div>
          <div class="cartao kpi"><span class="rotulo">Prazos vencidos</span><span class="valor" [style.color]="d.prazosVencidos ? '#dc2626' : ''">{{ d.prazosVencidos | number }}</span>
            <span class="detalhe">{{ d.notificados | number }} notificado(s) · {{ d.suspensos | number }} suspenso(s)</span></div>
        </div>
        <div class="grade grade-2">
          <div class="cartao">
            <div class="cartao-titulo"><span><nz-icon nzType="bar-chart" />Contribuintes por situação</span></div>
            <div class="cartao-corpo"><mf-barras [barras]="graficoStatus()" /></div>
          </div>
          <div class="cartao">
            <div class="cartao-titulo"><span><nz-icon nzType="table" />Malhas</span></div>
            <div class="cartao-corpo">
              <table class="tabela-simples">
                <thead><tr><th>Malha</th><th class="direita">Em análise</th><th class="direita">A notificar</th><th class="direita">Notificados</th><th class="direita">Encerrados</th></tr></thead>
                <tbody>
                  @for (m of d.malhas; track m.id) {
                    <tr><td><a [routerLink]="['/malhas', m.id]"><strong>{{ m.tipoCodigo }}</strong></a>&nbsp;<span class="suave">{{ m.nome }}</span></td>
                      <td class="direita num">{{ m.contagemPorAba.EM_ANALISE ?? 0 | number }}</td><td class="direita num">{{ m.contagemPorAba.A_NOTIFICAR ?? 0 | number }}</td>
                      <td class="direita num">{{ m.contagemPorAba.NOTIFICADOS ?? 0 | number }}</td><td class="direita num">{{ m.contagemPorAba.ENCERRADOS ?? 0 | number }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="cartao kpi"><span class="rotulo">Ações fiscais em andamento</span><span class="valor">{{ d.acoesFiscaisAtivas | number }}</span></div>
      } @else {
        <div class="grade grade-4">@for (i of [1, 2, 3, 4]; track i) { <div class="cartao cartao-corpo"><nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 1 }" /></div> }</div>
      }
    </div>
  `,
  styles: `
    .tabela-simples { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tabela-simples th { text-align: left; font-size: 12px; color: #475569; padding: 6px 8px; border-bottom: 1px solid var(--mf-borda); }
    .tabela-simples td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
    .tabela-simples th.direita, .tabela-simples td.direita { text-align: right; }
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly dash = signal<Dashboard | null>(null);
  readonly opcoesMalha = signal<{ id: number; rotulo: string }[]>([]);
  malhaId: number | null = null;

  private readonly rotulos: Record<string, string> = {
    EM_ANALISE: 'Em análise', A_NOTIFICAR: 'A notificar', NOTIFICACAO_EM_EMISSAO: 'Notificação em emissão', NOTIFICACAO_EMITIDA: 'Notificação emitida',
    NOTIFICADO: 'Notificado', ENCERRADO: 'Encerrado', CANCELADO: 'Cancelado', EXCLUIDO: 'Excluído',
  };

  readonly graficoStatus = computed(() =>
    Object.entries(this.dash()?.porStatus ?? {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ rotulo: this.rotulos[k] ?? k, valor: v }))
  );

  ngOnInit() {
    this.carregar();
    this.api.malhas().subscribe((m) => this.opcoesMalha.set(m.map((x) => ({ id: x.id, rotulo: `${x.tipoCodigo} — ${x.nome}` }))));
  }

  carregar() {
    this.api.dashboard(this.malhaId ?? undefined).subscribe((d) => this.dash.set(d));
  }
}
