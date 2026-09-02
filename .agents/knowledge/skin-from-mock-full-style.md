# Skins/temas a partir de mocks: diff de estilo completo, não só paleta

## Problema recorrente

Ao implementar um skin/tema a partir de um mock HTML (`design/ui-options/*.html`), a primeira tentativa copiou apenas as **cores** para os tokens existentes. O resultado ficou "meio termo": paleta nova com o chrome genérico do app (borda cinza 1px, sombra suave, raio padrão, fonte padrão). O usuário precisou apontar que "não ficou parecido".

Mocks carregam um **estilo**, que inclui no mínimo:

- largura e **cor** da borda (ex.: Blueprint e Swiss usam a cor *ink* do texto, não o cinza `--border`)
- sombra: nenhuma (flat) / suave difusa / **dura deslocada sem blur** (`3px 3px 0`)
- raios por nível (widget vs. botão interno vs. swatch)
- fonte da UI e pesos (ex.: Swiss usa uppercase 700; Midnight usa mono nos micro-labels)
- estados ativos: accent vs. **inversão para ink** (Swiss) vs. outline tracejado (Blueprint)
- grid do canvas como parte da identidade (Blueprint = linhas; demais mocks = dots)

## Regras obrigatórias

1. Antes de implementar, fazer um **diff de estilo completo** do mock (borda, sombra, raio, fonte, pesos, uppercase, estados ativos, grid) — não só do bloco de cores.
2. Tudo que variar por skin deve ser token (`tokens.css`) ou override por skin no final do `app.css`. Se um atributo está hardcoded no `app.css` e o skin precisa mudá-lo, expor como token.
3. O canvas é renderizado em JS lendo tokens via `getComputedStyle` (`CanvasHost.readThemeColors`) — novas cores de render precisam entrar em `tokens.css` e em `readThemeColors`.
4. Mocks com uma única variante (só light ou só dark): derivar a variante ausente de forma coerente e registrar no comentário do bloco CSS.
5. Ao testar skins via e2e, cuidado com `transition: 120ms` nos botões — usar `toHaveCSS` (retry) em vez de `getComputedStyle` imediato; e lembrar que o menu-btn também tem a classe `.tool-btn` (usar `.toolbar .tool-btn.active` para mirar a ferramenta).
