import { useQuery } from "@tanstack/react-query";
import { Listing } from "@shared/schema";
import { useParams } from "wouter";
import ListingCard from "@/components/listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function CategoryPage() {
  const { category } = useParams();
  const normalizedCategory = category?.toLowerCase();

  const { data: listings = [], isLoading, error } = useQuery<Listing[]>({
    queryKey: [`/api/listings/category/${normalizedCategory}`],
    enabled: !!category,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Error loading listings: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formattedCategory = category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : '';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{formattedCategory} Repairs</h1>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No repairs listed for this category yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}