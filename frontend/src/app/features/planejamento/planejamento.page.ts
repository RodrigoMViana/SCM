import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../../core/api.service';
import { MensagemService } from '../../core/mensagens';
import { Malha, TipoMalha } from '../../core/models';
import { StatusTagComponent, isoData } from '../../shared/ui';

/** Planejamentos (PM-006/007): lista de malhas por período e criação de nova malha. */
@Component({
  selector: 'app-planejamento',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, NzTableModule, NzButtonModule, NzModalModule, NzInputModule, NzSelectModule, NzDatePickerModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Planejamento das malhas</h1><div class="subtitulo">Crie malhas por período, aplique indicadores, execute os cruzamentos e consolide o ranking.</div></div>
        <button nz-button nzType="primary" (click)="nova()"><nz-icon nzType="plus" />Nova malha fiscal</button>
      </div>
      <div class="cartao">
        <nz-table #tab [nzData]="malhas()" [nzLoading]="carregando()" [nzHideOnSinglePage]="true">
          <thead><tr><th>Tipo</th><th>Nome</th><th>Período</th><th>Situação</th><th nzAlign="right">Contribuintes</th><th>Consolidada em</th><th></th></tr></thead>
          <tbody>
            @for (m of tab.data; track m.id) {
              <tr>
                <td><strong>{{ m.tipoCodigo }}</strong> <span class="suave">{{ m.tipoNome }}</span></td>
                <td>{{ m.nome }}</td>
                <td class="nowrap">{{ m.periodoInicio | date: 'dd/MM/yyyy' }} a {{ m.periodoFim | date: 'dd/MM/yyyy' }}</td>
                <td><mf-status [valor]="m.situacao" /></td>
                <td nzAlign="right" class="num">{{ m.total | number }}</td>
                <td>{{ (m.consolidadaEm | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                <td class="nowrap"><a nz-button nzSize="small" [routerLink]="['/planejamento', m.id]"><nz-icon nzType="apartment" />Plano</a>
                  @if (m.situacao !== 'RASCUNHO') { <a nz-button nzType="link" nzSize="small" [routerLink]="['/malhas', m.id]"><nz-icon nzType="table" />Listas</a> }</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </div>

    <nz-modal [nzVisible]="dlg()" nzTitle="Nova Malha Fiscal" (nzOnCancel)="dlg.set(false)" nzWidth="34rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div class="campo"><label class="obrigatorio">Tipo de malha</label>
            <nz-select [(ngModel)]="tipoId" nzPlaceHolder="Selecione">@for (t of tipos(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.rotulo" /> }</nz-select></div>
          <div class="campo"><label class="obrigatorio">Nome da malha</label><input nz-input [(ngModel)]="nome" placeholder="Ex.: Malha A1 — Exercício 2026" /></div>
          <div class="campo-linha">
            <div class="campo"><label class="obrigatorio">Período inicial</label><nz-date-picker [(ngModel)]="inicio" nzFormat="dd/MM/yyyy" /></div>
            <div class="campo"><label class="obrigatorio">Período final</label><nz-date-picker [(ngModel)]="fim" nzFormat="dd/MM/yyyy" /></div>
          </div>
        </div>
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="dlg.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!tipoId || !nome.trim() || !inicio || !fim" (click)="criar()">Criar e montar o plano</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `.corpo { display: flex; flex-direction: column; gap: 14px; }`,
})
export class PlanejamentoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly msg = inject(MensagemService);
  readonly malhas = signal<Malha[]>([]);
  readonly tipos = signal<(TipoMalha & { rotulo: string })[]>([]);
  readonly carregando = signal(true);
  readonly dlg = signal(false);
  tipoId: number | null = null;
  nome = '';
  inicio: Date | null = null;
  fim: Date | null = null;

  ngOnInit() {
    this.api.malhas().subscribe((m) => { this.malhas.set(m); this.carregando.set(false); });
    this.api.tiposMalha().subscribe((t) => this.tipos.set(t.filter((x) => x.ativo).map((x) => ({ ...x, rotulo: `${x.codigo} — ${x.nome}` }))));
  }

  nova() {
    const ano = new Date().getFullYear();
    this.tipoId = null;
    this.nome = '';
    this.inicio = new Date(ano, 0, 1);
    this.fim = new Date(ano, 11, 31);
    this.dlg.set(true);
  }

  criar() {
    this.api.salvarMalha(null, { tipoMalhaId: this.tipoId!, nome: this.nome, periodoInicio: isoData(this.inicio)!, periodoFim: isoData(this.fim)! }).subscribe((m) => {
      this.msg.add({ severity: 'success', summary: 'Malha criada', detail: 'Adicione os indicadores ao plano.' });
      this.dlg.set(false);
      this.router.navigate(['/planejamento', m.id]);
    });
  }
}
