import { describe, it, expect } from "vitest";

/**
 * Testes unitários da LÓGICA central da funcionalidade de rascunhos e do
 * fix de drag-and-drop de imagens. Rodam no ambiente jsdom padrão (sem
 * leitura de arquivos), replicando fielmente a lógica dos handlers.
 */

// ---------------------------------------------------------------------------
// 1. Reordenação de imagens (fix do TypeError no drag-and-drop)
// ---------------------------------------------------------------------------

interface Img { id: string; display_order: number }

/** Réplica fiel do handleDragOver corrigido (PropertyImageUpload). */
function reorder(images: Img[], draggedIndex: number, index: number): Img[] {
  if (draggedIndex === null || draggedIndex === index) return images;
  if (
    draggedIndex < 0 ||
    draggedIndex >= images.length ||
    index < 0 ||
    index >= images.length
  ) {
    return images; // guarda: índice defasado após remoções
  }
  const next = [...images];
  const dragged = next[draggedIndex];
  if (!dragged) return images;
  next.splice(draggedIndex, 1);
  next.splice(index, 0, dragged);
  return next.map((img, i) => ({ ...img, display_order: i }));
}

const mk = (n: number): Img[] =>
  Array.from({ length: n }, (_, i) => ({ id: `img${i}`, display_order: i }));

describe("reorder de imagens (drag fix)", () => {
  it("reordena e renumera display_order", () => {
    const res = reorder(mk(4), 0, 2);
    expect(res.map((i) => i.id)).toEqual(["img1", "img2", "img0", "img3"]);
    expect(res.map((i) => i.display_order)).toEqual([0, 1, 2, 3]);
  });

  it("NÃO quebra quando draggedIndex está fora do range (após remoções)", () => {
    const imgs = mk(2);
    expect(() => reorder(imgs, 4, 0)).not.toThrow();
    expect(reorder(imgs, 4, 0)).toBe(imgs); // sem mutação
  });

  it("NÃO quebra quando index alvo está fora do range", () => {
    const imgs = mk(2);
    expect(() => reorder(imgs, 0, 9)).not.toThrow();
  });

  it("não muta os objetos originais (imutável)", () => {
    const imgs = mk(3);
    const res = reorder(imgs, 0, 1);
    expect(imgs[0].display_order).toBe(0);
    expect(res).not.toBe(imgs);
  });
});

// ---------------------------------------------------------------------------
// 2. Lógica do guard de fechamento (handleRequestClose)
// ---------------------------------------------------------------------------

/** Réplica da condição corrigida que decide abrir o diálogo de fechamento. */
function shouldPromptOnClose(isDirty: boolean, isExisting: boolean, imagesLen: number): boolean {
  return isDirty || (!isExisting && imagesLen > 0);
}

describe("handleRequestClose — quando perguntar sobre rascunho", () => {
  it("pergunta se o form está sujo", () => {
    expect(shouldPromptOnClose(true, false, 0)).toBe(true);
    expect(shouldPromptOnClose(true, true, 0)).toBe(true);
  });

  it("NÃO pergunta quando nada mudou e não há imagens (criação)", () => {
    expect(shouldPromptOnClose(false, false, 0)).toBe(false);
  });

  it("em CRIAÇÃO, imagens adicionadas contam como alteração", () => {
    expect(shouldPromptOnClose(false, false, 3)).toBe(true);
  });

  it("FIX: ao EDITAR imóvel com imagens sem alterar nada, NÃO pergunta", () => {
    // Antes (bug): images.length>0 disparava falso-positivo.
    expect(shouldPromptOnClose(false, true, 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2b. Status do rascunho ao salvar (não rebaixar registro existente)
// ---------------------------------------------------------------------------

/** Réplica da regra de is_draft em handleSaveAsDraft. */
function draftFlagOnSave(existing: { is_draft?: boolean } | null): boolean {
  return existing ? !!existing.is_draft : true;
}

describe("handleSaveAsDraft — flag is_draft", () => {
  it("novo registro vira rascunho", () => {
    expect(draftFlagOnSave(null)).toBe(true);
  });

  it("FIX: editar registro JÁ SALVO mantém is_draft=false (não rebaixa)", () => {
    expect(draftFlagOnSave({ is_draft: false })).toBe(false);
  });

  it("editar um rascunho existente continua rascunho", () => {
    expect(draftFlagOnSave({ is_draft: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Placeholder de nome/título no rascunho
// ---------------------------------------------------------------------------

function leadDraftName(name?: string): string {
  return name?.trim() || "Lead sem nome";
}

describe("placeholders de rascunho", () => {
  it("usa 'Lead sem nome' quando vazio", () => {
    expect(leadDraftName("")).toBe("Lead sem nome");
    expect(leadDraftName("   ")).toBe("Lead sem nome");
    expect(leadDraftName(undefined)).toBe("Lead sem nome");
  });
  it("preserva o nome informado", () => {
    expect(leadDraftName("João")).toBe("João");
  });
});
