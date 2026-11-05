import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, delay, from, mergeMap, of, throwError } from 'rxjs';
import { DadosDemo, DemoBackend, ErroDemo } from './demo-backend';

let backend: Promise<DemoBackend> | null = null;

function carregar(): Promise<DemoBackend> {
  backend ??= fetch('demo/dados.json')
    .then((r) => {
      if (!r.ok) throw new Error('Massa de demonstração não encontrada');
      return r.json() as Promise<DadosDemo>;
    })
    .then((d) => new DemoBackend(d));
  return backend;
}

/**
 * Responde às chamadas /api/** com o back-end simulado em memória (versão de demonstração).
 * Registrado apenas quando AMBIENTE.demonstracao = true.
 */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, location.origin);
  const i = url.pathname.indexOf('/api/');
  if (i < 0) return next(req);
  const caminho = url.pathname.slice(i);
  return from(carregar()).pipe(
    mergeMap((b): Observable<HttpResponse<unknown>> => {
      try {
        const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
        const corpo = b.tratar({ metodo: req.method, caminho, params: url.searchParams, corpo: req.body, token, perfil: req.headers.get('X-Perfil') });
        // cópia para que a tela não altere o "banco" sem passar pela API
        return of(new HttpResponse({ status: 200, body: corpo === undefined ? null : structuredClone(corpo), url: req.url }));
      } catch (e) {
        const erro = e instanceof ErroDemo ? e : new ErroDemo(500, 'Erro na demonstração', String(e));
        return throwError(() => new HttpErrorResponse({ status: erro.status, error: { title: erro.title, detail: erro.detail }, url: req.url }));
      }
    }),
    delay(120),
  );
};
