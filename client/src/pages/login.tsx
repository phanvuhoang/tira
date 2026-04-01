import { useState } from "react";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface User {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  email?: string;
}

interface LoginPageProps {
  onLogin: (user: User, token: string) => void;
}

type Mode = "login" | "register" | "forgot";

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        onLogin(data.user, data.token);
      } else {
        setError(data.error || "Tên đăng nhập hoặc mật khẩu không đúng.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email: email || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Đăng ký thành công! Vui lòng đăng nhập.");
        setMode("login");
        setPassword("");
        setEmail("");
      } else {
        setError(data.error || "Đăng ký thất bại. Vui lòng thử lại.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, hsl(220, 25%, 10%) 0%, hsl(220, 20%, 14%) 50%, hsl(183, 30%, 12%) 100%)",
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(183, 85%, 30%) 0%, hsl(183, 85%, 22%) 100%)",
              boxShadow: "0 8px 32px hsl(183, 85%, 30%, 0.4)",
            }}
          >
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "hsl(0, 0%, 98%)" }}
          >
            TIRA
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "hsl(215, 20%, 55%)" }}
          >
            Tax Index Risk Analysis
          </p>
        </div>

        <Card
          className="border-0 shadow-2xl"
          style={{
            background: "hsl(220, 22%, 16%)",
            borderColor: "hsl(220, 15%, 25%)",
          }}
        >
          <CardHeader className="pb-4">
            <CardTitle
              className="text-lg font-semibold text-center"
              style={{ color: "hsl(0, 0%, 95%)" }}
            >
              {mode === "login"
                ? "Đăng nhập"
                : mode === "register"
                ? "Đăng ký tài khoản"
                : "Quên mật khẩu?"}
            </CardTitle>
            {mode === "login" && (
              <CardDescription
                className="text-center text-xs"
                style={{ color: "hsl(215, 20%, 50%)" }}
              >
                Đăng nhập để truy cập hệ thống phân tích rủi ro thuế
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Success message */}
            {successMsg && (
              <Alert
                style={{ background: "hsl(142, 55%, 20%, 0.3)", borderColor: "hsl(142, 55%, 35%)" }}
              >
                <AlertDescription style={{ color: "hsl(142, 55%, 70%)" }}>
                  {successMsg}
                </AlertDescription>
              </Alert>
            )}

            {/* Error message */}
            {error && (
              <Alert
                style={{ background: "hsl(0, 72%, 20%, 0.3)", borderColor: "hsl(0, 72%, 40%)" }}
              >
                <AlertDescription style={{ color: "hsl(0, 72%, 70%)" }}>
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Forgot password view */}
            {mode === "forgot" && (
              <div className="space-y-4 py-2">
                <div
                  className="rounded-lg p-4 text-sm"
                  style={{
                    background: "hsl(220, 15%, 20%)",
                    color: "hsl(215, 20%, 70%)",
                    borderLeft: "3px solid hsl(183, 85%, 35%)",
                  }}
                >
                  Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.
                </div>
                <Button
                  variant="ghost"
                  className="w-full"
                  style={{ color: "hsl(183, 85%, 55%)" }}
                  onClick={() => switchMode("login")}
                >
                  ← Quay lại đăng nhập
                </Button>
              </div>
            )}

            {/* Login form */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="login-username"
                    style={{ color: "hsl(215, 20%, 65%)", fontSize: "13px" }}
                  >
                    Tên đăng nhập
                  </Label>
                  <Input
                    id="login-username"
                    data-testid="input-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    required
                    autoFocus
                    style={{
                      background: "hsl(220, 20%, 12%)",
                      borderColor: "hsl(220, 15%, 28%)",
                      color: "hsl(0, 0%, 92%)",
                    }}
                    className="placeholder:text-muted-foreground/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="login-password"
                    style={{ color: "hsl(215, 20%, 65%)", fontSize: "13px" }}
                  >
                    Mật khẩu
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      data-testid="input-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      required
                      style={{
                        background: "hsl(220, 20%, 12%)",
                        borderColor: "hsl(220, 15%, 28%)",
                        color: "hsl(0, 0%, 92%)",
                        paddingRight: "2.5rem",
                      }}
                      className="placeholder:text-muted-foreground/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "hsl(215, 20%, 50%)" }}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  data-testid="btn-login"
                  className="w-full font-semibold"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, hsl(183, 85%, 30%) 0%, hsl(183, 85%, 24%) 100%)",
                    color: "white",
                    border: "none",
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Đăng nhập
                </Button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    data-testid="link-register"
                    onClick={() => switchMode("register")}
                    style={{ color: "hsl(183, 85%, 55%)" }}
                    className="hover:underline"
                  >
                    Chưa có tài khoản? Đăng ký
                  </button>
                  <button
                    type="button"
                    data-testid="link-forgot"
                    onClick={() => switchMode("forgot")}
                    style={{ color: "hsl(215, 20%, 50%)" }}
                    className="hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              </form>
            )}

            {/* Register form */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="reg-username"
                    style={{ color: "hsl(215, 20%, 65%)", fontSize: "13px" }}
                  >
                    Tên đăng nhập
                  </Label>
                  <Input
                    id="reg-username"
                    data-testid="input-reg-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Chọn tên đăng nhập"
                    required
                    autoFocus
                    style={{
                      background: "hsl(220, 20%, 12%)",
                      borderColor: "hsl(220, 15%, 28%)",
                      color: "hsl(0, 0%, 92%)",
                    }}
                    className="placeholder:text-muted-foreground/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="reg-password"
                    style={{ color: "hsl(215, 20%, 65%)", fontSize: "13px" }}
                  >
                    Mật khẩu
                  </Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      data-testid="input-reg-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      required
                      style={{
                        background: "hsl(220, 20%, 12%)",
                        borderColor: "hsl(220, 15%, 28%)",
                        color: "hsl(0, 0%, 92%)",
                        paddingRight: "2.5rem",
                      }}
                      className="placeholder:text-muted-foreground/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "hsl(215, 20%, 50%)" }}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="reg-email"
                    style={{ color: "hsl(215, 20%, 65%)", fontSize: "13px" }}
                  >
                    Email{" "}
                    <span style={{ color: "hsl(215, 20%, 40%)" }}>(tùy chọn)</span>
                  </Label>
                  <Input
                    id="reg-email"
                    data-testid="input-reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.com"
                    style={{
                      background: "hsl(220, 20%, 12%)",
                      borderColor: "hsl(220, 15%, 28%)",
                      color: "hsl(0, 0%, 92%)",
                    }}
                    className="placeholder:text-muted-foreground/40"
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="btn-register"
                  className="w-full font-semibold"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, hsl(183, 85%, 30%) 0%, hsl(183, 85%, 24%) 100%)",
                    color: "white",
                    border: "none",
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Đăng ký
                </Button>

                <div className="text-center text-xs pt-1">
                  <button
                    type="button"
                    data-testid="link-back-to-login"
                    onClick={() => switchMode("login")}
                    style={{ color: "hsl(183, 85%, 55%)" }}
                    className="hover:underline"
                  >
                    Đã có tài khoản? Đăng nhập
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "hsl(215, 20%, 35%)" }}
        >
          © 2025 TIRA – Hệ thống phân tích rủi ro thuế
        </p>
      </div>
    </div>
  );
}
