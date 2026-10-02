import { SessionStore } from "./session-store.js";
import { CliError } from "./errors.js";

/** REST handles renewable sessions; the Firebase client SDK uses the resulting ID token. */
export class UserSession {
  constructor(profile, config, store = new SessionStore()) {
    this.profile = profile; this.config = config; this.store = store;
    const base = config.useEmulators ? `http://127.0.0.1:${config.authPort}` : null;
    this.identity = base ? `${base}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1";
    this.secure = base ? `${base}/securetoken.googleapis.com/v1/token` : "https://securetoken.googleapis.com/v1/token";
  }
  async request(endpoint, body, tokenEndpoint = false) {
    let response;
    try {
      response = await fetch(`${tokenEndpoint ? this.secure : `${this.identity}/accounts:${endpoint}`}?key=${encodeURIComponent(this.config.options.apiKey)}`, {
        method: "POST", headers: { "Content-Type": tokenEndpoint ? "application/x-www-form-urlencoded" : "application/json" },
        body: tokenEndpoint ? new URLSearchParams(body).toString() : JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
    } catch { throw new CliError("AUTH_SERVICE_UNAVAILABLE", "Authentication service unavailable. Check the selected profile and retry.", 7); }
    let result;
    try { result = await response.json(); } catch { throw new CliError("AUTH_SERVICE_UNAVAILABLE", "Authentication service returned an invalid response.", 7); }
    if (!response.ok) {
      const code = String(result.error?.message || "").split(" : ")[0];
      if (endpoint === "sendOobCode" && body.requestType === "PASSWORD_RESET" && code === "EMAIL_NOT_FOUND") return {};
      const message = code === "EMAIL_EXISTS" ? "Email is already registered." : code.includes("WEAK_PASSWORD") ? "Password does not meet Firebase requirements." : code === "TOO_MANY_ATTEMPTS_TRY_LATER" ? "Authentication rate limit reached. Retry later." : "Authentication failed. Check credentials or sign in again.";
      throw new CliError("AUTH_FAILED", message, 3);
    }
    return result;
  }
  async login(email, password, register = false) {
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) throw new CliError("INVALID_INPUT", "Email and password are required; supply credentials through stdin or the hidden terminal prompt.");
    return this.store.withLock(this.profile, async () => {
      const result = await this.request(register ? "signUp" : "signInWithPassword", { email, password, returnSecureToken: true });
      await this.store.write(this.profile, { version: 1, projectId: this.config.options.projectId, uid: result.localId, email: result.email || email, refreshToken: result.refreshToken });
      if (register) await this.request("sendOobCode", { requestType: "VERIFY_EMAIL", idToken: result.idToken });
      const user = await this.lookup(result.idToken);
      return { uid: user.uid, email: user.email, emailVerified: user.emailVerified, ...(register ? { verificationSent: true } : {}) };
    });
  }
  async lookup(idToken) {
    const result = await this.request("lookup", { idToken });
    const user = result.users?.[0];
    if (!user) throw new CliError("AUTH_REQUIRED", "Session user no longer exists. Sign in again.", 3);
    return { uid: user.localId, email: user.email, emailVerified: user.emailVerified === true };
  }
  async token() {
    return this.store.withLock(this.profile, async () => {
      const session = await this.store.read(this.profile);
      if (!session) throw new CliError("AUTH_REQUIRED", "No saved session for this profile. Run auth login first.", 3);
      if (session.projectId !== this.config.options.projectId) throw new CliError("AUTH_REQUIRED", "Saved session belongs to another project. Sign in for this profile.", 3);
      const result = await this.request("token", { grant_type: "refresh_token", refresh_token: session.refreshToken }, true);
      const user = await this.lookup(result.id_token);
      // The refresh response's project_id is numeric project metadata, not the configured ID.
      // Account lookup uses this profile's API key; the client SDK also validates its user token.
      if (user.uid !== session.uid) throw new CliError("AUTH_REQUIRED", "Renewed session identity does not match the saved profile.", 3);
      await this.store.write(this.profile, { ...session, email: user.email, refreshToken: result.refresh_token });
      return { ...user, idToken: result.id_token };
    });
  }
  async verify() {
    const user = await this.token();
    await this.request("sendOobCode", { requestType: "VERIFY_EMAIL", idToken: user.idToken });
    return { verificationSent: true, email: user.email };
  }
  async reset(email) {
    if (typeof email !== "string" || !email.trim()) throw new CliError("INVALID_INPUT", "Email is required.");
    await this.request("sendOobCode", { requestType: "PASSWORD_RESET", email });
    return { resetRequested: true };
  }
  async logout() {
    await this.store.withLock(this.profile, () => this.store.remove(this.profile));
    return { loggedOut: true, scope: "local" };
  }
}
