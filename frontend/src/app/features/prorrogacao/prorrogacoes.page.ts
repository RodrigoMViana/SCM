import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ApiService } from '../../core/api.service';
import { MensagemService } from '../../core/mensagens';
import { MenuService } from '../../core/menu.service';
import { Prorrogacao } from '../../core/models';
import { StatusTagComponent, TabelaServidor, isoData } from '../../shared/ui';

/** Pedidos de prorrogação de prazo (PM-044 a PM-048). */
@Component({
  selector: 'app-prorrogacoes',
  imports: [FormsModule, RouterLink, DatePipe, NzTableModule, NzTabsModule, NzButtonModule, NzModalModule, NzDatePickerModule, NzInputModule, NzRadioModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>Pedidos de prorrogação de prazo</h1><div class="subtitulo">Analise os pedidos recebidos dos contribuintes.</div></div></div>
      <nz-tabs [nzSelectedIndex]="analisados() ? 1 : 0" (nzSelectedIndexChange)="trocar($event === 1)" class="abas-filtro">
        <nz-tab nzTitle="Em análise" /><nz-tab nzTitle="Analisados" />
      </nz-tabs>
      <div class="cartao">
        <nz-table #tab [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" (nzQueryParams)="t.aoMudar($event)" [nzNoResult]="vazio">
          <thead>
            <tr><th>Pedido</th><th>Contribuinte</th><th>Malha</th><th>Notificação</th><th>Prazo atual</th><th>Data solicitada</th><th>Origem</th><th>Motivo</th>
              @if (analisados()) { <th>Situação</th><th>Prazo final</th><th>Analisado por</th> } @else { <th></th> }</tr>
          </thead>
          <tbody>
            @for (p of tab.data; track p.id) {
              <tr>
                <td>{{ p.dataPedido | date: 'dd/MM/yyyy' }}</td><td><a [routerLink]="['/casos', p.casoId]">{{ p.razaoSocial }}</a></td><td>{{ p.malha }}</td>
                <td class="mono">{{ p.numNotificacao }}</td><td>{{ p.fimPrazoAtual | date: 'dd/MM/yyyy' }}</td><td>{{ p.dataSolicitada | date: 'dd/MM/yyyy' }}</td>
                <td>{{ p.origem === 'PORTAL' ? 'Portal' : 'Gestor' }}</td><td class="motivo">{{ p.motivo }}</td>
                @if (analisados()) {
                  <td><mf-status [valor]="p.status" /></td><td>{{ (p.dataFinal | date: 'dd/MM/yyyy') || '—' }}</td><td>{{ p.analisadoPor }}</td>
                } @else {
                  <td><button nz-button nzType="primary" nzSize="small" (click)="abrir(p)">Analisar</button></td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="calendar" />Nenhum pedido.</div></ng-template>
      </div>
    </div>

    <nz-modal [nzVisible]="!!atual()" nzTitle="Analisar pedido de prorrogação" (nzOnCancel)="atual.set(null)" nzWidth="34rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        @if (atual(); as p) {
          <div class="corpo">
            <div><strong>{{ p.razaoSocial }}</strong> — prazo atual {{ p.fimPrazoAtual | date: 'dd/MM/yyyy' }}, solicitado {{ p.dataSolicitada | date: 'dd/MM/yyyy' }}</div>
            <nz-radio-group [(ngModel)]="deferido" nzButtonStyle="solid">
              <label nz-radio-button [nzValue]="true">Deferir</label><label nz-radio-button [nzValue]="false">Indeferir</label>
            </nz-radio-group>
            @if (deferido) {
              <div class="campo"><label class="obrigatorio">Data final da prorrogação</label><nz-date-picker [(ngModel)]="dataFinal" nzFormat="dd/MM/yyyy" /></div>
            }
            <div class="campo"><label [class.obrigatorio]="!deferido">Justificativa</label><textarea nz-input rows="3" [(ngModel)]="justificativa"></textarea></div>
          </div>
        }
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="atual.set(null)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="deferido ? !dataFinal : !justificativa.trim()" [nzLoading]="enviando()" (click)="registrar()">Registrar análise</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `.corpo { display: flex; flex-direction: column; gap: 14px; } .motivo { max-width: 320px; }`,
})
export class ProrrogacoesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly menu = inject(MenuService);
  readonly analisados = signal(false);
  readonly atual = signal<Prorrogacao | null>(null);
  readonly enviando = signal(false);
  deferido = true;
  dataFinal: Date | null = null;
  justificativa = '';
  readonly t = new TabelaServidor<Prorrogacao>((c) => this.api.prorrogacoes(this.analisados(), c.pagina, c.tamanho));

  ngOnInit() {
    this.t.reiniciar();
  }

  trocar(a: boolean) {
    this.analisados.set(a);
    this.t.reiniciar();
  }

  abrir(p: Prorrogacao) {
    this.deferido = true;
    this.dataFinal = new Date(p.dataSolicitada + 'T00:00:00');
    this.justificativa = '';
    this.atual.set(p);
  }

  registrar() {
    this.enviando.set(true);
    this.api.analisarProrrogacao(this.atual()!.id, { deferido: this.deferido, dataFinal: isoData(this.dataFinal), justificativa: this.justificativa }).subscribe({
      next: (p) => {
        this.msg.add({ severity: 'success', summary: 'Análise registrada', detail: `Pedido ${p.status === 'DEFERIDO' ? 'deferido' : 'indeferido'}.` });
        this.enviando.set(false);
        this.atual.set(null);
        this.menu.atualizarContadores();
        this.t.reiniciar();
      },
      error: () => this.enviando.set(false),
    });
  }
}
