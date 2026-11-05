import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../core/api.service';
import { Malha } from '../../core/models';
import { StatusTagComponent } from '../../shared/ui';

@Component({
  selector: 'app-malhas',
  imports: [RouterLink, DatePipe, DecimalPipe, NzSkeletonModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div>
          <h1>Malhas Fiscais</h1>
          <div class="subtitulo">Selecione a malha por período para acessar as listas de trabalho.</div>
        </div>
      </div>
      @if (carregando()) {
        <div class="grade grade-3">@for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="cartao cartao-corpo"><nz-skeleton [nzActive]="true" /></div> }</div>
      } @else if (malhas().length === 0) {
        <div class="cartao vazio"><nz-icon nzType="table" />Nenhuma malha cadastrada.</div>
      } @else {
        <div class="grade grade-3">
          @for (m of malhas(); track m.id) {
            <a class="cartao malha" [routerLink]="['/malhas', m.id]">
              <div class="topo-malha">
                <span class="codigo">{{ m.tipoCodigo }}</span>
                <mf-status [valor]="m.situacao" />
              </div>
              <div class="nome">{{ m.tipoNome }}</div>
              <div class="suave periodo">{{ m.periodoInicio | date: 'MM/yyyy' }} a {{ m.periodoFim | date: 'MM/yyyy' }} · {{ m.nome }}</div>
              <div class="numeros">
                <div><span class="n num">{{ m.contagemPorAba.EM_ANALISE ?? 0 | number }}</span><span class="suave">Em análise</span></div>
                <div><span class="n num">{{ m.contagemPorAba.A_NOTIFICAR ?? 0 | number }}</span><span class="suave">A notificar</span></div>
                <div><span class="n num">{{ m.contagemPorAba.NOTIFICADOS ?? 0 | number }}</span><span class="suave">Notificados</span></div>
                <div><span class="n num">{{ m.contagemPorAba.ENCERRADOS ?? 0 | number }}</span><span class="suave">Encerrados</span></div>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .malha { display: flex; flex-direction: column; gap: 6px; padding: 16px; color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s; }
    .malha:hover { border-color: var(--mf-primaria); box-shadow: 0 2px 8px rgba(15, 23, 42, .06); text-decoration: none; color: inherit; }
    .topo-malha { display: flex; justify-content: space-between; align-items: center; }
    .codigo { font-weight: 700; font-size: 18px; color: var(--mf-primaria); }
    .nome { font-weight: 600; }
    .periodo { font-size: 12px; }
    .numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--mf-borda); }
    .numeros div { display: flex; flex-direction: column; }
    .numeros .n { font-weight: 600; font-size: 16px; }
    .numeros .suave { font-size: 11px; }
  `,
})
export class MalhasPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly malhas = signal<Malha[]>([]);
  readonly carregando = signal(true);

  ngOnInit() {
    this.api.malhas().subscribe({
      next: (m) => {
        this.malhas.set(m.filter((x) => x.situacao !== 'RASCUNHO'));
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }
}
