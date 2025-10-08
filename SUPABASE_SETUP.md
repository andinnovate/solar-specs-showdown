# Dual Supabase Configuration Setup

This project supports dual Supabase configurations: **Lovable** (default/production) and **Local Development** (optional override).

## 🏗️ Architecture

### Configuration System
- **Default**: Uses Lovable's Supabase instance
- **Override**: Can switch to your own Supabase instance for local development
- **Environment-based**: Configuration controlled via environment variables

### Files Structure
```
src/
├── lib/
│   └── supabaseConfig.ts          # Configuration management
├── integrations/supabase/
│   └── client.ts                  # Updated client with dual support
└── components/
    └── DevSupabaseConfig.tsx      # Development configuration UI

scripts/
└── setup-local-supabase.js        # Setup script for local config

supabase/
└── migrations/                    # Database migrations
```

## 🚀 Quick Setup

### 1. Default (Lovable Supabase)
The application works out of the box with Lovable's Supabase instance. No additional setup required.

### 2. Local Development Setup

#### Option A: Automated Setup
```bash
# Run the interactive setup script
node scripts/setup-local-supabase.js
```

#### Option B: Manual Setup
1. Create `.env.local` file in project root:
```env
# Local Development Environment Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Local Development Override
VITE_LOCAL_SUPABASE_URL=your_supabase_url
VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Enable local Supabase
VITE_USE_LOCAL_SUPABASE=true
```

2. Get your Supabase credentials:
   - Go to your Supabase dashboard
   - Navigate to Settings > API
   - Copy the URL and anon key

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Lovable Supabase URL | Required |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Lovable Supabase anon key | Required |
| `VITE_LOCAL_SUPABASE_URL` | Your local Supabase URL | Optional |
| `VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY` | Your local Supabase anon key | Optional |
| `VITE_USE_LOCAL_SUPABASE` | Enable local Supabase | `false` |

### Switching Between Configurations

#### Use Lovable Supabase (Default)
```env
VITE_USE_LOCAL_SUPABASE=false
```

#### Use Your Local Supabase
```env
VITE_USE_LOCAL_SUPABASE=true
```

## 🗄️ Database Setup

### For Local Development

1. **Create your Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for setup to complete

2. **Run migrations**:
   ```bash
   # If you have Supabase CLI installed
   supabase db reset
   
   # Or manually run the SQL files in supabase/migrations/
   ```

3. **Set up authentication**:
   - Go to Authentication > Settings in your Supabase dashboard
   - Configure your preferred auth providers
   - Add your admin user: `***REMOVED***`

### Migration Files
The project includes these migrations:
- `20251001142451_*` - Initial solar_panels table
- `20251001142834_*` - Additional data
- `20251002104215_*` - More data updates
- `20251003093058_*` - User preferences tables
- `20251003133204_*` - User favorites tables
- `20250103120000_*` - Admin access restrictions

## 🛠️ Development Tools

### Configuration Debug Component
In development mode, the Admin panel shows a configuration debug component that displays:
- Current Supabase provider (Lovable/Local)
- Configuration status
- URL (truncated for security)
- Local configuration availability

### Console Logging
In development, the app logs configuration details to the console:
```
🔧 Supabase Configuration: {
  provider: "lovable",
  hasLocalConfig: true,
  useLocal: false,
  url: "https://your-project.supabase.co..."
}
```

## 🔒 Security Considerations

### Admin Access
- Admin access is restricted to `***REMOVED***`
- This restriction applies to both Lovable and local Supabase instances
- Regular users can only manage their own preferences

### Environment Variables
- Never commit `.env.local` to version control
- Keep your Supabase credentials secure
- Use different Supabase projects for different environments

## 🚨 Troubleshooting

### Common Issues

1. **"Lovable Supabase configuration is missing"**
   - Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
   - These should be provided by Lovable

2. **Local Supabase not working**
   - Verify `VITE_USE_LOCAL_SUPABASE=true` in `.env.local`
   - Check that local Supabase URL and key are correct
   - Ensure your local Supabase instance is running

3. **Authentication issues**
   - Clear localStorage: `localStorage.clear()`
   - Check that your admin user exists in the correct Supabase instance
   - Verify RLS policies are properly applied

### Debug Steps
1. Check browser console for configuration logs
2. Use the DevSupabaseConfig component in Admin panel
3. Verify environment variables are loaded correctly
4. Test with both Supabase instances

## 📝 Best Practices

### Development Workflow
1. Use Lovable Supabase for production/staging
2. Use your local Supabase for development and testing
3. Keep migrations in sync between instances
4. Test admin functionality with both configurations

### Database Management
1. Always run migrations on both instances
2. Keep data in sync for testing
3. Use different admin emails for different environments
4. Regularly backup your local database

## 🔄 Switching Configurations

### From Lovable to Local
1. Set up your local Supabase instance
2. Create `.env.local` with your credentials
3. Set `VITE_USE_LOCAL_SUPABASE=true`
4. Restart your development server

### From Local to Lovable
1. Set `VITE_USE_LOCAL_SUPABASE=false` in `.env.local`
2. Or delete `.env.local` entirely
3. Restart your development server

The configuration system automatically handles the switch and provides clear feedback about which instance is being used.
