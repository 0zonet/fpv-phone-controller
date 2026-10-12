# FPV Phone Controller — Tokens del rediseño

Mismo lenguaje visual que brycofre.com (tema oscuro).

## Colores

| Token | Valor | Uso |
|---|---|---|
| bg | `#0D0D12` | Fondo |
| ink | `#F2F2F6` | Texto principal; fondo del botón primario |
| on-solid | `#121216` | Texto sobre botón primario |
| body | `#C9C9D4` | Texto secundario |
| muted | `#9C9CAD` | Etiquetas, captions |
| card | `rgba(30,30,40,0.62)` + blur 24px | Tarjetas de vidrio |
| edge | `rgba(255,255,255,0.08)` | Borde de tarjetas |
| chip | `rgba(255,255,255,0.06)` / borde `rgba(255,255,255,0.1)` | Botones secundarios, chips |
| accent | `#8B7CFF` | Acento violeta (toggles ON, sliders) |
| lava | `#FF8AD8` → `#8B7CFF` → `#6E9BFF` | Brillos de fondo, perillas, QR glow |
| ok | `#4ADE80` | Conectado / Ready |
| warn | `#F5C969` (fondo `rgba(250,190,60,0.1)`, borde `rgba(250,190,60,0.3)`) | Advertencia |
| error | `#F87171` / texto `#FCA5A5` (fondo `rgba(248,113,113,0.1)`) | Error, ARMED |

## Tipografía

- **Urbanist** 400–700: interfaz y textos.
- **Doto** 900: cifras grandes (throttle %, packets/s).
- **Martian Mono** 400–500: etiquetas técnicas en mayúsculas (MODE 2, CONTROLLER, YAW · THROTTLE), versiones, valores de ejes.

## Forma

- Botones: píldora (`border-radius: 999px`), mínimo 44px de alto.
- Tarjetas: radio 22–28px. Chips de estado: radio 16px.
- Botón primario: sólido `#F2F2F6` con texto oscuro. Uno solo por pantalla.
- Animaciones suaves, siempre desactivadas con `prefers-reduced-motion`.

## Pantallas

- PWA: 900 × 416 (landscape).
- Desktop: ventana 440 × 640.
