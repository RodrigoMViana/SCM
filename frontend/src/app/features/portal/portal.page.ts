import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../../core/api.service';
import { ConfigService } from '../../core/config.service';
import { MensagemService } from '../../core/mensagens';
import { DocumentoFiscal, MalhaPortal } from '../../core/models';
import { Selecao, StatusTagComponent, TabelaServidor, isoData } from '../../shared/ui';

/**
 * Simulação do Portal de Autorregularização (lado do contribuinte).
 * Em produção, a mesma API é consumida pelo portal oficial, com a IE vinda do login do contribuinte.
 */
@Component({
  selector: 'app-portal',
  imports: [FormsModule, DatePipe, CurrencyPipe, NzTableModule, NzButtonModule, NzModalModule, NzInputModule, NzSelectModule, NzDatePickerModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="aviso-simulacao"><nz-icon nzType="info-circle" />
        <span>Simulação do ambiente do contribuinte. No portal oficial o contribuinte vê apenas os próprios dados, identificado pelo login.</span></div>
      <div class="pagina-cabecalho">
        <div><h1>{{ cfg.cliente?.portalAutorregularizacao }} — Minhas malhas fiscais</h1>
          <div class="subtitulo">Consulte as inconsistências apontadas, conteste notas fiscais ou solicite prorrogação de prazo.</div></div>
        <div class="campo-linha">
          <div class="campo"><label>Contribuinte (CAD-ICMS)</label><input nz-input [(ngModel)]="ie" style="width: 180px" /></div>
          <button nz-button nzType="primary" (click)="carregar()">Consultar</button>
        </div>
      </div>

      @if (malhas().length === 0) {
        <div class="cartao vazio"><nz-icon nzType="bank" />Nenhuma malha fiscal exibida para este contribuinte.</div>
      } @else {
        <div class="cartao identificacao"><strong>{{ malhas()[0].razaoSocial }}</strong>&nbsp;·&nbsp;<span class="suave">CAD-ICMS {{ malhas()[0].inscricaoEstadual }} · CNPJ {{ malhas()[0].cnpj }}</span></div>
        <div class="grade grade-3">
          @for (m of malhas(); track m.casoId) {
            <button class="cartao malha" [class.ativa]="atual()?.casoId === m.casoId" (click)="selecionar(m)">
              <div class="topo"><strong class="codigo">{{ m.malhaCodigo }}</strong><span class="suave">{{ m.situacao }}</span></div>
              <div>{{ m.malhaNome }}</div>
              <div class="suave">Período {{ m.periodoInicio | date: 'MM/yyyy' }} a {{ m.periodoFim | date: 'MM/yyyy' }} · exibida em {{ m.dataExibicao | date: 'dd/MM/yyyy' }}</div>
              <div class="valor">{{ m.valor | currency }}</div>
            </button>
          }
        </div>
      }

      @if (atual(); as m) {
        <div class="cartao">
          <div class="cartao-titulo">
            <span><nz-icon nzType="unordered-list" />Relação de notas — Malha {{ m.malhaCodigo }}
              @if (m.numNotificacao) { <span class="suave">· Notificação {{ m.numNotificacao }} · prazo {{ m.fimPrazo | date: 'dd/MM/yyyy' }}</span> }</span>
            <span class="barra-acoes">
              <button nz-button nzSize="small" [disabled]="!m.numNotificacao" (click)="abrirProrrogacao()"><nz-icon nzType="calendar" />Solicitar prorrogação de prazo</button>
              <button nz-button nzType="primary" nzSize="small" [disabled]="!m.numNotificacao || !sel.quantidade()" (click)="abrirContestacao()"><nz-icon nzType="message" />Contestar notas selecionadas</button>
            </span>
          </div>
          @if (!m.numNotificacao) { <div class="cartao-corpo suave">A contestação e a prorrogação ficam disponíveis após a emissão da notificação.</div> }
          <nz-table #tab [nzData]="docs.itens()" [nzFrontPagination]="false" [nzTotal]="docs.total()" [(nzPageIndex)]="docs.pagina" [(nzPageSize)]="docs.tamanho"
                    [nzLoading]="docs.carregando()" (nzQueryParams)="docs.aoMudar($event)">
            <thead><tr>
              <th nzWidth="44px" [nzChecked]="sel.todos(pendentes())" [nzIndeterminate]="sel.parcial(pendentes())" [nzDisabled]="!pendentes().length"
                  (nzCheckedChange)="sel.marcarTodos(pendentes(), $event)"></th>
              <th>Nota (chave de acesso)</th><th>Emissão</th><th>Operação</th><th nzAlign="right">Valor</th><th nzAlign="right">ICMS</th><th>Situação</th></tr></thead>
            <tbody>
              @for (d of tab.data; track d.id) {
                <tr><td [nzChecked]="sel.tem(d)" [nzDisabled]="d.situacao !== 'PENDENTE'" (nzCheckedChange)="sel.alternar(d, $event)"></td>
                  <td class="mono">{{ d.chaveAcesso }}</td><td>{{ d.dataEmissao | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ d.operacao }}</td><td nzAlign="right" class="num">{{ d.valorTotal | currency }}</td><td nzAlign="right" class="num">{{ d.valorIcms | currency }}</td><td><mf-status [valor]="d.situacao" /></td></tr>
              }
            </tbody>
          </nz-table>
        </div>
      }
    </div>

    <nz-modal [nzVisible]="dlgCont()" nzTitle="Contestar notas selecionadas" (nzOnCancel)="dlgCont.set(false)" nzWidth="38rem" [nzFooter]="rodapeCont">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div class="suave">{{ sel.quantidade() }} NF-e selecionada(s).</div>
          <div class="campo"><label class="obrigatorio">Tipo de justificativa</label>
            <nz-select [(ngModel)]="tipo">@for (t of tipos; track t) { <nz-option [nzValue]="t" [nzLabel]="t" /> }</nz-select></div>
          <div class="campo"><label class="obrigatorio">Título</label><input nz-input [(ngModel)]="titulo" /></div>
          <div class="campo"><label class="obrigatorio">Justificativa (aplicada a todas as notas)</label><textarea nz-input rows="5" [(ngModel)]="descricao"></textarea></div>
        </div>
      </ng-container>
      <ng-template #rodapeCont>
        <button nz-button (click)="dlgCont.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!titulo.trim() || !descricao.trim()" (click)="contestar()">Enviar contestação</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="dlgPro()" nzTitle="Solicitar prorrogação de prazo" (nzOnCancel)="dlgPro.set(false)" nzWidth="32rem" [nzFooter]="rodapePro">
      <ng-container *nzModalContent>
        <div class="corpo">
          <div class="campo"><label class="obrigatorio">Nova data pretendida</label><nz-date-picker [(ngModel)]="novaData" nzFormat="dd/MM/yyyy" /></div>
          <div class="campo"><label class="obrigatorio">Motivo</label><textarea nz-input rows="4" [(ngModel)]="motivo"></textarea></div>
        </div>
      </ng-container>
      <ng-template #rodapePro>
        <button nz-button (click)="dlgPro.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!novaData || !motivo.trim()" (click)="prorrogar()">Enviar pedido</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .identificacao { padding: 12px 16px; }
    .malha { display: flex; flex-direction: column; gap: 4px; padding: 14px; text-align: left; cursor: pointer; font: inherit; }
    .malha.ativa { border-color: var(--mf-primaria); box-shadow: inset 0 0 0 1px var(--mf-primaria); }
    .topo { display: flex; justify-content: space-between; }
    .codigo { color: var(--mf-primaria); font-size: 16px; }
    .valor { font-weight: 600; font-size: 16px; margin-top: 4px; }
    .corpo { display: flex; flex-direction: column; gap: 14px; }
  `,
})
export class PortalPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  readonly cfg = inject(ConfigService);
  readonly malhas = signal<MalhaPortal[]>([]);
  readonly atual = signal<MalhaPortal | null>(null);
  readonly dlgCont = signal(false);
  readonly dlgPro = signal(false);
  readonly sel = new Selecao<DocumentoFiscal>();
  readonly tipos = ['Escrituração realizada em período anterior', 'Crédito fiscal aproveitado', 'Operação isenta / não tributada', 'Erro na emissão da NF-e', 'Outro'];
  ie = '03.088.888-8';
  tipo = this.tipos[0];
  titulo = '';
  descricao = '';
  novaData: Date | null = null;
  motivo = '';
  readonly docs = new TabelaServidor<DocumentoFiscal>((c) => this.api.documentos(this.atual()!.casoId, c.pagina, c.tamanho, true), { tamanho: 20 });
  readonly pendentes = computed(() => this.docs.itens().filter((d) => d.situacao === 'PENDENTE'));

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.atual.set(null);
    this.api.portalMalhas(this.ie.trim()).subscribe((m) => this.malhas.set(m));
  }

  selecionar(m: MalhaPortal) {
    this.sel.limpar();
    this.atual.set(m);
    this.docs.reiniciar();
  }

  abrirContestacao() {
    this.titulo = '';
    this.descricao = '';
    this.dlgCont.set(true);
  }

  contestar() {
    const qtd = this.sel.quantidade();
    this.api.portalContestar(this.atual()!.casoId, { tipoJustificativa: this.tipo, titulo: this.titulo, descricao: this.descricao, documentoIds: this.sel.ids() }).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Contestação enviada', detail: `${qtd} NF-e contestada(s). A análise será feita pelo Auditor/Fiscal.` });
      this.dlgCont.set(false);
      this.sel.limpar();
      this.docs.recarregar();
    });
  }

  abrirProrrogacao() {
    this.novaData = null;
    this.motivo = '';
    this.dlgPro.set(true);
  }

  prorrogar() {
    this.api.portalProrrogar(this.atual()!.casoId, { dataSolicitada: isoData(this.novaData)!, motivo: this.motivo }).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Pedido de prorrogação enviado' });
      this.dlgPro.set(false);
    });
  }
}
