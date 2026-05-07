import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBlogPostBySlug } from "@/lib/blogPosts";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  
  // Try static first
  const staticPost = slug ? getBlogPostBySlug(slug) : undefined;

  // Try DB if not static
  const { data: dbPost } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !staticPost && !!slug,
  });

  // Normalize to a common shape
  const post = staticPost
    ? { title: staticPost.title, excerpt: staticPost.excerpt, content: staticPost.content, date: staticPost.date, readTime: staticPost.readTime, tags: staticPost.tags, metaDescription: staticPost.metaDescription }
    : dbPost
    ? { title: dbPost.title, excerpt: dbPost.excerpt, content: dbPost.content, date: dbPost.published_at, readTime: dbPost.read_time, tags: dbPost.tags, metaDescription: dbPost.meta_description }
    : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (post) {
      const pageTitle = `${post.title} | Low End Candy`;
      const pageUrl = `https://lowendcandy.com/blog/${slug}`;

      document.title = pageTitle;

      const setMeta = (selector: string, value: string) => {
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement("meta");
          const nameMatch = selector.match(/\[name="(.+?)"\]/);
          const propMatch = selector.match(/\[property="(.+?)"\]/);
          if (nameMatch) (el as HTMLMetaElement).name = nameMatch[1];
          if (propMatch) el.setAttribute("property", propMatch[1]);
          document.head.appendChild(el);
        }
        el.setAttribute("content", value);
      };

      setMeta('meta[name="description"]', post.metaDescription);
      setMeta('meta[property="og:title"]', pageTitle);
      setMeta('meta[property="og:description"]', post.metaDescription);
      setMeta('meta[property="og:url"]', pageUrl);
      setMeta('meta[property="og:type"]', "article");

      return () => {
        // Restore homepage defaults on unmount
        document.title = "Low End Candy — Music Production Tools for Producers and DJs";
      };
    }
  }, [post, slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Post Not Found</h1>
          <Link to="/blog" className="text-primary hover:underline">← Back to Blog</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  const renderContent = (content: string) => {
    return content.split("\n\n").map((block, i) => {
      if (block.startsWith("### ")) {
        return <h3 key={i} className="text-xl font-semibold text-foreground mt-8 mb-3">{block.replace("### ", "")}</h3>;
      }
      if (block.startsWith("## ")) {
        return <h2 key={i} className="text-2xl font-bold text-foreground mt-10 mb-4">{block.replace("## ", "")}</h2>;
      }
      if (block.startsWith("- ")) {
        const items = block.split("\n").filter(l => l.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-1.5 text-muted-foreground my-4 ml-2">
            {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item.replace("- ", "")) }} />)}
          </ul>
        );
      }
      if (block.match(/^\d+\./)) {
        const items = block.split("\n").filter(l => l.match(/^\d+\./));
        return (
          <ol key={i} className="list-decimal list-inside space-y-1.5 text-muted-foreground my-4 ml-2">
            {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^\d+\.\s*/, "")) }} />)}
          </ol>
        );
      }
      return <p key={i} className="text-muted-foreground leading-relaxed my-4" dangerouslySetInnerHTML={{ __html: formatInline(block) }} />;
    });
  };

  const postUrl = `https://lowendcandy.com/blog/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "Low End Candy", url: "https://lowendcandy.com" },
    publisher: { "@type": "Organization", name: "Low End Candy", url: "https://lowendcandy.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    url: postUrl,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Blog
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4 leading-tight">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-10 pb-8 border-b border-border">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
          </div>
          <div>{renderContent(post.content)}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
