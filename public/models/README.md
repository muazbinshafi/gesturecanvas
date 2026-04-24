# Offline MediaPipe model

For strict offline use on a Linux server, download the hand landmarker model
into this folder. Otherwise the app loads it from the public CDN automatically.

```bash
curl -L -o public/models/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```

The app checks `/models/hand_landmarker.task` first and falls back to the CDN
if the file is missing.
