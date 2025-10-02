import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, Database, FileText, Settings } from "lucide-react";
import { CSVImporterComplete } from "@/components/CSVImporterComplete";

const Admin = () => {
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
            <Button variant="outline" asChild>
              <a href="/">← Back to App</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
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
          </TabsList>

          <TabsContent value="import" className="space-y-6">
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
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
