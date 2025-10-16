# Solar Panel Management Scripts - Deployment Guide

This guide covers the complete setup and deployment of the Python scripts for managing solar panel data.

## 📋 Prerequisites

### System Requirements
- Python 3.8 or higher
- pip package manager
- cron daemon (for scheduled execution)
- Access to Supabase database
- ScraperAPI account and API key

### Environment Setup
1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd solar-specs-showdown
   ```

2. **Create virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## 🔧 Configuration

### 1. Environment Variables
Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# ScraperAPI Configuration
SCRAPERAPI_KEY=your-scraperapi-key

# Script Configuration
MAX_CONCURRENT_REQUESTS=5
REQUEST_DELAY=1.0
MAX_RETRIES=3
LOG_LEVEL=INFO
LOG_DIR=./logs
DATA_DIR=./data

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourdomain.com
```

### 2. Database Setup
Ensure your Supabase database has the required tables. Run the migration:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration file:
# supabase/migrations/20251015000000_add_supporting_tables.sql
```

### 3. Directory Structure
Create necessary directories:

```bash
mkdir -p logs data
chmod 755 logs data
```

## 🚀 Deployment

### 1. Test Scripts Individually
Before setting up cron jobs, test each script:

```bash
# Test price updates
python scripts/update_prices.py --limit 5 --verbose

# Test flag checking
python scripts/check_flags.py --verbose

# Test panel discovery
python scripts/discover_panels.py --max-pages 1 --verbose

# Test health monitoring
python scripts/monitor_health.py --check all --verbose
```

### 2. Setup Cron Jobs
Use the provided cron setup script:

```bash
# Setup default cron jobs
python scripts/cron_setup.py setup-defaults

# Or install custom jobs
python scripts/cron_setup.py install

# List current jobs
python scripts/cron_setup.py list

# Remove jobs if needed
python scripts/cron_setup.py remove
```

### 3. Manual Cron Job Setup
If you prefer to set up cron jobs manually:

```bash
# Edit crontab
crontab -e

# Add these entries:
0 */6 * * * /path/to/venv/bin/python /path/to/scripts/update_prices.py --limit 50 >> /tmp/update_prices.log 2>&1
0 */2 * * * /path/to/venv/bin/python /path/to/scripts/check_flags.py --auto-resolve >> /tmp/check_flags.log 2>&1
0 2 * * * /path/to/venv/bin/python /path/to/scripts/discover_panels.py --max-pages 5 >> /tmp/discover_panels.log 2>&1
0 * * * * /path/to/venv/bin/python /path/to/scripts/monitor_health.py --check all >> /tmp/monitor_health.log 2>&1
```

## 📊 Monitoring and Maintenance

### 1. Log Monitoring
Monitor script execution through logs:

```bash
# View recent logs
tail -f logs/script.log

# View specific script logs
tail -f logs/update_prices.log
tail -f logs/check_flags.log
tail -f logs/discover_panels.log
tail -f logs/monitor_health.log

# View cron job logs
tail -f /tmp/update_prices.log
tail -f /tmp/check_flags.log
```

### 2. Health Monitoring
The health monitoring script provides comprehensive system status:

```bash
# Run health check
python scripts/monitor_health.py --check all

# Check specific components
python scripts/monitor_health.py --check database
python scripts/monitor_health.py --check scraper
python scripts/monitor_health.py --check flags
python scripts/monitor_health.py --check logs
```

### 3. Database Monitoring
Monitor script execution in the database:

```sql
-- View recent script logs
SELECT * FROM script_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- View ScraperAPI usage
SELECT * FROM scraper_usage 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- View flagged panels
SELECT * FROM flagged_panels 
WHERE status = 'needs_review'
ORDER BY created_at DESC;
```

## 🔧 Troubleshooting

### Common Issues

1. **Permission Denied Errors**:
   ```bash
   chmod +x scripts/*.py
   chmod 755 logs data
   ```

2. **Python Path Issues**:
   ```bash
   # Use absolute path to Python in cron jobs
   which python3
   # Use the full path in crontab
   ```

3. **Environment Variable Issues**:
   ```bash
   # Test environment loading
   python -c "from scripts.config import config; print(config.SUPABASE_URL)"
   ```

4. **Database Connection Issues**:
   ```bash
   # Test database connection
   python -c "from scripts.database import SolarPanelDB; db = SolarPanelDB(); print('Connected')"
   ```

5. **ScraperAPI Issues**:
   ```bash
   # Test ScraperAPI connection
   python scripts/scraperapi_sample.py
   ```

### Log Analysis

1. **Check for errors**:
   ```bash
   grep -i error logs/*.log
   grep -i "failed" logs/*.log
   ```

2. **Monitor performance**:
   ```bash
   grep -i "performance" logs/*.log
   grep -i "duration" logs/*.log
   ```

3. **Check retry attempts**:
   ```bash
   grep -i "retry" logs/*.log
   grep -i "circuit breaker" logs/*.log
   ```

## 📈 Performance Optimization

### 1. Tuning Parameters
Adjust these parameters in `.env` based on your needs:

```env
# Increase for faster processing (but respect rate limits)
MAX_CONCURRENT_REQUESTS=10
REQUEST_DELAY=0.5

# Increase for more reliability
MAX_RETRIES=5

# Adjust log level for production
LOG_LEVEL=WARNING
```

### 2. Cron Job Optimization
Adjust cron schedules based on your needs:

- **Price updates**: More frequent for active monitoring
- **Panel discovery**: Less frequent to avoid API limits
- **Health monitoring**: More frequent for critical systems
- **Flag checking**: Based on user activity

### 3. Database Optimization
Monitor database performance:

```sql
-- Check slow queries
SELECT * FROM script_logs 
WHERE message LIKE '%slow%' 
ORDER BY created_at DESC;

-- Monitor table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate ScraperAPI keys regularly
3. **Database Access**: Use service role keys only for scripts
4. **Log Files**: Ensure log files don't contain sensitive data
5. **Cron Jobs**: Run scripts with minimal required permissions

## 📞 Support

For issues or questions:

1. Check the logs first
2. Run health monitoring
3. Test individual components
4. Review this deployment guide
5. Check the main project documentation

## 🔄 Updates and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review health monitoring reports
   - Check for new ScraperAPI rate limits
   - Monitor database growth

2. **Monthly**:
   - Review and clean old logs
   - Update dependencies
   - Review cron job performance

3. **Quarterly**:
   - Rotate API keys
   - Review and update scripts
   - Performance optimization review
