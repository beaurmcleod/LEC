import { Phone, MapPin, Star, Music, Headphones, Users, Youtube, Instagram, Calendar, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import djHero from "@/assets/dj-hero.jpg";
import djBooth from "@/assets/dj-booth.jpg";

const DJServices = () => {
  const services = [
    {
      icon: Music,
      title: "Festival & Event DJ",
      description: "High-energy sets tailored to your event, from intimate gatherings to large-scale festivals."
    },
    {
      icon: Headphones,
      title: "Private Events",
      description: "Weddings, corporate events, and private parties with customized playlists and professional sound."
    },
    {
      icon: Users,
      title: "Club & Venue Performances",
      description: "Experienced in reading crowds and delivering unforgettable experiences on the dancefloor."
    },
  ];

  const genres = [
    "House", "Deep House", "Tech House", "Melodic Techno", 
    "Progressive House", "Afro House", "Electronic", "Dance"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Image */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${djHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        
        <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-accent text-accent" />
            ))}
              <span className="ml-2 text-muted-foreground">Professional DJ Services</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-foreground">
              LEC DJ Services
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Bringing energy and atmosphere to events across Southern California. 
              From festivals to private parties, let's create an unforgettable experience.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" asChild>
                <a href="mailto:booking@lowendcandy.com">
                  <Calendar className="w-5 h-5 mr-2" />
                  Book Now
                </a>
              </Button>
              <a href="tel:+17606076541" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-lg font-medium transition-colors">
                <Phone className="w-5 h-5" />
                (760) 607-6541
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">DJ Services</h2>
          
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

      {/* Featured Image Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="rounded-xl overflow-hidden">
              <img 
                src={djBooth} 
                alt="DJ booth at festival" 
                className="w-full h-auto object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4 text-foreground">Experience That Matters</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                With years of experience performing at festivals and venues across California, 
                LEC DJ Services brings technical expertise and musical knowledge to every event. 
                From reading the crowd to seamless mixing, every set is crafted to elevate 
                your event's atmosphere.
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Disc3 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-6 text-foreground">About Low End Candy</h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
            Low End Candy is a San Diego-based music project and DJ brand known for deep, 
            driving grooves and infectious energy. Whether it's a sunset festival set or 
            a late-night club session, LEC delivers curated sounds that keep the dancefloor 
            moving from start to finish.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Get in Touch</h2>
          
          <Card className="bg-card border-border">
            <CardContent className="p-8">
              <div className="grid sm:grid-cols-2 gap-6">
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
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Location</h3>
                    <p className="text-muted-foreground">San Diego, CA</p>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-4 pt-6 mt-6 border-t border-border justify-center">
                <a 
                  href="https://www.youtube.com/@lowendcandy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Youtube className="w-6 h-6 text-primary" />
                </a>
                <a 
                  href="https://www.instagram.com/lowendcandy/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Instagram className="w-6 h-6 text-primary" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to Book Your Event?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Let's discuss your event and create an unforgettable musical experience together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="mailto:booking@lowendcandy.com">Request a Quote</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="tel:+17606076541">Call Now</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Schema.org Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "LEC DJ Services",
  "alternateName": "Low End Candy",
  "description": "Professional DJ services for festivals, private events, and venues in Southern California.",
  "url": "https://www.lowendcandy.com/dj",
  "telephone": "+1-760-607-6541",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "San Diego",
    "addressRegion": "CA",
    "addressCountry": "US"
  },
  "sameAs": [
    "https://www.youtube.com/@lowendcandy",
    "https://www.instagram.com/lowendcandy/"
  ],
  "priceRange": "$$"
}`
        }}
      />
    </div>
  );
};

export default DJServices;
