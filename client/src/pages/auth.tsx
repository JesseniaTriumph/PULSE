import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Zap, Chrome, Sun, Moon, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { StarField } from "@/components/star-field";
import { useTheme } from "@/components/theme-provider";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const { login, register, demo } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegisterPw, setShowRegisterPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync(loginForm);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message?.includes("401") ? "Invalid username or password" : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleDemo = async () => {
    try {
      await demo.mutateAsync();
    } catch {
      toast({
        title: "Demo failed",
        description: "Something went wrong starting the demo",
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register.mutateAsync(registerForm);
    } catch (error: any) {
      let description = "Something went wrong";
      if (error.message?.includes("409")) {
        description = "Username or email already taken";
      } else if (error.message?.includes("400")) {
        description = "Please fill in all fields correctly";
      }
      toast({
        title: "Registration failed",
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <StarField />
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-indigo-950/30 pointer-events-none dark:block hidden" />

      <Button
        size="sm"
        variant="outline"
        onClick={toggleTheme}
        data-testid="button-auth-theme-toggle"
        className="absolute top-4 right-4 z-20 border-violet-500/30 hover:bg-violet-500/10"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="w-4 h-4 mr-1.5" /> : <Moon className="w-4 h-4 mr-1.5" />}
        {theme === "dark" ? "Light" : "Dark"}
      </Button>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30 animate-float">
            <Zap className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight pulse-glow" data-testid="text-app-title">
            PULSE
          </h1>
          <p className="text-muted-foreground mt-2 text-center">
            AI-Powered Attendance Tracking System
          </p>
        </div>

        <Card className="border-violet-500/20 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle>
              {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access your dashboard"
                : mode === "register"
                ? "Create an account to start processing attendance"
                : "We'll send a reset link to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "forgot" ? (
              <div className="space-y-4">
                {forgotSent ? (
                  <div className="text-center py-4 space-y-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
                    <p className="text-sm font-medium">Check your email</p>
                    <p className="text-xs text-muted-foreground">
                      If <span className="font-medium">{forgotEmail}</span> is registered, a reset
                      link has been sent.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const res = await fetch("/api/auth/forgot-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: forgotEmail }),
                        });
                        if (!res.ok) throw new Error("Request failed");
                      } catch {
                        // Silently ignore errors — always show success to avoid enumeration
                      }
                      setForgotSent(true);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email address</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="bg-background/50"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    >
                      Send Reset Link
                    </Button>
                  </form>
                )}
                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="text-violet-400 hover:text-violet-300 hover:underline font-medium"
                    onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); }}
                  >
                    Back to sign in
                  </button>
                </p>
              </div>
            ) : mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username or Email</Label>
                  <Input
                    id="login-username"
                    data-testid="input-login-username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="username or your@email.com"
                    required
                    autoComplete="username"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type={showLoginPw ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowLoginPw((v) => !v)}
                      aria-label={showLoginPw ? "Hide password" : "Show password"}
                    >
                      {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  data-testid="button-login"
                  disabled={login.isPending}
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    data-testid="link-switch-to-register"
                    className="text-violet-400 hover:text-violet-300 hover:underline font-medium"
                    onClick={() => setMode("register")}
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-displayname">Full Name</Label>
                  <Input
                    id="register-displayname"
                    data-testid="input-register-displayname"
                    value={registerForm.displayName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Your full name"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    data-testid="input-register-email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    data-testid="input-register-username"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="Choose a username"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      data-testid="input-register-password"
                      type={showRegisterPw ? "text" : "password"}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowRegisterPw((v) => !v)}
                      aria-label={showRegisterPw ? "Hide password" : "Show password"}
                    >
                      {showRegisterPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  data-testid="button-register"
                  disabled={register.isPending}
                >
                  {register.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    data-testid="link-switch-to-login"
                    className="text-violet-400 hover:text-violet-300 hover:underline font-medium"
                    onClick={() => setMode("login")}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 space-y-3">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-violet-500/30 hover:bg-violet-500/10 hover:border-violet-500/50"
            onClick={() => { window.location.href = "/api/auth/google"; }}
            data-testid="button-google-signin"
          >
            <Chrome className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
          <Button
            variant="outline"
            className="w-full border-violet-500/30 hover:bg-violet-500/10 hover:border-violet-500/50"
            onClick={handleDemo}
            data-testid="button-demo"
            disabled={demo.isPending}
          >
            {demo.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading demo...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Try Demo (with sample data)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
