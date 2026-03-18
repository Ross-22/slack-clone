"use client";

import EmojiPicker, { Theme } from "emoji-picker-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useRef,
  FormEvent,
  KeyboardEvent,
} from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHandle(email: string) {
  return email.split("@")[0];
}

function getInitial(email: string) {
  return email[0].toUpperCase();
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shouldGroup(
  prev: Doc<"messages"> | undefined,
  curr: Doc<"messages">
) {
  if (!prev) return false;
  if (prev.userId !== curr.userId) return false;
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
  const [selectedChannelId, setSelectedChannelId] =
    useState<Id<"channels"> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const channels = useQuery(api.channels.list);
  const seedChannels = useMutation(api.channels.seed);

  useEffect(() => {
    if (channels !== undefined && channels.length === 0) {
      void seedChannels({});
    }
  }, [channels, seedChannels]);

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0]._id);
    }
  }, [channels, selectedChannelId]);

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
      <Sidebar
        channels={channels ?? []}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(id) => {
          setSelectedChannelId(id);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
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
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  isOpen,
}: {
  channels: Doc<"channels">[];
  selectedChannelId: Id<"channels"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
  isOpen: boolean;
}) {
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const createChannel = useMutation(api.channels.create);
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
            onClick={() => onSelectChannel(ch._id)}
          />
        ))}
      </div>

      <UserFooter
        onSignOut={() =>
          void signOut().then(() => router.push("/signin"))
        }
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
  onClick,
}: {
  channel: Doc<"channels">;
  active: boolean;
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
          color: active ? "var(--text)" : hovered ? "var(--text)" : "var(--text-muted)",
          fontWeight: active ? 500 : 400,
          transition: "color 0.12s",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {channel.name}
      </span>
    </button>
  );
}

// ─── User Footer ─────────────────────────────────────────────────────────────

function UserFooter({ onSignOut }: { onSignOut: () => void }) {
  const data = useQuery(api.myFunctions.listNumbers, { count: 1 });
  const email = data?.viewer ?? "";

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
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: email ? stringToColor(email) : "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {email ? getInitial(email) : "·"}
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
        style={{
          flex: 1,
          fontSize: 12,
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {email ? getHandle(email) : "…"}
      </span>
      <SignOutIcon onClick={onSignOut} />
    </div>
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
  const viewer = useQuery(api.myFunctions.listNumbers, { count: 1 })?.viewer ?? null;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Reset input when switching channels
  useEffect(() => {
    setInput("");
  }, [channel._id]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    try {
      await sendMessage({ channelId: channel._id, content });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canSend = input.trim().length > 0 && !sending;

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
          messages.map((msg, i) => (
            <MessageItem
              key={msg._id}
              message={msg}
              grouped={shouldGroup(messages[i - 1], msg)}
              isOwn={viewer !== null && msg.authorEmail === viewer}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 14px", flexShrink: 0 }}>
        <MessageInput
          input={input}
          setInput={setInput}
          canSend={canSend}
          onSend={() => void handleSend()}
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
  canSend,
  onSend,
  onKeyDown,
  textareaRef,
  placeholder,
}: {
  input: string;
  setInput: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [emojiHovered, setEmojiHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiClick = (emojiObj: { emoji: string }) => {
    setInput((prev) => prev + emojiObj.emoji);
    textareaRef.current?.focus();
  };

  return (
    <>
      <div style={{ position: "relative" }}>
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
        <div
          style={{
            background: "var(--surface)",
            border: `1px solid ${focused ? "rgba(122,110,245,0.4)" : "var(--border-strong)"}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: "10px 10px 10px 14px",
            transition: "border-color 0.2s",
          }}
        >
          <textarea
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
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            resize: "none",
            color: "var(--text)",
            fontSize: 14,
            fontFamily: "inherit",
            lineHeight: 1.55,
            maxHeight: 120,
            overflow: "auto",
            paddingTop: 1,
          }}
        />
          <button
            onClick={() => setShowEmojiPicker((prev) => !prev)}
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
          onClick={onSend}
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

function MessageItem({
  message,
  grouped,
  isOwn,
}: {
  message: Doc<"messages">;
  grouped: boolean;
  isOwn: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="msg-enter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: isOwn ? "row-reverse" : "row",
        gap: 10,
        padding: grouped ? "2px 16px" : "10px 16px 2px",
        background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 0.1s",
        alignItems: "flex-end",
      }}
    >
      {/* Avatar */}
      <div style={{ width: 32, flexShrink: 0 }}>
        {!grouped ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: isOwn ? "var(--accent)" : stringToColor(message.authorEmail),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {getInitial(message.authorEmail)}
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
        style={{
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
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
              {isOwn ? "You" : getHandle(message.authorEmail)}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {formatTime(message._creationTime)}
            </span>
          </div>
        )}
        <div
          style={{
            background: isOwn ? "var(--accent)" : "var(--surface)",
            border: isOwn ? "none" : "1px solid var(--border-strong)",
            borderRadius: isOwn
              ? grouped ? "14px 14px 4px 14px" : "14px 4px 14px 14px"
              : grouped ? "14px 14px 14px 4px" : "4px 14px 14px 14px",
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
            {message.content}
          </p>
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
