import { Injectable, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';

export type Severidade = 'success' | 'info' | 'warn' | 'error';

export interface Mensagem {
  severity: Severidade;
  summary: string;
  detail?: string;
  /** Tempo de exibição em ms (padrão 4,5 s). */
  life?: number;
}

const TIPO: Record<Severidade, 'success' | 'info' | 'warning' | 'error'> = {
  success: 'success', info: 'info', warn: 'warning', error: 'error',
};

/**
 * Avisos ao usuário (canto superior direito). Fachada do produto sobre a biblioteca de UI:
 * as telas não dependem diretamente do componente de notificação escolhido.
 */
@Injectable({ providedIn: 'root' })
export class MensagemService {
  private readonly nz = inject(NzNotificationService);

  add(m: Mensagem) {
    this.nz.create(TIPO[m.severity], m.summary, m.detail ?? '', { nzDuration: m.life ?? 4500, nzPlacement: 'topRight' });
  }
}

export interface Confirmacao {
  header: string;
  message: string;
  acceptLabel?: string;
  rejectLabel?: string;
  /** Destaca o botão de confirmação em vermelho (ações destrutivas). */
  perigo?: boolean;
  accept: () => void;
}

/** Diálogo de confirmação padronizado do produto. */
@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  private readonly modal = inject(NzModalService);

  confirm(c: Confirmacao) {
    this.modal.confirm({
      nzTitle: c.header,
      nzContent: c.message,
      nzOkText: c.acceptLabel ?? 'Confirmar',
      nzCancelText: c.rejectLabel ?? 'Cancelar',
      nzOkDanger: c.perigo ?? false,
      nzWidth: 480,
      nzOnOk: () => c.accept(),
    });
  }
}
