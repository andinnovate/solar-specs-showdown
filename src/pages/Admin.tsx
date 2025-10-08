import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Database, FileText, Settings, LogIn, LogOut, AlertCircle, User, Shield, X } from "lucide-react";
import { CSVImporterComplete } from "@/components/CSVImporterComplete";
import { UserManagement } from "@/components/UserManagement";
import { DevSupabaseConfig } from "@/components/DevSupabaseConfig";
import { UnitSystem } from "@/lib/unitConversions";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/adminUtils";
import { toast } from "sonner";

const Admin = () => {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check current auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsAdmin(isAdminUser(user));
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(isAdminUser(currentUser));
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
          <Settings className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated but not admin
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <header className="border-b bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Admin Panel
                  </h1>
                  <p className="text-muted-foreground">
                    Solar panel management and data import
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <a href="/">← Back to Home</a>
                </Button>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                  <X className="w-5 h-5" />
                  Access Denied
                </CardTitle>
                <CardDescription>
                  You do not have admin privileges
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-destructive/50 text-destructive">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This admin panel is restricted to authorized administrators only. 
                    Regular users can manage their personal preferences on the main application.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Signed in as: <span className="font-medium">{user.email}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Admin access is restricted to: ***REMOVED***
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <a href="/">Go to Main App</a>
                  </Button>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
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
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Admin Panel
                </h1>
                <p className="text-muted-foreground">
                  Manage solar panel data and imports
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Sign Out
                  </Button>
                </div>
              )}
              <Button variant="outline" asChild>
                <a href="/">← Back to App</a>
              </Button>
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
                  Authentication Required
                </CardTitle>
                <CardDescription>
                  Please sign in to access the admin panel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Admin panel access is restricted to authorized administrators only.
                  </AlertDescription>
                </Alert>
                
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Loading...' : 'Sign In'}
                  </Button>
                  
                  <div className="text-center space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        setAuthLoading(true);
                        try {
                          const { error } = await supabase.auth.signInWithPassword({
                            email: '***REMOVED***',
                            password: '***REMOVED***',
                          });
                          if (error) throw error;
                          toast.success('Signed in with development account!');
                        } catch (error: unknown) {
                          console.error('Development sign in error:', error);
                          toast.error(`Sign in failed: ${error.message}`);
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                      className="w-full"
                      disabled={authLoading}
                    >
                      {authLoading ? 'Signing in...' : 'Sign In with Development Account'}
                    </Button>
                    
                    <p className="text-sm text-muted-foreground">
                      Admin access is restricted to: ***REMOVED***
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="import" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                CSV Import
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Import Logs
              </TabsTrigger>
              <TabsTrigger value="user" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                My Panels
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-6">
              <DevSupabaseConfig />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Import Solar Panel Data
                  </CardTitle>
                  <CardDescription>
                    Upload a CSV file to add or update solar panel specifications. 
                    The system will detect existing panels and show you what changes will be made.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CSVImporterComplete />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Management</CardTitle>
                  <CardDescription>
                    View and manage solar panel records in the database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Database management features coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Import History</CardTitle>
                  <CardDescription>
                    View previous CSV import operations and their results.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Import logging features coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

        <TabsContent value="user" className="space-y-6">
          <UserManagement userId={user.id} unitSystem={(() => {
            if (typeof window !== 'undefined') {
              const saved = localStorage.getItem('solar-panel-unit-system');
              return (saved as UnitSystem) || 'metric';
            }
            return 'metric';
          })()} />
        </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Admin;
