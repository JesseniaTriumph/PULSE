import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Loader2, Play } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { login, register, demo } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center mb-4">
            <ClipboardCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-app-title">Attendance Automator</h1>
          <p className="text-muted-foreground mt-1">Process and categorize absence excuses</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>{mode === "login" ? "Sign In" : "Create Account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access your dashboard"
                : "Create an account to start processing attendance"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    data-testid="input-login-username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    data-testid="input-login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
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
                    className="text-primary hover:underline font-medium"
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    data-testid="input-register-password"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
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
                    className="text-primary hover:underline font-medium"
                    onClick={() => setMode("login")}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
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
