/**
 * GestureController — webcam → MediaPipe HandLandmarker → emits gesture events.
 *
 * Tries `/models/hand_landmarker.task` first (offline drop-in); falls back to CDN.
 * Runs detection in a requestAnimationFrame loop.
 */
import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyPose, PoseStabilizer } from "@/lib/gestures/poses";
import { Vec2Filter } from "@/lib/gestures/oneEuro";
import { toCanvas, type LM } from "@/lib/gestures/landmarks";
import type { Pose } from "@/lib/types";

export interface GestureFrame {
  pose: Pose;
  cursor: { x: number; y: number } | null;
  visible: boolean;
}

interface Props {
  width: number;
  height: number;
  enabled: boolean;
  mirror: boolean;
  smoothing: { minCutoff: number; beta: number };
  onFrame: (f: GestureFrame) => void;
  onToggle: (enabled: boolean) => void;
}

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_LOCAL = "/models/hand_landmarker.task";

export function GestureController({ width, height, enabled, mirror, smoothing, onFrame, onToggle }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const filterRef = useRef(new Vec2Filter(smoothing.minCutoff, smoothing.beta));
  const stabilizerRef = useRef(new PoseStabilizer(3));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const [fps, setFps] = useState(0);

  // Update filter params live
  useEffect(() => { filterRef.current.set(smoothing.minCutoff, smoothing.beta); }, [smoothing.minCutoff, smoothing.beta]);

  useEffect(() => {
    if (!enabled) { stop(); return; }
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        // Try local model first
        let modelPath = MODEL_LOCAL;
        try {
          const head = await fetch(MODEL_LOCAL, { method: "HEAD" });
          if (!head.ok) modelPath = MODEL_CDN;
        } catch { modelPath = MODEL_CDN; }

        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (cancelled) { lm.close(); return; }
        landmarkerRef.current = lm;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
        loop();
      } catch (e) {
        console.error("Gesture init failed", e);
        setErrMsg(e instanceof Error ? e.message : "Camera/model unavailable");
        setStatus("error");
        onToggle(false);
      }
    })();
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    onFrame({ pose: "NONE", cursor: null, visible: false });
  }

  function loop() {
    let last = performance.now();
    let frames = 0; let acc = 0;
    const step = () => {
      const lm = landmarkerRef.current;
      const video = videoRef.current;
      if (!lm || !video || video.readyState < 2) { rafRef.current = requestAnimationFrame(step); return; }
      const t = performance.now();
      const result = lm.detectForVideo(video, t);
      const preview = previewRef.current;
      if (preview) drawPreview(preview, video, result.landmarks?.[0] as LM[] | undefined);

      if (result.landmarks?.length) {
        const hand = result.landmarks[0] as LM[];
        const pose = stabilizerRef.current.push(classifyPose(hand));
        // Index fingertip is landmark 8 — our cursor anchor
        const tip = toCanvas(hand[8], width, height, mirror);
        const sm = filterRef.current.filter(tip.x, tip.y, t);
        onFrame({ pose, cursor: sm, visible: true });
      } else {
        stabilizerRef.current.push("NONE");
        onFrame({ pose: "NONE", cursor: null, visible: false });
      }

      frames++; acc += t - last; last = t;
      if (acc >= 500) { setFps(Math.round((frames * 1000) / acc)); frames = 0; acc = 0; }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  return (
    <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
      <div className="glass rounded-xl p-2 shadow-toolbar w-40 sm:w-48">
        <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={previewRef} width={192} height={144} className="w-full h-full" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
          {status === "loading" && <div className="absolute inset-0 flex items-center justify-center text-xs gap-1"><Loader2 className="w-3 h-3 animate-spin" />Loading…</div>}
          {status === "error" && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-destructive p-2 text-center">{errMsg || "Camera unavailable"}</div>}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground">{enabled ? `${fps} fps` : "Off"}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onToggle(!enabled)} aria-label="Toggle camera">
            {enabled ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function drawPreview(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks?: LM[]) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  ctx.fillStyle = "hsl(265 89% 70%)";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Connect fingers
  ctx.strokeStyle = "hsl(190 95% 60%)"; ctx.lineWidth = 1.2;
  const links: [number, number][] = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
    [13,17],[0,17],[17,18],[18,19],[19,20],
  ];
  for (const [a,b] of links) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height);
    ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height);
    ctx.stroke();
  }
}
