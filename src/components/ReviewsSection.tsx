import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string | null;
  review_date: string | null;
}

export const ReviewsSection = () => {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, reviewer_name, rating, review_text, review_date")
        .order("review_date", { ascending: false })
        .limit(6);
      if (data) setReviews(data);
    };
    fetchReviews();
  }, []);

  if (reviews.length === 0) return null;

  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <section className="mt-16 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">What People Are Saying</h2>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${s <= Math.round(Number(avgRating)) ? "text-primary fill-primary" : "text-muted"}`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{avgRating} average from {reviews.length} reviews</span>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">{review.reviewer_name}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= review.rating ? "text-primary fill-primary" : "text-muted"}`}
                  />
                ))}
              </div>
            </div>
            {review.review_text && (
              <p className="text-sm text-muted-foreground leading-relaxed">{review.review_text}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
