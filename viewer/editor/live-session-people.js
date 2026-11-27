import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { apiUrl, appRequestHeaders, hasRemote } from "../remote.js";
import { normalizeSessionNick } from "../live-link-rules.js";

// The people of a shared session (live-link.js): who comes in under which
// nickname, whom the host lets in, the session closed and opened again, and
// a signed-in host's sessions as they were (worker/live_sessions.py).
//
//   a nickname   asked for before a session is started or joined; signed in,
//                it is the account's name. Kept in this browser for the next
//                time.
//   the host     whoever started the session (signed in: the account, from
//                any device; else this browser, with the session's key). The
//                host lets new people in at once or one by one, can let
//                someone go, and closes the session or opens it again.
//   the history  a signed-in host's sessions: when, how many took part, how
//                many are there now; each closed, opened again or joined.
//   who leads    whoever sent the last state, named for a few seconds.
//   who knocks   the host hears of someone waiting also with the window
//                closed: a notice, and a count on the toolbar's button.
//   presentation the host can lead alone (and let others lead too); the
//                others watch.
//   passcode     the host can ask for one at the door; the link does not
//                carry it.

const NICK_KEY = "aim3d-live-nick";
// Who sent the last state leads for this long after it.
const LEADER_MS = 4000;
const HOST_KEY_PREFIX = "aim3d-live-host:";

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  },
  set(key, value) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {
      // A private window: remembered for this page only.
    }
  },
};

// How long a session went on: from its start to its last use.
const duration = (from, to) => {
  const minutes = Math.round(((Number(to) || 0) - (Number(from) || 0)) / 60);
  if (!(minutes >= 1)) return "";
  const hours = Math.floor(minutes / 60);
  return hours
    ? t("liveLink.history.durationHours", { hours, minutes: minutes % 60 }, "{hours} h {minutes} min")
    : t("liveLink.history.durationMinutes", { minutes }, "{minutes} min");
};

const dateTime = (seconds) => (Number.isFinite(seconds) && seconds > 0
  ? new Date(seconds * 1000).toLocaleString(core.currentLanguage || "en", { dateStyle: "medium", timeStyle: "short" })
  : "");

// The worker's answer: JSON, also for a refusal; an error with `refused`
// when the worker said no (not when there is none).
async function liveRequest(path, { body, signal } = {}) {
  const headers = appRequestHeaders();
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(apiUrl(path), {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: "no-store",
  });
  const json = /json/.test(response.headers.get("Content-Type") || "");
  const data = json ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.refused = Boolean(data?.error) && response.status !== 404 && response.status < 500;
    Object.assign(error, { rejoin: data?.rejoin, closed: data?.closed, rejected: data?.rejected, passcode: data?.passcode, wrong: data?.wrong, lead: data?.lead });
    throw error;
  }
  if (!data) throw new Error("no relay");
  return data;
}

