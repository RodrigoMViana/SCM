import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { MensagemService } from '../../core/mensagens';
import { PerfilDetalhe, Permissao, UsuarioAdmin } from '../../core/models';
import { TabelaServidor } from '../../shared/ui';

/** Administração de permissões dos perfis (PM-005): perfis por usuário e permissões por perfil. */
@Component({
  selector: 'app-permissoes',
  imports: [FormsModule, NzTableModule, NzTabsModule, NzButtonModule, NzCheckboxModule, NzModalModule, NzInputModule, NzTagModule, NzIconModule],
  template: `
    <div class="pagina">
      <div class="pagina-cabecalho"><div><h1>Administração de permissões dos perfis</h1>
        <div class="subtitulo">Defina os perfis de cada usuário e as funcionalidades liberadas para cada perfil. O menu se ajusta automaticamente.</div></div></div>
      <div class="cartao cartao-abas">
        <nz-tabs>
          <nz-tab nzTitle="Usuários">
            <div class="barra-acoes" style="margin-bottom: 10px">
              <nz-input-wrapper style="width: 300px"><nz-icon nzInputPrefix nzType="search" />
                <input nz-input placeholder="Nome, login ou matrícula" [(ngModel)]="filtro" (keyup.enter)="u.reiniciar()" /></nz-input-wrapper>
            </div>
            <nz-table #tU [nzData]="u.itens()" [nzFrontPagination]="false" [nzTotal]="u.total()" [(nzPageIndex)]="u.pagina" [(nzPageSize)]="u.tamanho"
                      [nzLoading]="u.carregando()" (nzQueryParams)="u.aoMudar($event)">
              <thead><tr><th>Nome</th><th>Login</th><th>Cargo</th><th>Matrícula</th><th>Perfis</th><th></th></tr></thead>
              <tbody>
                @for (x of tU.data; track x.id) {
                  <tr><td>{{ x.nome }}</td><td class="mono">{{ x.login }}</td><td>{{ x.cargo }}</td><td class="mono">{{ x.matricula }}</td>
                    <td>@for (p of x.perfis; track p) { <nz-tag>{{ nomePerfil(p) }}</nz-tag> }</td>
                    <td><button nz-button nzSize="small" (click)="editarUsuario(x)"><nz-icon nzType="user-switch" />Perfis</button></td></tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>
          <nz-tab nzTitle="Perfis e permissões">
            <div class="matriz">
              <table>
                <thead><tr><th>Funcionalidade</th>@for (p of perfis(); track p.codigo) { <th class="centro">{{ p.nome }}</th> }</tr></thead>
                <tbody>
                  @for (g of modulos(); track g.modulo) {
                    <tr class="grupo"><td [attr.colspan]="perfis().length + 1">{{ g.modulo }}</td></tr>
                    @for (perm of g.itens; track perm.codigo) {
                      <tr><td>{{ perm.descricao }} <span class="suave mono">{{ perm.codigo }}</span></td>
                        @for (p of perfis(); track p.codigo) {
                          <td class="centro"><label nz-checkbox [ngModel]="tem(p, perm.codigo)" (ngModelChange)="alternar(p, perm.codigo, $event)"></label></td>
                        }
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            <div class="barra-acoes" style="margin-top: 12px"><span class="espaco"></span>
              <button nz-button nzType="primary" [disabled]="!alterados.size" (click)="salvarPerfis()"><nz-icon nzType="save" />Salvar permissões</button></div>
          </nz-tab>
        </nz-tabs>
      </div>
    </div>

    <nz-modal [nzVisible]="!!usuario()" [nzTitle]="'Perfis de ' + (usuario()?.nome ?? '')" (nzOnCancel)="usuario.set(null)" nzWidth="28rem" [nzFooter]="rodape">
      <ng-container *nzModalContent>
        <div class="lista">
          @for (p of perfis(); track p.codigo) {
            <label nz-checkbox [ngModel]="perfisUsuario.includes(p.codigo)" (ngModelChange)="marcarPerfil(p.codigo, $event)">{{ p.nome }}</label>
          }
        </div>
      </ng-container>
      <ng-template #rodape>
        <button nz-button (click)="usuario.set(null)">Cancelar</button>
        <button nz-button nzType="primary" (click)="salvarUsuario()">Salvar</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .cartao-abas { padding: 4px 16px 16px; }
    .matriz { overflow-x: auto; border: 1px solid var(--mf-borda); border-radius: 8px; background: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8fafc; font-size: 12px; padding: 8px; border-bottom: 1px solid var(--mf-borda); text-align: left; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .grupo td { background: #f8fafc; font-weight: 600; color: var(--mf-primaria); }
    .lista { display: flex; flex-direction: column; gap: 10px; }
    .lista label { margin-left: 0 !important; }
  `,
})
export class PermissoesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly msg = inject(MensagemService);
  readonly perfis = signal<PerfilDetalhe[]>([]);
  readonly permissoes = signal<Permissao[]>([]);
  readonly usuario = signal<UsuarioAdmin | null>(null);
  readonly modulos = computed(() => {
    const m = new Map<string, Permissao[]>();
    this.permissoes().forEach((p) => m.set(p.modulo, [...(m.get(p.modulo) ?? []), p]));
    return [...m].map(([modulo, itens]) => ({ modulo, itens }));
  });
  filtro = '';
  perfisUsuario: string[] = [];
  alterados = new Set<string>();
  readonly u = new TabelaServidor<UsuarioAdmin>((c) => this.api.usuarios(this.filtro, c.pagina, c.tamanho), { tamanho: 20 });

  ngOnInit() {
    this.api.perfisAdmin().subscribe((p) => this.perfis.set(p));
    this.api.permissoes().subscribe((p) => this.permissoes.set(p));
    this.u.reiniciar();
  }

  nomePerfil(codigo: string) {
    return this.perfis().find((p) => p.codigo === codigo)?.nome ?? codigo;
  }

  editarUsuario(x: UsuarioAdmin) {
    this.perfisUsuario = [...x.perfis];
    this.usuario.set(x);
  }

  marcarPerfil(codigo: string, v: boolean) {
    this.perfisUsuario = v ? [...this.perfisUsuario, codigo] : this.perfisUsuario.filter((c) => c !== codigo);
  }

  salvarUsuario() {
    this.api.atualizarPerfisUsuario(this.usuario()!.id, this.perfisUsuario).subscribe(() => {
      this.msg.add({ severity: 'success', summary: 'Perfis atualizados', detail: 'Vale a partir do próximo login do usuário.' });
      this.usuario.set(null);
      this.u.recarregar();
    });
  }

  tem(p: PerfilDetalhe, codigo: string) {
    return p.permissoes.includes(codigo);
  }

  alternar(p: PerfilDetalhe, codigo: string, v: boolean) {
    p.permissoes = v ? [...p.permissoes, codigo] : p.permissoes.filter((x) => x !== codigo);
    this.alterados.add(p.codigo);
  }

  salvarPerfis() {
    for (const codigo of this.alterados) {
      const p = this.perfis().find((x) => x.codigo === codigo)!;
      this.api.atualizarPermissoesPerfil(codigo, p.permissoes).subscribe();
    }
    this.msg.add({ severity: 'success', summary: 'Permissões salvas', detail: `${this.alterados.size} perfil(is) atualizado(s).` });
    this.alterados.clear();
  }
}
