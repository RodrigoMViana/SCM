import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ApiService } from '../../core/api.service';
import { MensagemService } from '../../core/mensagens';
import { MenuService } from '../../core/menu.service';
import { Contestacao } from '../../core/models';
import { StatusTagComponent, TabelaServidor, fmtMoeda, lerMoeda } from '../../shared/ui';

/** Caixa de Contestação (PM-051 a PM-056): sem parecer / com parecer e elaboração do parecer. */
@Component({
  selector: 'app-contestacoes',
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, NzTableModule, NzTabsModule, NzButtonModule, NzModalModule, NzInputModule, NzInputNumberModule, NzRadioModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>Caixa de Contestação</h1><div class="subtitulo">Contestações recebidas dos contribuintes notificados.</div></div></div>
      <nz-tabs [nzSelectedIndex]="comParecer() ? 1 : 0" (nzSelectedIndexChange)="trocar($event === 1)" class="abas-filtro">
        <nz-tab nzTitle="Sem parecer" /><nz-tab nzTitle="Com parecer" />
      </nz-tabs>
      <div class="cartao">
        <nz-table #tab [nzData]="t.itens()" [nzFrontPagination]="false" [nzTotal]="t.total()" [(nzPageIndex)]="t.pagina" [(nzPageSize)]="t.tamanho"
                  [nzLoading]="t.carregando()" (nzQueryParams)="t.aoMudar($event)" [nzNoResult]="vazio">
          <thead>
            <tr><th>Número</th><th>Data</th><th>Contribuinte</th><th>CAD-ICMS</th><th>Malha</th><th>Notificação</th><th>Prazo de análise</th>
              @if (comParecer()) { <th>Parecer</th><th>Resultado</th> }<th></th></tr>
          </thead>
          <tbody>
            @for (c of tab.data; track c.id) {
              <tr [style.fontWeight]="!c.lida ? 600 : 400">
                <td class="mono">{{ c.numero }}</td><td>{{ c.dataContestacao | date: 'dd/MM/yyyy' }}</td>
                <td><a [routerLink]="['/casos', c.casoId]">{{ c.razaoSocial }}</a></td><td class="mono">{{ c.inscricaoEstadual }}</td>
                <td>{{ c.malha }}</td><td class="mono">{{ c.numNotificacao }}</td><td>{{ c.prazoAnalise | date: 'dd/MM/yyyy' }}</td>
                @if (comParecer()) { <td class="mono">{{ c.numParecer }}</td><td><mf-status [valor]="c.resultadoParecer ?? ''" /></td> }
                <td><button nz-button nzSize="small" (click)="abrir(c)"><nz-icon nzType="eye" />{{ comParecer() ? 'Ver parecer' : 'Ver' }}</button></td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="inbox" />Nenhuma contestação.</div></ng-template>
      </div>
    </div>

    <nz-modal [nzVisible]="!!atual()" [nzTitle]="'Contestação ' + (atual()?.numero ?? '')" (nzOnCancel)="atual.set(null)" nzWidth="48rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        @if (atual(); as c) {
          <div class="corpo">
            <div class="dados">
              <div><div class="rotulo">Contribuinte</div><div class="valor">{{ c.razaoSocial }}</div></div>
              <div><div class="rotulo">Notificação</div><div class="valor mono">{{ c.numNotificacao }}</div></div>
              <div><div class="rotulo">Tipo de justificativa</div><div class="valor">{{ c.tipoJustificativa }}</div></div>
              <div><div class="rotulo">NF-e contestadas</div><div class="valor">{{ c.qtdDocumentos }}</div></div>
            </div>
            <div><strong>{{ c.titulo }}</strong><p class="texto">{{ c.descricao }}</p></div>
            @if (c.status === 'COM_PARECER') {
              <div class="cartao parecer">
                <div class="cartao-titulo"><span><nz-icon nzType="file-done" />Parecer nº {{ c.numParecer }} — {{ c.dataParecer | date: 'dd/MM/yyyy' }}</span><mf-status [valor]="c.resultadoParecer!" /></div>
                <div class="cartao-corpo"><p class="texto">{{ c.textoParecer }}</p>
                  <div class="suave">Auditor/Fiscal: {{ c.auditorParecer }} · Novo valor: {{ c.novoValor != null ? (c.novoValor | currency) : '—' }} · Novo prazo: {{ c.prazoPosParecer | date: 'dd/MM/yyyy' }}</div></div>
              </div>
            } @else {
              <div class="campo"><label class="obrigatorio">Análise da contestação</label>
                <nz-radio-group [(ngModel)]="resultado" nzButtonStyle="solid">
                  @for (r of resultados; track r.valor) { <label nz-radio-button [nzValue]="r.valor">{{ r.rotulo }}</label> }
                </nz-radio-group></div>
              <div class="campo"><label class="obrigatorio">Parecer</label><textarea nz-input rows="6" [(ngModel)]="texto"></textarea></div>
              <div class="campo"><label>Novo valor a cobrar (R$)</label>
                <nz-input-number [(ngModel)]="novoValor" [nzMin]="0" [nzFormatter]="fmtMoeda" [nzParser]="lerMoeda" style="width: 240px" />
                <span class="ajuda">Deixe em branco para manter o valor da notificação.</span></div>
            }
          </div>
        }
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="atual.set(null)">Fechar</button>
        @if (atual()?.status === 'SEM_PARECER') {
          <button nz-button nzType="primary" [disabled]="!resultado || !texto.trim()" [nzLoading]="enviando()" (click)="emitir()"><nz-icon nzType="check" />Emitir parecer</button>
        }
      </ng-template>
    </nz-modal>
  `,
  styles: `.corpo { display: flex; flex-direction: column; gap: 14px; } .texto { white-space: pre-wrap; line-height: 1.5; margin: 6px 0 0; } .parecer { border-color: #bbf7d0; }`,
})
export class ContestacoesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly menu = inject(MenuService);
  readonly fmtMoeda = fmtMoeda;
  readonly lerMoeda = lerMoeda;
  readonly comParecer = signal(false);
  readonly atual = signal<Contestacao | null>(null);
  readonly enviando = signal(false);
  readonly resultados = [
    { rotulo: 'Procedente', valor: 'PROCEDENTE' },
    { rotulo: 'Procedente parcial', valor: 'PROCEDENTE_PARCIAL' },
    { rotulo: 'Improcedente', valor: 'IMPROCEDENTE' },
  ];
  resultado: string | null = null;
  texto = '';
  novoValor: number | null = null;
  readonly t = new TabelaServidor<Contestacao>((c) => this.api.contestacoes(this.comParecer(), c.pagina, c.tamanho));

  ngOnInit() {
    this.t.reiniciar();
  }

  trocar(com: boolean) {
    this.comParecer.set(com);
    this.t.reiniciar();
  }

  abrir(c: Contestacao) {
    this.resultado = null;
    this.texto = '';
    this.novoValor = null;
    this.api.contestacao(c.id).subscribe((x) => { this.atual.set(x); this.menu.atualizarContadores(); });
  }

  emitir() {
    const c = this.atual()!;
    this.enviando.set(true);
    this.api.emitirParecer(c.id, { resultado: this.resultado!, texto: this.texto, novoValor: this.novoValor }).subscribe({
      next: (x) => {
        this.msg.add({ severity: 'success', summary: 'Parecer emitido', detail: `Parecer nº ${x.numParecer} emitido.` });
        this.enviando.set(false);
        this.atual.set(null);
        this.t.recarregar();
      },
      error: () => this.enviando.set(false),
    });
  }
}
