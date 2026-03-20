"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function NotificationHandler({ 
  selectedChannelId 
}: { 
  selectedChannelId: Id<"channels"> | null 
}) {
  const me = useQuery(api.users.me);
  const recentMessages = useQuery(api.messages.getRecentGlobal);
  const notifiedIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const isWindowFocused = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load audio with a distinct car double horn honk (Honk-Honk!)
    // URL: https://assets.mixkit.co/sfx/preview/mixkit-car-double-horn-719.mp3
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/719/719-preview.mp3");
    audioRef.current.volume = 0.7;

    const onFocus = () => (isWindowFocused.current = true);
    const onBlur = () => (isWindowFocused.current = false);
    
    isWindowFocused.current = document.hasFocus();

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!recentMessages || !me) return;

    // On the very first load of recentMessages, mark them all as "already notified"
    // so we don't spam the user with old messages.
    if (isInitialLoad.current) {
      recentMessages.forEach(msg => notifiedIds.current.add(msg._id));
      isInitialLoad.current = false;
      return;
    }

    // Sort by creation time to notify in order (though query is desc)
    const sorted = [...recentMessages].sort((a, b) => a._creationTime - b._creationTime);

    for (const msg of sorted) {
      if (notifiedIds.current.has(msg._id)) continue;
      
      // Mark as notified
      notifiedIds.current.add(msg._id);

      // Don't notify for our own messages
      if (msg.userId === me._id) continue;

      // Only notify if window is not focused OR message is in another channel
      const shouldNotify = !isWindowFocused.current || msg.channelId !== selectedChannelId;

      if (shouldNotify) {
        console.log("🔔 Should notify for message:", msg._id);
        // Play notification sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().then(() => {
            console.log("🔊 Sound played successfully");
          }).catch((err) => {
            console.warn("🔇 Audio play blocked or failed:", err);
          });
        } else {
          console.error("❌ Audio ref is null");
        }

        if ("Notification" in window && Notification.permission === "granted") {
          const title = `${msg.authorName} in #${msg.channelName}`;
          const options: NotificationOptions = {
            body: msg.content || "Image attached",
            icon: "/convex.svg",
            tag: msg.channelId, // Group notifications by channel
            renotify: true,
          };
          
          try {
            new Notification(title, options);
          } catch (e) {
            console.error("Failed to show notification:", e);
          }
        }
      }
    }
  }, [recentMessages, me, selectedChannelId]);

  return null;
}
