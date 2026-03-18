"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Cropper from "react-easy-crop";
import imageCompression from "browser-image-compression";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHandle(email: string) {
  return email.split("@")[0];
}

function getInitial(email: string) {
  return email ? email[0].toUpperCase() : "?";
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

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<File | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg");
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useQuery(api.users.me);
  const updateProfile = useMutation(api.users.update);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !name) {
      setName(user.name || getHandle(user.email || ""));
    }
  }, [user, name]);

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const saveCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedFile) {
        setImageFile(croppedFile);
      }
      setIsCropping(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let imageId = undefined;
      if (imageFile) {
        const compressedFile = await imageCompression(imageFile, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });

        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        });
        
        if (!result.ok) throw new Error("Upload failed");
        const { storageId } = await result.json();
        imageId = storageId;
      }

      await updateProfile({
        name: name.trim() || undefined,
        image: imageId,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
          animation: "fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>Profile Settings</h1>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 8,
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: user.imageUrl || imageFile ? "transparent" : stringToColor(user.email || ""),
                backgroundImage: imageFile 
                  ? `url(${URL.createObjectURL(imageFile)})` 
                  : user.imageUrl 
                  ? `url(${user.imageUrl})` 
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 700,
                color: "#fff",
                border: "4px solid var(--surface-2)",
                boxShadow: "0 0 20px var(--accent-glow)",
                overflow: "hidden",
              }}
            >
              {!user.imageUrl && !imageFile && getInitial(user.email || "")}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--accent)",
                border: "4px solid var(--surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          <div style={{ width: "100%" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "var(--text)",
                fontSize: 16,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
            />
          </div>

          <div style={{ width: "100%" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Email Address
            </label>
            <input
              value={user.email}
              readOnly
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "var(--text-muted)",
                fontSize: 16,
                cursor: "not-allowed",
              }}
            />
          </div>

          <div style={{ height: 16 }} />

          <div style={{ display: "flex", width: "100%", gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                color: "var(--text)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (!name.trim() && !imageFile)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                background: "var(--accent)",
                border: "none",
                color: "#fff",
                fontWeight: 600,
                cursor: (isSaving || (!name.trim() && !imageFile)) ? "default" : "pointer",
                transition: "all 0.2s",
                opacity: (isSaving || (!name.trim() && !imageFile)) ? 0.6 : 1,
                boxShadow: (isSaving || (!name.trim() && !imageFile)) ? "none" : "0 4px 12px var(--accent-glow)",
              }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {isCropping && imageSrc && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(0,0,0,0.9)", 
            zIndex: 3000, 
            display: "flex", 
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div style={{ padding: 24, background: "var(--surface)", borderTop: "1px solid var(--border-strong)", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div style={{ width: "100%", maxWidth: 400 }}>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setIsCropping(false)}
                style={{ padding: "8px 24px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={saveCroppedImage}
                style={{ padding: "8px 24px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer" }}
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
