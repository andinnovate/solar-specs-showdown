# User Flagging System - Feature Plan

## 🎯 Overview

Allow website users to flag solar panels with incorrect information, creating a crowdsourced data quality improvement system. Users can report specific field errors and optionally suggest corrections, which are then reviewed by admins.

## 🏗️ System Architecture

### Database Schema

#### 1. User Flags Table
```sql
CREATE TABLE user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES solar_panels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  flagged_fields JSONB NOT NULL, -- ["name", "price_usd", "wattage"]
  suggested_corrections JSONB, -- {"name": "Correct Name", "price_usd": 99.99}
  user_comment TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, resolved
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_user_flags_panel_id ON user_flags(panel_id);
CREATE INDEX idx_user_flags_status ON user_flags(status);
CREATE INDEX idx_user_flags_user_id ON user_flags(user_id);
```

#### 2. Update solar_panels table
```sql
-- Add user_verified_overrides (similar to manual_overrides but from user flags)
ALTER TABLE solar_panels 
ADD COLUMN user_verified_overrides JSONB DEFAULT '[]'::jsonb;

-- Add flag count for quick UI display
ALTER TABLE solar_panels 
ADD COLUMN flag_count INTEGER DEFAULT 0;
```

## 🎨 UI Components

### 1. Flag Icon Component
```tsx
// src/components/FlagIcon.tsx
interface FlagIconProps {
  panelId: string;
  flagCount: number;
  flaggedFields: string[];
  onFlag: () => void;
  className?: string;
}

// States:
// - Default: Clear outline flag icon
// - Has flags: Red filled flag icon
// - Hover: Tooltip with flag details
```

### 2. Flag Submission Modal
```tsx
// src/components/FlagSubmissionModal.tsx
interface FlagSubmissionModalProps {
  panel: SolarPanel;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (flagData: FlagSubmission) => void;
}

// Features:
// - Checkboxes for each field (name, price, wattage, dimensions, etc.)
// - Optional "suggested correction" inputs for checked fields
// - Text area for additional comments
// - Submit button with confirmation
```

### 3. Admin Flag Queue
```tsx
// src/components/FlagQueue.tsx
// - List of pending flags with panel details
// - Show original vs suggested values
// - Approve/Reject/Edit actions
// - Bulk operations
```

## 🔄 User Workflow

### 1. User Discovers Incorrect Data
```
User browsing panels → Sees incorrect info → Clicks flag icon
```

### 2. Flag Submission Process
```
1. Flag modal opens
2. User checks boxes for incorrect fields:
   ☑️ Name (suggested: "Renogy 100W Monocrystalline")
   ☑️ Price (suggested: $79.99)
   ☐ Wattage (correct)
   ☐ Dimensions (correct)
3. User adds comment: "Price is wrong, found it for $79.99 on manufacturer site"
4. User clicks "Submit Flag"
5. Flag saved with status 'pending'
6. Panel flag count incremented
7. Success message shown
```

### 3. Admin Review Process
```
1. Admin sees flag in queue
2. Admin reviews original vs suggested values
3. Admin can:
   - Approve: Apply suggested corrections + mark as user-verified
   - Edit: Modify suggestions before applying
   - Reject: Dismiss flag with reason
4. If approved: Fields marked as user-verified (protected from scraper)
5. Flag status updated to 'approved'/'rejected'
```

## 🛠️ Implementation Plan

### Phase 1: Database & Backend
- [ ] Create user_flags table migration
- [ ] Add user_verified_overrides to solar_panels
- [ ] Create flag management API endpoints
- [ ] Update scraper to respect user-verified overrides

### Phase 2: UI Components
- [ ] Create FlagIcon component with hover states
- [ ] Build FlagSubmissionModal with field checkboxes
- [ ] Add flag icons to existing panel cards
- [ ] Create flag status indicators

### Phase 3: Admin Interface
- [ ] Add Flag Queue tab to admin panel
- [ ] Create flag review interface
- [ ] Add bulk flag management
- [ ] Create flag analytics dashboard

### Phase 4: Integration & Polish
- [ ] Connect flag submission to backend
- [ ] Add email notifications for flag updates
- [ ] Create flag reporting and analytics
- [ ] Add user flag history

## 📊 Data Flow

### Flag Submission
```
User clicks flag → Modal opens → User selects fields → User suggests corrections → 
Submit → API call → Database insert → Panel flag_count++ → Success message
```

### Admin Review
```
Admin opens flag queue → Reviews flag → Approves/Rejects → 
If approved: Apply corrections + mark as user-verified → 
Update panel + flag status → Notify user (optional)
```

