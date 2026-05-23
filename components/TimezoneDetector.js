"use client";

// On first mount (after signin), detect the browser's IANA timezone and
// save it to the user's profile if it's not already set. Silent.

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TimezoneDetector() {
  useEffect(() => {
    (async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz) return;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles").select("timezone").eq("id", user.id).single();
        if (profile?.timezone === tz) return; // unchanged
        await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id);
      } catch {}
    })();
  }, []);
  return null;
}
