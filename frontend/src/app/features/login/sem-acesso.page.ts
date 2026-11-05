import { Component } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-sem-acesso',
  imports: [NzIconModule],
  template: `
    <div class="pagina">
      <div class="cartao vazio">
        <nz-icon nzType="lock" />
        O perfil ativo não possui funcionalidades liberadas. Solicite acesso ao Gestor das Malhas.
      </div>
    </div>
  `,
})
export class SemAcessoPage {}
