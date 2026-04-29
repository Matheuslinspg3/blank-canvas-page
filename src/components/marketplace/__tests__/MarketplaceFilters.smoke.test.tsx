import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketplaceFilters, defaultMarketplaceFilters } from "../MarketplaceFilters";

/**
 * GUARDRAIL: garante que os campos de filtro NUNCA somem do DOM
 * apenas porque a query de origem retornou vazio. Esse foi o bug que
 * fez o usuário relatar "clico em Localização e não abre nada".
 */
describe("MarketplaceFilters — smoke (guardrail contra campos sumindo)", () => {
  const baseProps = {
    filters: defaultMarketplaceFilters,
    onUpdateFilter: vi.fn(),
    onClearFilters: vi.fn(),
    activeFilterCount: 0,
    propertyTypes: [],
    availableAmenities: [],
  };

  it("renderiza o campo Cidades mesmo quando cities=[] e neighborhoods=[]", () => {
    render(
      <MarketplaceFilters
        {...baseProps}
        cities={[]}
        neighborhoods={[]}
      />,
    );

    // Abre o popover de filtros
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

    // Abre o collapsible de Localização (default-open quando há seleção, então clica)
    const locationTrigger = screen.getByText(/Localização/i);
    fireEvent.click(locationTrigger);

    // Os FilterField devem estar no DOM com seus labels
    expect(screen.getByTestId("marketplace-cities-field")).toBeInTheDocument();
    expect(screen.getByTestId("marketplace-neighborhoods-field")).toBeInTheDocument();

    // E mensagens de empty-state devem aparecer
    expect(
      screen.getByText(/Nenhuma cidade disponível no momento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Selecione uma cidade ou veja todos/i),
    ).toBeInTheDocument();
  });

  it("renderiza o campo Cidades quando há cidades disponíveis", () => {
    render(
      <MarketplaceFilters
        {...baseProps}
        cities={[{ city: "Santos", count: 12 }]}
        neighborhoods={[{ neighborhood: "Gonzaga", count: 5 }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    fireEvent.click(screen.getByText(/Localização/i));

    expect(screen.getByTestId("marketplace-cities-field")).toBeInTheDocument();
    expect(screen.getByTestId("marketplace-neighborhoods-field")).toBeInTheDocument();
    // Empty-state NÃO deve aparecer
    expect(
      screen.queryByText(/Nenhuma cidade disponível no momento/i),
    ).not.toBeInTheDocument();
  });
});
