import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, inject, provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideNzConfig } from 'ng-zorro-antd/core/config';
import { provideNzNativeDateAdapter } from 'ng-zorro-antd/core/time';
import { provideNzI18n, pt_BR } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { routes } from './app.routes';
import { ConfigService } from './core/config.service';
import { httpInterceptor } from './core/http.interceptor';
import { ICONES } from './core/icones';
import { demoInterceptor } from './demo/demo.interceptor';
import { AMBIENTE } from '../environments/ambiente';

registerLocaleData(localePt);

/**
 * Biblioteca de UI: NG-ZORRO (Ant Design para Angular, licença MIT, sem chave de licença).
 * A cor primária abaixo é só o padrão; a cor do cliente é aplicada em tempo de execução
 * pelo ConfigService (tema por CSS variables).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // na versão de demonstração (GitHub Pages) a API é simulada no navegador
    provideHttpClient(withInterceptors(AMBIENTE.demonstracao ? [httpInterceptor, demoInterceptor] : [httpInterceptor])),
    provideNzI18n(pt_BR),
    provideNzNativeDateAdapter({ locale: 'pt-BR', firstDayOfWeek: 0 }),
    provideNzIcons(ICONES),
    NzModalService,
    provideNzConfig({
      theme: { primaryColor: '#005670' },
      notification: { nzMaxStack: 6 },
      table: { nzSize: 'small' },
    }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    provideAppInitializer(() => inject(ConfigService).carregar()),
  ],
};
