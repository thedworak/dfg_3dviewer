# Live link

The scene stays connected: to the manifest it comes from, to the file of its
model, and to other viewers that show it. What changes at the other end
changes on screen, and the page is not loaded again.

**File > Live link** opens the window with the three of them. (A fourth,
[live data](live-data.md), connects the model to a table.)

## A shared session

Everyone who opens a session's link sees one scene. Whoever moves the camera
moves it for all - and switches its projection (perspective or orthographic)
for all; the same goes for the year on the 4D timeline, the section planes,
the reconstruction variant, the lights (moved, coloured, added, removed), the
raking light, the sun, the weather, the edited materials, the shading, the
measurements placed, the ground, the background, the environment map, the
rendering (tone mapping, exposure, ambient occlusion) and the live data's
settings. A phone becomes the remote control
of a screen: open the link on both and turn the model on the phone.

- **Start a session** makes the link (`…?session=<id>`). Copy it, send it, or
  open it on another device.
- A viewer that joins takes the session's view. If the others show another
  model or manifest (one that has a URL), it opens that one first.
- **The others see what I do** and **I see what the others do** switch the
  two directions. With the first off you only watch; with the second off
  you only lead.
- Everyone can lead. When two people move at once, the last one wins.

Not shared: comments and their Level of Certainty, the generated
surroundings, historical photos, the scene's sounds and cameras, a 2D
image's and a sound file's tools, a point cloud's and a volume's settings,
and what belongs to each viewer (its language, its theme, its toolbars,
which windows are open). A measurement is shared once it is finished, not
while its points are being placed. Neither is a model opened from a file on
the device shared (it has no address the others could open).

A part of the state too large to send with every change (a table kept as
rows, hundreds of measurements: more than 24 kB) stays out; the others keep
theirs.

The states travel through the worker (`worker/live_sessions.py`,
[`worker/README.md`](../worker/README.md)): each viewer posts its state to
`/api/live/<id>` and waits there for the next one, which arrives as soon as
someone posts. Nothing is stored; a session is forgotten two hours after its
last use. The id is the session's key - whoever has the link can join and
lead - so it is 14 random characters. A state holds numbers and settings
only, and a viewer applies it through the same checks as a manifest.

Without a worker (a static copy of the viewer) the link still works between
the tabs and windows of one browser; the window says so.

## The manifest, followed

The viewer reads the manifest again, and applies only what differs from the
version before: a light, the weather, a year, a section, a comment. The
camera flies to its new place instead of jumping. The model is not loaded
again - unless the new version names another model, which is then opened as
usual.

- **Follow the manifest**: a manifest opened by URL is read again every 1, 2,
  5 or 15 seconds. Not read while the page is in a background tab.
- **Open a manifest file…**: in Chrome and Edge the file stays connected
  (File System Access API): saved in an editor, it is applied within a
  second. Other browsers read it once.
- **The scene's settings**: the manifest's `AIM3DViewer` block as text
  ([schema](../viewer/manifesto/AIM3DViewer-schema.md)), in the window. What
  is typed there is applied as it is typed, as soon as it is valid JSON; the
  window names the blocks that changed, or says why nothing was applied.
  Without a manifest the scene as it stands is written out, so any scene can
  be edited this way.

Opening another scene by hand ends the following.

## The model's file, followed

For whoever builds the model: the viewer stays open beside the modelling
program. Each time the file is saved, the new model takes the old one's
place. The old view is held over the canvas and fades into the new one, and
the scene around the model is kept: the camera, the comments, the section,
the lights, the weather, the live data.

- **Follow the model's file**: a model opened by URL is asked every few
  seconds whether it changed (its `ETag`, date or size, by a `HEAD` request).
- **Open a model file…**: a file from the device, watched for being saved
  (Chrome and Edge; other browsers read it once).

Comments sit on parts of the model by their place in its hierarchy. They
stay where they were while the model keeps its structure; after objects are
added or removed in front of them they may point at a neighbour.

## From a page

```js
await Viewer.startLiveSession();          // -> the session's id
Viewer.getLiveLink().session.link;        // the link to hand on
Viewer.setLiveSessionOptions({ send: false });
Viewer.leaveLiveSession();

Viewer.followLiveManifest({ interval: 2 });
await Viewer.applyLiveManifest(manifest); // a newer version, from anywhere
Viewer.followLiveModel({ interval: 2 });
```

The code is `viewer/editor/live-link.js` and `viewer/live-link-rules.js`
(what changed between two manifests, a session's ids and cameras; no DOM);
see [`viewer/FUNCTIONS.md`](../viewer/FUNCTIONS.md).
