import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Users, Check, Globe, CalendarX, Gift } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { useCalendarBusyTimes, isTimeSlotBusy } from "@/hooks/useCalendarBusyTimes";
import zoomLogo from "@/assets/zoom-logo.webp";

// PST time slots
const pstTimeSlots = [
  { hour: 9, label: "9:00 AM" },
  { hour: 10, label: "10:00 AM" },
  { hour: 11, label: "11:00 AM" },
  { hour: 12, label: "12:00 PM" },
  { hour: 13, label: "1:00 PM" },
  { hour: 14, label: "2:00 PM" },
  { hour: 15, label: "3:00 PM" },
  { hour: 16, label: "4:00 PM" },
  { hour: 17, label: "5:00 PM" },
];

function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getTimezoneAbbr(timezone: string): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZoneName: 'short' };
  const parts = new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).formatToParts(date);
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart?.value || timezone;
}

function convertPSTToLocal(pstHour: number, selectedDate: Date | undefined): { hour: number; label: string; nextDay: boolean } {
  if (!selectedDate) {
    const isPM = pstHour >= 12;
    const displayHour = pstHour > 12 ? pstHour - 12 : pstHour === 0 ? 12 : pstHour;
    return { hour: pstHour, label: `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`, nextDay: false };
  }

  const pstOffset = -8;
  const pstDate = new Date(selectedDate);
  pstDate.setHours(pstHour, 0, 0, 0);
  const utcTime = new Date(pstDate.getTime() - (pstOffset * 60 * 60 * 1000));
  const localOffset = new Date().getTimezoneOffset();
  const localTime = new Date(utcTime.getTime() - (localOffset * 60 * 1000));

  const localHour = localTime.getHours();
  const isPM = localHour >= 12;
  const displayHour = localHour > 12 ? localHour - 12 : localHour === 0 ? 12 : localHour;
  const nextDay = localTime.getDate() !== selectedDate.getDate();

  return {
    hour: localHour,
    label: `${displayHour}:00 ${isPM ? 'PM' : 'AM'}${nextDay ? ' (+1 day)' : ''}`,
    nextDay
  };
}

function formatPSTTime(pstHour: number): string {
  const isPM = pstHour >= 12;
  const displayHour = pstHour > 12 ? pstHour - 12 : pstHour === 0 ? 12 : pstHour;
  return `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`;
}

const FreeConsultation = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedPSTHour, setSelectedPSTHour] = useState<number | null>(null);

  const userTimezone = useMemo(() => getUserTimezone(), []);
  const userTimezoneAbbr = useMemo(() => getTimezoneAbbr(userTimezone), [userTimezone]);
  const isPST = userTimezone.includes('Pacific') || userTimezone.includes('Los_Angeles');

  const { busyTimes } = useCalendarBusyTimes();

  const displayTimeSlots = useMemo(() => {
    return pstTimeSlots.map(slot => {
      const isBusy = selectedDate
        ? isTimeSlotBusy(busyTimes, selectedDate, slot.hour, 30)
        : false;

      return {
        pstHour: slot.hour,
        pstLabel: slot.label,
        local: convertPSTToLocal(slot.hour, selectedDate),
        isBusy,
      };
    });
  }, [selectedDate, busyTimes]);

  const handleBookConsultation = () => {
    if (!selectedDate || selectedPSTHour === null) return;

    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const pstTimeLabel = formatPSTTime(selectedPSTHour);

    const params = new URLSearchParams({
      type: "lesson",
      lessonId: "free-consultation",
      id: "free-consultation",
      title: "Free 30-Minute Consultation",
      price: "$0",
      date: formattedDate,
      time: pstTimeLabel,
    });

    navigate(`/enter-email?${params.toString()}`);
  };

  const selectedLocalTime = selectedPSTHour !== null
    ? convertPSTToLocal(selectedPSTHour, selectedDate)
    : null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/links"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Links
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Free Consultation
            </h1>
            <img src={zoomLogo} alt="Via Zoom" className="h-12 w-12 rounded-lg" />
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Book a free 30-minute discovery call to discuss your music production goals, 
            ask questions, and see if private lessons are the right fit for you.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Info Card */}
          <div className="space-y-4">
            <Card className="border-primary shadow-glow-primary">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Gift className="w-5 h-5 text-primary" />
                      30-Minute Discovery Call
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      30 minutes
                    </CardDescription>
                  </div>
                  <span className="text-2xl font-bold text-primary">FREE</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  No commitment, no pressure — just a friendly chat about your music production journey.
                </p>
                <ul className="space-y-2">
                  {[
                    "One-on-one video call via Zoom",
                    "Discuss your goals & challenges",
                    "Get personalized recommendations",
                    "Ask any production questions",
                    "No obligation to purchase lessons",
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Calendar & Booking */}
          <div className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Select a Date
                </CardTitle>
                <CardDescription>Available Monday - Friday</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedPSTHour(null);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today || isWeekend(date);
                  }}
                  className="rounded-md border border-border pointer-events-auto"
                />
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Select a Time
                </CardTitle>
                <CardDescription className="space-y-1">
                  {selectedDate
                    ? `Choose your preferred time for ${format(selectedDate, "EEEE, MMMM d")}`
                    : "First select a date above"}
                  {!isPST && (
                    <span className="flex items-center gap-1 text-xs text-primary mt-1">
                      <Globe className="w-3 h-3" />
                      Showing times in your timezone ({userTimezoneAbbr})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {displayTimeSlots.map((slot) => (
                    <Button
                      key={slot.pstHour}
                      variant={selectedPSTHour === slot.pstHour ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPSTHour(slot.pstHour)}
                      disabled={!selectedDate || slot.isBusy}
                      className={cn(
                        "transition-all flex flex-col h-auto py-2 relative",
                        selectedPSTHour === slot.pstHour && "shadow-glow-primary",
                        slot.isBusy && "opacity-50 cursor-not-allowed line-through"
                      )}
                    >
                      {slot.isBusy && (
                        <CalendarX className="w-3 h-3 absolute top-1 right-1 text-destructive" />
                      )}
                      <span className={cn("font-medium", slot.isBusy && "line-through")}>
                        {slot.local.label}
                      </span>
                      {!isPST && (
                        <span className="text-[10px] opacity-70">{slot.pstLabel} PST</span>
                      )}
                      {slot.isBusy && (
                        <span className="text-[10px] text-destructive">Unavailable</span>
                      )}
                    </Button>
                  ))}
                </div>
                {!isPST && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    All sessions are conducted in Pacific Time (PST/PDT)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Summary & Book */}
            <Card className="border-border bg-card/50">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session</span>
                    <span className="font-medium">Free 30-Min Consultation</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">30 minutes</span>
                  </div>
                  {selectedDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                    </div>
                  )}
                  {selectedPSTHour !== null && selectedLocalTime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <div className="text-right">
                        <span className="font-medium">{selectedLocalTime.label}</span>
                        {!isPST && (
                          <span className="block text-xs text-muted-foreground">
                            {formatPSTTime(selectedPSTHour)} PST
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary">FREE</span>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full mt-6"
                  size="lg"
                  disabled={!selectedDate || selectedPSTHour === null}
                  onClick={handleBookConsultation}
                >
                  {selectedDate && selectedPSTHour !== null
                    ? "Book Free Consultation"
                    : "Select a date and time"}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  After booking, you'll receive a confirmation email with a Zoom link.
                  Questions? Contact{" "}
                  <a href="mailto:beau@lowendcandy.com" className="text-primary hover:underline">
                    beau@lowendcandy.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreeConsultation;
