import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Listing, Subscription } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Ban, CheckCircle, X } from "lucide-react";
import { formatDistance } from "date-fns";
import { useState } from "react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isTogglingBlock, setIsTogglingBlock] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState<number | null>(null);
  const [isRejecting, setIsRejecting] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Redirect if not admin
  if (!user?.isAdmin) {
    setLocation("/");
    return null;
  }

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: listings = [], isLoading: isLoadingListings } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
    enabled: !!user?.isAdmin,
  });

  const { data: pendingSubscriptions = [], isLoading: isLoadingSubscriptions } = useQuery<
    (Subscription & { username: string })[]
  >({
    queryKey: ["/api/admin/subscriptions/pending"],
    enabled: !!user?.isAdmin,
  });

  const handleDeleteListing = async (listingId: number) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      setIsDeleting(listingId);
      await apiRequest("DELETE", `/api/admin/listings/${listingId}`);
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
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleBlockUser = async (userId: number, currentBlockedState: boolean) => {
    try {
      setIsTogglingBlock(userId);
      await apiRequest("POST", `/api/admin/users/${userId}/toggle-block`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: `User ${currentBlockedState ? "unblocked" : "blocked"} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user status",
        variant: "destructive",
      });
    } finally {
      setIsTogglingBlock(null);
    }
  };

  const handleVerifySubscription = async (subscriptionId: number) => {
    try {
      setIsVerifying(subscriptionId);
      await apiRequest("POST", `/api/admin/subscriptions/${subscriptionId}/verify`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions/pending"] });
      toast({
        title: "Success",
        description: "Subscription verified successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify subscription",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(null);
    }
  };

  const handleRejectSubscription = async (subscriptionId: number) => {
    try {
      setIsRejecting(subscriptionId);
      await apiRequest("POST", `/api/admin/subscriptions/${subscriptionId}/reject`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions/pending"] });
      toast({
        title: "Success",
        description: "Subscription rejected successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject subscription",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users Management</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{u.username}</p>
                        <div className="flex gap-2 mt-1">
                          {u.isAdmin && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                          {u.isRepairman && (
                            <Badge>Repairman</Badge>
                          )}
                          {u.isBlocked && (
                            <Badge variant="destructive">Blocked</Badge>
                          )}
                        </div>
                      </div>
                      {!u.isAdmin && (
                        <Button
                          variant={u.isBlocked ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleToggleBlockUser(u.id, u.isBlocked)}
                          disabled={isTogglingBlock === u.id}
                        >
                          {isTogglingBlock === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.isBlocked ? (
                            <><CheckCircle className="h-4 w-4 mr-2" /> Unblock</>
                          ) : (
                            <><Ban className="h-4 w-4 mr-2" /> Block</>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          <Card>
            <CardHeader>
              <CardTitle>Listings Management</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingListings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{listing.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {listing.category} • Posted{" "}
                          {formatDistance(new Date(listing.createdAt), new Date(), {
                            addSuffix: true,
                          })}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {listing.status}
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteListing(listing.id)}
                        disabled={isDeleting === listing.id}
                      >
                        {isDeleting === listing.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Pending Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSubscriptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingSubscriptions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No pending subscriptions
                    </p>
                  ) : (
                    pendingSubscriptions.map((subscription) => (
                      <div
                        key={subscription.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{subscription.username}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Amount: ₹{subscription.amount} • Requested{" "}
                            {formatDistance(new Date(subscription.createdAt), new Date(), {
                              addSuffix: true,
                            })}
                          </p>
                          <button
                            onClick={() => setSelectedImage(subscription.paymentProof)}
                            className="text-sm text-primary hover:underline mt-2 inline-block"
                          >
                            View Payment Proof
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectSubscription(subscription.id)}
                            disabled={isRejecting === subscription.id}
                          >
                            {isRejecting === subscription.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><X className="h-4 w-4 mr-2" /> Reject</>
                            )}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleVerifySubscription(subscription.id)}
                            disabled={isVerifying === subscription.id}
                          >
                            {isVerifying === subscription.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" /> Verify</>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <img
              src={selectedImage || ""}
              alt="Payment Proof"
              className="w-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}