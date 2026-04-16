

# Adicionar Logo 3D com Parallax atrás do Hero

## O que será feito
Inserir a imagem 3D da logo (enviada anteriormente) como background do Hero section, com efeito parallax no mouse, opacidade baixa e overlay gradiente escuro para manter legibilidade.

## Arquivos

### 1. `src/assets/porta-logo-3d.png` (novo)
Copiar a imagem 3D enviada anteriormente (`seedream-4.5_...jpg`).

### 2. `src/pages/LandingPage.tsx` (edição do Hero section, linhas 108-136)

Transformar o Hero em `position: relative` com overflow hidden. Adicionar dentro dele:

**Camada 1 — Logo 3D (z-0):**
- `<img>` com `absolute inset-0 w-full h-full object-contain opacity-[0.12]` e `pointer-events-none`
- Transform controlado por `onMouseMove` no container: `translate3d(±15px, ±10px, 0) scale(1.05)`
- `transition: transform 0.15s ease-out` para suavidade
- Em mobile (< 768px): parallax desativado, leve animação CSS float

**Camada 2 — Overlay gradiente (z-10):**
- `absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background`

**Camada 3 — Conteúdo existente (z-20):**
- Todo o conteúdo atual (Badge, h1, p, botões) com `relative z-20`

**Hook inline `useMouseParallax`:**
```
const [transform, setTransform] = useState('translate3d(0,0,0)')
// onMouseMove: calcular offset do centro, aplicar translate3d e rotateX/Y
// requestAnimationFrame para performance
// useEffect cleanup
```

### 3. `src/index.css` (adição mínima)
Keyframe `@keyframes float-3d` para mobile:
```css
@keyframes float-3d {
  0%, 100% { transform: translateY(0) scale(1.05); }
  50% { transform: translateY(-10px) scale(1.07); }
}
```

## O que NÃO muda
- Nenhuma outra seção da landing page
- Routing, auth, queries, design system global

