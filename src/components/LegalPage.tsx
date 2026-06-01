import { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

export const LegalPage = ({ title, updated, children }: LegalPageProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-primary bg-clip-text text-transparent mb-3">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {updated}</p>
        <article className="prose prose-invert max-w-none space-y-5 text-foreground/90 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-primary [&_a]:underline hover:[&_a]:text-primary/80">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
};
