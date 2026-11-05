import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NzConfigService } from 'ng-zorro-antd/core/config';
import { firstValueFrom } from 'rxjs';
import { ConfiguracaoCliente } from './models';

/**
 * Carrega a identidade do CLIENTE em tempo de execução (nome do órgão, sistema legado,
 * cores e logotipo). O mesmo build do front-end atende qualquer órgão: basta o back-end
 * estar configurado com o perfil do cliente (ex.: application-sefazap.yml).
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly title = inject(Title);
  private readonly nz = inject(NzConfigService);

  readonly config = signal<ConfiguracaoCliente | null>(null);

  get cliente() {
    return this.config()?.cliente;
  }

  async carregar(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.http.get<ConfiguracaoCliente>('/api/public/config'));
      this.config.set(cfg);
      this.aplicarTema(cfg);
    } catch {
      // back-end indisponível: mantém tema padrão; a tela de login exibirá o erro ao autenticar
    }
  }

  private aplicarTema(cfg: ConfiguracaoCliente) {
    const tema = cfg.cliente.tema;
    if (tema?.corPrimaria) {
      this.nz.set('theme', { primaryColor: tema.corPrimaria });
      const root = document.documentElement.style;
      root.setProperty('--mf-primaria', tema.corPrimaria);
      root.setProperty('--mf-primaria-hover', tema.corPrimariaHover || tema.corPrimaria);
    }
    this.title.setTitle(`${cfg.cliente.nomeSistema} — ${cfg.cliente.nomeCurto}`);
  }
}
