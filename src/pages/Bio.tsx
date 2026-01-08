import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import bioDjBooth from "@/assets/bio-dj-booth.jpg";
import bioLibLineup from "@/assets/bio-lib-lineup.png";
import bioStudio from "@/assets/bio-studio.jpg";
import bioCollab from "@/assets/bio-collab.jpg";
import bioLibBooth from "@/assets/bio-lib-booth.jpg";
import bioLibSolo from "@/assets/bio-lib-solo.jpg";
import bioRemixAlbum from "@/assets/bio-remix-album.jpg";
import bioFestivalGroup from "@/assets/bio-festival-group.png";

const Bio = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container max-w-2xl mx-auto px-4 py-16">
        {/* Back button */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="text-center mb-12 space-y-6">
          <div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-lg border-4 border-primary/50">
            <img 
              src={bioLibSolo} 
              alt="Bohemyth"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            About Bohemyth
          </h1>
        </div>

        {/* Bio content */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-lg mb-8">
          <p className="text-lg text-foreground leading-relaxed">
            Bohemyth (Beau McLeod) is a music producer, performing artist, and educator with proven industry and teaching credentials. He's played Lightning in a Bottle twice, worked with Grammy-winning producer Kato On The Track, and released an album that surpassed 100,000 streams. He's formally trained with a degree from Icon Collective, a Music Technology degree from MiraCosta College, and additional study at San Diego State University. As an educator, he's mentored around 100 private students, built an online music production course, runs the Low End Candy YouTube channel, and has taught at 343 Labs—where he also managed their YouTube channel—bringing real-world production experience and clear, results-driven instruction to every student he works with.
          </p>
        </div>

        {/* Photo Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg overflow-hidden shadow-lg md:col-span-2">
            <img 
              src={bioCollab} 
              alt="Bohemyth collaborating in the studio"
              className="w-full h-72 object-cover"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img 
              src={bioLibSolo} 
              alt="Bohemyth performing at Lightning in a Bottle"
              className="w-full h-64 object-cover"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img 
              src={bioLibLineup} 
              alt="Lightning in a Bottle 2023 Lineup featuring Bohemyth"
              className="w-full h-64 object-cover object-top"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img 
              src={bioStudio} 
              alt="Bohemyth in the studio"
              className="w-full h-64 object-cover"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img 
              src={bioLibBooth} 
              alt="Bohemyth at the DJ booth"
              className="w-full h-64 object-cover"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg md:col-span-2">
            <img 
              src={bioFestivalGroup} 
              alt="Festival group photo at Lightning in a Bottle"
              className="w-full h-72 object-cover"
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg md:col-span-2">
            <img 
              src={bioRemixAlbum} 
              alt="Android Porn Remix Album featuring Bohemyth"
              className="w-full h-72 object-contain bg-black"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            © 2024 Low End Candy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Bio;
