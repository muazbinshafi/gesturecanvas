import { useEffect, useState } from "react";
import { Joyride, type Step } from "react-joyride";

const STEPS: Step[] = [
  { target: "body", placement: "center", content: "Welcome to Gesture Whiteboard! Let me show you around in 30 seconds." },
  { target: "[data-tour='toolbar']", content: "Pick your tool here — pen, shapes, text, eraser. Tap a colour, drag the slider for size." },
  { target: "[data-tour='camera']", content: "Tap the camera icon to enable hand tracking. Index finger = draw, open hand = erase, fist = pan, pinch = select." },
  { target: "[data-tour='export']", content: "Export your board as PNG, JSON, or copy a public share link when you're signed in." },
  { target: "[data-tour='settings']", content: "Remap any gesture, tweak smoothing, and tune Smart Ink in Settings." },
];

export function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboarding_done");
    if (!done) setTimeout(() => setRun(true), 600);
  }, []);

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      onEvent={(e) => {
        if (e.type === "tour:end") { localStorage.setItem("onboarding_done", "1"); setRun(false); }
      }}
    />
  );
}
