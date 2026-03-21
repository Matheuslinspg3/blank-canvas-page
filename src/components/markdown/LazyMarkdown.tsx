import { lazy, Suspense } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));

interface LazyMarkdownProps {
  children: string;
}

export default function LazyMarkdown({ children }: LazyMarkdownProps) {
  return (
    <Suspense fallback={<span>{children}</span>}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </Suspense>
  );
}
