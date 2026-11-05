import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Subscription, filter, interval } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ConfigService } from '../core/config.service';
import { MenuService } from '../core/menu.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, NzSelectModule, NzButtonModule, NzBadgeModule, NzAvatarModule, NzTooltipModule, NzIconModule],
  template: `
    <div class="shell" [class.recolhido]="recolhido()">
      <aside class="lateral">
        <div class="marca">
          @if (cfg.cliente?.tema?.logoUrl) {
            <img [src]="cfg.cliente!.tema.logoUrl" alt="" width="32" height="32" />
          }
          <div class="marca-texto">
            <span class="sistema">{{ cfg.cliente?.nomeSistema ?? 'Painel de Malhas Fiscais' }}</span>
            <span class="orgao">{{ cfg.cliente?.nomeCurto ?? '' }}</span>
          </div>
        </div>
        <nav>
          @for (item of menu.itens(); track item.rota) {
            <a [routerLink]="item.rota" routerLinkActive="ativo" class="item" nz-tooltip [nzTooltipTitle]="recolhido() ? item.rotulo : ''" nzTooltipPlacement="right">
              <nz-icon [nzType]="item.icone" />
              <span class="rotulo">{{ item.rotulo }}</span>
              @if (item.contador && (menu.contadores()?.[item.contador] ?? 0) > 0) {
                <nz-badge nzStandalone [nzCount]="menu.contadores()![item.contador]" [nzOverflowCount]="999" />
              }
            </a>
          }
        </nav>
        <div class="rodape-lateral">Produto Indra · v{{ cfg.config()?.versao }}</div>
      </aside>

      <div class="principal">
        <header class="topo">
          <button nz-button nzType="text" (click)="recolhido.set(!recolhido())" aria-label="Recolher menu">
            <nz-icon [nzType]="recolhido() ? 'menu-unfold' : 'menu-fold'" />
          </button>
          @if (cfg.config()?.demonstracao) { <span class="selo-demo">Versão de demonstração · dados fictícios</span> }
          <span class="espaco"></span>
          @if (auth.perfis().length > 1) {
            <div class="perfil">
              <span class="suave">Perfil</span>
              <nz-select class="seletor-perfil" [ngModel]="auth.perfilAtivo()" (ngModelChange)="trocar($event)">
                @for (p of auth.perfis(); track p.codigo) { <nz-option [nzValue]="p.codigo" [nzLabel]="p.nome" /> }
              </nz-select>
            </div>
          } @else {
            <span class="perfil-unico">{{ auth.nomePerfilAtivo() }}</span>
          }
          <div class="usuario">
            <nz-avatar [nzText]="iniciais()" style="background: var(--mf-primaria); color: #fff" />
            <span>{{ auth.sessao()?.nome }}</span>
          </div>
          <button nz-button nzType="text" (click)="auth.sair()" aria-label="Sair"><nz-icon nzType="logout" /><span class="rotulo-sair">Sair</span></button>
        </header>
        <main>
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: var(--mf-sidebar) 1fr; min-height: 100vh; transition: grid-template-columns .2s; }
    .shell.recolhido { grid-template-columns: 64px 1fr; }
    .lateral { background: #fff; border-right: 1px solid var(--mf-borda); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .marca { display: flex; align-items: center; gap: 10px; padding: 16px; border-bottom: 1px solid var(--mf-borda); min-height: 64px; }
    .marca-texto { display: flex; flex-direction: column; min-width: 0; }
    .sistema { font-weight: 600; color: var(--mf-primaria); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .orgao { font-size: 12px; color: var(--mf-texto-suave); }
    nav { display: flex; flex-direction: column; padding: 8px; gap: 2px; flex: 1; }
    .item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 6px; color: #475569; font-weight: 500; font-size: 13px; text-decoration: none; }
    .item:hover { background: #f1f5f9; color: var(--mf-texto); text-decoration: none; }
    .item.ativo { background: color-mix(in srgb, var(--mf-primaria) 10%, white); color: var(--mf-primaria); }
    .item nz-icon { font-size: 16px; width: 18px; }
    .item .rotulo { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .recolhido .marca-texto, .recolhido .rotulo, .recolhido nz-badge, .recolhido .rodape-lateral { display: none; }
    .recolhido .item { justify-content: center; }
    .rodape-lateral { padding: 12px 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid var(--mf-borda); }
    .principal { display: flex; flex-direction: column; min-width: 0; }
    .topo { height: 64px; background: #fff; border-bottom: 1px solid var(--mf-borda); display: flex; align-items: center; gap: 16px; padding: 0 16px; position: sticky; top: 0; z-index: 10; }
    .espaco { flex: 1; }
    .selo-demo { font-size: 12px; font-weight: 500; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 2px 10px; }
    .perfil { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; }
    .seletor-perfil { width: 220px; }
    .perfil-unico { font-size: 13px; font-weight: 500; color: var(--mf-primaria); }
    .usuario { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
    main { min-width: 0; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 64px 1fr; } .marca-texto, .rotulo, .rodape-lateral, .selo-demo, .rotulo-sair, .perfil > .suave { display: none; }
      .usuario > span { display: none; } .topo { gap: 6px; padding: 0 8px; } .seletor-perfil { width: 150px; }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly menu = inject(MenuService);
  readonly cfg = inject(ConfigService);
  private readonly router = inject(Router);
  readonly recolhido = signal(false);
  readonly iniciais = computed(() =>
    (this.auth.sessao()?.nome ?? '?').replace(/[^\p{L}\s]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  );
  private subs = new Subscription();

  ngOnInit() {
    this.menu.atualizarContadores();
    this.subs.add(interval(60_000).subscribe(() => this.menu.atualizarContadores()));
    this.subs.add(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menu.atualizarContadores()));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  async trocar(codigo: string) {
    await this.auth.trocarPerfil(codigo);
    this.menu.atualizarContadores();
  }
}
