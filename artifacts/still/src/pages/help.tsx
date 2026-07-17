import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
// Single source of truth: the in-app Help page renders the same FAQ markdown that
// lives in docs/FAQ.md, so the doc and the app can never drift. Vite inlines the
// file at build via the ?raw import.
import faqMarkdown from "../../../../docs/FAQ.md?raw";
import { AppNav } from "@/components/app-nav";

export default function Help() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-6 py-12 md:py-16">
        <article
          className="font-body prose prose-stone max-w-none
            prose-headings:font-display prose-headings:text-deep-brown
            prose-h1:text-4xl prose-h1:mb-3 prose-h2:text-2xl prose-h2:mt-12
            prose-h3:text-lg prose-h3:text-ink
            prose-p:text-soft-ink prose-li:text-soft-ink prose-strong:text-ink
            prose-a:text-accent-sepia prose-a:no-underline hover:prose-a:underline
            prose-li:marker:text-faint-ink
            prose-hr:border-border/60
            prose-blockquote:border-accent-sepia/50 prose-blockquote:text-soft-ink"
          data-testid="faq-content"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
          >
            {faqMarkdown}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
