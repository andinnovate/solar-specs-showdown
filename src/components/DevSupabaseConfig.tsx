import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { supabaseConfig } from '@/integrations/supabase/client';

/**
 * Development component for managing Supabase configuration
 * Only shows in development mode
 */
export const DevSupabaseConfig = () => {
  const [configInfo, setConfigInfo] = useState(supabaseConfig.info);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Don't render in production
  if (import.meta.env.PROD) {
    return null;
  }

  const refreshConfig = async () => {
    setIsRefreshing(true);
    // Reload the page to pick up any environment variable changes
    window.location.reload();
  };

  const getProviderBadgeVariant = (provider: string) => {
    switch (provider) {
      case 'lovable':
        return 'default';
      case 'local':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'lovable':
        return 'text-blue-600';
      case 'local':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Settings className="w-4 h-4" />
          Development: Supabase Configuration
        </CardTitle>
        <CardDescription className="text-orange-700">
          Current Supabase instance configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-600" />
            <span className="font-medium">Provider:</span>
            <Badge variant={getProviderBadgeVariant(configInfo.provider)}>
              {configInfo.provider}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshConfig}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium text-orange-800">URL:</span>
            <span className={`ml-2 font-mono text-xs ${getProviderColor(configInfo.provider)}`}>
              {configInfo.url.substring(0, 40)}...
            </span>
          </div>
          
          <div className="text-sm">
            <span className="font-medium text-orange-800">Local Config:</span>
            <Badge variant={configInfo.hasLocalConfig ? 'default' : 'outline'} className="ml-2">
              {configInfo.hasLocalConfig ? 'Available' : 'Not Set'}
            </Badge>
          </div>

          <div className="text-sm">
            <span className="font-medium text-orange-800">Use Local:</span>
            <Badge variant={configInfo.useLocal ? 'secondary' : 'outline'} className="ml-2">
              {configInfo.useLocal ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>

        {!configInfo.hasLocalConfig && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No local Supabase configuration found. Run{' '}
              <code className="bg-orange-100 px-1 rounded text-xs">
                node scripts/setup-local-supabase.js
              </code>{' '}
              to set up local development.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-orange-700 space-y-1">
          <div>• Lovable Supabase: Used by default for production</div>
          <div>• Local Supabase: Override with VITE_USE_LOCAL_SUPABASE=true</div>
          <div>• Configuration: Set in .env.local file</div>
        </div>
      </CardContent>
    </Card>
  );
};
