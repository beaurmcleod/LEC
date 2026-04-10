import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Users, Check, Globe, CalendarX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { useCalendarBusyTimes, isTimeSlotBusy } from "@/hooks/useCalendarBusyTimes";
import zoomLogo from "@/assets/zoom-logo.webp";
// PST time slots (what Beau works in)
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

interface LessonOption {
  id: string;
  title: string;
  duration: string;
  price: number;
  description: string;
  features: string[];
}

const lessonOptions: LessonOption[] = [
  {
    id: "78ec84c6-1fef-4a1b-833e-abb9039b9298",
    title: "1 Hour Session",
    duration: "60 minutes",
    price: 99,
    description: "Perfect for focused feedback or tackling specific production challenges",
    features: [
      "One-on-one video call",
      "Screen sharing & live feedback",
      "Recording of session provided",
      "Follow-up notes & resources",
    ],
  },
  {
    id: "4ddb3517-4204-4b51-9625-6d6861181eb1",
    title: "2 Hour Session",
    duration: "120 minutes",
    price: 149,
    description: "Deep dive into your project with comprehensive guidance",
    features: [
      "Can be split into 2 × 1-hour lessons",
      "Extended one-on-one session",
      "Full track review & feedback",
      "Live production demonstrations",
      "Recording of session provided",
      "Detailed follow-up notes",
    ],
  },
  {
    id: "ed2732f3-a006-4dc6-a9f3-d07f75111e0f",
    title: "4 Lesson Pack",
    duration: "4 × 60 minutes",
    price: 300,
    description: "Commit to your growth with a structured lesson series",
    features: [
      "Four 1-hour sessions",
      "Flexible scheduling",
      "Personalized curriculum",
      "Progress tracking",
      "Priority booking",
      "Save $96 vs individual lessons",
    ],
  },
];

// Get user's timezone
function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Get timezone abbreviation for display
function getTimezoneAbbr(timezone: string): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZoneName: 'short' };
  const parts = new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).formatToParts(date);
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart?.value || timezone;
}

