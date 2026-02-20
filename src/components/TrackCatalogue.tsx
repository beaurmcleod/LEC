import { useEffect, useRef, useState } from "react";
import { Play, Pause, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Track {
  id: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
  genre: string | null;
  release_year: number | null;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const TrackCatalogue = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchTracks = async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setTracks(data);
      setLoading(false);
    };
    fetchTracks();
  }, []);

  const togglePlay = (track: Track) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(track.audio_url);
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      setProgress((p) => ({ ...p, [track.id]: audio.currentTime }));
    });
    audio.addEventListener("loadedmetadata", () => {
      setDurations((d) => ({ ...d, [track.id]: audio.duration }));
    });
    audio.addEventListener("ended", () => {
      setPlayingId(null);
    });

    audio.play();
    setPlayingId(track.id);
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Music className="w-6 h-6 text-primary" />
        Track Catalogue
      </h2>
      <div className="space-y-3">
        {tracks.map((track) => {
          const isPlaying = playingId === track.id;
          const current = progress[track.id] || 0;
          const duration = durations[track.id] || track.duration_seconds || 0;
          const pct = duration > 0 ? (current / duration) * 100 : 0;

          return (
            <div
              key={track.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
            >
              {/* Artwork or placeholder */}
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {track.artwork_url ? (
                  <img
                    src={track.artwork_url}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Play button */}
              <button
                onClick={() => togglePlay(track)}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/80 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                )}
              </button>

              {/* Track info + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground truncate">
                    {track.title}
                  </p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {duration > 0 ? `${formatTime(current)} / ${formatTime(duration)}` : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {track.artist}
                  {track.genre && ` · ${track.genre}`}
                  {track.release_year && ` · ${track.release_year}`}
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
