import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../../core/api.service';
import { ConfirmacaoService, MensagemService } from '../../core/mensagens';
import { MenuService } from '../../core/menu.service';
import { AcaoFiscal } from '../../core/models';
import { StatusTagComponent } from '../../shared/ui';

/** MPFs designados ao Auditor/Fiscal logado: registro de ciência (PM-069 / RF-09). */
@Component({
  selector: 'app-mpfs-designados',
  imports: [DatePipe, RouterLink, NzTableModule, NzButtonModule, NzIconModule, StatusTagComponent],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>MPFs designados a mim</h1>
        <div class="subtitulo">Quando todos os auditores designados registram ciência, o TIF é incluído e notificado automaticamente (RF-09 → RF-12).</div></div></div>
      <div class="cartao">
        <nz-table #tab [nzData]="itens()" [nzLoading]="carregando()" [nzHideOnSinglePage]="true" [nzNoResult]="vazio">
          <thead><tr><th>Contribuinte</th><th>Malha</th><th>MPF</th><th>Abertura</th><th>Prazo de execução</th><th>Situação</th><th>Equipe</th><th></th></tr></thead>
          <tbody>
            @for (a of tab.data; track a.id) {
              <tr>
                <td><a [routerLink]="['/casos', a.casoId]">{{ a.razaoSocial }}</a></td><td>{{ a.malhaCodigo }}</td>
                <td class="mono">{{ a.numMpf || '—' }}</td><td>{{ (a.dataAberturaMpf | date: 'dd/MM/yyyy') || '—' }}</td><td>{{ (a.prazoExecucao | date: 'dd/MM/yyyy') || '—' }}</td>
                <td><mf-status [valor]="a.status" [rotulo]="a.statusRotulo" /></td>
                <td>@for (x of a.auditores; track x.usuarioId) { <div class="nowrap">{{ x.nome }} {{ x.dataCiencia ? '✓ ' + (x.dataCiencia | date: 'dd/MM') : '(pendente)' }}</div> }</td>
                <td>@if (a.minhaCienciaPendente) { <button nz-button nzType="primary" nzSize="small" (click)="ciencia(a)"><nz-icon nzType="edit" />Registrar ciência</button> }</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #vazio><div class="vazio"><nz-icon nzType="audit" />Nenhum MPF designado.</div></ng-template>
      </div>
    </div>
  `,
})
export class MpfsDesignadosPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  private readonly confirm = inject(ConfirmacaoService);
  private readonly menu = inject(MenuService);
  readonly itens = signal<AcaoFiscal[]>([]);
  readonly carregando = signal(true);

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.api.minhasAcoes().subscribe({ next: (i) => { this.itens.set(i); this.carregando.set(false); }, error: () => this.carregando.set(false) });
  }

  ciencia(a: AcaoFiscal) {
    this.confirm.confirm({
      header: 'Registrar ciência do MPF',
      message: `Registrar sua ciência no MPF ${a.numMpf} (${a.razaoSocial})? Em produção, esta ação exige assinatura com certificado digital.`,
      acceptLabel: 'Registrar ciência',
      accept: () => this.api.cienciaAuditor(a.id).subscribe((r) => {
        this.msg.add({ severity: 'success', summary: 'Ciência registrada', detail: r.status === 'TIF_EM_EMISSAO' ? 'Todos cientes: TIF em emissão no sistema legado.' : 'Aguardando ciência dos demais auditores.' });
        this.menu.atualizarContadores();
        this.carregar();
      }),
    });
  }
}
