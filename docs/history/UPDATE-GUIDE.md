> Historical notes from an earlier edition. Use START-HERE.md, PROJECT-MAP.md and PRESENTATION-GUIDE.md in the project root for the current build.

> Latest update: see FLOOR-GALLERY-GUIDE.md for the new UMSKAL Discover layout. This guide describes the retained Tabletop features.

# Tabletop AR update

This copy is based on your latest uploaded Labuan-Ar.zip. Your original ZIP and XAMPP project were not changed.

## What changed

1. **Full-screen AR camera.** The camera fills the browser viewport, including in landscape. Start AR also requests the browser's full-screen mode where supported. Home, language and view controls float over the camera. Tap **Explore & listen** to open the scrollable controls panel; **Hide controls** returns to the clear camera view. The 3D preview keeps its separate viewer layout.
2. **Automatic narration.** UMSKAL narration starts after the reveal finishes, in the selected language, in both AR and 3D preview. It is attempted once per location/language each session. A brief loss and reacquisition of a marker does not restart it. Narration pauses on marker loss, changing location, opening a story/info card or leaving the page. Use Play/Resume narration to continue. If the browser blocks automatic sound, a visible **Play narration** button appears over the camera. Replay reveal does not restart the recording.
3. **Tabletop placement.** The model stands perpendicular to the printed marker, with its base on the marker plane. Rotating and zooming keep that base anchored. The reveal grows upward from the map. The live camera position comes from marker tracking; do not manually move the AR camera in code.
4. **Story video slot for every location.** Story contains a video area. Empty slots show “Video coming soon.” Direct MP4/WebM/OGG files use a player; YouTube and Vimeo links use an embedded player after a tap. An Open video link is also available. Videos do not autoplay over narration. Closing the story, hiding the AR panel, changing location or leaving the page stops the video.
5. **Four models in the preview.** UMSKAL, Clock Tower, Surrender Point and LISC are selectable. New locations have three visual discoveries, short model tours and a challenge. Preview models load on selection. LISC uses the default “Labuan | Sea Sport Complex” scene from your supplied file. The loader now preserves repeated mesh instances.

UMSKAL still has its 13 approximate floor bands and explicitly labelled sample floor information. New location text describes model features; historical content can be refined when we work through each location.

## One file to edit your media

Open **coding/media-config.js**. Each location has its own block:

- `umslic` = UMSKAL (the existing internal name is retained for saved progress)
- `labuanclocktower` = Clock Tower
- `surrenderpoint` = Surrender Point
- `lisc` = LISC

### Narration

Put recordings in `assets/audio/`, then fill the English and Malay slots:

```js
audio: {
  en: './assets/audio/surrender-en.mp3',
  ms: './assets/audio/surrender-ms.mp3'
},
```

Leave a language as `''` until its recording is ready. The narration button will show as unavailable for that language. UMSKAL's existing recordings are already connected. New floor descriptions are not synchronized with the original long UMSKAL recording.

### Story videos

Paste your actual URL inside the quotes for each language:

```js
storyVideo: {
  en: 'https://your-domain.example/videos/story-en.mp4',
  ms: ''
},
```

Replace the example with your own URL. A normal YouTube watch/share URL or Vimeo video URL also works. Direct video URLs must return playable video, not a file-sharing preview page. On a published HTTPS site, use HTTPS URLs. The video owner must allow playback/embedding; private or restricted links may require the Open video option. No external video has been chosen or uploaded for you.

### Markers for the new locations

Surrender Point and LISC currently work in **3D preview only**, as agreed. Their AR marker slots are empty, so they do not interfere with UMSKAL/Clock Tower tracking.

1. Choose a distinct marker image for each location.
2. Compile each image separately into a single-image MindAR `.mind` file using a compatible v2 compiler.
3. Put each `.mind` file and its matching image in `assets/targets/`.
4. Fill both paths for the location:

```js
marker: './assets/targets/surrenderpoint.mind',
image: './assets/targets/surrenderpoint.png',
```

The application automatically includes configured markers and assigns them to the correct model. Changing the image path alone does not compile a marker. Do not reuse another location's `.mind` file or put multiple targets inside one slot. Print the exact image used for compilation without cropping or stretching it.

### Tabletop size and facing direction

```js
tabletop: { size: .9, yawDegrees: 0 }
```

`size` sets the largest model dimension relative to marker width. Lower values make the model smaller. `yawDegrees` turns the building on the map: try 90, 180 or -90 if you need its front facing another edge. The separate 90-degree tabletop tilt is already handled by the application; do not add it to the model file. The app detects the printed marker, not the table surface itself.

## Presentation setup

1. Serve this folder using XAMPP on your computer, or publish its contents to your static host. `index.html` must be at the website root. Keep `coding`, `libs` and `assets` alongside it.
2. Open the published **HTTPS** address on the presentation phone. A plain HTTP LAN address generally cannot request the camera; desktop localhost is suitable for development.
3. Make your QR code point to that website address. The QR code opens the site; the separate image marker triggers the model.
4. Place the printed map flat on the table with each complete marker visible. Avoid glossy reflections, folds and objects covering the image.
5. Start AR, allow the rear camera, and begin with the complete marker in view. Then move the phone to an angle above the table to see the building stand up. Keep the marker visible while moving.
6. Check sound and phone volume. If Play narration appears, tap it once. Use Explore & listen for Story, Discover, Challenge and Info.

Browsers that do not offer native full-screen still receive the full browser viewport layout; their browser/OS bars may remain visible. No website can override every device's browser controls or autoplay policy.

## Verification

Browser checks cover all four models, discovery mesh matches, the 13-floor picker, media placeholders and supported URL formats, automatic narration and blocked-playback recovery, actual MindAR recognition using simulated camera images, full-viewport sizing with open/closed panels, and camera cleanup. A real phone and the final printed map still need a presentation rehearsal, including tracking at an angle, sound, glare, zoom and screen rotation. External video hosting cannot be tested until you add your URLs.
