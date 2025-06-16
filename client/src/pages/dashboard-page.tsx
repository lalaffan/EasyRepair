import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Listing, Bid } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ListCheck, Clock, Receipt, Star, AlertTriangle } from "lucide-react";
import ListingCard from "@/components/listing-card";
import ReviewForm from "@/components/review-form";
import ReviewList from "@/components/review-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedListing, setSelectedListing] = useState<number | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [showSubscriptionWarning, setShowSubscriptionWarning] = useState(false);

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
  });

  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription"],
    enabled: user?.isRepairman,
  });

  useEffect(() => {
    if (subscription?.endDate) {
      const end = parseISO(subscription.endDate);
      const days = differenceInDays(end, new Date());
      setDaysRemaining(days);
      setShowSubscriptionWarning(days <= 7 && days > 0);
    }
  }, [subscription]);

  const userListings = listings.filter(listing => listing.userId === user?.id);
  const { data: bids = [] } = useQuery<Bid[]>({
    queryKey: ["/api/bids/repairman"],
    enabled: user?.isRepairman,
  });

  // Calculate total earnings from accepted bids
  const totalEarnings = user?.isRepairman
    ? bids
        .filter(bid => bid.status === "accepted")
        .reduce((total, bid) => total + parseFloat(bid.amount.toString()), 0)
    : userListings
        .filter(listing => listing.status === "completed")
        .reduce((total, listing) => total + parseFloat(listing.budget.toString()), 0);

  const completeRepairMutation = useMutation({
    mutationFn: async (listingId: number) => {
      await apiRequest("POST", `/api/listings/${listingId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Success",
        description: "Repair marked as completed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCompleteRepair = (listingId: number) => {
    completeRepairMutation.mutate(listingId);
  };

  const handleLeaveReview = (listingId: number) => {
    setSelectedListing(listingId);
  };

  // Get repairs that this repairman is working on
  const repairmanListings = user?.isRepairman
    ? listings.filter(listing => {
        return bids.some(bid =>
          bid.listingId === listing.id &&
          bid.repairmanId === user.id &&
          bid.status === "accepted"
        );
      })
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {user?.isRepairman && daysRemaining !== null && (
        <div className={`mb-6 p-4 rounded-lg border ${
          daysRemaining <= 0 
            ? 'bg-red-100 border-red-400 text-red-700'
            : showSubscriptionWarning
            ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
            : 'bg-green-100 border-green-400 text-green-700'
        }`}>
          <div className="flex items-center gap-2">
            {daysRemaining <= 0 ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
            <span className="font-medium">
              {daysRemaining <= 0
                ? 'Your subscription has expired. Please renew to continue accepting repair requests.'
                : `Subscription expires in ${daysRemaining} days${
                    showSubscriptionWarning ? '. Please renew soon!' : ''
                  }`}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.isRepairman ? "Active Repairs" : "Active Listings"}
            </CardTitle>
            <ListCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.isRepairman
                ? repairmanListings.filter(l => l.status === "in_progress").length
                : userListings.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.isRepairman ? "Repairs Completed" : "Devices Fixed"}
            </CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.isRepairman
                ? repairmanListings.filter(l => l.status === "completed").length
                : userListings.filter(l => l.status === "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.isRepairman ? "Total Earnings" : "Total Spent"}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">
          {user?.isRepairman ? "Your Repairs" : "Your Devices"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {user?.isRepairman ? (
            repairmanListings.length > 0 ? (
              repairmanListings.map(listing => (
                <div key={listing.id}>
                  <ListingCard listing={listing} />
                  {listing.status === "in_progress" && (
                    <Button
                      variant="default"
                      className="mt-2 w-full"
                      onClick={() => handleCompleteRepair(listing.id)}
                      disabled={completeRepairMutation.isPending}
                    >
                      Mark as Completed
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground col-span-2 text-center py-8">
                No repairs found. Accept bids on repair listings to start working on repairs.
              </p>
            )
          ) : (
            userListings.map(listing => (
              <div key={listing.id}>
                <ListingCard listing={listing} />
                {listing.status === "completed" && (
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => handleLeaveReview(listing.id)}
                  >
                    Leave Review
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {user?.isRepairman && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Your Reviews</h2>
          <ReviewList repairmanId={user.id} />
        </div>
      )}

      <Dialog open={selectedListing !== null} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <ReviewForm
              listingId={selectedListing}
              onSuccess={() => setSelectedListing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}