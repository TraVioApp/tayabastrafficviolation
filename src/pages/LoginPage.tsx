import { Lock, ShieldCheck, User } from "lucide-react";
import "./LoginPage.css";

interface LoginPageProps {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  handleLogin: (e: React.FormEvent) => Promise<void> | void;
}

export function LoginPage({
  username,
  password,
  setUsername,
  setPassword,
  handleLogin,
}: LoginPageProps) {
  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-grid">
          <section className="login-brand">
            <div className="login-brand-top">
              <div className="login-brand-logo">
                <img src="/LGU-logo-big.png" alt="LGU Logo" />
              </div>
              <div>
                <p className="login-brand-tag">LGU</p>
                <h1 className="login-brand-title">Traffic Portal</h1>
              </div>
            </div>

            <div className="login-brand-body">
              <div className="login-badge">
                <ShieldCheck size={16} />
                Administrative access
              </div>

              <h2>Monitoring traffic enforcement with clarity.</h2>
              <p>
                Manage violation records, officer operations, and reporting in one protected environment.
              </p>
            </div>

            <div className="login-brand-features">
              {[
                "Violation tracking",
                "Officer directory",
                "Reports and audits",
              ].map((item) => (
                <div key={item} className="login-feature">
                  <div className="login-feature-icon">✓</div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="login-panel">
            <div className="login-panel-inner">
              <div className="login-panel-header">
                <div className="login-panel-icon">
                  <ShieldCheck size={24} />
                </div>
                <span className="eyebrow">Secure login</span>
                <h3>Welcome back</h3>
                <p>Sign in to continue to the admin dashboard.</p>
              </div>

              <form onSubmit={handleLogin} className="login-form">
                <div className="login-field">
                  <label htmlFor="username">Username</label>
                  <div className="login-input-wrap">
                    <User />
                    <input
                      id="username"
                      type="text"
                      className="login-input"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="password">Password</label>
                  <div className="login-input-wrap">
                    <Lock />
                    <input
                      id="password"
                      type="password"
                      className="login-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="login-submit">
                  Sign in to portal
                </button>
              </form>

              <div className="login-footer">
                <p>© 2026 Traffic Management Authority</p>
                <p>Authorized administrative access only</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
