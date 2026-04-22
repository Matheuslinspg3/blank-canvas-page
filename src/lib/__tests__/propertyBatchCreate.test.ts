import { describe, it, expect } from 'vitest';
import { applyFieldMappings, VARIATION_COLUMNS } from '@/lib/propertyFieldMappings';
import { sanitizePropertyInsert } from '@/lib/validatePropertyColumns';
import { createEmptyRow, createRowFromBase, isRowEmpty } from '@/hooks/usePropertyBatchCreate';

// ---------------------------------------------------------------------------
// applyFieldMappings
// ---------------------------------------------------------------------------
describe('applyFieldMappings', () => {
  it('maps notes into description when no existing description', () => {
    const result = applyFieldMappings({ notes: 'Obs do corretor' });
    expect(result.description).toBe('Obs do corretor');
    expect(result).not.toHaveProperty('notes');
  });

  it('appends notes to existing description', () => {
    const result = applyFieldMappings(
      { notes: 'Obs do corretor' },
      'Apartamento com vista para o mar',
    );
    expect(result.description).toContain('Apartamento com vista para o mar');
    expect(result.description).toContain('Observações: Obs do corretor');
  });

  it('preserves existing description when notes is empty', () => {
    const result = applyFieldMappings({ notes: '' }, 'Descrição original');
    expect(result.description).toBe('Descrição original');
  });

  it('passes through regular DB columns unchanged', () => {
    const result = applyFieldMappings({
      bedrooms: 3,
      sale_price: 450000,
      status: 'disponivel',
    });
    expect(result.bedrooms).toBe(3);
    expect(result.sale_price).toBe(450000);
    expect(result.status).toBe('disponivel');
  });

  it('does not include notes key in output', () => {
    const result = applyFieldMappings({ notes: 'test', bedrooms: 2 });
    expect(Object.keys(result)).not.toContain('notes');
  });
});

// ---------------------------------------------------------------------------
// sanitizePropertyInsert
// ---------------------------------------------------------------------------
describe('sanitizePropertyInsert', () => {
  it('strips columns that do not exist on properties table', () => {
    const { clean, invalidColumns } = sanitizePropertyInsert({
      title: 'Apto 101',
      notes: 'should be stripped',
      fake_column: 123,
      bedrooms: 2,
    });
    expect(clean.title).toBe('Apto 101');
    expect(clean.bedrooms).toBe(2);
    expect(clean).not.toHaveProperty('notes');
    expect(clean).not.toHaveProperty('fake_column');
    expect(invalidColumns).toContain('notes');
    expect(invalidColumns).toContain('fake_column');
  });

  it('returns empty invalidColumns when all columns are valid', () => {
    const { clean, invalidColumns } = sanitizePropertyInsert({
      title: 'Casa 1',
      sale_price: 300000,
      organization_id: 'abc',
    });
    expect(invalidColumns).toHaveLength(0);
    expect(clean.title).toBe('Casa 1');
  });
});

// ---------------------------------------------------------------------------
// VARIATION_COLUMNS consistency
// ---------------------------------------------------------------------------
describe('VARIATION_COLUMNS', () => {
  it('marks notes with dbColumn: null', () => {
    const notesCol = VARIATION_COLUMNS.find((c) => c.key === 'notes');
    expect(notesCol).toBeDefined();
    expect(notesCol!.dbColumn).toBeNull();
  });

  it('does not mark standard columns with dbColumn: null', () => {
    const standardCols = VARIATION_COLUMNS.filter(
      (c) => c.key !== 'notes' && c.dbColumn === null,
    );
    expect(standardCols).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------
describe('createEmptyRow / isRowEmpty', () => {
  it('creates an empty row that is detected as empty', () => {
    const row = createEmptyRow();
    expect(isRowEmpty(row)).toBe(true);
  });

  it('detects a row with data as non-empty', () => {
    const row = createEmptyRow();
    row.property_code = 'ABC-001';
    expect(isRowEmpty(row)).toBe(false);
  });
});

describe('createRowFromBase', () => {
  it('copies numeric fields from base property', () => {
    const base = { bedrooms: 3, suites: 1, bathrooms: 2, parking_spots: 2, area_useful: 80, area_total: 100, sale_price: 500000 };
    const row = createRowFromBase(base);
    expect(row.bedrooms).toBe(3);
    expect(row.suites).toBe(1);
    expect(row.sale_price).toBe(500000);
    expect(row.notes).toBe('');
    expect(row.status).toBe('disponivel');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: multiple variations pipeline
// ---------------------------------------------------------------------------
describe('multiple variations pipeline', () => {
  it('processes multiple rows without notes leaking into insert data', () => {
    const baseDescription = 'Apartamento no Caiçara';
    const rows = [
      { notes: 'Unidade A - vista mar', bedrooms: 2, sale_price: 300000, status: 'disponivel' },
      { notes: '', bedrooms: 3, sale_price: 450000, status: 'disponivel' },
      { notes: 'Cobertura duplex', bedrooms: 4, sale_price: 900000, status: 'reservado' },
    ];

    const results = rows.map((row) => {
      const mapped = applyFieldMappings(row, baseDescription);
      const { clean, invalidColumns } = sanitizePropertyInsert({
        ...mapped,
        title: `Imóvel - Unidade`,
        organization_id: 'org-1',
      });
      return { clean, invalidColumns };
    });

    // All should pass sanitization without invalid columns
    results.forEach((r) => {
      expect(r.invalidColumns).toHaveLength(0);
      expect(r.clean).not.toHaveProperty('notes');
    });

    // First row: notes appended to description
    expect(results[0].clean.description).toContain('Observações: Unidade A - vista mar');
    expect(results[0].clean.description).toContain(baseDescription);

    // Second row: no notes, description preserved
    expect(results[1].clean.description).toBe(baseDescription);

    // Third row: notes appended
    expect(results[2].clean.description).toContain('Observações: Cobertura duplex');
  });
});
