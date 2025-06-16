import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-600 dark:text-gray-200">
              EasyRepair
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Connecting users with skilled repair technicians for reliable
              electronics repairs.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Quick Links
            </h4>
            <div className="space-y-2">
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
                asChild
              >
                <Link href="/">Home</Link>
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
                asChild
              >
                <Link href="/browse">Browse Repairs</Link>
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
                asChild
              >
                <Link href="/how-it-works">How It Works</Link>
              </Button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Categories
            </h4>
            <div className="space-y-2">
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                Smartphones
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                Laptops
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                TVs
              </Button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Support
            </h4>
            <div className="space-y-2">
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                Contact Us
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                FAQ
              </Button>
              <br />
              <Button
                variant="link"
                className="dark:text-gray-300 hover:dark:text-gray-100"
              >
                Terms of Service
              </Button>
            </div>
          </div>
        </div>
        <Separator className="my-8 dark:border-gray-700" />
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} EasyRepair. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
