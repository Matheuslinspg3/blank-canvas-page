import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const RichTextEditor = lazy(() =>
  import("@/components/contracts/RichTextEditor").then((m) => ({
    default: m.RichTextEditor,
  }))
);

export { AVAILABLE_VARIABLES } from "@/components/contracts/RichTextEditor";

interface LazyRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onAiGenerate?: () => void;
  isAiGenerating?: boolean;
}

export default function LazyRichTextEditor(props: LazyRichTextEditorProps) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-md" />}>
      <RichTextEditor {...props} />
    </Suspense>
  );
}
