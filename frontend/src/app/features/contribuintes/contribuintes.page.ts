import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../../core/api.service';
import { CasoResumo, Contribuinte } from '../../core/models';
import { StatusTagComponent, TabelaServidor } from '../../shared/ui';

/** Consulta de contribuintes e de sua participação nas malhas (PM-075). */
@Component({
  selector: 'app-contribuintes',
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, NzTableModule, NzButtonModule, NzModalModule, NzInputModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>Contribuintes</h1><div class="subtitulo">Pesquise por razão social, inscrição estadual ou CNPJ.</div></div></div>
      <div class="cartao">
        <div class="cartao-corpo filtros">
          <nz-input-wrapper style="width: 340px"><nz-icon nzInputPrefix nzType="search" />
            <input nz-input [(ngModel)]="filtro" (keyup.enter)="t.reiniciar()" placeholder="Razão social, IE ou CNPJ" /></nz-input-wrapper>
          <button nz-button nzType="primary" (click)="t.reiniciar()">Pesquisar</button>
        </div>
        <nz-table #tab [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" (nzQueryParams)="t.aoMudar($event)">
          <thead><tr><th>Razão social</th><th>CAD-ICMS</th><th>CNPJ</th><th>Situação cadastral</th><th>Município</th><th></th></tr></thead>
          <tbody>
            @for (c of tab.data; track c.id) {
              <tr><td>{{ c.razaoSocial }}</td><td class="mono">{{ c.inscricaoEstadual }}</td><td class="mono">{{ c.cnpj }}</td>
                <td><mf-status [valor]="c.situacaoCadastral" [rotulo]="c.situacaoCadastral" /></td><td>{{ c.municipio }}</td>
                <td><button nz-button nzSize="small" (click)="abrir(c)"><nz-icon nzType="table" />Malhas</button></td></tr>
            }
          </tbody>
        </nz-table>
      </div>
    </div>
    <nz-modal [nzVisible]="!!atual()" [nzTitle]="atual()?.razaoSocial ?? ''" (nzOnCancel)="atual.set(null)" nzWidth="56rem" [nzFooter]="null">
      <ng-container *nzModalContent>
        <nz-table #tC [nzData]="casos()" [nzShowPagination]="false" [nzNoResult]="'Contribuinte não está em nenhuma malha.'">
          <thead><tr><th>Malha</th><th>Situação</th><th nzAlign="right">ICMS a recuperar</th><th>Notificação</th><th>Fim do prazo</th><th>Ação fiscal</th><th></th></tr></thead>
          <tbody>
            @for (c of tC.data; track c.id) {
              <tr><td>{{ c.malhaCodigo }}</td><td><mf-status [valor]="c.status" [rotulo]="c.statusRotulo" /></td><td nzAlign="right" class="num">{{ c.icmsDiferenca | currency }}</td>
                <td class="mono">{{ c.numNotificacao ?? '—' }}</td><td>{{ (c.fimPrazo | date: 'dd/MM/yyyy') || '—' }}</td><td>{{ c.acaoFiscalStatus ?? '—' }}</td>
                <td><a [routerLink]="['/casos', c.id]">Detalhes</a></td></tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>
  `,
  styles: `.filtros { display: flex; gap: 8px; border-bottom: 1px solid var(--mf-borda); }`,
})
export class ContribuintesPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly atual = signal<Contribuinte | null>(null);
  readonly casos = signal<CasoResumo[]>([]);
  filtro = '';
  readonly t = new TabelaServidor<Contribuinte>((c) => this.api.contribuintes(this.filtro, c.pagina, c.tamanho));

  ngOnInit() {
    this.t.reiniciar();
  }

  abrir(c: Contribuinte) {
    this.atual.set(c);
    this.api.pesquisarCasos({ contribuinteId: c.id, tamanho: 50 }).subscribe((p) => this.casos.set(p.itens));
  }
}
