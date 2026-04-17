import { useState } from "react";
import { Check, ChevronsUpDown, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIbgeMunicipios, type IbgeMunicipio } from "@/hooks/financing/useIbgeMunicipios";

interface Props {
  uf: string;
  value: IbgeMunicipio | null;
  onChange: (city: IbgeMunicipio | null) => void;
  disabled?: boolean;
}

export function CityAutocomplete({ uf, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: cities = [], isLoading } = useIbgeMunicipios(uf, search);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !uf}
          className="w-full h-9 justify-between text-xs font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {value ? value.name : "Selecione o município"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar município…"
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {cities.length === 0 && search.length < 2
                    ? "Digite ao menos 2 letras"
                    : "Nenhum município encontrado"}
                </CommandEmpty>
                <CommandGroup>
                  {cities.map((c) => (
                    <CommandItem
                      key={c.ibge_code}
                      value={c.ibge_code}
                      onSelect={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          value?.ibge_code === c.ibge_code ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{c.name}</span>
                      {c.capital && (
                        <span className="ml-auto text-[9px] uppercase text-primary">
                          capital
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
