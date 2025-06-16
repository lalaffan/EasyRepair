import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBidSchema, InsertBid } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import SubscriptionDialog from "./subscription-dialog";
import { useQuery } from "@tanstack/react-query";

interface BidFormProps {
  listingId: number;
}

export default function BidForm({ listingId }: BidFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // Query for subscription status
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription"],
    enabled: !!user?.isRepairman,
  });

  const form = useForm<InsertBid>({
    resolver: zodResolver(insertBidSchema),
    defaultValues: {
      amount: undefined,
      comment: "",
    },
  });

  const onSubmit = async (data: InsertBid) => {
    try {
      await apiRequest("POST", `/api/listings/${listingId}/bids`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}/bids`] });
      toast({
        title: "Success",
        description: "Your bid has been placed",
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      if (message.includes("active subscription")) {
        setShowSubscription(true);
      } else {
        toast({
          title: "Error placing bid",
          description: message,
          variant: "destructive",
        });
      }
    }
  };

  // Show subscription dialog if needed
  if (showSubscription) {
    return <SubscriptionDialog open={true} onOpenChange={() => setShowSubscription(false)} />;
  }

  // Check subscription status
  const needsSubscription = !subscription || subscription.status !== "active";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={needsSubscription ? "outline" : "default"}
          onClick={(e) => {
            if (needsSubscription) {
              e.preventDefault();
              setShowSubscription(true);
            }
          }}
        >
          {needsSubscription ? "Subscribe to Place Bids" : "Place Bid"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place a Bid</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(onSubmit)(e);
          }} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bid Amount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter your bid amount"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add details about your repair service"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || needsSubscription}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing Bid...
                </>
              ) : (
                "Submit Bid"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}