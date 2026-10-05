"use client";

// Pulls the logged-in player's arcade bests from WordPress into localStorage, so the /3d cards
// show them (syncServerScores runs at most every 5 minutes and is a no-op for guests / flag off).
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { syncServerScores } from "@/arcade3d/core/scores";

export default function ArcadeScoreSync() {
   const { user } = useAuth();
   const userId = user?.id ?? null;

   useEffect(() => {
      if (userId !== null) void syncServerScores(userId);
   }, [userId]);

   return null;
}
