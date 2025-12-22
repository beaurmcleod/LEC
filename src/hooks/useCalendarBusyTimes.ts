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
  // Create the slot start time in PST
  const slotStart = new Date(date);
  slotStart.setHours(pstHour, 0, 0, 0);
  
  // Convert PST to UTC (PST is UTC-8)
  const pstOffset = -8 * 60; // minutes
  const utcStart = new Date(slotStart.getTime() - pstOffset * 60 * 1000);
  const utcEnd = new Date(utcStart.getTime() + durationMinutes * 60 * 1000);

  // Check if this slot overlaps with any busy time
  return busyTimes.some((busy) => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);

    // Check for overlap: slot starts before busy ends AND slot ends after busy starts
    return utcStart < busyEnd && utcEnd > busyStart;
  });
}
