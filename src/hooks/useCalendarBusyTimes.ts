import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

interface BusyTime {
  start: string;
  end: string;
}

interface CalendarBusyTimesResult {
  busyTimes: BusyTime[];
  isLoading: boolean;
  isConnected: boolean;
  refetch: () => Promise<void>;
}

export function useCalendarBusyTimes(): CalendarBusyTimesResult {
  const [busyTimes, setBusyTimes] = useState<BusyTime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const fetchBusyTimes = async () => {
    setIsLoading(true);
    try {
      // Fetch busy times for the next 2 months
      const startDate = new Date().toISOString();
      const endDate = endOfMonth(addMonths(new Date(), 2)).toISOString();

      const { data, error } = await supabase.functions.invoke("get-calendar-busy-times", {
        body: { startDate, endDate },
      });

      if (error) {
        console.error("Error fetching busy times:", error);
        return;
      }

      setBusyTimes(data.busyTimes || []);
      setIsConnected(data.connected || false);
    } catch (error) {
      console.error("Error fetching busy times:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusyTimes();
  }, []);

  return { busyTimes, isLoading, isConnected, refetch: fetchBusyTimes };
}

// Check if a specific time slot is busy
export function isTimeSlotBusy(
  busyTimes: BusyTime[],
  date: Date,
  pstHour: number,
  durationMinutes: number = 60
): boolean {
  // Get the Pacific timezone offset for this specific date (handles DST)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hourStr = String(pstHour).padStart(2, '0');

  const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit', hour12: false,
  });

  const tempUtc = new Date(`${year}-${month}-${day}T12:00:00Z`);
  const pacificParts = pacificFormatter.formatToParts(tempUtc);
  const pHourVal = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
  const pacificOffsetHours = pHourVal - 12; // -7 for PDT, -8 for PST

  // Convert Pacific time to UTC
  const utcStart = new Date(`${year}-${month}-${day}T${hourStr}:00:00Z`);
  utcStart.setHours(utcStart.getHours() - pacificOffsetHours);
  const utcEnd = new Date(utcStart.getTime() + durationMinutes * 60 * 1000);

  // Check if this slot overlaps with any busy time
  return busyTimes.some((busy) => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    return utcStart < busyEnd && utcEnd > busyStart;
  });
}
