import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Contadores } from './models';

export interface ItemMenu {
  rotulo: string;
  /** Nome do ícone Ant Design (ver core/icones.ts). */
  icone: string;
  rota: string;
  permissoes: string[];
  contador?: keyof Contadores;
}

/**
 * Menu orientado a PERMISSÕES (não a perfis fixos): ao renomear perfis ou redistribuir
 * permissões em outro cliente, o menu se ajusta sem mudança de código.
 */
const ITENS: ItemMenu[] = [
  { rotulo: 'Dashboard', icone: 'dashboard', rota: '/dashboard', permissoes: ['DASHBOARD_VER'] },
  { rotulo: 'Malhas Fiscais', icone: 'table', rota: '/malhas', permissoes: ['MALHA_CONSULTAR', 'MALHA_GERIR'] },
  { rotulo: 'Planejamento', icone: 'apartment', rota: '/planejamento', permissoes: ['MALHA_GERIR'] },
  { rotulo: 'Indicadores', icone: 'sliders', rota: '/indicadores', permissoes: ['INDICADOR_GERIR'] },
  { rotulo: 'Caixa de Contestação', icone: 'inbox', rota: '/contestacoes', permissoes: ['CONTESTACAO_ANALISAR'], contador: 'contestacoesNaoLidas' },
  { rotulo: 'Pedidos de prorrogação', icone: 'calendar', rota: '/prorrogacoes', permissoes: ['PRORROGACAO_ANALISAR'], contador: 'prorrogacoesPendentes' },
  { rotulo: 'Ação Fiscal / MPF', icone: 'file-search', rota: '/acao-fiscal', permissoes: ['ACAO_FISCAL_CONSULTAR', 'MPF_ABRIR'], contador: 'mpfPendentes' },
  { rotulo: 'MPFs designados a mim', icone: 'audit', rota: '/mpfs-designados', permissoes: ['MPF_CIENCIA'], contador: 'mpfsDesignados' },
  { rotulo: 'Impedidos', icone: 'stop', rota: '/impedimentos', permissoes: ['IMPEDIMENTO_CONSULTAR', 'IMPEDIMENTO_GERIR'] },
  { rotulo: 'Contribuintes', icone: 'team', rota: '/contribuintes', permissoes: ['CONTRIBUINTE_CONSULTAR'] },
  { rotulo: 'Integrações', icone: 'sync', rota: '/integracoes', permissoes: ['INTEGRACAO_MONITORAR'] },
  { rotulo: 'Parametrizações', icone: 'setting', rota: '/parametrizacoes', permissoes: ['PARAMETRO_GERIR'] },
  { rotulo: 'Permissões dos perfis', icone: 'lock', rota: '/permissoes', permissoes: ['ADMIN_PERMISSOES'] },
  { rotulo: 'Minhas malhas fiscais', icone: 'bank', rota: '/portal', permissoes: ['PORTAL_CONTRIBUINTE'] },
];

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly contadores = signal<Contadores | null>(null);

  readonly itens = computed(() => {
    this.auth.permissoes();
    return ITENS.filter((i) => this.auth.pode(...i.permissoes));
  });

  primeiraRota(): string {
    return this.itens()[0]?.rota ?? '/sem-acesso';
  }

  atualizarContadores() {
    if (!this.auth.autenticado()) return;
    this.api.contadores().subscribe({ next: (c) => this.contadores.set(c), error: () => undefined });
  }
}