export function attachLiveSessionPeople(Viewer) {
  Object.assign(Viewer, {
    // ---- the nickname ----

    // The name to come in under: the one given, the account's, the one
    // used last in this browser.
    liveSessionNick(given) {
      return normalizeSessionNick(given) || normalizeSessionNick(Viewer.authState?.user) || normalizeSessionNick(storage.get(NICK_KEY));
    },

    rememberLiveSessionNick(nick) {
      const value = normalizeSessionNick(nick);
      if (value && value !== normalizeSessionNick(Viewer.authState?.user)) storage.set(NICK_KEY, value);
    },

    // No nickname yet: the window asks for one (or, with no window, the
    // browser does).
    askLiveSessionNick(room) {
      const state = Viewer.getLiveLinkState();
      state.joining = room || null;
      Viewer.toggleLiveLinkPanel(true);
      if (state.ui) {
        state.sections.session = true;
        Viewer.renderLiveLinkPanel();
        requestAnimationFrame(() => state.ui?.nickInput?.focus());
        return;
      }
      const nick = normalizeSessionNick(window.prompt(t("liveLink.session.nickPrompt", "Your name in the session")));
      if (nick) Viewer.startLiveSession(room, { nick });
    },

    // ---- the worker ----

    // The key that makes this browser the host of `room` (kept in the
    // session too: another tab may have forgotten it).
    liveSessionHostKey(room) {
      const session = Viewer.liveLinkState?.session;
      return (session?.id === room && session.hostKey) || storage.get(HOST_KEY_PREFIX + room);
    },

    // Comes in (again) under the session's nickname. Throws `refused` when
    // the worker says no: closed, or not let in.
    async joinLiveSessionServer(session) {
      const state = Viewer.getLiveLinkState();
      const answer = await liveRequest(`/api/live/${session.id}/join`, {
        body: {
          client: state.client,
          nick: session.nick,
          passcode: session.passcode || undefined,
          hostKey: Viewer.liveSessionHostKey(session.id) || undefined,
          title: Viewer.liveSessionTitle?.() || undefined,
        },
        signal: session.abort.signal,
      });
      if (answer.hostKey) {
        session.hostKey = answer.hostKey;
        storage.set(HOST_KEY_PREFIX + session.id, answer.hostKey);
      }
      // A pending viewer starts from the beginning once let in; the worker
      // may have started again, with the people counted anew.
      session.version = 0;
      session.roster = -1;
      Viewer.applyLiveSessionPeople(session, answer);
      return answer;
    },

    // The scene's name, for the host's history.
    liveSessionTitle() {
      const manifest = Viewer.currentManifest;
      const label = manifest?.label || manifest?.title || manifest?.name;
      const text = typeof label === "string" ? label : label && typeof label === "object" ? Object.values(label).flat()[0] : "";
      if (text) return String(text);
      return String(Viewer.shownModelUrl || "").split(/[?#]/)[0].split("/").pop();
    },

    // What an answer says of the people: how many, who, the caller's own
    // place, closed or not. True when the window has something new to show.
    applyLiveSessionPeople(session, answer) {
      if (!session || !answer) return false;
      // An answer older than what is known (a long poll overtaken by a
      // host's change): its people are not the latest.
      if (typeof answer.roster === "number" && answer.roster < session.roster) return false;
      const look = () => JSON.stringify([session.peers, session.waiting, session.status, session.host, session.closed, session.approval, session.members, session.nick, session.lead, session.canLead, session.hasPasscode]);
      const before = look();
      // The worker may have made the name unique ("Anna (2)").
      if (typeof answer.nick === "string" && answer.nick) session.nick = answer.nick;
      if (typeof answer.peers === "number") session.peers = answer.peers;
      if (typeof answer.pending === "number") session.waiting = answer.pending;
      if (typeof answer.roster === "number") session.roster = answer.roster;
      if (typeof answer.status === "string") session.status = answer.status;
      if (typeof answer.host === "boolean") session.host = answer.host;
      if (typeof answer.you === "string") session.you = answer.you;
      if (typeof answer.closed === "boolean") session.closed = answer.closed;
      // A switch just made here holds until the worker answers it: a long
      // poll's answer on its way would set it back.
      if ((answer.approval === "auto" || answer.approval === "manual") && !session.approvalWanted) session.approval = answer.approval;
      if (Array.isArray(answer.members)) session.members = answer.members.filter((item) => item && typeof item.id === "string");
      else if (session.status !== "active") session.members = [];
      if ((answer.lead === "all" || answer.lead === "host") && !session.leadWanted) session.lead = answer.lead;
      if (typeof answer.canLead === "boolean") session.canLead = answer.canLead;
      if (typeof answer.passcode === "boolean") session.hasPasscode = answer.passcode;
      const changed = before !== look();
      if (changed) {
        Viewer.announceLiveSessionKnocks(session);
        Viewer.updateLiveSessionBadge();
      }
      if (session.status === "rejected") {
        Viewer.endLiveSession(t("liveLink.session.rejected", "The host did not let you in."));
        return true;
      }
      if (changed) Viewer.syncLiveLinkPanel();
      return changed;
    },

    // The host hears of each new one waiting, also with the window closed.
    announceLiveSessionKnocks(session) {
      session.announced ??= new Set();
      const waiting = session.host ? (session.members || []).filter((item) => item.status === "pending") : [];
      const fresh = waiting.filter((item) => !session.announced.has(item.id));
      session.announced = new Set(waiting.map((item) => item.id));
      if (!fresh.length || Viewer.isLiveLinkPanelOpen?.()) return;
      const message = fresh.length === 1
        ? t("liveLink.session.knock", { nick: fresh[0].nick }, "{nick} is waiting to be let into the session.")
        : t("liveLink.session.knocks", { count: fresh.length }, "{count} people are waiting to be let into the session.");
      Viewer.showStatusNotice?.(message, 6000);
    },

    // How many wait, on the toolbar's Live link button (the host's).
    updateLiveSessionBadge() {
      const button = Viewer.editorToolbarButtons?.liveLink;
      if (!button) return;
      const session = Viewer.liveLinkState?.session;
      const count = session?.host ? (session.members || []).filter((item) => item.status === "pending").length : 0;
      let badge = button.querySelector(".viewer-livelink-badge");
      if (!count) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "viewer-livelink-badge";
        button.appendChild(badge);
      }
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.title = t("liveLink.session.pendingCount", { count }, "waiting: {count}");
    },

    // Who sent the last state (their public id; this viewer's own when it
    // sends): named in the window while it is recent.
    noteLiveSessionLeader(session, id) {
      if (!session || !id) return;
      const now = Date.now();
      const changed = session.leader?.id !== id || now - session.leader.at > LEADER_MS;
      session.leader = { id, at: now };
      clearTimeout(session.leaderTimer);
      session.leaderTimer = setTimeout(() => Viewer.syncLiveLinkPanel(), LEADER_MS + 50);
      if (changed) Viewer.syncLiveLinkPanel();
    },

    liveSessionLeader(session) {
      if (!session?.leader || Date.now() - session.leader.at > LEADER_MS) return null;
      const member = (session.members || []).find((item) => item.id === session.leader.id);
      if (session.leader.id === session.you) return { id: session.you, nick: session.nick, you: true };
      return member ? { id: member.id, nick: member.nick, you: false } : null;
    },

    // The session ends here, with a word why.
    endLiveSession(notice) {
      const state = Viewer.getLiveLinkState();
      Viewer.leaveLiveSession();
      state.notice = notice || null;
      Viewer.renderLiveLinkPanel();
      Viewer.updateLiveSessionBadge();
    },

    // The host's say (the session shown, or - by `room` - one from the
    // history): "approve" / "reject" someone (`target`: their public id),
    // "close", "reopen", "approval" ("auto" or "manual"), "lead" (`value`:
    // "all", or "host" - a presentation), "grant" (`target` may lead too:
    // `value` true or false), "passcode" (`value`; "" takes it away); signed
    // in, "title" (`value`) and "forget" (out of the history).
    async manageLiveSession(action, { target, approval, room, value } = {}) {
      const state = Viewer.getLiveLinkState();
      const session = state.session;
      const id = room || session?.id;
      if (!id) return null;
      const own = session && session.id === id;
      if (own && session.mode === "browser") return null;
      try {
        const answer = await liveRequest(`/api/live/${id}/manage`, {
          body: { action, target, approval, value, client: own ? state.client : undefined, hostKey: Viewer.liveSessionHostKey(id) || undefined },
        });
        if (own && state.session === session) {
          const wasAuto = session.approval !== "manual";
          if (action === "approval") session.approvalWanted = null;
          if (action === "lead") session.leadWanted = null;
          Viewer.applyLiveSessionPeople(session, answer);
          // Someone sent away: from now on the host lets people in.
          session.hostNote = action === "reject" && wasAuto && answer.approval === "manual"
            ? t("liveLink.session.removedManual", "New people now wait to be let in, so whoever was removed cannot come straight back.")
            : null;
          Viewer.syncLiveLinkPanel();
        }
        if (state.history) Viewer.loadLiveSessionHistory();
        return answer;
      } catch (error) {
        if (own) {
          if (action === "approval") session.approvalWanted = null;
          if (action === "lead") session.leadWanted = null;
          session.error = error.message;
          Viewer.syncLiveLinkPanel();
        } else if (state.history) {
          state.history.error = error.message;
          Viewer.syncLiveLinkPanel();
        }
        return null;
      }
    },

    // A signed-in host's sessions (GET /api/live/mine).
    async loadLiveSessionHistory() {
      const state = Viewer.getLiveLinkState();
      const history = state.history ??= { items: [], loading: false, error: null, loaded: false };
      if (!Viewer.authState?.user || !hasRemote()) {
        history.items = [];
        Viewer.syncLiveLinkPanel();
        return [];
      }
      history.loading = true;
      Viewer.syncLiveLinkPanel();
      try {
        const answer = await liveRequest("/api/live/mine");
        history.items = Array.isArray(answer.sessions) ? answer.sessions : [];
        history.error = null;
      } catch (error) {
        history.error = error.message;
      }
      history.loading = false;
      history.loaded = true;
      Viewer.syncLiveLinkPanel();
      return history.items;
    },

    getLiveSessionHistory() {
      return Viewer.liveLinkState?.history?.items || [];
    },

    // ---- the window ----

    // Before a session: the nickname, and the session the link names.
    buildLiveSessionStart({ el, labels, button, actions }) {
      const state = Viewer.getLiveLinkState();
      const children = [];
      if (state.notice) {
        const notice = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_notice", state.notice);
        notice.setAttribute("role", "alert");
        children.push(notice);
      }
      const label = el("label", "viewer-livelink-panel_nick");
      const caption = el("span");
      labels.push([caption, () => t("liveLink.session.nick", "Your name in the session")]);
      const input = el("input", "viewer-livelink-panel_nick-input");
      input.type = "text";
      input.maxLength = 40;
      input.autocomplete = "nickname";
      input.value = state.nickDraft ?? Viewer.liveSessionNick();
      labels.push([input, () => t("liveLink.session.nick", "Your name in the session")]);
      input.placeholder = t("liveLink.session.nickPlaceholder", "e.g. Anna");
      label.append(caption, input);
      state.ui.nickInput = input;
      // The session the link names asks for a passcode.
      let passcode = null;
      if (state.joining && state.needPasscode) {
        const box = el("label", "viewer-livelink-panel_nick");
        const text = el("span");
        labels.push([text, () => t("liveLink.session.passcode", "Passcode")]);
        passcode = el("input", "viewer-livelink-panel_nick-input viewer-livelink-panel_passcode-input");
        passcode.type = "password";
        passcode.autocomplete = "off";
        passcode.maxLength = 64;
        labels.push([passcode, () => t("liveLink.session.passcode", "Passcode")]);
        passcode.addEventListener("keydown", (event) => {
          if (event.key === "Enter") go();
        });
        box.append(text, passcode);
        state.ui.passcodeInput = passcode;
      }
      const go = () => {
        const nick = normalizeSessionNick(input.value);
        if (!nick) {
          input.setAttribute("aria-invalid", "true");
          input.focus();
          return;
        }
        if (passcode && !passcode.value.trim()) {
          passcode.setAttribute("aria-invalid", "true");
          passcode.focus();
          return;
        }
        state.nickDraft = undefined;
        state.notice = null;
        Viewer.startLiveSession(state.joining || undefined, { nick, passcode: passcode?.value.trim() || undefined });
      };
      input.addEventListener("input", () => {
        state.nickDraft = input.value;
        input.removeAttribute("aria-invalid");
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") go();
      });
      children.push(label);
      if (passcode) children.push(passcode.parentElement);
      if (Viewer.authState?.user) {
        const signed = el("p", "viewer-pointcloud-panel_note");
        labels.push([signed, () => t("liveLink.session.nickSignedIn", { user: Viewer.authState.user }, "Signed in as {user}: the name is the account's, change it here for this session.")]);
        children.push(signed);
      }
      if (state.joining) {
        const note = el("p", "viewer-pointcloud-panel_note");
        labels.push([note, () => t("liveLink.session.joinIntro", { id: state.joining }, "The link opens the session {id}. Give a name the others will see, and join.")]);
        children.push(note, actions(
          button("viewer-livelink-panel_join", () => t("liveLink.session.join", "Join the session"), go),
          button("viewer-livelink-panel_start", () => t("liveLink.session.startOwn", "Start my own instead"), () => {
            state.joining = null;
            Viewer.renderLiveLinkPanel();
          }),
        ));
      } else {
        const note = el("p", "viewer-pointcloud-panel_note");
        labels.push([note, () => t("liveLink.session.intro", "Everyone who opens the session's link sees this scene as you move it. A phone becomes the remote control of a screen.")]);
        children.push(note, actions(button("viewer-livelink-panel_start", () => t("liveLink.session.start", "Start a session"), go)));
      }
      return children;
    },

    // In a session: who is there, and the host's switches.
    buildLiveSessionPeople({ el, labels, button, actions, check }) {
      const state = Viewer.getLiveLinkState();
      const session = state.session;
      const ui = state.ui;
      const children = [];
      const you = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_you");
      ui.you = you;
      children.push(you);
      const people = el("ul", "viewer-livelink-panel_people");
      people.setAttribute("aria-live", "polite");
      ui.people = people;
      ui.peopleKey = null;
      children.push(people);
      if (session.mode === "server") {
        const hostBox = el("div", "viewer-livelink-panel_host");
        ui.hostBox = hostBox;
        const auto = check(() => t("liveLink.session.autoAccept", "Let new people in at once"), session.approval !== "manual", (on) => {
          // Shown at once; the worker's answer settles it.
          session.approval = on ? "auto" : "manual";
          session.approvalWanted = session.approval;
          Viewer.manageLiveSession("approval", { approval: session.approval });
        });
        auto.classList.add("viewer-livelink-panel_auto");
        ui.autoInput = auto.querySelector("input");
        const close = button("viewer-livelink-panel_close", () => (session.closed
          ? t("liveLink.session.reopen", "Resume the session")
          : t("liveLink.session.close", "Close the session")), () => Viewer.manageLiveSession(session.closed ? "reopen" : "close"));
        ui.closeButton = close;
        const hint = el("p", "viewer-pointcloud-panel_note");
        labels.push([hint, () => (session.approval === "manual"
          ? t("liveLink.session.manualHint", "New people wait in the list until you let them in.")
          : t("liveLink.session.autoHint", "Whoever opens the link comes in at once."))]);
        const hostNote = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_notice");
        hostNote.setAttribute("role", "status");
        ui.hostNote = hostNote;
        const present = check(() => t("liveLink.session.presentation", "Only I lead (a presentation)"), session.lead === "host", (on) => {
          session.lead = on ? "host" : "all";
          session.leadWanted = session.lead;
          Viewer.manageLiveSession("lead", { value: session.lead });
        });
        present.classList.add("viewer-livelink-panel_present");
        ui.presentInput = present.querySelector("input");
        const presentHint = el("p", "viewer-pointcloud-panel_note");
        labels.push([presentHint, () => (session.lead === "host"
          ? t("liveLink.session.presentationHint", "The others watch; let someone lead too from the list.")
          : t("liveLink.session.everyoneLeads", "Everyone can move the scene."))]);
        // The passcode at the door: set here, handed on apart from the link.
        const code = el("input", "viewer-livelink-panel_nick-input viewer-livelink-panel_passcode-set");
        code.type = "text";
        code.autocomplete = "off";
        code.maxLength = 64;
        code.placeholder = t("liveLink.session.passcodeNew", "New passcode (4 or more characters)");
        labels.push([code, () => t("liveLink.session.passcodeNew", "New passcode (4 or more characters)")]);
        const setCode = button("viewer-livelink-panel_passcode-save", () => t("liveLink.session.passcodeSet", "Ask for it"), async () => {
          const value = code.value.trim();
          if (value.length < 4) {
            code.setAttribute("aria-invalid", "true");
            code.focus();
            return;
          }
          code.removeAttribute("aria-invalid");
          if (await Viewer.manageLiveSession("passcode", { value })) code.value = "";
        });
        const clearCode = button("viewer-livelink-panel_passcode-clear", () => t("liveLink.session.passcodeClear", "No passcode"), () => Viewer.manageLiveSession("passcode", { value: "" }));
        ui.passcodeClear = clearCode;
        const codeNote = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_passcode-note");
        ui.passcodeNote = codeNote;
        hostBox.append(auto, hint, hostNote, present, presentHint, code, actions(setCode, clearCode), codeNote, actions(close));
        children.push(hostBox);
      }
      return children;
    },

    // The list of people, the counts and the host's switches, as they are now.
    syncLiveSessionPeople() {
      const state = Viewer.liveLinkState;
      const ui = state?.ui;
      const session = state?.session;
      if (!ui || !session) return;
      if (ui.you) {
        const parts = [t("liveLink.session.you", { nick: session.nick || "" }, "You: {nick}")];
        if (session.host) parts.push(t("liveLink.session.hostBadge", "host"));
        ui.you.textContent = parts.join(" · ");
      }
      if (ui.hostBox) ui.hostBox.hidden = !session.host;
      if (ui.autoInput) ui.autoInput.checked = session.approval !== "manual";
      if (ui.presentInput) ui.presentInput.checked = session.lead === "host";
      if (ui.passcodeNote) {
        ui.passcodeNote.textContent = session.hasPasscode
          ? t("liveLink.session.passcodeOn", "New people give the passcode. Hand it on apart from the link.")
          : t("liveLink.session.passcodeOff", "No passcode: the link is enough.");
      }
      if (ui.passcodeClear) ui.passcodeClear.hidden = !session.hasPasscode;
      if (session.approval !== "manual") session.hostNote = null;
      if (ui.hostNote) {
        ui.hostNote.textContent = session.hostNote || "";
        ui.hostNote.hidden = !session.hostNote;
      }
      if (ui.closeButton) {
        ui.closeButton.textContent = session.closed ? t("liveLink.session.reopen", "Resume the session") : t("liveLink.session.close", "Close the session");
      }
      const members = session.members || [];
      const leader = Viewer.liveSessionLeader(session);
      const key = JSON.stringify([members, session.host, session.status, session.lead, leader?.id, core.currentLanguage]);
      if (!ui.people || ui.peopleKey === key) return;
      ui.peopleKey = key;
      const rows = [];
      const row = (item) => {
        const li = document.createElement("li");
        li.className = `viewer-livelink-panel_person is-${item.status}${item.id === leader?.id ? " is-leading" : ""}`;
        const name = document.createElement("span");
        name.className = "viewer-livelink-panel_person-name";
        const tags = [];
        if (item.id === session.you) tags.push(t("liveLink.session.youTag", "you"));
        if (item.host) tags.push(t("liveLink.session.hostBadge", "host"));
        if (item.id === leader?.id) tags.push(t("liveLink.session.leadingTag", "leading"));
        else if (session.lead === "host" && item.lead && !item.host) tags.push(t("liveLink.session.mayLeadTag", "may lead"));
        name.textContent = item.nick + (tags.length ? ` (${tags.join(", ")})` : "");
        li.appendChild(name);
        if (session.host && !item.host && item.id !== session.you) {
          const act = (className, text, action) => {
            const element = document.createElement("button");
            element.type = "button";
            element.className = `viewer-pointcloud-panel_button ${className}`;
            element.textContent = text;
            element.addEventListener("click", () => Viewer.manageLiveSession(action, { target: item.id }));
            return element;
          };
          if (item.status === "pending") li.append(act("viewer-livelink-panel_approve", t("liveLink.session.approve", "Let in"), "approve"));
          if (item.status === "active" && session.lead === "host") {
            const grant = document.createElement("button");
            grant.type = "button";
            grant.className = "viewer-pointcloud-panel_button viewer-livelink-panel_grant";
            grant.textContent = item.lead ? t("liveLink.session.stopLead", "Stop leading") : t("liveLink.session.letLead", "Let lead");
            grant.addEventListener("click", () => Viewer.manageLiveSession("grant", { target: item.id, value: !item.lead }));
            li.append(grant);
          }
          li.append(act("viewer-livelink-panel_reject", item.status === "pending" ? t("liveLink.session.refuse", "Refuse") : t("liveLink.session.remove", "Remove"), "reject"));
        }
        return li;
      };
      const pending = members.filter((item) => item.status === "pending");
      const active = members.filter((item) => item.status === "active");
      if (pending.length) {
        const head = document.createElement("li");
        head.className = "viewer-livelink-panel_people-head";
        head.textContent = t("liveLink.session.pendingTitle", { count: pending.length }, "Waiting: {count}");
        rows.push(head, ...pending.map(row));
      }
      if (active.length) {
        const head = document.createElement("li");
        head.className = "viewer-livelink-panel_people-head";
        head.textContent = t("liveLink.session.activeTitle", { count: active.length }, "Active: {count}");
        rows.push(head, ...active.map(row));
      }
      ui.people.replaceChildren(...rows);
      ui.people.hidden = rows.length === 0;
    },

    // The status line of a session.
    liveSessionStatusText(session) {
      if (session.error) return t("liveLink.status.error", { error: session.error }, "Could not read it: {error}");
      if (session.status === "pending") return t("liveLink.session.waiting", "Waiting for the host to let you in…");
      if (session.closed) {
        return session.host
          ? t("liveLink.session.closedHost", "The session is closed: nobody new comes in and nothing is shared. Resume it to go on.")
          : t("liveLink.session.closedGuest", "The host closed the session. It goes on here when it is resumed.");
      }
      const parts = [t("liveLink.session.status", { count: session.peers }, "In the session: {count}")];
      if (session.host && session.waiting) parts.push(t("liveLink.session.pendingCount", { count: session.waiting }, "waiting: {count}"));
      const leader = Viewer.liveSessionLeader(session);
      if (leader) parts.push(leader.you ? t("liveLink.session.youLead", "you lead") : t("liveLink.session.leads", { nick: leader.nick }, "{nick} leads"));
      if (session.canLead === false) parts.push(t("liveLink.session.watching", "a presentation: you watch"));
      return parts.join(" · ");
    },

    // A signed-in host's sessions, in the window.
    buildLiveSessionHistory({ el, labels, button, actions }) {
      const state = Viewer.getLiveLinkState();
      const ui = state.ui;
      const list = el("ul", "viewer-livelink-panel_history");
      ui.history = list;
      ui.historyKey = null;
      const status = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_history-status");
      ui.historyStatus = status;
      const refresh = button("viewer-livelink-panel_history-refresh", () => t("liveLink.history.refresh", "Refresh"), () => Viewer.loadLiveSessionHistory());
      if (!state.history?.loaded && !state.history?.loading) Viewer.loadLiveSessionHistory();
      return [status, list, actions(refresh)];
    },

    syncLiveSessionHistory() {
      const state = Viewer.liveLinkState;
      const ui = state?.ui;
      if (!ui?.history) return;
      const history = state.history || { items: [] };
      const items = history.items || [];
      ui.historyStatus.textContent = history.error
        ? t("liveLink.status.error", { error: history.error }, "Could not read it: {error}")
        : history.loading && !items.length
          ? t("liveLink.history.loading", "Reading your sessions…")
          : items.length ? "" : t("liveLink.history.empty", "No sessions yet. The ones you start while signed in are listed here.");
      ui.historyStatus.hidden = !ui.historyStatus.textContent;
      const current = state.session?.id;
      const key = JSON.stringify([items, current, core.currentLanguage]);
      if (ui.historyKey === key) return;
      ui.historyKey = key;
      ui.history.replaceChildren(...items.map((item) => {
        const li = document.createElement("li");
        li.className = `viewer-livelink-panel_history-item${item.closed ? " is-closed" : ""}${item.id === current ? " is-current" : ""}`;
        li.dataset.session = item.id;
        const title = document.createElement("strong");
        title.textContent = item.title || item.id;
        const when = document.createElement("span");
        when.className = "viewer-livelink-panel_history-when";
        when.textContent = [
          dateTime(item.createdAt),
          duration(item.createdAt, item.lastActiveAt),
          item.closed ? t("liveLink.history.closed", "closed") : t("liveLink.history.open", "open"),
          ...(item.lead === "host" ? [t("liveLink.history.presentation", "presentation")] : []),
          ...(item.passcode ? [t("liveLink.history.passcode", "passcode")] : []),
        ].filter(Boolean).join(" · ");
        const stats = document.createElement("span");
        stats.className = "viewer-livelink-panel_history-stats";
        stats.textContent = [
          t("liveLink.history.active", { count: item.active || 0 }, "active now: {count}"),
          t("liveLink.history.participants", { count: item.participants || 0 }, "took part: {count}"),
          t("liveLink.history.peak", { count: item.peak || 0 }, "at most at once: {count}"),
          ...(item.pending ? [t("liveLink.session.pendingCount", { count: item.pending }, "waiting: {count}")] : []),
        ].join(" · ");
        const row = document.createElement("div");
        row.className = "viewer-livedata-panel_actions";
        const act = (className, text, onClick) => {
          const element = document.createElement("button");
          element.type = "button";
          element.className = `viewer-pointcloud-panel_button ${className}`;
          element.textContent = text;
          element.addEventListener("click", onClick);
          return element;
        };
        if (item.id !== current) {
          row.append(act("viewer-livelink-panel_history-join", t("liveLink.history.join", "Join"), () => Viewer.startLiveSession(item.id)));
        }
        row.append(item.closed
          ? act("viewer-livelink-panel_history-reopen", t("liveLink.session.reopen", "Resume the session"), () => Viewer.manageLiveSession("reopen", { room: item.id }))
          : act("viewer-livelink-panel_history-close", t("liveLink.session.close", "Close the session"), () => Viewer.manageLiveSession("close", { room: item.id })));
        row.append(
          act("viewer-livelink-panel_history-rename", t("liveLink.history.rename", "Rename"), () => {
            const value = window.prompt(t("liveLink.history.renamePrompt", "The session's name in your list"), item.title || "");
            if (value !== null) Viewer.manageLiveSession("title", { room: item.id, value });
          }),
          act("viewer-livelink-panel_history-forget", t("liveLink.history.forget", "Remove from the list"), () => {
            if (window.confirm(t("liveLink.history.forgetConfirm", "Remove this session from your list? Whoever is in it stays; it is no longer yours to close or resume."))) {
              Viewer.manageLiveSession("forget", { room: item.id });
            }
          }),
        );
        li.append(title, when, stats, row);
        return li;
      }));
      ui.history.hidden = items.length === 0;
    },
  });
}
