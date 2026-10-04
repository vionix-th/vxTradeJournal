import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./styles.css";
import { icon, brand, authFrame } from "./icons.js";
import { skillDownloadPanel } from "./skill-download.js";
import { EditorLifecycle } from "./editor-lifecycle.js";
import { TradeEditorSession } from "./trade-editor-session.js";
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
import {
  accountEditor,
  instrumentEditor,
  strategyEditor,
  tradeEditor,
  executionEditor,
  adjustmentEditor,
  settingsEditor,
} from "./editors.js";
import {
  journalView,
  accountsView,
  instrumentsView,
  strategiesView,
  tradeView,
} from "./views.js";
const root = document.getElementById("app");
const currentEntity = (ui, type, record) => record?.id
  ? ui.data[type].find((item) => item.id === record.id) || record
  : record;
const withTrade = (ui, arg, render) => {
  const trade = ui.data.trades.find((item) => item.id === arg.tradeId);
  if (trade) render(trade);
  else tradeView(ui, arg.tradeId);
};
const routes = {
  journal: journalView,
  accounts: accountsView,
  instruments: instrumentsView,
  strategies: strategiesView,
  trade: tradeView,
  accountEditor: (ui, arg) => accountEditor(ui, currentEntity(ui, "accounts", arg?.first ? null : arg), !!arg?.first && !ui.data.accounts.length),
  instrumentEditor: (ui, arg) => instrumentEditor(ui, currentEntity(ui, "instruments", arg),
    ui.lifecycle.current.parent ? (saved) => ui.lifecycle.returnParent(saved) : null),
  strategyEditor: (ui, arg) => strategyEditor(ui, currentEntity(ui, "strategies", arg)),
  tradeEditor: (ui, arg) => {
    const session = arg?.session || new TradeEditorSession({
      baseRecord: currentEntity(ui, "trades", arg), data: ui.data,
      defaultInstrumentId: ui.recentInstruments().find((instrument) => !instrument.archived && !instrument.draft)?.id,
    });
    session.setContext(ui.data);
    ui.arg = { session };
    ui.lifecycle.current.arg = ui.arg;
    tradeEditor(ui, session);
  },
  executionEditor: (ui, arg) => withTrade(ui, arg, (trade) => executionEditor(ui, trade, arg.legId, trade.executions.find((item) => item.id === arg.executionId))),
  adjustmentEditor: (ui, arg) => withTrade(ui, arg, (trade) => adjustmentEditor(ui, trade, trade.adjustments.find((item) => item.id === arg.adjustmentId))),
  snapshotEditor: (ui, arg) => withTrade(ui, arg, (trade) => instrumentEditor(ui,
    trade.legs.find((leg) => leg.id === arg.legId).snapshot,
    () => ui.go("trade", { id: arg.tradeId, reopenLegId: arg.legId }, true),
    { trade, legId: arg.legId })),
  settings: settingsEditor,
};
class JournalUI {
  constructor() {
    this.lifecycle = new EditorLifecycle(root, (route, arg) => this.renderRoute(route, arg));
    this.dirty = false;
    this.filters = {};
    this.page = 1;
    this.data = null;
    this.repo = null;
    this.route = "journal";
    this.arg = null;
    this.loadGeneration = 0;
    this.desktopMedia = window.matchMedia("(min-width: 701px)");
    this.desktopMedia.addEventListener("change", (event) => {
      const session = root.querySelector(".session-details");
      if (session) session.open = event.matches;
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
    this.lifecycle.reset();
    this.route = "journal";
    this.arg = null;
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
    const nav = el("nav", { "aria-label": "Main navigation" });
    for (const [route, title] of Object.entries({
      journal: "Journal",
      instruments: "Instruments",
      strategies: "Strategies",
      accounts: "Accounts",
      settings: "Settings",
    }))
      nav.append(
        button([icon(route), el("span", {}, title)], () => this.go(route), "nav-item", {
          "data-route": route,
        }),
      );
    const sidebar = el(
      "aside",
      { class: "sidebar" },
      brand(),
      el("span", { class: "nav-label" }, "Workspace"),
      nav,
      el(
        "details",
        {
          class: "sidebar-footer session-details",
          open: this.desktopMedia.matches ? true : null,
        },
        el("summary", {}, "Session"),
        el("div", { class: "session-profile" },
          el("span", { class: "avatar", "aria-hidden": "true" }, this.user.email.slice(0, 1).toUpperCase()),
          el("div", {}, el("strong", {}, "Personal workspace"), el("p", {}, this.user.email))),
        button(
          [icon("refresh", 16), "Reload records"],
          () => this.reloadCurrent(),
          "session-action",
        ),
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
        el(
          "p",
          { class: "help" },
          `v${typeof __APP_VERSION__ === "undefined" ? "0.1.0" : __APP_VERSION__} · ${typeof __BUILD_COMMIT__ === "undefined" ? "local" : __BUILD_COMMIT__}`,
        ),
      ),
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
  renderRoute(route, arg) {
    this.route = route;
    this.arg = arg;
    const navRoute = routePolicies[route]?.navigationSection || route;
    for (const n of root.querySelectorAll("[data-route]")) {
      if (n.dataset.route === navRoute) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    }
    try {
      routes[route](this, arg);
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
  form(title, description, saveLabel, handler, onCancel, { operationId = crypto.randomUUID() } = {}) {
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
          () => this.lifecycle.cancel(onCancel),
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
  async commit(action, after) {
    const generation = this.loadGeneration;
    return this.lifecycle.run(action, async (saved) => {
      if (generation !== this.loadGeneration) return;
      const data = await this.repo.load();
      if (generation !== this.loadGeneration) return;
      this.dirty = false;
      this.data = data;
      this.theme();
      await after(saved);
    });
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
    const policy = routePolicies[this.route];
    const refreshed = policy?.refresh(this.arg) || { route: this.route, arg: this.arg };
    try {
      await this.lifecycle.run(() => repo.load(), async (data) => {
        if (generation !== this.loadGeneration) return;
        this.data = data;
        this.dirty = false;
        this.theme();
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
