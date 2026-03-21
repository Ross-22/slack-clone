"use client";

import { createPortal } from "react-dom";
import imageCompression from "browser-image-compression";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { ProfileModal } from "@/components/ProfileModal";
import { NotificationHandler } from "@/components/NotificationHandler";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  FormEvent,
  KeyboardEvent,
} from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHandle(email: string) {
  return email.split("@")[0];
}

function getInitial(email: string) {
  return email ? email[0].toUpperCase() : "?";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderContent(content: string, isInput = false) {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <strong 
          key={i} 
          style={{ 
            color: isInput ? "var(--accent)" : "inherit", 
            fontWeight: isInput ? "inherit" : 800,
            background: isInput ? "rgba(122,110,245,0.15)" : "none",
            borderBottom: isInput ? "1px solid var(--accent)" : "none",
          }}
        >
          {part}
        </strong>
      );
    }
    return part;
  });
}

function shouldGroup(
  prev: Doc<"messages"> | undefined,
  curr: Doc<"messages">
) {
  if (!prev) return false;
  if (prev.userId !== curr.userId) return false;
  if (curr.replyToId) return false;
  return curr._creationTime - prev._creationTime < 5 * 60 * 1000;
}

function stringToColor(str: string): string {
  const colors = [
    "#6366f1","#8b5cf6","#ec4899","#14b8a6",
    "#f59e0b","#10b981","#3b82f6","#ef4444",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

// ─── Loading Screen ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "fadeSlideUp 0.6s ease-in-out infinite alternate",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <LoadingScreen />;
  return <ChatApp />;
}

// ─── ChatApp ─────────────────────────────────────────────────────────────────

function ChatApp() {
  const channels = useQuery(api.channels.list);
  const seedChannels = useMutation(api.channels.seed);
  
  const [selectedChannelId, setSelectedChannelId] =
    useState<Id<"channels"> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Set initial channel if none selected
  if (channels && channels.length > 0 && !selectedChannelId) {
    setSelectedChannelId(channels[0]._id);
  }

  useEffect(() => {
    if (channels !== undefined && channels.length === 0) {
      void seedChannels({});
    }
  }, [channels, seedChannels]);

  const selectedChannel = channels?.find((c) => c._id === selectedChannelId);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
        position: "relative",
      }}
    >
      <NotificationHandler selectedChannelId={selectedChannelId} />
      <Sidebar
        channels={channels ?? []}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(id) => {
          setSelectedChannelId(id);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onProfileClick={() => setShowProfileModal(true)}
      />
      
      <div 
        className={`mobile-overlay ${isSidebarOpen ? "open" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <main className="main-content">
        {selectedChannelId && selectedChannel ? (
          <ChannelView 
            channel={selectedChannel} 
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        ) : (
          <EmptyState onMenuClick={() => setIsSidebarOpen(true)} />
        )}
      </main>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  isOpen,
  onProfileClick,
}: {
  channels: Doc<"channels">[];
  selectedChannelId: Id<"channels"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
  isOpen: boolean;
  onProfileClick: () => void;
}) {
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const createChannel = useMutation(api.channels.create);
  const unreadChannels = useQuery(api.readReceipts.unreadChannels) ?? [];
  const { signOut } = useAuthActions();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddChannel) inputRef.current?.focus();
  }, [showAddChannel]);

  async function handleCreateChannel(e: FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const id = await createChannel({ name: newChannelName });
    setNewChannelName("");
    setShowAddChannel(false);
    onSelectChannel(id as Id<"channels">);
  }

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Workspace header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 8px var(--accent-glow)",
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            Slackr
          </span>
        </div>
      </div>

      {/* Channels list */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 16px 4px 14px",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Channels
          </span>
          <AddChannelButton onClick={() => setShowAddChannel((v) => !v)} />
        </div>

        {showAddChannel && (
          <form
            onSubmit={handleCreateChannel}
            style={{
              padding: "4px 10px 8px",
              animation: "fadeSlideUp 0.15s ease-out",
            }}
          >
            <input
              ref={inputRef}
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowAddChannel(false);
                  setNewChannelName("");
                }
              }}
              placeholder="e.g. design"
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--accent-glow)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--border-strong)")
              }
            />
          </form>
        )}

        {channels.map((ch) => (
          <ChannelItem
            key={ch._id}
            channel={ch}
            active={ch._id === selectedChannelId}
            isUnread={unreadChannels.includes(ch._id)}
            onClick={() => onSelectChannel(ch._id)}
          />
        ))}
      </div>

      <UserFooter
        onSignOut={() =>
          void signOut().then(() => router.push("/signin"))
        }
        onProfileClick={onProfileClick}
      />
    </aside>
  );
}

// ─── Add Channel Button ───────────────────────────────────────────────────────

function AddChannelButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="New channel"
      style={{
        background: hovered ? "var(--sidebar-hover)" : "none",
        border: "none",
        cursor: "pointer",
        color: hovered ? "var(--accent)" : "var(--text-muted)",
        width: 20,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 5,
        fontSize: 16,
        lineHeight: 1,
        padding: 0,
        transition: "color 0.15s, background 0.15s",
      }}
    >
      +
    </button>
  );
}

// ─── Channel Item ─────────────────────────────────────────────────────────────

function ChannelItem({
  channel,
  active,
  isUnread,
  onClick,
}: {
  channel: Doc<"channels">;
  active: boolean;
  isUnread?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "calc(100% - 8px)",
        marginLeft: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 7,
        padding: "5px 12px",
        background: active
          ? "var(--sidebar-active)"
          : hovered
          ? "var(--sidebar-hover)"
          : "none",
        border: "none",
        borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        cursor: "pointer",
        textAlign: "left",
        borderRadius: "0 7px 7px 0",
        transition: "background 0.12s, border-color 0.12s, transform 0.12s",
        transform: hovered && !active ? "translateX(3px)" : "translateX(0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
        <span
          style={{
            fontSize: 11,
            color: active ? "var(--accent)" : "var(--text-muted)",
            fontWeight: 400,
            transition: "color 0.12s",
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          #
        </span>
        <span
          style={{
            fontSize: 13,
            color: active ? "var(--text)" : isUnread ? "#fff" : hovered ? "var(--text)" : "var(--text-muted)",
            fontWeight: active || isUnread ? 600 : 400,
            transition: "color 0.12s",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {channel.name}
        </span>
      </div>
      {isUnread && !active && (
        <div 
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            boxShadow: "0 0 8px var(--accent-glow)"
          }}
        />
      )}
    </button>
  );
}

// ─── User Footer ─────────────────────────────────────────────────────────────

function UserFooter({ 
  onSignOut,
  onProfileClick 
}: { 
  onSignOut: () => void;
  onProfileClick: () => void;
}) {
  const user = useQuery(api.users.me);

  if (!user) return null;
  const email = user.email || "";
  const name = user.name || getHandle(email);

  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        onClick={onProfileClick}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: user.imageUrl ? "transparent" : stringToColor(email),
          backgroundImage: user.imageUrl ? `url(${user.imageUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          position: "relative",
          cursor: "pointer",
        }}
      >
        {!user.imageUrl && getInitial(email)}
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--online)",
            border: "2px solid var(--sidebar-bg)",
          }}
        />
      </div>
      <span
        onClick={onProfileClick}
        style={{
          flex: 1,
          fontSize: 12,
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        {name}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <ProfileButton onClick={onProfileClick} />
        <SignOutIcon onClick={onSignOut} />
      </div>
    </div>
  );
}

function ProfileButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Profile settings"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: hovered ? "var(--text-muted)" : "var(--text-dim)",
        padding: 4,
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        transition: "color 0.15s",
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
  );
}

function SignOutIcon({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Sign out"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: hovered ? "var(--text-muted)" : "var(--text-dim)",
        padding: 4,
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        transition: "color 0.15s",
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}

// ─── Channel View ─────────────────────────────────────────────────────────────

function ChannelView({ 
  channel,
  onMenuClick 
}: { 
  channel: Doc<"channels">;
  onMenuClick: () => void;
}) {
  const messages = useQuery(api.messages.list, { channelId: channel._id });
  const sendMessage = useMutation(api.messages.send);
  const markRead = useMutation(api.readReceipts.markRead);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const readers = useQuery(api.readReceipts.channelReaders, { channelId: channel._id }) ?? [];
  const userData = useQuery(api.myFunctions.listNumbers, { count: 1 });
  const viewer = userData?.viewer ?? null;
  const viewerId = userData?.viewerId ?? null;
  
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Doc<"messages"> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      // Mark read when messages update
      void markRead({ channelId: channel._id });
    }
  }, [messages, channel._id, markRead]);

  // Reset input when switching channels
  useEffect(() => {
    setInput("");
    setImageFile(null);
    setReplyingTo(null);
  }, [channel._id]);

  async function handleSend(mentions?: Id<"users">[]) {
    const content = input.trim();
    if ((!content && !imageFile) || sending) return;
    setSending(true);
    setInput("");
    
    const currentImageFile = imageFile;
    const currentReplyToId = replyingTo?._id;
    setImageFile(null);
    setReplyingTo(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    try {
      let imageId = undefined;
      
      if (currentImageFile) {
        const compressedFile = await imageCompression(currentImageFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        });
        
        if (!result.ok) throw new Error("Failed to upload image");
        
        const { storageId } = await result.json();
        imageId = storageId;
      }

      await sendMessage({ 
        channelId: channel._id, 
        content, 
        imageId,
        replyToId: currentReplyToId,
        mentions,
      });
      // Self mark read after sending
      void markRead({ channelId: channel._id });
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(_e: KeyboardEvent<HTMLTextAreaElement>) {
    // Other key handlers can go here if needed.
  }

  const canSend = (input.trim().length > 0 || imageFile !== null) && !sending;

  // Compute read receipts mapping to exactly the latest message each user has seen
  const readersByMessageId = new Map<string, string[]>();
  if (messages && viewerId !== null) {
    for (const reader of readers) {
      // Find the absolute latest message sent by the CURRENT USER that this specific reader has seen.
      // We loop backwards from the end to find the most recent one.
      const seenMessage = [...messages].reverse().find(
        (m) => m.userId === viewerId && reader.lastReadTime >= m._creationTime
      );
      if (seenMessage) {
        if (!readersByMessageId.has(seenMessage._id)) {
          readersByMessageId.set(seenMessage._id, []);
        }
        readersByMessageId.get(seenMessage._id)!.push(getHandle(reader.email || "unknown"));
      }
    }
  }

  return (
    <>
      {/* Header */}
      <div className="channel-header">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span style={{ fontSize: 16, color: "var(--accent)", fontWeight: 300 }}>
          #
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.015em",
          }}
        >
          {channel.name}
        </span>
        {channel.description && (
          <>
            <span style={{ color: "var(--border-strong)", fontSize: 16 }}>|</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {channel.description}
            </span>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages === undefined ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <ChannelEmpty name={channel.name} />
        ) : (
          messages.map((msg, i) => {
            const isOwn = viewer !== null && msg.authorEmail === viewer;
            const messageReaders = readersByMessageId.get(msg._id) || [];

            return (
              <MessageItem
                key={msg._id}
                message={msg}
                grouped={shouldGroup(messages[i - 1], msg)}
                isOwn={isOwn}
                readBy={messageReaders}
                onReply={() => setReplyingTo(msg)}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 14px", flexShrink: 0 }}>
        <MessageInput
          input={input}
          setInput={setInput}
          imageFile={imageFile}
          setImageFile={setImageFile}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          canSend={canSend}
          onSend={(mentions) => void handleSend(mentions)}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          placeholder={`Message #${channel.name}`}
        />
      </div>
    </>
  );
}

// ─── Message Input ────────────────────────────────────────────────────────────

function MessageInput({
  input,
  setInput,
  imageFile,
  setImageFile,
  replyingTo,
  onCancelReply,
  canSend,
  onSend,
  onKeyDown,
  textareaRef,
  placeholder,
}: {
  input: string;
  setInput: (v: string) => void;
  imageFile: File | null;
  setImageFile: (f: File | null) => void;
  replyingTo: Doc<"messages"> | null;
  onCancelReply: () => void;
  canSend: boolean;
  onSend: (mentions?: Id<"users">[]) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [emojiHovered, setEmojiHovered] = useState(false);
  const [imageHovered, setImageHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mention State
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const rawUsers = useQuery(api.users.list);
  const users = useMemo(() => rawUsers ?? [], [rawUsers]);
  const [currentMentions, setCurrentMentions] = useState<Set<Id<"users">>>(new Set());

  // Reset mention index when search changes
  const [prevMentionSearch, setPrevMentionSearch] = useState<string | null>(null);
  if (mentionSearch !== prevMentionSearch) {
    setMentionIndex(0);
    setPrevMentionSearch(mentionSearch);
  }

  const filteredUsers = useMemo(() => {
    if (mentionSearch === null) return [];
    const query = mentionSearch.toLowerCase();
    return (users || [])
      .filter(u => 
        u.email && (u.name?.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      )
      .slice(0, 10);
  }, [users, mentionSearch]);

  const handleEmojiClick = (emojiObj: { emoji: string }) => {
    setInput(input + emojiObj.emoji);
    textareaRef.current?.focus();
  };

  const insertMention = (user: { _id: Id<"users">; name?: string; email?: string }) => {
    if (mentionSearch === null || !user.email) return;
    
    const cursor = textareaRef.current?.selectionStart ?? 0;
    const textBefore = input.substring(0, cursor - mentionSearch.length - 1);
    const textAfter = input.substring(cursor);
    const name = user.name || getHandle(user.email);
    
    const newValue = `${textBefore}@${name} ${textAfter}`;
    setInput(newValue);
    setMentionSearch(null);
    setCurrentMentions(prev => new Set(prev).add(user._id));
    
    // Focus back and move cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = textBefore.length + name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const removeImage = () => setImageFile(null);

  const handleSend = () => {
    // Collect all mentions currently in the text
    const mentionsToSend: Id<"users">[] = [];
    currentMentions.forEach(id => {
      const user = users.find(u => u._id === id);
      const name = user?.name || (user?.email ? getHandle(user.email) : "");
      if (input.includes(`@${name}`)) {
        mentionsToSend.push(id);
      }
    });
    onSend(mentionsToSend);
    setCurrentMentions(new Set());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSearch !== null && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionSearch(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    onKeyDown(e);
  };

  return (
    <>
      <div style={{ position: "relative" }}>
        {mentionSearch !== null && filteredUsers.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 8,
            width: 240,
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            overflow: "hidden",
            zIndex: 100,
          }}>
            {filteredUsers.map((user, i) => (
              <div
                key={user._id}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setMentionIndex(i)}
                style={{
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  background: i === mentionIndex ? "var(--accent-dim)" : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: user.imageUrl ? "transparent" : stringToColor(user.email || ""),
                  backgroundImage: user.imageUrl ? `url(${user.imageUrl})` : "none",
                  backgroundSize: "cover",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 700,
                }}>
                  {!user.imageUrl && getInitial(user.email || "")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.name || getHandle(user.email || "")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showEmojiPicker && (
          <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 12, zIndex: 50 }}>
            <div 
              style={{ position: "fixed", inset: 0 }} 
              onClick={() => setShowEmojiPicker(false)}
            />
            <div style={{ position: "relative", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", borderRadius: 8 }}>
              <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} />
            </div>
          </div>
        )}

        {replyingTo && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            animation: "fadeSlideUp 0.15s ease-out",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", margin: "0 0 2px" }}>
                Replying to {getHandle(replyingTo.authorEmail)}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {replyingTo.content || "Image"}
              </p>
            </div>
            <button
              onClick={onCancelReply}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}

        <div
          style={{
            background: "var(--surface)",
            border: `1px solid ${focused ? "rgba(122,110,245,0.4)" : "var(--border-strong)"}`,
            borderRadius: replyingTo ? "0 0 10px 10px" : 10,
            display: "flex",
            flexDirection: "column",
            transition: "border-color 0.2s",
          }}
        >
          {imageFile && (
            <div style={{ padding: "10px 10px 0 14px", position: "relative", width: "max-content" }}>
              <img 
                src={URL.createObjectURL(imageFile)} 
                alt="Preview" 
                style={{ height: 60, borderRadius: 6, objectFit: "cover" }} 
              />
              <button 
                onClick={removeImage}
                style={{ 
                  position: "absolute", 
                  top: 2, 
                  right: -8, 
                  background: "var(--surface-2)", 
                  border: "1px solid var(--border-strong)", 
                  borderRadius: "50%", 
                  width: 20, 
                  height: 20, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text)"
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 10px 10px 14px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setImageHovered(true)}
              onMouseLeave={() => setImageHovered(false)}
              title="Add image"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 0 6px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: imageHovered ? "var(--accent)" : "var(--text-dim)",
                transition: "color 0.15s",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleImageChange} 
            />
            <div style={{ flex: 1, position: "relative", minHeight: 24, display: "flex" }}>
              <div 
                id="input-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  paddingTop: 1,
                  pointerEvents: "none",
                  fontSize: 14,
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                  maxHeight: 120,
                  overflow: "hidden",
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  zIndex: 1,
                  visibility: input ? "visible" : "hidden",
                }}
              >
                {renderContent(input, true)}
                <span style={{ color: "transparent" }}>{input.endsWith("\n") ? "\n " : ""}</span>
                </div>              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(/<3/g, "❤️")
                           .replace(/:-\)/g, "🙂")
                           .replace(/:\)/g, "🙂")
                           .replace(/:-\(/g, "🙁")
                           .replace(/:\(/g, "🙁")
                           .replace(/:D/g, "😃")
                           .replace(/;-\)/g, "😉")
                           .replace(/;\)/g, "😉");
                  setInput(val);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

                  // Detect @ for mentions
                  const cursor = e.target.selectionStart;
                  const textBefore = val.substring(0, cursor);
                  const atIndex = textBefore.lastIndexOf("@");
                  if (atIndex !== -1 && (atIndex === 0 || textBefore[atIndex - 1] === " ")) {
                    const query = textBefore.substring(atIndex + 1);
                    if (!query.includes(" ")) {
                      setMentionSearch(query);
                    } else {
                      setMentionSearch(null);
                    }
                  } else {
                    setMentionSearch(null);
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of items) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) {
                        setImageFile(file);
                        e.preventDefault();
                        break;
                      }
                    }
                  }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  setFocused(false);
                  // Delay closing mentions to allow for click
                  setTimeout(() => setMentionSearch(null), 150);
                }}
                onScroll={(e) => {
                  const overlay = document.getElementById("input-overlay");
                  if (overlay) overlay.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                }}
                placeholder={placeholder}
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  color: "transparent",
                  caretColor: "var(--text)",
                  fontSize: 14,
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                  maxHeight: 120,
                  overflow: "auto",
                  paddingTop: 1,
                  position: "relative",
                  zIndex: 2,
                }}
              />
            </div>
          <button
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setEmojiHovered(true)}
            onMouseLeave={() => setEmojiHovered(false)}
            title="Add emoji"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 4px 6px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: emojiHovered ? "var(--accent)" : "var(--text-dim)",
              transition: "color 0.15s",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
          </button>
        <button
          onClick={handleSend}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canSend}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            background: canSend ? "var(--accent)" : "var(--surface-2)",
            border: "none",
            borderRadius: 7,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canSend ? "pointer" : "default",
            flexShrink: 0,
            transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
            transform: canSend && btnHovered ? "scale(1.08)" : "scale(1)",
            boxShadow:
              canSend && btnHovered ? "0 0 14px var(--accent-glow)" : "none",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={canSend ? "#fff" : "var(--text-dim)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      </div>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          marginTop: 5,
          paddingLeft: 2,
        }}
      >
        Enter ↵ to send · Shift+Enter for new line
      </p>
    </>
  );
}

