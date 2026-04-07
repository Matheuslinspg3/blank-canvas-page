

## Plano: Templates de Site + Gerador com IA

### Contexto
Atualmente o storefront tem um layout fixo (Hero → Imóveis → Sobre → Contato → Footer). O usuário quer poder escolher entre templates visuais diferentes e ter a opção de gerar o conteúdo com IA.

### O que será feito

**1. Coluna `site_template` na tabela `website_settings`**
- Migração adicionando `site_template TEXT DEFAULT 'classic'` na tabela `website_settings`
- Valores possíveis: `classic`, `modern`, `elegant`, `bold`, `minimal`

**2. 5 Templates de site (variações visuais no storefront)**
Cada template define um estilo visual diferente para o Hero, cards de imóveis, About, Contact e Footer:

- **Classic** (atual) — Gradiente no hero, cards com sombra, layout centralizado
- **Modern** — Hero com imagem de fundo e overlay escuro, cards arredondados com hover elevado, seções com fundo alternado
- **Elegant** — Hero minimalista com tipografia serif grande, cards com bordas finas, paleta sofisticada com tons dourados
- **Bold** — Hero com cor sólida vibrante e texto grande, cards com borda colorida lateral, seções com formas geométricas decorativas
- **Minimal** — Hero clean com fundo branco e texto escuro, sem gradientes, cards flat com espaçamento generoso

**3. Componente `SiteTemplateSelector` em "Meu Site"**
- Nova seção na aba **Conteúdo**, logo após "Status do Site"
- Grid de 5 cards com miniatura/preview de cada template
- Card selecionado com borda primária e checkmark
- Salvamento junto com as demais configurações
- Opção adicional: card "Criar com IA" (com ícone Sparkles)

**4. Card "Montar Template" (personalização manual)**
- Um card extra que leva à aba de conteúdo/marca para edição manual dos textos e cores
- Funciona como atalho para o fluxo manual já existente

**5. Card "Criar com IA"**
- Card com ícone Sparkles e badge "IA"
- Ao clicar: chama edge function `generate-site-content` que analisa os dados da org e imóveis para gerar hero_title, hero_subtitle, about_text, meta_title, meta_description, whatsapp_message
- Preenche os campos do formulário sem salvar automaticamente (o usuário revisa e salva)
- A edge function usará a API de IA do provedor externo configurado (o Lovable AI Gateway está desabilitado; será necessária uma chave de API externa como OpenAI)

**6. Renderização dinâmica no `WhiteLabelStorefront`**
- Ler `website.site_template` e renderizar os componentes do storefront com as variações visuais correspondentes
- Cada componente (Hero, Properties, About, Contact, Footer) recebe uma prop `template` e aplica os estilos condicionalmente
- Alternativa mais limpa: criar variantes de componente por template (ex: `StorefrontHeroModern`, `StorefrontHeroBold`, etc.) e usar um map para selecionar

### Arquivos a criar/modificar
- **Migração SQL**: adicionar coluna `site_template`
- **`src/components/settings/SiteTemplateSelector.tsx`**: novo componente de seleção de template
- **`src/components/settings/SiteSettingsTab.tsx`**: integrar selector + botão IA na aba Conteúdo
- **`src/components/storefront/templates/`**: pasta com variantes visuais dos componentes
- **`src/components/WhiteLabelStorefront.tsx`**: renderizar template selecionado
- **`supabase/functions/generate-site-content/index.ts`**: edge function para gerar conteúdo com IA

### Nota sobre IA
O Lovable AI Gateway está desabilitado. Para o "Criar com IA" funcionar, será necessário fornecer uma chave de API externa (ex: OpenAI) ou habilitar o Lovable AI nas configurações do projeto.

