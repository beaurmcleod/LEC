import { Phone, MapPin, Clock, Star, Music, Headphones, Mic2, Youtube, Instagram, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LocalLessons = () => {
  const businessHours = [
    { day: "Monday", hours: "9:00 AM – 6:00 PM" },
    { day: "Tuesday", hours: "9:00 AM – 6:00 PM" },
    { day: "Wednesday", hours: "9:00 AM – 6:00 PM" },
    { day: "Thursday", hours: "9:00 AM – 6:00 PM" },
    { day: "Friday", hours: "9:00 AM – 6:00 PM" },
    { day: "Saturday", hours: "By Appointment" },
    { day: "Sunday", hours: "Closed" },
  ];

  const services = [
    {
      icon: Music,
      title: "1-on-1 Ableton Live Lessons",
      description: "Personalized instruction tailored to your skill level and goals in Ableton Live."
    },
    {
      icon: Headphones,
      title: "Music Production Coaching",
      description: "Learn to write songs, build clean drums, and master sound design techniques."
    },
    {
      icon: Mic2,
      title: "In-Home & Zoom Sessions",
      description: "Flexible lesson options – learn from the comfort of your home or via video call."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-primary/20 via-background to-secondary/20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="ml-2 text-muted-foreground">5.0 Rating on Google</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Music Production Lessons in Carlsbad, CA
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Professional 1-on-1 music production lessons for beginners to advanced producers. 
            Learn Ableton Live, sound design, and songwriting from an experienced instructor.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="tel:+17606076541" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-lg font-medium transition-colors">
              <Phone className="w-5 h-5" />
              (760) 607-6541
            </a>
            <Button size="lg" asChild>
              <a href="/lessons">Book Online</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Our Services</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="bg-card border-border">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <service.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">{service.title}</h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-foreground">About Low End Candy</h2>
          
          <div className="prose prose-lg mx-auto text-center">
            <p className="text-muted-foreground text-lg leading-relaxed">
              Low End Candy offers customized music production lessons for aspiring and established 
              producers in the Carlsbad and greater San Diego area. Whether you're just starting out 
              or looking to refine your skills, our lessons are tailored to help you achieve your 
              creative goals. We specialize in Ableton Live instruction, covering everything from 
              basic navigation to advanced production techniques.
            </p>
          </div>
        </div>
      </section>

      {/* Contact & Location Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Contact & Location</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Address</h3>
                    <p className="text-muted-foreground">2015 Linda Ln</p>
                    <p className="text-muted-foreground">Carlsbad, CA 92008</p>
                    <a 
                      href="https://www.google.com/maps/dir//2015+Linda+Ln,+Carlsbad,+CA+92008" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Get Directions <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Phone</h3>
                    <a href="tel:+17606076541" className="text-primary hover:underline">
                      (760) 607-6541
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Business Hours</h3>
                    <ul className="space-y-1">
                      {businessHours.map((item, index) => (
                        <li key={index} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.day}</span>
                          <span className="text-foreground">{item.hours}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex gap-4 pt-4 border-t border-border">
                  <a 
                    href="https://www.youtube.com/@lowendcandy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                  >
                    <Youtube className="w-5 h-5 text-primary" />
                  </a>
                  <a 
                    href="https://www.instagram.com/lowendcandy/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                  >
                    <Instagram className="w-5 h-5 text-primary" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Google Map Embed */}
            <Card className="bg-card border-border overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3344.5!2d-117.35!3d33.13!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dc735df153f92b%3A0xcdc66e306c1afc53!2s2015%20Linda%20Ln%2C%20Carlsbad%2C%20CA%2092008!5e0!3m2!1sen!2sus!4v1704067200000!5m2!1sen!2sus"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "400px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Low End Candy Location Map"
              />
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to Start Your Music Production Journey?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Book your first lesson today and take the next step toward more polished mixes and stronger tracks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="/lessons">Book a Lesson</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="tel:+17606076541">Call Now</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Schema.org LocalBusiness Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Music Production Lessons & Courses",
            "alternateName": "Low End Candy",
            "description": "Professional 1-on-1 music production lessons in Ableton Live for beginners to advanced producers in Carlsbad and San Diego area.",
            "url": "https://www.lowendcandy.com",
            "telephone": "+1-760-607-6541",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "2015 Linda Ln",
              "addressLocality": "Carlsbad",
              "addressRegion": "CA",
              "postalCode": "92008",
              "addressCountry": "US"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 33.13,
              "longitude": -117.35
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "5.0",
              "reviewCount": "3"
            },
            "openingHoursSpecification": [
              {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "09:00",
                "closes": "18:00"
              }
            ],
            "sameAs": [
              "https://www.youtube.com/@lowendcandy",
              "https://www.instagram.com/lowendcandy/"
            ],
            "priceRange": "$$"
          })
        }}
      />
    </div>
  );
};

export default LocalLessons;
