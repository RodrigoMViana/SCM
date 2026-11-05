import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { MensagemService } from '../../core/mensagens';
import { GrupoIndicador, Indicador, TipoMalha } from '../../core/models';

/** Catálogo de indicadores (cruzamentos) e seus parâmetros. */
@Component({
  selector: 'app-indicadores',
  imports: [FormsModule, NzTableModule, NzButtonModule, NzModalModule, NzInputModule, NzSelectModule, NzRadioModule, NzCheckboxModule, NzSwitchModule, NzTagModule, NzIconModule],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho">
        <div><h1>Indicadores</h1><div class="subtitulo">Catálogo de cruzamentos disponíveis para os planos. Contrato da view/consulta: INSCRICAO_ESTADUAL + QUANTIDADE e/ou VALOR.</div></div>
        <div class="barra-acoes">
          <button nz-button (click)="novoGrupo()"><nz-icon nzType="folder-add" />Novo grupo</button>
          <button nz-button nzType="primary" (click)="editar(null)"><nz-icon nzType="plus" />Novo indicador</button>
        </div>
      </div>
      <div class="cartao">
        <div class="cartao-corpo filtros">
          <nz-input-wrapper style="width: 300px"><nz-icon nzInputPrefix nzType="search" /><input nz-input placeholder="Pesquisar indicador" [(ngModel)]="busca" /></nz-input-wrapper>
          <nz-select [(ngModel)]="grupoFiltro" nzAllowClear nzPlaceHolder="Todos os grupos" style="min-width: 320px">
            @for (g of grupos(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.nome" /> }
          </nz-select>
        </div>
        <nz-table #tab [nzData]="filtrados()" [nzPageSize]="20">
          <thead><tr><th>Código</th><th>Indicador</th><th>Grupo</th><th>Tipo de malha</th><th>Métrica</th><th>Origem</th><th>Risco</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            @for (i of tab.data; track i.id) {
              <tr>
                <td class="mono">{{ i.codigo }}</td>
                <td>{{ i.nome }} @if (i.provisorio) { <nz-tag nzColor="warning">cadastro provisório</nz-tag> }</td>
                <td class="suave">{{ i.grupoNome }}</td><td>{{ i.tipoMalhaCodigo }}</td>
                <td>{{ i.metrica === 'QUANTIDADE' ? 'Qtd. documentos' : 'Valor (R$)' }}</td>
                <td class="mono">{{ i.origem === 'VIEW' ? (i.viewOrigem || '—') : 'Consulta SQL' }}</td>
                <td>{{ i.riscoPadrao }}</td>
                <td><nz-tag [nzColor]="i.ativo ? 'success' : 'default'">{{ i.ativo ? 'Ativo' : 'Inativo' }}</nz-tag></td>
                <td><button nz-button nzType="text" (click)="editar(i)" aria-label="Alterar"><nz-icon nzType="edit" /></button></td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </div>

    <nz-modal [nzVisible]="dlg()" [nzTitle]="form.id ? 'Alterar indicador' : 'Novo indicador'" (nzOnCancel)="dlg.set(false)" nzWidth="52rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        <div class="form">
          <div class="grade grade-2">
            <div class="campo"><label class="obrigatorio">Nome do indicador</label><input nz-input [(ngModel)]="form.nome" /></div>
            <div class="campo"><label>Código</label><input nz-input [(ngModel)]="form.codigo" /></div>
            <div class="campo"><label>Grupo</label>
              <nz-select [(ngModel)]="form.grupoId" nzAllowClear>@for (g of grupos(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.nome" /> }</nz-select></div>
            <div class="campo"><label>Tipo de malha</label>
              <nz-select [(ngModel)]="form.tipoMalhaId" nzAllowClear>@for (t of tipos(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.codigo + ' — ' + t.nome" /> }</nz-select></div>
            <div class="campo"><label class="obrigatorio">Métrica de ranqueamento</label>
              <nz-radio-group [(ngModel)]="form.metrica" nzButtonStyle="solid">
                <label nz-radio-button nzValue="QUANTIDADE">Quantidade de documentos</label><label nz-radio-button nzValue="VALOR">Valor (R$)</label>
              </nz-radio-group></div>
            <div class="campo"><label>Risco padrão</label>
              <nz-radio-group [(ngModel)]="form.riscoPadrao" nzButtonStyle="solid">
                <label nz-radio-button nzValue="BAIXO">Baixo</label><label nz-radio-button nzValue="MEDIO">Médio</label><label nz-radio-button nzValue="ALTO">Alto</label>
              </nz-radio-group></div>
          </div>
          <div class="campo"><label>Descrição / objetivo</label><textarea nz-input rows="2" [(ngModel)]="form.descricao"></textarea></div>
          <div class="campo"><label>Origem dos dados</label>
            <nz-radio-group [(ngModel)]="form.origem" nzButtonStyle="solid">
              <label nz-radio-button nzValue="VIEW">View</label><label nz-radio-button nzValue="SQL">Consulta SQL</label>
            </nz-radio-group></div>
          @if (form.origem === 'VIEW') {
            <div class="campo"><label>View de origem</label><input nz-input class="mono" [(ngModel)]="form.viewOrigem" placeholder="VW_MF_..." />
              <span class="ajuda">Cada parâmetro vira um filtro: COLUNA = :parametro.</span></div>
          } @else {
            <div class="campo"><label>Consulta SQL</label><textarea nz-input rows="6" class="mono" [(ngModel)]="form.consultaSql" placeholder="SELECT INSCRICAO_ESTADUAL, QUANTIDADE, VALOR FROM ... WHERE EXERCICIO = :exercicio"></textarea>
              <span class="ajuda">Somente SELECT. Use :nome_do_parametro para referenciar os parâmetros.</span></div>
          }
          <div class="campo">
            <div class="barra-acoes"><label>Parâmetros esperados</label><span class="espaco"></span>
              <button nz-button nzType="link" nzSize="small" (click)="form.parametros.push({ nome: '', tipo: 'TEXTO', obrigatorio: false })"><nz-icon nzType="plus" />Adicionar parâmetro</button></div>
            @for (p of form.parametros; track $index) {
              <div class="param">
                <input nz-input class="mono" [(ngModel)]="p.nome" placeholder="nome" />
                <nz-select [(ngModel)]="p.tipo">@for (t of tiposParam; track t) { <nz-option [nzValue]="t" [nzLabel]="t" /> }</nz-select>
                <label nz-checkbox [(ngModel)]="p.obrigatorio">obrigatório</label>
                <input nz-input [(ngModel)]="p.valorPadrao" placeholder="valor padrão" />
                <button nz-button nzType="text" nzDanger (click)="form.parametros.splice($index, 1)" aria-label="Remover"><nz-icon nzType="delete" /></button>
              </div>
            }
          </div>
          <div class="campo-linha"><nz-switch [(ngModel)]="form.ativo" /><span>{{ form.ativo ? 'Ativo' : 'Inativo' }}</span></div>
        </div>
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="dlg.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!form.nome.trim()" (click)="salvar()">Salvar</button>
      </ng-template>
    </nz-modal>

    <nz-modal [nzVisible]="dlgGrupo()" nzTitle="Novo grupo de indicadores" (nzOnCancel)="dlgGrupo.set(false)" nzWidth="28rem" [nzFooter]="rodapeGrupo">
      <ng-container *nzModalContent>
        <div class="campo"><label class="obrigatorio">Nome do grupo</label><input nz-input [(ngModel)]="nomeGrupo" /></div>
      </ng-container>
      <ng-template #rodapeGrupo>
        <button nz-button (click)="dlgGrupo.set(false)">Cancelar</button>
        <button nz-button nzType="primary" [disabled]="!nomeGrupo.trim()" (click)="salvarGrupo()">Salvar</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .filtros { display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--mf-borda); }
    .form { display: flex; flex-direction: column; gap: 14px; }
    .param { display: grid; grid-template-columns: 1.2fr 1fr auto 1fr auto; gap: 8px; align-items: center; margin-top: 6px; }
  `,
})
export class IndicadoresPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  readonly indicadores = signal<Indicador[]>([]);
  readonly grupos = signal<GrupoIndicador[]>([]);
  readonly tipos = signal<TipoMalha[]>([]);
  readonly dlg = signal(false);
  readonly dlgGrupo = signal(false);
  readonly buscaSig = signal('');
  readonly grupoSig = signal<number | null>(null);
  readonly tiposParam = ['INTEIRO', 'DECIMAL', 'TEXTO', 'DATA'];
  readonly filtrados = computed(() => {
    const b = this.buscaSig().toLowerCase();
    return this.indicadores().filter((i) => (!b || i.nome.toLowerCase().includes(b) || (i.codigo ?? '').toLowerCase().includes(b))
      && (!this.grupoSig() || i.grupoId === this.grupoSig()));
  });
  form: Indicador = this.vazio();
  nomeGrupo = '';

  get busca() { return this.buscaSig(); }
  set busca(v: string) { this.buscaSig.set(v); }
  get grupoFiltro() { return this.grupoSig(); }
  set grupoFiltro(v: number | null) { this.grupoSig.set(v); }

  ngOnInit() {
    this.carregar();
    this.api.grupos().subscribe((g) => this.grupos.set(g));
    this.api.tiposMalha().subscribe((t) => this.tipos.set(t));
  }

  carregar() {
    this.api.indicadores().subscribe((i) => this.indicadores.set(i));
  }

  vazio(): Indicador {
    return { nome: '', metrica: 'VALOR', origem: 'VIEW', riscoPadrao: 'MEDIO', ativo: true, provisorio: true, parametros: [] };
  }

  editar(i: Indicador | null) {
    if (!i) {
      this.form = this.vazio();
      this.dlg.set(true);
      return;
    }
    this.api.indicador(i.id!).subscribe((x) => { this.form = { ...x, parametros: x.parametros.map((p) => ({ ...p })) }; this.dlg.set(true); });
  }

  salvar() {
    this.api.salvarIndicador(this.form).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Indicador salvo' });
      this.dlg.set(false);
      this.carregar();
    });
  }

  novoGrupo() {
    this.nomeGrupo = '';
    this.dlgGrupo.set(true);
  }

  salvarGrupo() {
    this.api.salvarGrupo({ nome: this.nomeGrupo, ativo: true, ordem: this.grupos().length + 1 }).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Grupo criado' });
      this.dlgGrupo.set(false);
      this.api.grupos().subscribe((g) => this.grupos.set(g));
    });
  }
}
