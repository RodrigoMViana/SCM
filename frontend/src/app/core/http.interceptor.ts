import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { MensagemService } from './mensagens';

/** Anexa o token e o perfil ativo; trata erros da API (Problem Details) com mensagens amigáveis. */
export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const msg = inject(MensagemService);
  const token = auth.token();
  const perfil = auth.perfilAtivo();
  let r = req;
  if (token && !req.url.includes('/api/auth/login') && !req.url.includes('/api/public/')) {
    r = req.clone({
      setHeaders: { Authorization: `Bearer ${token}`, ...(perfil ? { 'X-Perfil': perfil } : {}) },
    });
  }
  return next(r).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !req.url.includes('/api/auth/login')) {
        auth.sair();
      } else if (!req.headers.has('X-Silencioso')) {
        const corpo = e.error as { title?: string; detail?: string } | null;
        msg.add({
          severity: e.status === 422 || e.status === 409 ? 'warn' : 'error',
          summary: corpo?.title ?? (e.status === 0 ? 'Servidor indisponível' : 'Erro'),
          detail: corpo?.detail ?? (e.status === 0 ? 'Não foi possível conectar ao servidor.' : e.message),
          life: 6000,
        });
      }
      return throwError(() => e);
    })
  );
};
