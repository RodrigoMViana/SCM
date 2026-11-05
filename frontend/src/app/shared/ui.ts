import { Component, computed, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EMPTY, Observable, Subject, catchError, debounceTime, switchMap } from 'rxjs';
import { MensagemService } from '../core/mensagens';
import { Pagina, ResultadoLote } from '../core/models';

type Cor = 'success' | 'processing' | 'warning' | 'error' | 'default' | 'blue' | 'purple';

const CORES: Record<string, Cor> = {
  // casos
  EM_ANALISE: 'default', A_NOTIFICAR: 'processing', NOTIFICACAO_EM_EMISSAO: 'warning', NOTIFICACAO_EMITIDA: 'warning',
  NOTIFICADO: 'purple', ENCERRADO: 'success', CANCELADO: 'default', EXCLUIDO: 'error',
  // ação fiscal
  SOLICITADA: 'warning', MPF_EM_ABERTURA: 'processing', MPF_ABERTO: 'blue', TIF_EM_EMISSAO: 'processing', TIF_AGUARDANDO_CIENCIA: 'warning',
  AUTO_EM_LAVRATURA: 'processing', AUTO_LAVRADO: 'warning', AUTO_EM_HOMOLOGACAO: 'processing', AUTO_AGUARDANDO_CIENCIA: 'warning',
  ENCERRAMENTO_EM_INCLUSAO: 'processing', AGUARDANDO_RATIFICACAO: 'warning', RATIFICACAO_EM_ANDAMENTO: 'processing', CONCLUIDA: 'success',
  INDEFERIDA: 'error',
  // malhas / integrações / genéricos
  ATIVA: 'success', RASCUNHO: 'default', ENCERRADA: 'default',
  PENDENTE: 'default', EM_EXECUCAO: 'processing', ERRO: 'error', SEM_PARECER: 'warning', COM_PARECER: 'success',
  DEFERIDO: 'success', INDEFERIDO: 'error', EXECUTANDO: 'processing',
  PROCEDENTE: 'success', PROCEDENTE_PARCIAL: 'warning', IMPROCEDENTE: 'error',
  Ativo: 'success', Suspenso: 'warning', Baixado: 'default', 'Em processo de baixa': 'warning',
  CONTESTADA: 'warning', ACATADA: 'success', MANTIDA: 'error', REGULARIZADA: 'success',
};

