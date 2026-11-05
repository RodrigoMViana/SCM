import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Exige sessão autenticada (carrega a sessão na primeira navegação). */
export const autenticadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.autenticado()) return router.parseUrl('/login');
  if (!auth.sessao()) {
    const s = await auth.carregarSessao();
    if (!s) return router.parseUrl('/login');
  }
  return true;
};

/** Exige ao menos uma das permissões informadas em route.data.permissoes. */
export const permissaoGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const exigidas = (route.data?.['permissoes'] as string[] | undefined) ?? [];
  return exigidas.length === 0 || auth.pode(...exigidas) ? true : router.parseUrl('/inicio');
};
