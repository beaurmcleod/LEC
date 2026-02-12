import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { blogPosts } from "@/lib/blogPosts";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-16 space-y-4">
            <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-primary bg-clip-text text-transparent">
              The Candy Blog
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tips, tutorials, and the latest news in Ableton Live and music production.
            </p>
          </header>

          <div className="space-y-8">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block rounded-lg border border-border bg-card p-6 md:p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary"
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.readTime}
                    </span>
                  </div>
                  <span className="text-primary flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
