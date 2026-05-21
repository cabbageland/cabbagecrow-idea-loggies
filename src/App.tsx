import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import PetDashboard from "./pet/PetDashboard";
import PetSprite from "./pet/PetSprite";

function getPreviewView(): "pet" | "dashboard" {
  return new URLSearchParams(window.location.search).get("view") === "dashboard"
    ? "dashboard"
    : "pet";
}

export default function App() {
  const [view, setView] = useState<"pet" | "dashboard">(getPreviewView);

  useEffect(() => {
    if ("__TAURI_INTERNALS__" in window) {
      setView(getCurrentWindow().label === "dashboard" ? "dashboard" : "pet");
    }
  }, []);

  return view === "dashboard" ? (
    <PetDashboard />
  ) : (
    <main className="pet-stage" aria-label="CabbageCrow desktop pet">
      <PetSprite />
    </main>
  );
}
