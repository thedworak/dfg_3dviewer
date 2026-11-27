# Live link

The scene stays connected: to the manifest it comes from, to the file of its
model, and to other viewers that show it. What changes at the other end
changes on screen, and the page is not loaded again.

**File > Live link** opens the window with the three of them. (A fourth,
[live data](live-data.md), connects the model to a table.)

## Cooperation mode

The window calls it **Cooperation mode**: a shared session.

Everyone who opens a session's link sees one scene. Whoever moves the camera
moves it for all - and switches its projection (perspective or orthographic)
for all. The same goes for:

- the year on the 4D timeline, the section planes, the reconstruction
  variant and the comparison;
- the lights (moved, coloured, added, removed), the raking light, the sun,
  the weather, the generated surroundings;
- the edited materials, the shading, the ground, the background, the
  environment map and the rendering (tone mapping, exposure, ambient
  occlusion);
- the comments with their Level of Certainty, and the Level of Certainty
  view; the measurements placed; the scene's cameras;
- the historical photos and the one held over the view, the scene's sounds,
  the live data's settings;
- the tools of what is not a mesh: a 2D image's filters and which image of
  a set is shown, a sound file's view and playback settings, a point
  cloud's points (size, shape, colours, classes hidden), a volume's
  rendering (stack, mode, channels).

A phone becomes the remote control of a screen: open the link on both and
turn the model on the phone.

- **Start a session** makes the link (`…?session=<id>`). Copy it, send it, or
  open it on another device.
- **A nickname** comes first: the name the others see in the list of who
  is there. Signed in, it is the account's name (it can be changed for the
  session). The browser keeps the one used last, so a link opened again
  joins at once; a link opened with no name known asks for one. Two people
  under one name are told apart: the later one is "Anna (2)".
- A session's link skips the intro (`?intro=1` still shows it) and the
  hint with the hand: the scene comes as the others show it. Neither does
  the model's fly-in after loading take back the view the others gave.
- A viewer that joins takes the session's view. If the others show another
  model or manifest (one that has a URL), it opens that one first.
- **The others see what I do** and **I see what the others do** switch the
  two directions. With the first off you only watch; with the second off
  you only lead.
- Everyone can lead. When two people move at once, the last one wins.

### Who is in

The window counts who is active in the session and names them. Whoever
started the session is its **host** (signed in: the account, on any device;
otherwise this browser, which keeps the session's key). The host:

- chooses whether new people come in at once (**Let new people in at
  once**, the default) or wait in the list until they are let in (**Let
  in**) or not (**Refuse**). Switched back on, those waiting come in.
- can let someone go (**Remove**): they are out and cannot come back with
  that viewer. If new people came in at once, from then on they wait to be
  let in: otherwise the one removed would come straight back.
- makes it a **presentation** (**Only I lead**): the others watch - what
  they do stays with them - and the host can let someone lead too (**Let
  lead**) or not any more.
- asks for a **passcode** at the door (4 to 64 characters, handed on apart
  from the link; **No passcode** takes it away). Who is already in is not
  asked again. Wrong passcodes are limited per address.
- **closes the session**: nobody new comes in and nothing is shared; those
  in it stay and see that it is closed. **Resume the session** goes on
  where it stopped.

Someone waiting is announced to the host also with the window closed: a
notice, and their number on the toolbar's Live link button. The window
also names who leads - who moved the scene last, for a few seconds.

### My sessions

Signed in, the window lists the sessions you started (the last 100): when,
how long it went on, whether open or closed (a presentation, a passcode),
how many are active now, how many took part and how many were in at once.
Each can be closed, resumed, joined again, renamed or removed from the list
(whoever is in it stays; it is no longer yours) - also after the worker
started again. The worker keeps for this only
the session's id, its title (the scene's name), dates, settings and counts,
never a state or a nickname.

Between the tabs of one browser (no worker) there is no host: everyone is
in, and the window lists them.

Not shared: what belongs to each viewer (its language, its theme, its
toolbars, which windows are open), whether a sound plays, and what is still
being made - a measurement while its points are placed, a comment while it
is written. A model, a photo or a sound opened from a file on the device is
not shared either: it has no address the others could open.

A part of the state too large to send with every change (a table kept as
rows, hundreds of measurements or comments: more than 24 kB) stays out; the others keep
theirs.

The states travel through the worker (`worker/live_sessions.py`,
[`worker/README.md`](../worker/README.md)): each viewer posts its state to
`/api/live/<id>` and waits there for the next one, which arrives as soon as
someone posts. The states are not stored; a session is forgotten two hours
after its last use (a signed-in host's session is kept in their history,
see above). The id is the session's key - whoever has the link can join and
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
await Viewer.startLiveSession(undefined, { nick: "Anna" }); // -> the session's id
Viewer.getLiveLink().session.members;     // [{ id, nick, status, host }]
await Viewer.manageLiveSession("approval", { approval: "manual" }); // the host's
await Viewer.manageLiveSession("approve", { target: id });
await Viewer.manageLiveSession("close");  // "reopen" resumes it
await Viewer.manageLiveSession("lead", { value: "host" });     // a presentation
await Viewer.manageLiveSession("grant", { target: id, value: true });
await Viewer.manageLiveSession("passcode", { value: "4711" }); // "" takes it away
await Viewer.startLiveSession(id, { nick: "Bea", passcode: "4711" });
await Viewer.loadLiveSessionHistory();    // a signed-in host's sessions
Viewer.getLiveLink().session.link;        // the link to hand on
Viewer.setLiveSessionOptions({ send: false });
Viewer.leaveLiveSession();

Viewer.followLiveManifest({ interval: 2 });
await Viewer.applyLiveManifest(manifest); // a newer version, from anywhere
Viewer.followLiveModel({ interval: 2 });
```

The code is `viewer/editor/live-link.js`, `viewer/editor/live-session-people.js` (the people) and `viewer/live-link-rules.js`
(what changed between two manifests, a session's ids and cameras; no DOM);
see [`viewer/FUNCTIONS.md`](../viewer/FUNCTIONS.md).
