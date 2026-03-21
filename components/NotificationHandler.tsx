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
    // Pre-load audio with a small car horn beep sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/717/717-preview.mp3");
    audioRef.current.volume = 0.5;

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

      const isMentioned = msg.mentions?.includes(me._id) || msg.isGlobalMention;

      // Only notify if window is not focused OR message is in another channel OR mentioned
      const shouldNotify = !isWindowFocused.current || msg.channelId !== selectedChannelId || isMentioned;

      if (shouldNotify) {
        // Play notification sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          void audioRef.current.play().catch(() => {});
        }

        if ("Notification" in window && Notification.permission === "granted") {
          let title = `${msg.authorName} in #${msg.channelName}`;
          if (isMentioned) {
            title = msg.isGlobalMention 
              ? `📢 @everyone mentioned by ${msg.authorName} in #${msg.channelName}`
              : `⚠️ Mentioned by ${msg.authorName} in #${msg.channelName}`;
          }
          
          const options: NotificationOptions & { renotify?: boolean; requireInteraction?: boolean } = {
            body: msg.content || "Image attached",
            icon: "/convex.svg",
            tag: isMentioned ? `mention-${msg._id}` : msg.channelId, // Group notifications by channel, but mentions are unique
            renotify: true,
            requireInteraction: isMentioned, // Mention notifications stay until clicked
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
