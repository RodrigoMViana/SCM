import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../../core/auth.service';
import { ConfigService } from '../../core/config.service';
import { MenuService } from '../../core/menu.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzIconModule, NzAlertModule],
  template: `
    <div class="fundo">
      <div class="coluna">
        <div class="cabecalho">
          @if (cfg.cliente?.tema?.logoUrl) { <img [src]="cfg.cliente!.tema.logoUrl" width="48" height="48" alt="" /> }
          <h1>{{ cfg.cliente?.nomeSistema ?? 'Painel de Malhas Fiscais' }}</h1>
          <span class="suave">{{ cfg.cliente?.nomeOrgao ?? '' }}</span>
        </div>

        <form class="cartao" (ngSubmit)="entrar()">
          <div class="cartao-titulo"><span><nz-icon nzType="user" />Login de acesso</span></div>
          <div class="cartao-corpo corpo">
            <div class="campo">
              <label for="login">Login</label>
              <input nz-input id="login" name="login" [(ngModel)]="login" placeholder="Exemplo: sergio.lages" autocomplete="username" />
            </div>
            <div class="campo">
              <label for="senha">Senha</label>
              <nz-input-password>
                <input nz-input id="senha" name="senha" type="password" [(ngModel)]="senha" placeholder="Digite sua senha" autocomplete="current-password" />
              </nz-input-password>
            </div>
            @if (erro()) { <nz-alert nzType="error" [nzMessage]="erro()!" nzShowIcon /> }
            <button nz-button nzType="primary" nzBlock type="submit" [nzLoading]="carregando()" [disabled]="!login || !senha">Entrar</button>
            <button nz-button nzBlock type="button" (click)="certificado()"><nz-icon nzType="safety-certificate" />Login com certificado digital</button>
          </div>
        </form>

        <div class="cartao">
          <div class="cartao-titulo"><span><nz-icon nzType="key" />Acesso de demonstração</span></div>
          <div class="cartao-corpo demo">
            <span class="suave">{{ cfg.config()?.demonstracao ? 'Versão de demonstração com dados fictícios.' : 'Ambiente de desenvolvimento.' }}
              Senha de todos os usuários: 123456. Clique para preencher o login.</span>
            @for (u of demo; track u.login) {
              <button type="button" class="usuario-demo" (click)="preencher(u.login)">
                <strong>{{ u.login }}</strong><span class="suave">{{ u.desc }}</span>
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .fundo { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--mf-fundo); }
    .coluna { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 20px; }
    .cabecalho { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
    .cabecalho h1 { font-size: 20px; color: var(--mf-primaria); }
    .corpo { display: flex; flex-direction: column; gap: 14px; }
    .demo { display: flex; flex-direction: column; gap: 8px; }
    .usuario-demo { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; border: 1px solid var(--mf-borda);
      border-radius: 6px; background: #fff; cursor: pointer; text-align: left; font: inherit; }
    .usuario-demo:hover { background: #f8fafc; border-color: var(--mf-primaria); }
    .usuario-demo span { font-size: 12px; }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly menu = inject(MenuService);
  readonly cfg = inject(ConfigService);

  login = '';
  senha = '';
  readonly erro = signal<string | null>(null);
  readonly carregando = signal(false);

  readonly demo = [
    { login: 'sergio.lages', desc: 'Todos os perfis — alterne pelo seletor do cabeçalho' },
    { login: 'gestor', desc: 'Gestor das Malhas' },
    { login: 'caio.kenji', desc: 'Auditor/Fiscal (MPF aguardando ciência)' },
    { login: 'gerente.nufes', desc: 'Gerente NUFES' },
    { login: 'gerente.cepaf', desc: 'Gerente CEPAF' },
    { login: 'contribuinte', desc: 'Portal de Autorregularização (simulação)' },
  ];

  preencher(login: string) {
    this.login = login;
    if (this.cfg.config()?.demonstracao) this.senha = '123456';
  }

  async entrar() {
    this.erro.set(null);
    this.carregando.set(true);
    try {
      await this.auth.entrar(this.login.trim(), this.senha);
      await this.router.navigateByUrl(this.menu.primeiraRota());
    } catch (e: unknown) {
      const err = e as { error?: { detail?: string }; status?: number };
      this.erro.set(err?.error?.detail ?? (err?.status === 0 ? 'Servidor indisponível.' : 'Não foi possível autenticar.'));
    } finally {
      this.carregando.set(false);
    }
  }

  certificado() {
    this.erro.set('Autenticação por certificado digital é realizada pelo SSO corporativo do órgão (modo oidc).');
  }
}
