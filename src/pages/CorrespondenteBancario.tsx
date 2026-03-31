import { PageHeader } from "@/components/PageHeader";
import { CorrespondenteTab } from "@/components/financing/CorrespondenteTab";

export default function CorrespondenteBancario() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Correspondente Bancário"
        description="Gerencie processos de financiamento, simule taxas e gere formulários bancários"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Correspondente Bancário" },
        ]}
      />
      <div className="flex-1 p-4 sm:p-6">
        <CorrespondenteTab />
      </div>
    </div>
  );
}
