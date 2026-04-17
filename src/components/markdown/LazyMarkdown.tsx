import { lazy, Suspense } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

const ReactMarkdown = lazy(() =>
  lazyWithRetry(() => import("react-markdown"), { moduleName: "react-markdown" }),
);

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
