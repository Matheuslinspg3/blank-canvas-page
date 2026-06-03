import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePropertyStreets, StreetOption } from '@/hooks/usePropertyStreets';
import { cn } from '@/lib/utils';

interface StreetAutocompleteFilterProps {
  value: string[];
  onChange: (next: string[]) => void;
  cities?: string[];
  neighborhoods?: string[];
  className?: string;
}

/**
 * Autocomplete filter for streets with:
 * - Debounce 300ms (inside hook)
 * - Min 3 chars to search
 * - Max 10 results
 * - Sanitized input (guardrail GR-2)
 * - Keyboard navigation (guardrail GR-8)
 * - Fallback messages for no results
 */
export function StreetAutocompleteFilter({
  value,
  onChange,
  cities = [],
  neighborhoods = [],
  className,
}: StreetAutocompleteFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { streets, isLoading, isEnabled } = usePropertyStreets({
    searchTerm,
    cities,
    neighborhoods,
  });

  // Filter out already-selected streets from suggestions
  const suggestions = useMemo(
    () => streets.filter((s) => !value.includes(s.street)),
    [streets, value]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectStreet = (street: string) => {
    if (!value.includes(street)) {
      onChange([...value, street]);
    }
    setSearchTerm('');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const removeStreet = (street: string) => {
    onChange(value.filter((v) => v !== street));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          selectStreet(suggestions[highlightIndex].street);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const showDropdown = isOpen && (isLoading || searchTerm.length >= 3);

  return (
    <div ref={containerRef} className={cn('space-y-1.5', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => searchTerm.length >= 3 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Digite a rua (mín. 3 letras)..."
          className="h-8 pl-8 pr-8 text-sm"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-label="Filtrar por rua"
          maxLength={100}
        />
        {searchTerm && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchTerm(''); setIsOpen(false); }}
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ScrollArea className="max-h-[200px]">
            <div className="p-1" role="listbox">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando ruas...
                </div>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {searchTerm.length < 3
                    ? 'Digite ao menos 3 caracteres'
                    : 'Nenhuma rua encontrada. Tente outro termo.'}
                </p>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={s.street}
                    type="button"
                    role="option"
                    aria-selected={idx === highlightIndex}
                    onClick={() => selectStreet(s.street)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left',
                      'hover:bg-accent hover:text-accent-foreground',
                      idx === highlightIndex && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{s.street}</span>
                    {s.neighborhood && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {s.neighborhood}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{s.count}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Selected street badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((street) => (
            <Badge key={street} variant="secondary" className="gap-1 text-xs">
              {street}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeStreet(street)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
