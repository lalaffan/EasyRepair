import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function HeroSection() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="relative" style={{ height: "500px" }}>
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url(https://images.unsplash.com/photo-1597424216540-64533fe46ef8)",
          filter: "brightness(0.3)",
          width: "100%",
          height: "100%",
        }}
      />
      <div className="relative z-10 container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Get Your Electronics Fixed by Trusted Professionals
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-8">
            Upload photos of your faulty devices and receive competitive repair
            quotes from verified technicians.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {user?.isRepairman ? (
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                onClick={() => navigate("/browse")}
              >
                Browse Repair Requests
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                onClick={() => navigate("/create-listing")}
              >
                List Your Device
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white bg-transparent hover:bg-white/10 hover:text-white hover:border-white"
            >
              How It Works
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