/** Etiqueta de situação padronizada em todo o produto. */
@Component({
  selector: 'mf-status',
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="cor()" class="mf-status">{{ rotulo() ?? texto(valor()) }}</nz-tag>`,
})
export class StatusTagComponent {
  readonly valor = input.required<string>();
  readonly rotulo = input<string | null | undefined>();
  readonly cor = computed<Cor>(() => CORES[this.valor()] ?? 'default');

  texto(v: string): string {
    if (!v) return '';
    const t = v.replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
}

/** Exibe o resultado de uma operação em massa (processados e ignorados com motivo). */
export function informarLote(msg: MensagemService, acao: string, r: ResultadoLote) {
  if (r.processados > 0) {
    msg.add({
      severity: 'success',
      summary: acao,
      detail: `${r.processados} contribuinte(s) processado(s)${r.loteId ? ' — lote ' + r.loteId : ''}.`,
    });
  }
  for (const i of r.ignorados.slice(0, 5)) {
    msg.add({ severity: 'warn', summary: i.descricao, detail: i.motivo, life: 8000 });
  }
  if (r.ignorados.length > 5) {
    msg.add({ severity: 'warn', summary: 'Itens ignorados', detail: `Mais ${r.ignorados.length - 5} item(ns) não processado(s).` });
  }
}

/** Data ISO (yyyy-mm-dd) a partir de um Date local. */
export function isoData(d: Date | null | undefined): string | null {
  if (!d) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Formatação de moeda para nz-input-number ([nzFormatter]/[nzParser]). */
export const fmtMoeda = (v: number | string | null | undefined): string =>
  v === null || v === undefined || v === '' ? '' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const lerMoeda = (t: string): number => {
  const limpo = t.replace(/[^\d,-]/g, '').replace(',', '.');
  return limpo ? Number(limpo) : (null as unknown as number);
};

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ tabelas paginadas no servidor

export interface Consulta {
  pagina: number;
  tamanho: number;
  ordenarPor?: string;
  desc?: boolean;
}

/** Converte o evento da tabela (página 1-based, ordenação) no contrato da API (página 0-based). */
export function consulta(p: NzTableQueryParams, ordemPadrao?: string): Consulta {
  const ordem = p.sort.find((s) => s.value);
  return {
    pagina: Math.max(0, p.pageIndex - 1),
    tamanho: p.pageSize,
    ordenarPor: ordem?.key ?? ordemPadrao,
    desc: ordem?.value === 'descend',
  };
}

/**
 * Estado de uma tabela paginada no servidor: página, ordenação, carregamento e cancelamento
 * de requisições obsoletas (switchMap). Pedidos simultâneos (ex.: troca de aba + reinício da
 * paginação) são agrupados em uma única chamada.
 */
export class TabelaServidor<T> {
  readonly itens = signal<T[]>([]);
  readonly total = signal(0);
  readonly carregando = signal(false);
  pagina = 1;
  tamanho: number;
  private ordem: { campo?: string; desc: boolean } = { desc: false };
  private readonly pedidos = new Subject<void>();

  constructor(
    fonte: (c: Consulta) => Observable<Pagina<T>>,
    opcoes: { tamanho?: number; ordemPadrao?: string; aoCarregar?: (p: Pagina<T>) => void } = {},
  ) {
    this.tamanho = opcoes.tamanho ?? 25;
    this.pedidos
      .pipe(
        debounceTime(0),
        switchMap(() => {
          this.carregando.set(true);
          const c = { pagina: this.pagina - 1, tamanho: this.tamanho, ordenarPor: this.ordem.campo ?? opcoes.ordemPadrao, desc: this.ordem.desc };
          return fonte(c).pipe(catchError(() => { this.carregando.set(false); return EMPTY; }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        this.itens.set(p.itens);
        this.total.set(p.total);
        this.carregando.set(false);
        opcoes.aoCarregar?.(p);
      });
  }

  /** Evento (nzQueryParams) da nz-table. */
  aoMudar(p: NzTableQueryParams) {
    const c = consulta(p);
    this.pagina = p.pageIndex;
    this.tamanho = p.pageSize;
    this.ordem = { campo: c.ordenarPor, desc: !!c.desc };
    this.recarregar();
  }

  recarregar() {
    this.pedidos.next();
  }

  /** Volta para a primeira página (após trocar filtro ou aba). */
  reiniciar() {
    this.pagina = 1;
    this.recarregar();
  }
}

/** Seleção de linhas por id, preservada entre páginas e recarregamentos. */
export class Selecao<T extends { id: number }> {
  private readonly mapa = signal(new Map<number, T>());
  readonly itens = computed(() => [...this.mapa().values()]);
  readonly quantidade = computed(() => this.mapa().size);

  tem(x: T): boolean {
    return this.mapa().has(x.id);
  }
  alternar(x: T, marcado: boolean) {
    const m = new Map(this.mapa());
    if (marcado) m.set(x.id, x);
    else m.delete(x.id);
    this.mapa.set(m);
  }
  todos(pagina: readonly T[]): boolean {
    return pagina.length > 0 && pagina.every((x) => this.tem(x));
  }
  parcial(pagina: readonly T[]): boolean {
    return pagina.some((x) => this.tem(x)) && !this.todos(pagina);
  }
  marcarTodos(pagina: readonly T[], marcado: boolean) {
    const m = new Map(this.mapa());
    pagina.forEach((x) => (marcado ? m.set(x.id, x) : m.delete(x.id)));
    this.mapa.set(m);
  }
  limpar() {
    this.mapa.set(new Map());
  }
  ids(): number[] {
    return [...this.mapa().keys()];
  }
}

// ------------------------------------------------------------------ gráfico de barras horizontais

export interface Barra {
  rotulo: string;
  valor: number;
}

/**
 * Gráfico de barras horizontais leve (HTML/CSS, sem biblioteca externa), suficiente para
 * os painéis do produto e com rótulos de valor sempre visíveis.
 */
@Component({
  selector: 'mf-barras',
  template: `
    <div class="barras">
      @for (b of barras(); track b.rotulo) {
        <div class="linha">
          <span class="rot" [title]="b.rotulo">{{ b.rotulo }}</span>
          <span class="trilho"><span class="barra" [style.width.%]="(b.valor / maximo()) * 100"></span></span>
          <span class="val">{{ b.valor.toLocaleString('pt-BR') }}</span>
        </div>
      } @empty { <div class="suave">Sem dados.</div> }
    </div>
  `,
  styles: `
    .barras { display: flex; flex-direction: column; gap: 10px; }
    .linha { display: grid; grid-template-columns: minmax(120px, 34%) 1fr 64px; gap: 10px; align-items: center; font-size: 13px; }
    .rot { color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trilho { background: #f1f5f9; border-radius: 4px; height: 18px; overflow: hidden; }
    .barra { display: block; height: 100%; background: var(--mf-primaria); border-radius: 4px; min-width: 2px; transition: width .3s; }
    .val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
  `,
})
export class BarrasComponent {
  readonly barras = input<Barra[]>([]);
  readonly maximo = computed(() => Math.max(1, ...this.barras().map((b) => b.valor)));
}