// ─── Message Item ─────────────────────────────────────────────────────────────

type MessageWithImage = Doc<"messages"> & { 
  imageUrl?: string | null; 
  authorImageUrl?: string | null;
  authorName?: string | null;
  replyTo?: { _id: Id<"messages">; content?: string; authorEmail: string } | null;
  reactions?: Doc<"reactions">[];
};

function EmojiHotbar({
  onSelect,
  onCustomOpen,
  onHotbarChange,
  currentHotbar,
  onEditingChange,
}: {
  onSelect: (emoji: string) => void;
  onCustomOpen: () => void;
  onHotbarChange: (newHotbar: string[]) => void;
  currentHotbar: string[];
  onEditingChange?: (isEditing: boolean) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);

  useEffect(() => {
    onEditingChange?.(editingIndex !== null || isEditingMode);
  }, [editingIndex, isEditingMode, onEditingChange]);

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "var(--surface-2)",
        border: `1px solid ${isEditingMode ? "var(--accent)" : "var(--border-strong)"}`,
        borderRadius: 20,
        padding: "4px 8px",
        boxShadow: isEditingMode ? "0 0 15px var(--accent-glow)" : "0 4px 12px rgba(0,0,0,0.3)",
        animation: "fadeSlideUp 0.15s ease-out",
        alignItems: "center",
        transition: "all 0.2s",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setIsEditingMode(!isEditingMode)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          color: isEditingMode ? "var(--accent)" : "var(--text-muted)",
          display: "flex",
          borderRadius: 6,
          transition: "color 0.2s",
        }}
        className="hover-scale"
        title={isEditingMode ? "Done editing" : "Edit hotbar"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isEditingMode ? (
            <polyline points="20 6 9 17 4 12"></polyline>
          ) : (
            <>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path>
            </>
          )}
        </svg>
      </button>

      <div style={{ width: 1, height: 16, background: "var(--border-strong)", margin: "0 2px" }} />

      {currentHotbar.map((emoji, i) => (
        <button
          key={i}
          onClick={() => isEditingMode ? setEditingIndex(i) : onSelect(emoji)}
          style={{
            background: "none",
            border: isEditingMode ? "1px dashed var(--accent-dim)" : "none",
            fontSize: 18,
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 6,
            transition: "transform 0.1s",
            animationName: isEditingMode ? "wiggle" : "none",
            animationDuration: "0.3s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            animationDelay: `${i * 0.05}s`,
          }}
          className={!isEditingMode ? "hover-scale" : ""}
        >
          {emoji}
        </button>
      ))}

      {!isEditingMode && (
        <>
          <div style={{ width: 1, height: 16, background: "var(--border-strong)", margin: "0 2px" }} />
          <button
            onClick={onCustomOpen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              color: "var(--text-muted)",
              display: "flex",
              borderRadius: 6,
            }}
            className="hover-scale"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </button>
        </>
      )}

      {editingIndex !== null && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div onClick={() => setEditingIndex(null)} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "relative", zIndex: 1001 }}>
            <EmojiPicker 
              theme={Theme.DARK} 
              onEmojiClick={(emojiObj) => {
                const next = [...currentHotbar];
                next[editingIndex] = emojiObj.emoji;
                onHotbarChange(next);
                setEditingIndex(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Reactions({
  reactions,
  onToggle,
  viewerId,
  isOwn,
}: {
  reactions: Doc<"reactions">[];
  onToggle: (emoji: string) => void;
  viewerId: string | null;
  isOwn: boolean;
}) {
  const groups = new Map<string, string[]>();
  reactions.forEach((r) => {
    if (!groups.has(r.emoji)) groups.set(r.emoji, []);
    groups.get(r.emoji)!.push(r.userId);
  });

  if (reactions.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 4,
        justifyContent: isOwn ? "flex-end" : "flex-start",
      }}
    >
      {Array.from(groups.entries()).map(([emoji, userIds]) => {
        const hasReacted = viewerId && userIds.includes(viewerId as Id<"users">);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            style={{
              background: hasReacted ? "var(--accent-dim)" : "var(--surface-2)",
              border: `1px solid ${hasReacted ? "var(--accent)" : "var(--border-strong)"}`,
              borderRadius: 12,
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 13 }}>{emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: hasReacted ? "var(--text)" : "var(--text-muted)" }}>
              {userIds.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MessageItem({
  message,
  grouped,
  isOwn,
  readBy = [],
  onReply,
}: {
  message: MessageWithImage;
  grouped: boolean;
  isOwn: boolean;
  readBy?: string[];
  onReply?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showHotbar, setShowHotbar] = useState(false);
  const [hotbarPosition, setHotbarPosition] = useState<"above" | "below">("above");
  const [isHotbarEditing, setIsHotbarEditing] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();
  const bubbleWrapperRef = useRef<HTMLDivElement>(null);

  const updateMessage = useMutation(api.messages.update);
  const removeMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.reactions.toggle);
  const updateHotbar = useMutation(api.reactions.updateHotbar);
  const hotbar = useQuery(api.reactions.getHotbar) ?? ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  const userData = useQuery(api.myFunctions.listNumbers, { count: 1 });
  const viewerId = userData?.viewerId ?? null;
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      // Move cursor to end
      const length = editContent.length;
      editInputRef.current?.setSelectionRange(length, length);
    }
  }, [isEditing, editContent.length]);

  async function handleUpdate() {
    const trimmed = editContent.trim();
    if (trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    if (!trimmed && !message.imageId) return;
    
    try {
      await updateMessage({ messageId: message._id, content: trimmed });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete() {
    if (confirm("Are you sure you want to delete this message?")) {
      try {
        await removeMessage({ messageId: message._id });
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Swipe-to-reply + Long press logic
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);

    if (isMobile) {
      longPressTimer.current = setTimeout(() => {
        if (bubbleWrapperRef.current) {
          const rect = bubbleWrapperRef.current.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          setHotbarPosition(centerY > window.innerHeight / 2 ? "above" : "below");
        }
        setShowHotbar(true);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 500);
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    if (touchStartX.current !== null && touchStartY.current !== null) {
      const dx = Math.abs(x - touchStartX.current);
      const dy = Math.abs(y - touchStartY.current);
      if (dx > 10 || dy > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }

    if (touchStartX.current === null) return;
    const diff = x - touchStartX.current;
    
    // Allow swiping right for others' messages, and left for own messages
    if ((!isOwn && diff > 0) || (isOwn && diff < 0)) {
      const absDiff = Math.abs(diff);
      const resistance = Math.pow(absDiff, 0.8);
      const offset = Math.min(resistance, 100);
      setSwipeOffset(diff > 0 ? offset : -offset);
    }
  }

  function onTouchEnd() {
    setIsSwiping(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (Math.abs(swipeOffset) >= 45) {
      onReply?.();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    setSwipeOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const handleDoubleClick = (_e: React.MouseEvent | React.TouchEvent) => {
    if (isEditing || !hotbar[0]) return;
    // Prevent default to avoid zoom on mobile if possible, 
    // though onDoubleClick is a desktop event.
    void toggleReaction({ messageId: message._id, emoji: hotbar[0] });
  };

  const scrollToOriginal = () => {
    if (!message.replyTo?._id) return;
    const el = document.getElementById(`msg-${message.replyTo._id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("msg-highlight");
      setTimeout(() => el.classList.remove("msg-highlight"), 2500);
    }
  };

  return (
    <div
      id={`msg-${message._id}`}
      className="msg-enter"
      onMouseEnter={() => !isMobile && setHovered(true)}
      onMouseLeave={() => {
        if (!showHotbar && !showCustomPicker && !isHotbarEditing) {
          setHovered(false);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{
        padding: grouped ? "2px 16px" : "10px 16px 2px",
        background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 0.1s",
        position: "relative",
        zIndex: (showHotbar || showCustomPicker || isHotbarEditing) ? 100 : 1,
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isOwn ? "row-reverse" : "row",
          gap: 10,
          alignItems: "flex-end",
          width: "100%",
          transition: isSwiping ? "none" : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          transform: `translate3d(${swipeOffset}px, 0, 0)`,
          willChange: "transform",
        }}
      >
        {/* Swipe Reply Icon Indicator */}
        {Math.abs(swipeOffset) > 10 && (
          <div style={{
            position: "absolute",
            [swipeOffset > 0 ? "left" : "right"]: -35,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: Math.min(Math.abs(swipeOffset) / 50, 1),
            color: "var(--accent)",
            transition: "opacity 0.1s",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: swipeOffset > 0 ? "scaleX(1)" : "scaleX(-1)" }}>
              <polyline points="9 17 4 12 9 7"></polyline>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
          </div>
        )}

        {/* Avatar */}
        <div style={{ width: 32, flexShrink: 0 }}>
          {!grouped ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: message.authorImageUrl ? "transparent" : (isOwn ? "var(--accent)" : stringToColor(message.authorEmail)),
                backgroundImage: message.authorImageUrl ? `url(${message.authorImageUrl})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {!message.authorImageUrl && getInitial(message.authorEmail)}
            </div>
          ) : (
            <span
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                display: "block",
                textAlign: isOwn ? "left" : "right",
                paddingBottom: 4,
                lineHeight: 1,
                opacity: hovered ? 1 : 0,
                transition: "opacity 0.1s",
              }}
            >
              {formatTime(message._creationTime)}
            </span>
          )}
        </div>

        {/* Bubble */}
        <div
          className="message-bubble-wrapper"
          ref={bubbleWrapperRef}
          style={{
            alignItems: isOwn ? "flex-end" : "flex-start",
            flex: isEditing ? 1 : "initial",
            position: "relative",
            maxWidth: "80%",
          }}
        >
          {/* Mobile-only hotbar with backdrop */}
          {showHotbar && isMobile && (
            <>
              <div 
                style={{ position: "fixed", inset: 0, zIndex: 1000, background: "transparent" }} 
                onClick={(e) => { e.stopPropagation(); setShowHotbar(false); }} 
              />
              <div 
                style={{ 
                  position: "absolute", 
                  zIndex: 1001,
                  [hotbarPosition === "above" ? "bottom" : "top"]: "calc(100% + 4px)",
                  [isOwn ? "right" : "left"]: 0,
                }}
              >
                <EmojiHotbar 
                  currentHotbar={hotbar}
                  onEditingChange={setIsHotbarEditing}
                  onSelect={(emoji) => {
                    void toggleReaction({ messageId: message._id, emoji });
                    setShowHotbar(false);
                  }}
                  onCustomOpen={() => {
                    setShowCustomPicker(true);
                    setShowHotbar(false);
                  }}
                  onHotbarChange={(newHotbar) => void updateHotbar({ hotbar: newHotbar })}
                />
              </div>
            </>
          )}

          {/* Reply/Edit/Delete Actions (Desktop) */}
          {((!isMobile && hovered) || (!isMobile && showHotbar) || showCustomPicker || isHotbarEditing) && !isEditing && (
            <div
              style={{
                position: "absolute",
                top: 0,
                [isOwn ? "right" : "left"]: "calc(100% + 4px)",
                display: "flex",
                flexDirection: isOwn ? "row" : "row-reverse",
                alignItems: "center",
                gap: 4,
                zIndex: 20,
              }}
            >
              {!isMobile && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: isOwn ? "row" : "row-reverse",
                    gap: 4,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    padding: 2,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <button
                    onClick={() => setShowHotbar(!showHotbar)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: showHotbar ? "var(--accent)" : "var(--text-muted)",
                      display: "flex",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => !showHotbar && (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={(e) => !showHotbar && (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                      <line x1="9" y1="9" x2="9.01" y2="9"></line>
                      <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                  </button>
                  <button
                    onClick={onReply}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: "var(--text-muted)",
                      display: "flex",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 17 4 12 9 7"></polyline>
                      <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                    </svg>
                  </button>
                  {isOwn && (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 4,
                          color: "var(--text-muted)",
                          display: "flex",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={handleDelete}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 4,
                          color: "var(--text-muted)",
                          display: "flex",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {showHotbar && !isMobile && (
                <div style={{ position: "absolute", top: -40, [isOwn ? "right" : "left"]: 0 }}>
                  <EmojiHotbar 
                    currentHotbar={hotbar}
                    onEditingChange={setIsHotbarEditing}
                    onSelect={(emoji) => {
                      void toggleReaction({ messageId: message._id, emoji });
                      setShowHotbar(false);
                    }}
                    onCustomOpen={() => {
                      setShowCustomPicker(true);
                      setShowHotbar(false);
                    }}
                    onHotbarChange={(newHotbar) => void updateHotbar({ hotbar: newHotbar })}
                  />
                </div>
              )}
            </div>
          )}

        {showCustomPicker && typeof document !== "undefined" && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
            <div onClick={() => setShowCustomPicker(false)} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "relative", zIndex: 1001 }}>
              <EmojiPicker 
                theme={Theme.DARK} 
                onEmojiClick={(emojiObj) => {
                  void toggleReaction({ messageId: message._id, emoji: emojiObj.emoji });
                  setShowCustomPicker(false);
                }}
              />
            </div>
          </div>,
          document.body
        )}

        {!grouped && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              flexDirection: isOwn ? "row-reverse" : "row",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isOwn ? "var(--accent)" : "var(--text)",
                letterSpacing: "-0.01em",
              }}
            >
              {isOwn ? "You" : (message.authorName || getHandle(message.authorEmail))}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {formatTime(message._creationTime)}
            </span>
          </div>
        )}

        {/* Reply label */}
        {message.replyTo && (
          <div
            onClick={scrollToOriginal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--text)",
              marginBottom: -4,
              paddingBottom: 4,
              flexDirection: isOwn ? "row-reverse" : "row",
              background: "rgba(255,255,255,0.03)",
              padding: "4px 10px 8px",
              borderRadius: "12px 12px 0 0",
              border: "1px solid var(--border-strong)",
              borderBottom: "none",
              width: "fit-content",
              position: "relative",
              zIndex: 0,
              cursor: "pointer",
            }}
            className="hover-scale"
            title="Jump to message"
          >
            <svg 
              width="13" 
              height="13" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="var(--accent)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ transform: isOwn ? "scaleX(-1)" : "none", opacity: 0.9 }}
            >
              <polyline points="9 17 4 12 9 7"></polyline>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
            <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Replying to</span>
              <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>{getHandle(message.replyTo.authorEmail)}</span>
              {message.replyTo.content && (
                <span style={{ 
                  opacity: 0.6, 
                  fontStyle: "italic",
                  maxWidth: isMobile ? 120 : 200,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-block",
                  fontSize: 11,
                  marginLeft: 2
                  }}>
                  &ldquo;{message.replyTo.content}&rdquo;
                  </span>              )}
            </span>
          </div>
        )}
        
        {message.imageUrl && !isEditing && (
          <>
            <img 
              src={message.imageUrl} 
              alt="Attachment" 
              onClick={() => setIsImageModalOpen(true)}
              style={{ 
                maxWidth: 280, 
                maxHeight: 320, 
                borderRadius: 12,
                objectFit: "cover",
                cursor: "pointer",
                border: "1px solid var(--border-strong)",
                marginBottom: message.content ? 4 : 0,
              }} 
            />
            {isImageModalOpen && typeof document !== "undefined" && createPortal(
              <div 
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.85)",
                  zIndex: 100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  backdropFilter: "blur(5px)",
                  cursor: "zoom-out",
                }}
                onClick={() => setIsImageModalOpen(false)}
              >
                <img 
                  src={message.imageUrl} 
                  alt="Attachment expanded" 
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "100%", 
                    objectFit: "contain",
                    borderRadius: 8,
                    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                  }} 
                />
              </div>,
              document.body
            )}
          </>
        )}

        {isEditing ? (
          <div style={{ width: "100%", marginTop: 4 }}>
            <textarea
              ref={editInputRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleUpdate();
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditContent(message.content || "");
                }
              }}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--accent)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "var(--text)",
                fontSize: 14,
                lineHeight: 1.55,
                outline: "none",
                resize: "none",
                minHeight: 44,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11 }}>
              <span style={{ color: "var(--text-dim)" }}>
                escape to <button onClick={() => { setIsEditing(false); setEditContent(message.content || ""); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "inherit" }}>cancel</button>
              </span>
              <span style={{ color: "var(--text-dim)" }}>•</span>
              <span style={{ color: "var(--text-dim)" }}>
                enter to <button onClick={handleUpdate} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "inherit" }}>save</button>
              </span>
            </div>
          </div>
        ) : message.content && (
          <div
            style={{
              background: isOwn ? "var(--accent)" : "var(--surface)",
              border: isOwn ? "none" : "1px solid var(--border-strong)",
              borderRadius: isOwn
                ? grouped ? "14px 14px 4px 14px" : "14px 4px 14px 14px"
                : grouped ? "14px 14px 14px 4px" : "4px 14px 14px 4px",
              padding: "8px 12px",
              boxShadow: isOwn ? "0 2px 8px var(--accent-glow)" : "none",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: isOwn ? "#fff" : "var(--text)",
                lineHeight: 1.55,
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {renderContent(message.content, false)}
            </p>
          </div>
        )}
        
        {isOwn && readBy.length > 0 && !isEditing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              color: "var(--text-muted)",
              fontSize: 10.5,
              opacity: hovered ? 1 : 0.75,
              transition: "opacity 0.15s",
              fontWeight: 500,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Seen by {readBy.join(", ")}</span>
          </div>
        )}

        <Reactions 
          reactions={message.reactions || []} 
          onToggle={(emoji) => void toggleReaction({ messageId: message._id, emoji })}
          viewerId={viewerId}
          isOwn={isOwn}
        />
      </div>
    </div>
  </div>
);
}

// ─── Supporting Components ────────────────────────────────────────────────────

function ChannelEmpty({ name }: { name: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "var(--accent)",
          fontWeight: 200,
        }}
      >
        #
      </div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text)",
          margin: 0,
        }}
      >
        Welcome to #{name}
      </p>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          margin: 0,
          textAlign: "center",
          maxWidth: 260,
          lineHeight: 1.6,
        }}
      >
        This is the start of #{name}. Send a message to get the conversation
        going.
      </p>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div
      style={{
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {[140, 200, 160].map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            className="skeleton"
            style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}
          />
          <div
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div className="skeleton" style={{ height: 11, width: 90 }} />
            <div className="skeleton" style={{ height: 11, width: w }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="channel-header">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        Select a channel to start chatting
      </div>
    </div>
  );
}
