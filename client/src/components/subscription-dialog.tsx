import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubscriptionSchema, InsertSubscription } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Add image resizing utility function
const resizeImage = async (file: File, maxWidth = 800, maxHeight = 800): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.85 // Slightly reduce quality to decrease file size
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
  });
};

export default function SubscriptionDialog({
  open,
  onOpenChange,
}: SubscriptionDialogProps) {
  const { toast } = useToast();
  const form = useForm<InsertSubscription>({
    resolver: zodResolver(insertSubscriptionSchema.omit({ userId: true })),
    defaultValues: {
      amount: 300,
      paymentProof: "",
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (data: Omit<InsertSubscription, "userId">) => {
      // First validate the file
      if (!data.paymentProof || !(data.paymentProof instanceof File)) {
        throw new Error("Please select a payment proof screenshot");
      }

      if (!data.paymentProof.type.startsWith('image/')) {
        throw new Error("Please upload an image file (JPG, PNG, or GIF)");
      }

      try {
        // Resize the image before upload
        const resizedBlob = await resizeImage(data.paymentProof);
        const resizedFile = new File([resizedBlob], data.paymentProof.name, {
          type: 'image/jpeg'
        });

        const formData = new FormData();
        formData.append("image", resizedFile);

        // Upload the resized file
        console.log("Uploading payment proof...");
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.message || "Failed to upload payment proof");
        }

        const { imageUrl } = await uploadResponse.json();
        console.log("Upload successful, image URL:", imageUrl);

        // Create subscription with the image URL
        console.log("Creating subscription...");
        const subscriptionData = {
          amount: data.amount,
          paymentProof: imageUrl,
        };
        console.log("Subscription data:", subscriptionData);

        const res = await apiRequest("POST", "/api/subscription", subscriptionData);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create subscription");
        }

        return await res.json();
      } catch (error) {
        console.error("Upload/subscription error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description:
          "Subscription request submitted successfully. Please wait for admin verification.",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Subscribe as Repairman</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground text-center">
              Scan the QR code below to make a payment of ₹300 for your monthly
              subscription
            </p>
            <div className="w-48 h-48 bg-muted flex items-center justify-center overflow-hidden rounded-lg">
              <img 
                src="/myqr/qr.jpg" 
                alt="Payment QR Code"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              After payment, upload a screenshot of your payment confirmation
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit((data) =>
                  subscriptionMutation.mutate(data),
                )(e);
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="paymentProof"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Payment Screenshot</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={subscriptionMutation.isPending}
              >
                Submit for Verification
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}