// Convert Pacific Time hour to user's local time (handles DST automatically)
function convertPSTToLocal(pstHour: number, selectedDate: Date | undefined): { hour: number; label: string; nextDay: boolean } {
  if (!selectedDate) {
    const isPM = pstHour >= 12;
    const displayHour = pstHour > 12 ? pstHour - 12 : pstHour === 0 ? 12 : pstHour;
    return { hour: pstHour, label: `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`, nextDay: false };
  }

  // Build the target date/time string and parse it in America/Los_Angeles
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const hourStr = String(pstHour).padStart(2, '0');
  const pacificDateStr = `${year}-${month}-${day}T${hourStr}:00:00`;

  // Get the UTC offset for America/Los_Angeles on this specific date/time
  const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  // Create a temp date to find the Pacific offset on this day
  // We use a known UTC time and see what Pacific shows to derive offset
  const tempUtc = new Date(`${year}-${month}-${day}T12:00:00Z`);
  const pacificParts = pacificFormatter.formatToParts(tempUtc);
  const pHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
  const pacificOffsetHours = pHour - 12; // offset from UTC in hours (will be -7 or -8)

  // Now convert the desired Pacific time to UTC
  const utcTime = new Date(`${year}-${month}-${day}T${hourStr}:00:00Z`);
  utcTime.setHours(utcTime.getHours() - pacificOffsetHours);

  // Convert to user's local time
  const localTime = new Date(utcTime);
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

// Format PST time for display
function formatPSTTime(pstHour: number): string {
  const isPM = pstHour >= 12;
  const displayHour = pstHour > 12 ? pstHour - 12 : pstHour === 0 ? 12 : pstHour;
  return `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`;
}

const Lessons = () => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<LessonOption | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedPSTHour, setSelectedPSTHour] = useState<number | null>(null);

  const userTimezone = useMemo(() => getUserTimezone(), []);
  const userTimezoneAbbr = useMemo(() => getTimezoneAbbr(userTimezone), [userTimezone]);
  const isPST = userTimezone.includes('Pacific') || userTimezone.includes('Los_Angeles');

  // Fetch busy times from Google Calendar
  const { busyTimes, isLoading: isLoadingBusyTimes, isConnected: isCalendarConnected } = useCalendarBusyTimes();

  // Get duration in minutes for the selected lesson
  const lessonDurationMinutes = useMemo(() => {
    if (!selectedOption) return 60;
    if (selectedOption.title.includes("2 Hour")) return 120;
    return 60; // Default to 60 minutes
  }, [selectedOption]);

  // Convert time slots for display with busy status
  const displayTimeSlots = useMemo(() => {
    return pstTimeSlots.map(slot => {
      const isBusy = selectedDate 
        ? isTimeSlotBusy(busyTimes, selectedDate, slot.hour, lessonDurationMinutes)
        : false;
      
      return {
        pstHour: slot.hour,
        pstLabel: slot.label,
        local: convertPSTToLocal(slot.hour, selectedDate),
        isBusy,
      };
    });
  }, [selectedDate, busyTimes, lessonDurationMinutes]);

  const handleBookLesson = () => {
    if (!selectedOption || !selectedDate || selectedPSTHour === null) return;

    // Format the date as YYYY-MM-DD for consistency
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const pstTimeLabel = formatPSTTime(selectedPSTHour);
    
    const params = new URLSearchParams({
      type: "lesson",
      lessonId: selectedOption.id,
      id: selectedOption.id,
      title: selectedOption.title,
      price: `$${selectedOption.price}`,
      date: formattedDate,
      time: pstTimeLabel, // Always send PST time to backend
    });

    navigate(`/enter-email?${params.toString()}`);
  };

  const selectedLocalTime = selectedPSTHour !== null 
    ? convertPSTToLocal(selectedPSTHour, selectedDate) 
    : null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-8">
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
              Book a Private Lesson
            </h1>
            <img src={zoomLogo} alt="Via Zoom" className="h-12 w-12 rounded-lg" />
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Level up your music production skills with personalized one-on-one coaching via Zoom. 
            Whether you're just starting out or looking to refine your craft, I'll help you reach your goals.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Lesson Options */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Choose Your Session</h2>
            {lessonOptions.map((option) => (
              <Card
                key={option.id}
                className={cn(
                  "cursor-pointer transition-all duration-300 hover:border-primary/50",
                  selectedOption?.id === option.id
                    ? "border-primary shadow-glow-primary"
                    : "border-border"
                )}
                onClick={() => setSelectedOption(option)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{option.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4" />
                        {option.duration}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">${option.price}</span>
                      {option.title === "4 Lesson Pack" && (
                        <span className="block text-xs text-accent">Value Pack</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{option.description}</p>
                  <ul className="space-y-2">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Calendar & Booking */}
          <div className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Select a Date
                </CardTitle>
                <CardDescription>
                  Available Monday - Friday
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedPSTHour(null); // Reset time when date changes
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

            {/* Time Slot Selection */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Select a Time
                </CardTitle>
                <CardDescription className="space-y-1">
                  {selectedDate 
                    ? `Choose your preferred time slot for ${format(selectedDate, "EEEE, MMMM d")}`
                    : "First select a date above"
                  }
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
                    All lessons are conducted in Pacific Time (PST/PDT)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Summary & Book Button */}
            <Card className="border-border bg-card/50">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
                {selectedOption ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session</span>
                      <span className="font-medium">{selectedOption.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{selectedOption.duration}</span>
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
                        <span className="font-bold text-primary">${selectedOption.price}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Select a session type to see pricing
                  </p>
                )}

                <Button
                  className="w-full mt-6"
                  size="lg"
                  disabled={!selectedOption || !selectedDate || selectedPSTHour === null}
                  onClick={handleBookLesson}
                >
                  {selectedOption && selectedDate && selectedPSTHour !== null
                    ? `Book & Pay $${selectedOption.price}`
                    : "Select a session, date, and time"}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  After payment, you'll receive an email to confirm the exact time. 
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

export default Lessons;
