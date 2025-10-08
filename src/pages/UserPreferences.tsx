import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sun, LogIn, LogOut, AlertCircle, User } from "lucide-react";
import { UserManagement } from "@/components/UserManagement";
import { UnitSystem } from "@/lib/unitConversions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UserPreferences = () => {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Check current auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Signed in successfully!');
    } catch (error: unknown) {
      console.error('Auth error:', error);
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sun className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Your Preferences
                </h1>
                <p className="text-muted-foreground">
                  Manage your favorite panels and hidden items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <a href="/">← Back to Home</a>
              </Button>
              {user && (
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!user ? (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Sign In Required
                </CardTitle>
                <CardDescription>
                  Please sign in to manage your panel preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Sign in to save your favorite panels and hide items you don't want to see.
                  </AlertDescription>
                </Alert>
                
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">Email</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Loading...' : 'Sign In'}
                  </Button>
                  
                  <div className="text-center space-y-2">
                    <Button
                      type="button"
                      variant="link"
                      onClick={async () => {
                        setAuthLoading(true);
                        try {
                          const { error } = await supabase.auth.signUp({
                            email: email || 'user@example.com',
                            password: password || 'password123',
                          });
                          if (error) throw error;
                          toast.success('Account created! Please check your email for confirmation.');
                        } catch (error: unknown) {
                          console.error('Sign up error:', error);
                          toast.error(`Sign up failed: ${error.message}`);
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                      className="w-full"
                      disabled={authLoading}
                    >
                      {authLoading ? 'Creating account...' : 'Create New Account'}
                    </Button>
                    
                    <p className="text-sm text-muted-foreground">
                      Sign in to save your preferences across devices
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome, {user.email}!</h2>
              <p className="text-muted-foreground">
                Manage your favorite solar panels and hide items you don't want to see in your search results.
              </p>
            </div>

            <UserManagement 
              userId={user.id} 
              unitSystem={(() => {
                if (typeof window !== 'undefined') {
                  const saved = localStorage.getItem('solar-panel-unit-system');
                  return (saved as UnitSystem) || 'metric';
                }
                return 'metric';
              })()} 
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default UserPreferences;
