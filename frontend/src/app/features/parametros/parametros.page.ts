import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { ConfigService } from '../../core/config.service';
import { MensagemService } from '../../core/mensagens';
import { Parametro, ParametroHistorico } from '../../core/models';
import { isoData } from '../../shared/ui';

const NATUREZA: Record<string, { rotulo: string; cor: string }> = {
  FIXO: { rotulo: 'Parâmetro fixo', cor: 'blue' },
  PROCEDIMENTO: { rotulo: 'Preenchido pelo procedimento', cor: 'default' },
  RETORNO: { rotulo: 'Retorno do sistema legado', cor: 'green' },
  REFERENCIA: { rotulo: 'Referência', cor: 'orange' },
};
const VARIAVEIS = ['numero_processo', 'periodo', 'razao_social', 'inscricao_estadual', 'malha', 'anexos', 'email_auditor', 'telefone_auditor', 'prazo_dias'];

/** Parametrizações com vigência, programação e histórico (justificativa obrigatória). */
@Component({
  selector: 'app-parametros',
  imports: [FormsModule, DatePipe, NzTableModule, NzTabsModule, NzButtonModule, NzModalModule, NzInputModule, NzDatePickerModule, NzTagModule, NzIconModule],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>Parametrizações</h1>
        <div class="subtitulo">Prazos, textos e parâmetros dos serviços do {{ cfg.cliente?.sistemaLegado }}. Alterações exigem justificativa e podem ser programadas para uma data futura.</div></div></div>
      <nz-tabs [nzSelectedIndex]="indice()" (nzSelectedIndexChange)="trocar($event)" class="abas-filtro">
        @for (a of abas; track a.v) { <nz-tab [nzTitle]="a.l" /> }
        <nz-tab nzTitle="Histórico de alterações" />
      </nz-tabs>
      @if (aba() === 'hist') {
        <div class="cartao">
          <nz-table #tHist [nzData]="historico()" [nzPageSize]="20" [nzNoResult]="vazio">
            <thead><tr><th>Data/hora</th><th>Usuário</th><th>Parâmetro</th><th>Operação</th><th>Valor anterior</th><th>Novo valor</th><th>Vigência</th><th>Justificativa</th></tr></thead>
            <tbody>@for (h of tHist.data; track h.id) {
              <tr><td class="nowrap">{{ h.dataHora | date: 'dd/MM/yyyy HH:mm' }}</td><td>{{ h.usuario }}</td><td>{{ nomeParametro(h.parametroId) }}</td>
                <td>{{ h.operacao }}</td><td class="valor-h">{{ h.valorAnterior }}</td><td class="valor-h">{{ h.valorNovo }}</td><td>{{ h.vigencia | date: 'dd/MM/yyyy' }}</td><td>{{ h.justificativa }}</td></tr>
            }</tbody>
          </nz-table>
          <ng-template #vazio><div class="vazio">Nenhuma alteração registrada.</div></ng-template>
        </div>
      } @else {
        @for (sec of secoes(); track sec.nome) {
          <div class="cartao">
            <div class="cartao-titulo"><span><nz-icon nzType="setting" />{{ sec.nome }}</span></div>
            <nz-table #tSec [nzData]="sec.itens" [nzShowPagination]="false">
              <thead><tr><th nzWidth="30%">Campo</th><th>Forma de preenchimento</th><th>Valor</th><th>Vigente desde</th><th></th></tr></thead>
              <tbody>
                @for (p of tSec.data; track p.id) {
                  <tr>
                    <td>{{ p.nome }}</td>
                    <td><nz-tag [nzColor]="nat(p).cor">{{ nat(p).rotulo }}</nz-tag></td>
                    <td class="valor">{{ p.valor }}
                      @if (p.vigenciaProgramada) { <div class="programado"><nz-icon nzType="field-time" /> A partir de {{ p.vigenciaProgramada | date: 'dd/MM/yyyy' }}: {{ p.valorProgramado }}</div> }</td>
                    <td class="nowrap">{{ (p.vigenteDesde | date: 'dd/MM/yyyy') || '—' }}</td>
                    <td class="nowrap">
                      @if (p.editavel && p.natureza === 'FIXO') { <button nz-button nzSize="small" (click)="editar(p)">Alterar</button> }
                      @if (p.vigenciaProgramada) { <button nz-button nzType="text" nzSize="small" (click)="cancelando.set(p); justificativa = ''">Cancelar programação</button> }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </div>
        }
      }
    </div>

    <nz-modal [nzVisible]="!!atual()" [nzTitle]="'Alterar parâmetro — ' + (atual()?.nome ?? '')" (nzOnCancel)="atual.set(null)" nzWidth="44rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        @if (atual(); as p) {
          <div class="corpo">
            <div class="suave">Valor vigente desde {{ p.vigenteDesde | date: 'dd/MM/yyyy' }}: <strong>{{ p.valor }}</strong></div>
            <div class="campo"><label class="obrigatorio">Novo valor</label>
              @if (p.tipoValor === 'TEXTO_LONGO') {
                <textarea nz-input rows="6" [(ngModel)]="valor"></textarea>
                <div class="variaveis"><span class="suave">Inserir campo:</span>
                  @for (v of variaveis; track v) { <button nz-button nzType="link" nzSize="small" (click)="inserir(v)">{{ v }}</button> }</div>
              } @else { <input nz-input [(ngModel)]="valor" /> }
            </div>
            <div class="campo"><label class="obrigatorio">Vigente a partir de</label><nz-date-picker [(ngModel)]="vigencia" nzFormat="dd/MM/yyyy" [nzDisabledDate]="antesDeHoje" />
              <span class="ajuda">Data futura = alteração programada; o valor atual continua valendo até lá.</span></div>
            <div class="campo"><label class="obrigatorio">Justificativa</label><textarea nz-input rows="2" [(ngModel)]="justificativa"></textarea></div>
          </div>
        }
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="atual.set(null)">Descartar</button>
        <button nz-button nzType="primary" [disabled]="!valor.trim() || !justificativa.trim() || !vigencia" (click)="salvar()">Confirmar alteração</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="!!cancelando()" nzTitle="Cancelar programação" (nzOnCancel)="cancelando.set(null)" nzWidth="30rem" [nzFooter]="rodapeCanc">
      <ng-container *nzModalContent>
        <div class="campo"><label class="obrigatorio">Justificativa</label><textarea nz-input rows="3" [(ngModel)]="justificativa"></textarea></div>
      </ng-container>
      <ng-template #rodapeCanc>
        <button nz-button (click)="cancelando.set(null)">Voltar</button>
        <button nz-button nzType="primary" [disabled]="!justificativa.trim()" (click)="cancelarProgramacao()">Confirmar cancelamento</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: 14px; }
    .valor { white-space: pre-wrap; max-width: 520px; }
    .valor-h { max-width: 220px; font-size: 12px; }
    .programado { margin-top: 4px; font-size: 12px; color: #92400e; background: #fffbeb; border-radius: 4px; padding: 2px 6px; display: inline-block; }
    .variaveis { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
  `,
})
export class ParametrosPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  readonly cfg = inject(ConfigService);
  readonly abas = [
    { v: 'prazos', l: 'Prazos' }, { v: 'notif', l: 'Notificação' }, { v: 'proc', l: 'Processo' },
    { v: 'port', l: 'Portaria' }, { v: 'mpf', l: 'MPF' }, { v: 'auto', l: 'Auto de Infração' },
  ];
  readonly variaveis = VARIAVEIS;
  readonly aba = signal('prazos');
  readonly indice = computed(() => (this.aba() === 'hist' ? this.abas.length : this.abas.findIndex((a) => a.v === this.aba())));
  readonly todos = signal<Parametro[]>([]);
  readonly historico = signal<ParametroHistorico[]>([]);
  readonly atual = signal<Parametro | null>(null);
  readonly cancelando = signal<Parametro | null>(null);
  readonly secoes = computed(() => {
    const mapa = new Map<string, Parametro[]>();
    this.todos().filter((p) => p.aba === this.aba()).forEach((p) => mapa.set(p.secao, [...(mapa.get(p.secao) ?? []), p]));
    return [...mapa].map(([nome, itens]) => ({ nome, itens }));
  });
  valor = '';
  vigencia: Date | null = null;
  justificativa = '';

  readonly antesDeHoje = (d: Date) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return d < hoje;
  };

  ngOnInit() {
    this.carregar();
  }

  trocar(i: number) {
    const v = i >= this.abas.length ? 'hist' : this.abas[i].v;
    this.aba.set(v);
    if (v === 'hist') this.carregarHistorico();
  }

  carregar() {
    this.api.parametros().subscribe((p) => this.todos.set(p));
  }

  carregarHistorico() {
    this.api.historicoParametros().subscribe((h) => this.historico.set(h));
  }

  nat(p: Parametro) {
    return NATUREZA[p.natureza] ?? NATUREZA['REFERENCIA'];
  }

  nomeParametro(id: number) {
    return this.todos().find((p) => p.id === id)?.nome ?? id;
  }

  inserir(v: string) {
    this.valor = `${this.valor} {{${v}}}`;
  }

  editar(p: Parametro) {
    this.valor = p.valor ?? '';
    this.vigencia = new Date();
    this.justificativa = '';
    this.atual.set(p);
  }

  salvar() {
    this.api.alterarParametro(this.atual()!.id, { valor: this.valor, vigenteAPartir: isoData(this.vigencia), justificativa: this.justificativa }).subscribe((p) => {
      this.msg.add({ severity: 'success', summary: p.vigenciaProgramada ? 'Alteração programada' : 'Parâmetro alterado' });
      this.atual.set(null);
      this.carregar();
    });
  }

  cancelarProgramacao() {
    this.api.cancelarProgramacao(this.cancelando()!.id, this.justificativa).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Programação cancelada' });
      this.cancelando.set(null);
      this.carregar();
    });
  }
}
