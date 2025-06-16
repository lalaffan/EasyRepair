import CreateListingForm from "@/components/create-listing-form";

export default function CreateListingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create New Listing</h1>
      <div className="max-w-2xl mx-auto">
        <CreateListingForm />
      </div>
    </div>
  );
}