### Scraper Integration
```
Scraper runs → Checks manual_overrides + user_verified_overrides → 
Skips protected fields → Updates remaining fields → Logs skipped fields
```

## 🎨 UI Design Details

### Flag Icon States
```css
/* Default state */
.flag-icon {
  @apply w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer;
}

/* Has flags state */
.flag-icon.has-flags {
  @apply text-red-500 fill-current;
}

/* Hover tooltip */
.flag-tooltip {
  @apply absolute bg-gray-900 text-white text-xs px-2 py-1 rounded;
}
```

### Flag Modal Layout
```
┌─────────────────────────────────────┐
│ 🚩 Flag Incorrect Information       │
├─────────────────────────────────────┤
│ What's wrong with this panel?       │
│                                     │
│ ☑️ Name: "Incorrect Name"           │
│    Suggested: [________________]    │
│                                     │
│ ☑️ Price: $99.99                    │
│    Suggested: $[79.99]              │
│                                     │
│ ☐ Wattage (appears correct)        │
│ ☐ Dimensions (appears correct)      │
│                                     │
│ Additional comments:                │
│ [_____________________________]    │
│                                     │
│              [Cancel] [Submit]      │
└─────────────────────────────────────┘
```

### Admin Flag Queue
```
┌─────────────────────────────────────────────────────────┐
│ 🚩 Flag Queue (3 pending)                              │
├─────────────────────────────────────────────────────────┤
│ Panel: Renogy 100W Solar Panel                         │
│ User: john@example.com                                  │
│ Flagged: Name, Price                                    │
│                                                         │
│ Original: "100W Solar Panel" → Suggested: "Renogy..." │
│ Original: $99.99 → Suggested: $79.99                   │
│                                                         │
│ Comment: "Found correct name on manufacturer website"   │
│                                                         │
│ [Reject] [Edit] [Approve]                              │
└─────────────────────────────────────────────────────────┘
```

## 🔒 Security & Permissions

### User Permissions
- Any authenticated user can flag panels
- Users can only see their own flag history
- Users cannot edit/delete flags after submission

### Admin Permissions
- Only admin users can access flag queue
- Admins can approve/reject/edit any flag
- Admins can see all flag history and analytics

### Data Protection
- User-verified overrides are protected from scraper updates
- Price fields are exception (allowed to be fluid)
- Flag data is preserved for audit trail

## 📈 Analytics & Reporting

### Flag Metrics
- Total flags submitted
- Flags by field type (name, price, specs, etc.)
- Approval/rejection rates
- Most flagged panels
- User contribution leaderboard

### Quality Improvements
- Before/after data quality scores
- Reduction in incorrect information
- User satisfaction with corrections

## 🚀 Future Enhancements

### Advanced Features
- [ ] Flag voting system (multiple users flag same issue)
- [ ] Expert reviewer roles
- [ ] Automated flag validation
- [ ] Integration with manufacturer data sources
- [ ] Mobile app flagging

### Gamification
- [ ] Points for helpful flags
- [ ] Badges for data quality contributors
- [ ] Leaderboards for top flaggers
- [ ] Recognition for verified contributors

## 📝 API Endpoints

### User Endpoints
```
POST /api/flags - Submit new flag
GET /api/flags/user - Get user's flag history
GET /api/panels/:id/flags - Get flags for specific panel
```

### Admin Endpoints
```
GET /api/admin/flags - Get all flags with filters
PUT /api/admin/flags/:id - Update flag status
POST /api/admin/flags/:id/approve - Approve flag
POST /api/admin/flags/:id/reject - Reject flag
```

## 🎯 Success Metrics

### User Engagement
- Number of flags submitted per month
- User retention after flagging
- Flag submission completion rate

### Data Quality
- Reduction in incorrect panel information
- Time to resolution for flags
- User satisfaction with corrections

### Admin Efficiency
- Time to review flags
- Approval accuracy rate
- Bulk operation usage

## 📋 Implementation Checklist

### Database
- [ ] Create user_flags table
- [ ] Add user_verified_overrides column
- [ ] Add flag_count column
- [ ] Create indexes for performance
- [ ] Add foreign key constraints

### Backend
- [ ] Flag submission API
- [ ] Flag management API
- [ ] Update scraper logic
- [ ] Add flag analytics queries

### Frontend
- [ ] FlagIcon component
- [ ] FlagSubmissionModal
- [ ] Admin flag queue
- [ ] Flag status indicators
- [ ] User flag history

### Integration
- [ ] Connect UI to APIs
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add success notifications
- [ ] Add email notifications

This comprehensive flagging system will significantly improve data quality through crowdsourcing while maintaining admin control over final decisions.
