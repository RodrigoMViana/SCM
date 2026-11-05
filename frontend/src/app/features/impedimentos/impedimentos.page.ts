import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmacaoService, MensagemService } from '../../core/mensagens';
import { Impedimento } from '../../core/models';

/** Contribuintes impedidos de notificação/ação fiscal (F-020, F-021, PM-040, PM-041). */
@Component({
  selector: 'app-impedimentos',
  imports: [FormsModule, DatePipe, NzTableModule, NzButtonModule, NzModalModule, NzInputModule, NzTagModule, NzIconModule],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Contribuintes impedidos</h1>
          <div class="subtitulo">{{ auth.pode('IMPEDIMENTO_GERIR') ? 'Inclua ou libere impedimentos do seu perfil.' : 'Somente leitura.' }}</div></div>
        @if (auth.pode('IMPEDIMENTO_GERIR')) { <button nz-button nzType="primary" (click)="novo.set(true)"><nz-icon nzType="stop" />Impedir contribuinte</button> }
      </div>
      <div class="cartao">
        <nz-table #tab [nzData]="itens()" [nzLoading]="carregando()" [nzPageSize]="25" [nzHideOnSinglePage]="true" [nzNoResult]="vazio">
          <thead><tr><th>Contribuinte</th><th>CAD-ICMS</th><th>CNPJ</th><th>Origem</th><th>Data</th><th>Justificativa</th><th></th></tr></thead>
          <tbody>
            @for (i of tab.data; track i.id) {
              <tr><td>{{ i.razaoSocial }}</td><td class="mono">{{ i.inscricaoEstadual }}</td><td class="mono">{{ i.cnpj }}</td>
                <td><nz-tag>Impedido pelo {{ i.origemRotulo }}</nz-tag></td><td>{{ i.data | date: 'dd/MM/yyyy' }}</td><td>{{ i.justificativa }}</td>
                <td>@if (i.podeLiberar) { <button nz-button nzSize="small" (click)="liberar(i)">Permitir notificação</button> }</td></tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="stop" />Nenhum contribuinte impedido.</div></ng-template>
      </div>
    </div>
    <nz-modal [nzVisible]="novo()" nzTitle="Impedir notificação de contribuinte" (nzOnCancel)="novo.set(false)" nzWidth="30rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div class="campo"><label class="obrigatorio">Inscrição estadual (CAD-ICMS)</label><input nz-input [(ngModel)]="ie" placeholder="00.000.000-0" /></div>
          <div class="campo"><label class="obrigatorio">Justificativa</label><textarea nz-input rows="3" [(ngModel)]="justificativa"></textarea></div>
        </div>
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="novo.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!ie.trim() || !justificativa.trim()" (click)="incluir()">Impedir</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `.corpo { display: flex; flex-direction: column; gap: 14px; }`,
})
export class ImpedimentosPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly confirm = inject(ConfirmacaoService);
  readonly auth = inject(AuthService);
  readonly itens = signal<Impedimento[]>([]);
  readonly carregando = signal(true);
  readonly novo = signal(false);
  ie = '';
  justificativa = '';

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.api.impedimentos().subscribe({ next: (i) => { this.itens.set(i); this.carregando.set(false); }, error: () => this.carregando.set(false) });
  }

  incluir() {
    this.api.incluirImpedimento(this.ie.trim(), this.justificativa).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Impedimento incluído' });
      this.novo.set(false);
      this.ie = this.justificativa = '';
      this.carregar();
    });
  }

  liberar(i: Impedimento) {
    this.confirm.confirm({
      header: 'Permitir notificação', message: `Liberar ${i.razaoSocial} para notificação?`, acceptLabel: 'Liberar',
      accept: () => this.api.liberarImpedimento(i.id).subscribe(() => { this.msg.add({ severity: 'success', summary: 'Impedimento liberado' }); this.carregar(); }),
    });
  }
}
