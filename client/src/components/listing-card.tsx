import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Listing, Bid } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Trash2, Clock, ChevronDown, ChevronUp, ImageIcon, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistance } from "date-fns";
import BidForm from "./bid-form";
import ReviewList from "./review-list";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ChatDialog from "./chat-dialog";

interface ListingCardProps {
  listing: Listing;
}

interface ExtendedBid extends Bid {
  repairmanName?: string;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showBids, setShowBids] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedBid, setSelectedBid] = useState<ExtendedBid | null>(null);
  const [imageError, setImageError] = useState(false);

  const { data: bids = [] } = useQuery<ExtendedBid[]>({
    queryKey: [`/api/listings/${listing.id}/bids`],
    enabled: showBids,
  });

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/listings/${listing.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete listing",
        variant: "destructive",
      });
    }
  };

  const handleAcceptBid = async (bidId: number) => {
    try {
      await apiRequest("POST", `/api/listings/${listing.id}/accept-bid/${bidId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/listings/${listing.id}/bids`] });
      const acceptedBid = bids.find(bid => bid.id === bidId);
      if (acceptedBid) {
        setSelectedBid(acceptedBid);
        setShowChat(true);
      }
      toast({
        title: "Success",
        description: "Bid accepted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept bid",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (listing.status === "in_progress" && bids.length > 0) {
      const accepted = bids.find(bid => bid.status === "accepted");
      if (accepted) {
        setSelectedBid(accepted);
      }
    }
  }, [listing.status, bids]);

  return (
    <>
      <Card className="overflow-hidden">
        <div
          className={`aspect-[3/2] w-full bg-cover bg-center rounded-t-lg relative ${
            imageError ? 'bg-muted' : ''
          }`}
          style={
            !imageError
              ? {
                  backgroundImage: `url(${listing.imageUrl})`,
                }
              : undefined
          }
        >
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <img
            src={listing.imageUrl}
            alt=""
            className="hidden"
            onError={() => setImageError(true)}
          />
        </div>
        {listing.budget && (
          <div className="px-3 py-1 bg-muted">
            <p className="text-xs font-medium">
              Budget: ₹{listing.budget}
            </p>
          </div>
        )}
        <CardHeader className="p-3">
          <div className="flex justify-between items-start gap-2">
            <div>
              <CardTitle className="text-base">{listing.title}</CardTitle>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <Clock className="h-3 w-3 mr-1" />
                {formatDistance(new Date(listing.createdAt), new Date(), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={listing.status === "open" ? "default" : "secondary"} className="text-xs">
                {listing.status}
              </Badge>
              {user?.id === listing.userId && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {listing.description}
          </p>

          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">{listing.category}</Badge>
            {user?.isRepairman && listing.status === "open" && (
              <BidForm listingId={listing.id} />
            )}
          </div>

          {(user?.id === listing.userId || user?.isRepairman) && (
            <div className="mt-2 border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full flex items-center justify-between text-sm h-8"
                onClick={() => setShowBids(!showBids)}
              >
                Show Bids {showBids ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>

              {showBids && (
                <div className="mt-2 space-y-2">
                  {bids.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center">No bids yet</p>
                  ) : (
                    bids.map((bid) => (
                      <div key={bid.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3 w-3" />
                            <p className="text-sm font-medium">{bid.repairmanName}</p>
                          </div>
                          <p className="text-sm font-medium">₹{bid.amount}</p>
                          {bid.comment && (
                            <p className="text-xs text-muted-foreground mt-1">{bid.comment}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistance(new Date(bid.createdAt), new Date(), { addSuffix: true })}
                          </p>
                          <div className="mt-2 border-t pt-2">
                            <p className="text-xs font-medium mb-1">Repairman Reviews</p>
                            <ReviewList repairmanId={bid.repairmanId} />
                          </div>
                        </div>
                        {user?.id === listing.userId && listing.status === "open" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAcceptBid(bid.id)}
                          >
                            Accept Bid
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {listing.status === "in_progress" && selectedBid && selectedBid.status === "accepted" && (
            <div className="mt-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-sm"
                onClick={() => setShowChat(true)}
              >
                Chat with {user?.id === listing.userId ? "Repairman" : "Customer"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBid && (
        <ChatDialog
          open={showChat}
          onOpenChange={setShowChat}
          listingId={listing.id}
          recipientId={user?.id === listing.userId ? selectedBid.repairmanId : listing.userId}
        />
      )}
    </>
  );
}