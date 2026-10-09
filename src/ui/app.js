import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./styles.css";
import { createSupportReminderController } from './support-reminder-controller.js';
import { supportReminders } from './support-reminder-policy.js';
import { openSupportDialog } from './support.js';
import { supportReminderNotice } from './support-reminder-notice.js';
import { icon } from "./icons.js";
import { brand, authFrame } from "./branding.js";
import { workspaceNavigation } from "./workspace-navigation.js";
import { skillDownloadPanel } from "./skill-download.js";
import { EditorLifecycle } from "./editor-lifecycle.js";
import { routePolicies } from "./route-policy.js";
import { recentInstruments } from "../application/instruments.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  reload,
  getIdToken,
} from "firebase/auth";
import { auth, db, useEmulators } from "../persistence/firebase.js";
import { Repository } from "../persistence/repository.js";
import { el, button, field, values, header, notice } from "./components.js";
const root = document.getElementById("app");
class JournalUI {
  constructor() {
    this.pendingCompletion = null;
    this.lifecycle = new EditorLifecycle(root, (route, arg) => this.renderRoute(route, arg), routePolicies, {
      canNavigate: () => !this.pendingCompletion,
    });
    this.dirty = false;
    this.filters = {};
    this.page = 1;
    this.data = null;
    this.repo = null;
    this.loadGeneration = 0;
    const getSupport = () => [...root.querySelectorAll('.support-trigger')].find((control) => control.getClientRects().length) || this.navigation?.more;
    this.reminders = createSupportReminderController({
      store: supportReminders,
      safe: () => document.visibilityState === 'visible' && document.hasFocus() &&
        !!this.user?.emailVerified && !!this.data && !!this.repo &&
        !this.dirty && !this.lifecycle.busy && !this.pendingCompletion &&
        !routePolicies[this.lifecycle.current?.route]?.complete &&
        !document.querySelector('dialog[open], .notice.error, .notice.warning') &&
        !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]'),
      getSupport,
      openSupport: () => openSupportDialog(getSupport),
      show: supportReminderNotice,
    });
    this.desktopMedia = window.matchMedia("(min-width: 701px)");
    this.desktopMedia.addEventListener("change", (event) => {
      this.navigation?.setDesktop(event.matches);
    });
    window.addEventListener("beforeunload", (e) => {
      if (this.dirty || this.lifecycle.busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }
  get dirty() { return this.lifecycle.dirty; }
  set dirty(value) { this.lifecycle.dirty = value; }
  async loadUser(user) {
    const generation = ++this.loadGeneration;
    this.pendingCompletion = null;
    this.lifecycle.reset();
    this.data = null;
    this.repo = null;
    this.filters = {};
    this.page = 1;
    this.user = user;
    if (!user) {
      this.repo = null;
      this.data = null;
      this.dirty = false;
      this.authPage();
      return;
    }
    if (!user.emailVerified) {
      this.verifyPage();
      return;
    }
    this.repo = new Repository(
      db,
      user.uid,
      () => !!auth.currentUser?.emailVerified,
    );
    root.replaceChildren(
      el("div", { class: "auth-shell" }, notice("Loading private journal…")),
    );
    try {
      // Refresh the verification claim used by Firestore rules when a user
      // completed verification outside this tab.
      await getIdToken(user, true);
      const data = await this.repo.load();
      if (generation !== this.loadGeneration) return;
      this.data = data;
      this.theme();
      this.shell();
      if (!data.accounts.length) this.go("accountEditor", { first: true }, true, { replace: true });
      else this.go("journal", null, true, { replace: true });
    } catch (e) {
      if (generation !== this.loadGeneration) return;
      root.replaceChildren(
        el(
          "div",
          { class: "auth-shell" },
          el(
            "div",
            { class: "auth-card" },
            el("h1", {}, "Journal unavailable"),
            notice(e.message, "error"),
            button("Retry loading", () => this.loadUser(auth.currentUser)),
            button("Sign out", () => signOut(auth), "button secondary"),
          ),
        ),
      );
    }
  }
  theme() {
    const theme = this.data.settings.theme;
    if (theme === "system")
      document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = theme;
  }
  shell() {
    this.content = el("div", { class: "page-content" });
    this.main = el("main", { id: "main", tabindex: "-1" },
      el("div", { class: "workspace-bar" },
        el("span", { class: "workspace-name" }, "Workspace", el("span", { class: "workspace-divider" }, "/"), "Trading journal"),
        el("span", { class: "privacy-label" }, icon("lock", 14), "Private workspace")), this.content);
    const reload = button(
      [icon("refresh", 16), "Reload records"],
      () => this.reloadCurrent(),
      "session-action",
    );
    const session = el(
      "section",
      {
        class: "sidebar-footer session-details",
        "aria-label": "Session",
      },
      el("div", { class: "session-profile" },
        el("span", { class: "avatar", "aria-hidden": "true" }, this.user.email.slice(0, 1).toUpperCase()),
        el("div", {}, el("strong", {}, "Personal workspace"), el("p", {}, this.user.email))),
      reload,
      button(
        [icon("logout", 16), "Sign out"],
        () => {
          if (this.canLeave()) {
            this.dirty = false;
            signOut(auth);
          }
        },
        "session-action",
      ),
      skillDownloadPanel({ compact: true }),
    );
    this.navigation = workspaceNavigation((route) => this.go(route), this.desktopMedia.matches, session, reload);
    const sidebar = el(
      "aside",
      { class: "sidebar" },
      brand(),
      el("span", { class: "nav-label" }, "Workspace"),
      this.navigation.nav,
      this.navigation.sessionSlot,
      this.navigation.projectActions,
    );
    root.replaceChildren(
      el("a", { class: "skip-link", href: "#main", onClick: (event) => {
        event.preventDefault();
        this.main.focus();
      } }, "Skip to journal"),
      el("div", { class: "shell" }, sidebar, this.main),
    );
  }
  canLeave() {
    return this.lifecycle.canLeave();
  }
  go(route, arg = null, force = false, options = {}) {
    return this.lifecycle.go(route, arg, { ...options, force });
  }
  retainArg(arg) {
    this.lifecycle.retainArg(arg);
  }
  renderRoute(route, arg) {
    const navRoute = routePolicies[route]?.navigationSection || route;
    for (const n of root.querySelectorAll("[data-route], [data-navigation-section]")) {
      if ((n.dataset.route || n.dataset.navigationSection) === navRoute) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    }
    try {
      routePolicies[route].render(this, arg);
    } catch (e) {
      this.show(notice(e.message, "error"));
    }
  }
  show(node) {
    node.classList.add("view-stack");
    this.content.replaceChildren(node);
    this.main.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  form(title, description, saveLabel, handler, { operationId = crypto.randomUUID() } = {}) {
    const errors = el("div", { class: "full form-errors" });
    const body = el("div", { class: "panel form-grid editor-fields" });
    const submit = el("button", { type: "submit", class: "button" }, saveLabel);
    const node = el(
      "form",
      { class: "editor-form" },
      header(title, description),
      errors,
      body,
      el(
        "div",
        { class: "actions editor-actions" },
        button(
          "Cancel",
          () => this.lifecycle.cancelEditor(),
          "button secondary",
        ),
        submit,
      ),
    );
    const state = { node, body, errors, operationId };
    let busy = false;
    node.addEventListener("input", () => {
      this.dirty = true;
    });
    node.addEventListener("change", () => {
      this.dirty = true;
    });
    node.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      submit.textContent = "Saving…";
      errors.replaceChildren();
      try {
        await handler(node);
      } catch (error) {
        errors.append(notice(error.message, "error"));
        if (error.name === "ConflictError")
          errors.append(
            button(
              "Reload current records",
              () => this.reloadCurrent(),
              "button secondary",
            ),
          );
      } finally {
        busy = false;
        submit.disabled = false;
        submit.textContent = saveLabel;
      }
    });
    return state;
  }
  async commit(action, after = null, { countsUsage = false } = {}) {
    const generation = this.loadGeneration;
    return this.lifecycle.run(action, async (saved) => {
      if (generation !== this.loadGeneration) return;
      if (countsUsage) void supportReminders.recordUsage();
      const completion = { saved, after, generation, repo: this.repo, entry: this.lifecycle.current };
      this.pendingCompletion = completion;
      this.dirty = false;
      await this.finishCommit(completion);
    });
  }
  completionIsCurrent(completion) {
    return this.pendingCompletion === completion && completion.generation === this.loadGeneration &&
      completion.repo === this.repo && completion.entry === this.lifecycle.current;
  }
  async finishCommit(completion) {
    let data;
    try {
      data = await completion.repo.load();
    } catch (error) {
      if (this.completionIsCurrent(completion)) this.showCommitRecovery(completion, error);
      return;
    }
    if (!this.completionIsCurrent(completion)) return;
    this.data = data;
    this.dirty = false;
    this.theme();
    this.pendingCompletion = null;
    if (completion.after) await completion.after(completion.saved);
    else this.lifecycle.completeEditor(completion.saved);
  }
  showCommitRecovery(completion, error) {
    this.show(el("section", { class: "panel" },
      header("Saved; refresh failed", "The write is confirmed. Refresh the journal before continuing."),
      notice(error.message, "error"),
      el("div", { class: "actions" },
        button("Retry refresh", async () => {
          if (!this.completionIsCurrent(completion)) return;
          try {
            await this.lifecycle.run(() => this.finishCommit(completion), () => {});
          } catch (failure) {
            this.main.prepend(notice(failure.message, "error"));
          }
        }),
        button("Sign out", () => {
          if (this.completionIsCurrent(completion) && this.lifecycle.canLeave(false, { allowBlocked: true }))
            signOut(auth);
        }, "button secondary"),
      ),
    ));
  }
  async action(action, after) {
    try {
      await this.commit(action, after);
    } catch (e) {
      this.main.prepend(notice(e.message, "error"));
    }
  }
  async reloadCurrent() {
    if (!this.canLeave()) return;
    const generation = this.loadGeneration;
    const repo = this.repo;
    const refreshed = this.lifecycle.refreshDestination();
    try {
      await this.lifecycle.run(() => repo.load(), async (data) => {
        if (generation !== this.loadGeneration) return;
        this.data = data;
        this.dirty = false;
        this.theme();
        this.lifecycle.discardEditor();
        this.go(refreshed.route, refreshed.arg, true, { replace: true });
      });
    } catch (e) {
      this.main.prepend(notice(e.message, "error"));
    }
  }
  date(value) {
    if (!value) return "Not yet opened";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: this.data?.settings.timezone || "UTC",
    }).format(new Date(value));
  }
  recentInstruments() {
    return recentInstruments(this.data.instruments, this.data.trades);
  }
  authPage(mode = "signin", message = null) {
    const errors = el("div");
    const email = field("Email", "email", "", {
      type: "email",
      controlAttrs: { required: true, autocomplete: "email" },
    });
    const password =
      mode === "reset"
        ? null
        : field("Password", "password", "", {
            type: "password",
            controlAttrs: { required: true, minlength: 6,
              autocomplete: mode === "register" ? "new-password" : "current-password" },
          });
    const submit = el(
      "button",
      { type: "submit", class: "button" },
      mode === "register"
        ? "Create user"
        : mode === "reset"
          ? "Send reset email"
          : "Sign in",
    );
    const form = el(
      "form",
      { class: "auth-card" },
      el("span", { class: "eyebrow" }, "Welcome to your workspace"),
      el(
        "h1",
        {},
        mode === "register"
          ? "Create private journal"
          : mode === "reset"
            ? "Reset password"
            : "Welcome back",
      ),
      el(
        "p",
        { class: "muted" },
        mode === "register" ? "Create an account to start your private trading record." : mode === "reset" ? "Receive a link to reset your password." : "Sign in to continue your trading journal.",
      ),
      message ? notice(message, "success") : null,
      errors,
      email,
      password,
      submit,
      el(
        "div",
        { class: "actions" },
        button(
          mode === "register" ? "Back to sign in" : "Register",
          () => this.authPage(mode === "register" ? "signin" : "register"),
          "button secondary",
        ),
        button(
          mode === "reset" ? "Sign in" : "Forgot password",
          () => this.authPage(mode === "reset" ? "signin" : "reset"),
          "button secondary",
        ),
      ),
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submit.disabled = true;
      errors.replaceChildren();
      try {
        const v = values(form);
        if (mode === "register") {
          const credential = await createUserWithEmailAndPassword(
            auth,
            v.email,
            v.password,
          );
          await sendEmailVerification(credential.user, {
            url: window.location.origin,
          });
          this.verifyPage("Verification email sent.");
        } else if (mode === "reset") {
          await sendPasswordResetEmail(auth, v.email, {
            url: window.location.origin,
          });
          this.authPage(
            "signin",
            "Reset email sent if email is registered. Open its link to choose new password.",
          );
        } else await signInWithEmailAndPassword(auth, v.email, v.password);
      } catch (error) {
        if (mode === "reset" && error.code === "auth/user-not-found")
          this.authPage(
            "signin",
            "Reset email sent if email is registered. Open its link to choose new password.",
          );
        else errors.append(notice(authMessage(error), "error"));
      } finally {
        submit.disabled = false;
      }
    });
    root.replaceChildren(authFrame(form));
  }
  verifyPage(message = null) {
    const errors = el("div");
    const card = el(
      "div",
      { class: "auth-card" },
      el("h1", {}, "Verify email"),
      el(
        "p",
        {},
        `Verification required before saving trading data. Account: ${auth.currentUser?.email || this.user?.email || ""}`,
      ),
      el(
        "p",
        { class: "muted" },
        useEmulators
          ? "Local prototype: verification and reset links appear in emulator terminal output."
          : "Open the verification link sent to the account email address, then check verification here.",
      ),
      message ? notice(message) : null,
      errors,
      button("Check verification", async () => {
        try {
          await reload(auth.currentUser);
          await getIdToken(auth.currentUser, true);
          if (!auth.currentUser.emailVerified) {
            errors.replaceChildren(
              notice("Email still unverified. Open verification link first."),
            );
            return;
          }
          await this.loadUser(auth.currentUser);
        } catch (e) {
          errors.replaceChildren(notice(authMessage(e), "error"));
        }
      }),
      button(
        "Resend verification",
        async () => {
          try {
            await sendEmailVerification(auth.currentUser, {
              url: window.location.origin,
            });
            errors.replaceChildren(notice("Verification email sent."));
          } catch (e) {
            errors.replaceChildren(notice(authMessage(e), "error"));
          }
        },
        "button secondary",
      ),
      button("Sign out", () => signOut(auth), "button secondary"),
    );
    root.replaceChildren(authFrame(card));
  }
}
function authMessage(e) {
  const messages = {
    "auth/invalid-credential": "Email or password incorrect.",
    "auth/email-already-in-use":
      "Email already registered. Sign in or reset password.",
    "auth/network-request-failed":
      "Authentication unavailable. Check local services and retry.",
    "auth/weak-password": "Password must contain at least six characters.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return messages[e.code] || e.message;
}
const ui = new JournalUI();
onAuthStateChanged(auth, (user) => ui.loadUser(user));
