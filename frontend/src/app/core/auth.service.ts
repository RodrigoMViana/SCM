import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PerfilResumo, Sessao } from './models';

const CHAVE_TOKEN = 'mf.token';
const CHAVE_PERFIL = 'mf.perfil';

function ler(chave: string): string | null {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, valor);
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * Sessão do usuário: token JWT, perfis autorizados e PERFIL ATIVO.
 * Trocar de perfil não exige novo login: o perfil ativo segue no cabeçalho X-Perfil
 * e o back-end concede apenas as permissões daquele perfil.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(ler(CHAVE_TOKEN));
  readonly perfilAtivo = signal<string | null>(ler(CHAVE_PERFIL));
  readonly sessao = signal<Sessao | null>(null);

  readonly autenticado = computed(() => !!this.token());
  readonly perfis = computed<PerfilResumo[]>(() => this.sessao()?.perfis ?? []);
  readonly permissoes = computed(() => new Set(this.sessao()?.permissoes ?? []));
  readonly nomePerfilAtivo = computed(
    () => this.perfis().find((p) => p.codigo === this.perfilAtivo())?.nome ?? ''
  );

  pode(...permissoes: string[]): boolean {
    const p = this.permissoes();
    return permissoes.some((x) => p.has(x));
  }

  async entrar(login: string, senha: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<{ token: string; perfis: PerfilResumo[] }>('/api/auth/login', { login, senha })
    );
    this.token.set(r.token);
    gravar(CHAVE_TOKEN, r.token);
    const perfil = r.perfis[0]?.codigo ?? null;
    this.perfilAtivo.set(perfil);
    gravar(CHAVE_PERFIL, perfil);
    await this.carregarSessao();
  }

  async carregarSessao(): Promise<Sessao | null> {
    if (!this.token()) return null;
    try {
      const s = await firstValueFrom(this.http.get<Sessao>('/api/auth/sessao'));
      this.sessao.set(s);
      if (s.perfilAtivo && s.perfilAtivo !== this.perfilAtivo()) {
        this.perfilAtivo.set(s.perfilAtivo);
        gravar(CHAVE_PERFIL, s.perfilAtivo);
      }
      return s;
    } catch {
      this.sair(false);
      return null;
    }
  }

  async trocarPerfil(codigo: string) {
    this.perfilAtivo.set(codigo);
    gravar(CHAVE_PERFIL, codigo);
    await this.carregarSessao();
    await this.router.navigateByUrl('/inicio');
  }

  sair(navegar = true) {
    this.token.set(null);
    this.sessao.set(null);
    this.perfilAtivo.set(null);
    gravar(CHAVE_TOKEN, null);
    gravar(CHAVE_PERFIL, null);
    if (navegar) this.router.navigateByUrl('/login');
  }
}
