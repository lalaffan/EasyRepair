import { Card, CardContent } from "@/components/ui/card";
import { 
  Smartphone, 
  Laptop, 
  Tv, 
  Speaker, 
  Tablet,
  Watch,
  ImageIcon 
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const categories = [
  {
    name: "Smartphones",
    icon: Smartphone,
    image: "/images/smartphone-repair.jpg",
    fallbackColor: "bg-blue-100",
    slug: "smartphones"
  },
  {
    name: "Laptops",
    icon: Laptop,
    image: "/images/laptop-repair.jpg",
    fallbackColor: "bg-green-100",
    slug: "laptops"
  },
  {
    name: "TVs",
    icon: Tv,
    image: "/images/tv-repair.jpg",
    fallbackColor: "bg-purple-100",
    slug: "tvs"
  },
  {
    name: "Audio",
    icon: Speaker,
    image: "/images/audio-repair.jpg",
    fallbackColor: "bg-red-100",
    slug: "audio"
  },
  {
    name: "Tablets",
    icon: Tablet,
    image: "/images/tablet-repair.jpg",
    fallbackColor: "bg-yellow-100",
    slug: "tablets"
  },
  {
    name: "Smartwatches",
    icon: Watch,
    image: "/images/smartwatch-repair.jpg",
    fallbackColor: "bg-orange-100",
    slug: "smartwatches"
  }
];

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {categories.map((category) => (
        <Link key={category.slug} href={`/category/${category.slug}`}>
          <Card className="group cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div 
                className={`aspect-square rounded-lg mb-4 overflow-hidden ${category.fallbackColor}`}
              >
                <div className="w-full h-full flex items-center justify-center group-hover:bg-black/10 transition-colors">
                  <category.icon className="w-12 h-12 text-gray-700" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-center">{category.name}</h3>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}