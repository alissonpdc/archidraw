# KB — Seta sketch não pode ultrapassar o arrowhead (guard de ponta)

**Sintoma:** E2E `sketch animated shaft never renders past the arrow tip`
falha de forma **flaky** (às vezes `dark` = 0, às vezes 10) para uma seta
`dashed + roughness 3 + animated` desenhada de (200,200)→(500,200), amostrando
pixels escuros em x∈[502,514], y∈[196,204].

**Causa raiz (dupla):**

1. **Handle de seleção na ponta contamina o sample.** A seta continua
   selecionada após o draw; o handle da ponta é um quadrado ~7px centrado no
   tip com borda na cor de seleção (`#6965db`, luminância ~0.43 < 0.5). A borda
   direita cai dentro da região amostrada → `dark = 10`. Flaky porque a frame
   capturada varia com o loop de RAF da animação.
2. **O rigid misregistration desfazia o clamp.** `clampEnd`/`clampStart` no
   `roughPolyline` só pinam a geometria em espaço LOCAL; o transform rígido
   (`translate` até ±0.9×roughness, rot, scale) deslocava a polilinha inteira,
   então a ponta podia passar ~2-3px além da cabeça mesmo "clampada".

**Regra (sempre seguir):**

1. Ao amostrar pixels do desenho no canvas, **desselecionar primeiro** e aguardar
   o commit do frame:
   ```ts
   await page.evaluate(async () => {
     const ed = (window as any).__editor__;
     ed.clearSelection();
     // 2 frames = commit do redesenho sem handles
     await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
   });
   ```
2. Pontas "clampadas" de arrow (shaft e asas da head) precisam manter o anchor
   EXATO no espaço final: o pivot do rigid transform deve ser o próprio clamp
   point com **translation zero** (rot/scale em torno da ponta). Nunca `translate`
   um clamp point — ele não está mais "exato" depois disso.

## Implementação real

- `src/core/renderer.ts` — `roughPolyline`: quando `clampStart || clampEnd`,
  `ax/ay` = ponto clampado, offset de translação = 0, pivot em `(ax,ay)`.
- `e2e/specs/arrow-animation.spec.ts:268` — desseleciona antes de amostrar.