import { useState } from "react";
import { Phone, MapPin, Star, Music, Headphones, Users, Youtube, Instagram, Disc3, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import djWeddingHero from "@/assets/dj-wedding-hero.webp";
import djBooth from "@/assets/dj-booth.jpg";

const DJServices = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventType: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-dj-inquiry', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Inquiry Sent!",
        description: "Thanks for reaching out. We'll get back to you soon!",
      });
      
      setFormData({
        name: "",
        email: "",
        phone: "",
        eventDate: "",
        eventType: "",
        message: ""
      });
    } catch (error) {
      console.error('Error sending inquiry:', error);
      toast({
        title: "Error",
        description: "There was a problem sending your inquiry. Please try again or email us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          style={{ backgroundImage: `url(${djWeddingHero})` }}
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
            
            <a href="tel:+17606076541" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-lg font-medium transition-colors">
              <Phone className="w-5 h-5" />
              (760) 607-6541
            </a>
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

      {/* Contact Form Section */}
      <section className="py-16 px-4 bg-primary/10">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">Tell Us About Your Event</h2>
          <p className="text-muted-foreground text-center mb-8">
            Fill out the form below and we'll get back to you to discuss your event.
          </p>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">Event Date</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventType">Type of Event</Label>
                  <Input
                    id="eventType"
                    placeholder="Wedding, Birthday, Corporate Event, etc."
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Tell Us About Your Event *</Label>
                  <Textarea
                    id="message"
                    placeholder="Share details about your event - venue, number of guests, music preferences, and anything else you'd like us to know..."
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  <Send className="w-5 h-5 mr-2" />
                  {isSubmitting ? "Sending..." : "Send Inquiry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Info Section */}
      <section className="py-16 px-4">
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
