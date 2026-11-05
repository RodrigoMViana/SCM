import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { autenticadoGuard, permissaoGuard } from './core/guards';
import { MenuService } from './core/menu.service';

const p = (...permissoes: string[]) => ({ canActivate: [permissaoGuard], data: { permissoes } });

/** Rotas com carregamento sob demanda (lazy): o bundle inicial contém apenas login e shell. */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', children: [], canActivate: [() => inject(Router).parseUrl(inject(MenuService).primeiraRota())] },
      { path: 'dashboard', ...p('DASHBOARD_VER'), loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'malhas', ...p('MALHA_CONSULTAR', 'MALHA_GERIR'), loadComponent: () => import('./features/malhas/malhas.page').then((m) => m.MalhasPage) },
      { path: 'malhas/:malhaId', ...p('MALHA_CONSULTAR', 'MALHA_GERIR'), loadComponent: () => import('./features/malhas/malha-casos.page').then((m) => m.MalhaCasosPage) },
      { path: 'casos/:id', loadComponent: () => import('./features/casos/caso-detalhe.page').then((m) => m.CasoDetalhePage) },
      { path: 'planejamento', ...p('MALHA_GERIR'), loadComponent: () => import('./features/planejamento/planejamento.page').then((m) => m.PlanejamentoPage) },
      { path: 'planejamento/:malhaId', ...p('MALHA_GERIR'), loadComponent: () => import('./features/planejamento/plano-malha.page').then((m) => m.PlanoMalhaPage) },
      { path: 'indicadores', ...p('INDICADOR_GERIR'), loadComponent: () => import('./features/indicadores/indicadores.page').then((m) => m.IndicadoresPage) },
      { path: 'contestacoes', ...p('CONTESTACAO_ANALISAR'), loadComponent: () => import('./features/contestacao/contestacoes.page').then((m) => m.ContestacoesPage) },
      { path: 'prorrogacoes', ...p('PRORROGACAO_ANALISAR'), loadComponent: () => import('./features/prorrogacao/prorrogacoes.page').then((m) => m.ProrrogacoesPage) },
      { path: 'acao-fiscal', ...p('ACAO_FISCAL_CONSULTAR', 'MPF_ABRIR'), loadComponent: () => import('./features/acao-fiscal/acao-fiscal.page').then((m) => m.AcaoFiscalPage) },
      { path: 'mpfs-designados', ...p('MPF_CIENCIA'), loadComponent: () => import('./features/acao-fiscal/mpfs-designados.page').then((m) => m.MpfsDesignadosPage) },
      { path: 'impedimentos', ...p('IMPEDIMENTO_CONSULTAR', 'IMPEDIMENTO_GERIR'), loadComponent: () => import('./features/impedimentos/impedimentos.page').then((m) => m.ImpedimentosPage) },
      { path: 'contribuintes', ...p('CONTRIBUINTE_CONSULTAR'), loadComponent: () => import('./features/contribuintes/contribuintes.page').then((m) => m.ContribuintesPage) },
      { path: 'integracoes', ...p('INTEGRACAO_MONITORAR'), loadComponent: () => import('./features/integracao/integracoes.page').then((m) => m.IntegracoesPage) },
      { path: 'parametrizacoes', ...p('PARAMETRO_GERIR'), loadComponent: () => import('./features/parametros/parametros.page').then((m) => m.ParametrosPage) },
      { path: 'permissoes', ...p('ADMIN_PERMISSOES'), loadComponent: () => import('./features/permissoes/permissoes.page').then((m) => m.PermissoesPage) },
      { path: 'portal', ...p('PORTAL_CONTRIBUINTE'), loadComponent: () => import('./features/portal/portal.page').then((m) => m.PortalPage) },
      { path: 'sem-acesso', loadComponent: () => import('./features/login/sem-acesso.page').then((m) => m.SemAcessoPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
