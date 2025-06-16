import { Review } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { formatDistance } from "date-fns";

interface ReviewListProps {
  repairmanId: number;
}

export default function ReviewList({ repairmanId }: ReviewListProps) {
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: [`/api/repairmen/${repairmanId}/reviews`],
  });

  if (reviews.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-2 text-xs">
        No reviews yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {reviews.map((review) => (
        <div key={review.id} className="border rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <p className="text-xs mb-1">{review.comment}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistance(new Date(review.createdAt), new Date(), {
              addSuffix: true,
            })}
          </p>
        </div>
      ))}
    </div>
  );
}