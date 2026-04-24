import { useEffect, useState } from "react";
import { Joyride, STATUS, type Step } from "react-joyride";

const STEPS: Step[] = [
  { target: "body", placement: "center", content: "Welcome to Gesture Whiteboard! Let me show you around in 30 seconds." },
  { target: "[data-tour='toolbar']", content: "Pick your tool here — pen, shapes, text, eraser. Tap a colour, drag the slider for size." },
  { target: "[data-tour='camera']", content: "Tap the camera icon to enable hand tracking. Point your index finger to draw, open hand to erase, fist to pan, pinch to select." },
  { target: "[data-tour='export']", content: "Export your board as PNG, JSON, or copy a public share link when you're signed in." },
  { target: "[data-tour='settings']", content: "Remap any gesture, tweak smoothing, and tune Smart Ink in Settings." },
];

export function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboarding_done");
    if (!done) setTimeout(() => setRun(true), 600);
  }, []);

  function cb(d: { status: string }) {
    const finished = ([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(d.status);
    if (finished) { localStorage.setItem("onboarding_done", "1"); setRun(false); }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={cb}
      styles={{
        options: {
          primaryColor: "hsl(265 89% 70%)",
          backgroundColor: "hsl(230 24% 10%)",
          arrowColor: "hsl(230 24% 10%)",
          textColor: "hsl(210 40% 98%)",
          overlayColor: "hsla(230, 50%, 2%, 0.7)",
          zIndex: 100,
        },
      }}
    />
  );
}
