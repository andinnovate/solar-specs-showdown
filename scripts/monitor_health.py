#!/usr/bin/env python3
"""
Health monitoring script for solar panel management system.
Monitors database health, ScraperAPI usage, and system performance.
"""

import asyncio
import argparse
import time
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.database import SolarPanelDB
from scripts.utils import send_notification, format_duration
from scripts.config import config

class HealthMonitor:
    """Monitor system health and performance"""
    
    def __init__(self, db: SolarPanelDB, logger):
        self.db = db
        self.logger = logger
        self.health_checks = {}
        self.alerts = []
    
    async def check_database_health(self) -> Dict[str, Any]:
        """Check database connectivity and performance"""
        start_time = time.time()
        
        try:
            # Test basic connectivity
            result = self.db.client.table('solar_panels').select('id').limit(1).execute()
            
            response_time = (time.time() - start_time) * 1000
            
            health_status = {
                'status': 'healthy',
                'response_time_ms': response_time,
                'connected': True,
                'error': None
            }
            
            if response_time > 5000:  # 5 seconds
                health_status['status'] = 'slow'
                self.alerts.append(f"Database response time is slow: {response_time:.0f}ms")
            
            self.logger.log_script_event("INFO", f"Database health check: {health_status['status']}")
            return health_status
            
        except Exception as e:
            health_status = {
                'status': 'unhealthy',
                'response_time_ms': None,
                'connected': False,
                'error': str(e)
            }
            
            self.alerts.append(f"Database connection failed: {str(e)}")
            self.logger.log_script_event("ERROR", f"Database health check failed: {str(e)}")
            return health_status
    
    async def check_scraper_usage(self) -> Dict[str, Any]:
        """Check ScraperAPI usage and performance"""
        try:
            stats = await self.db.get_scraper_usage_stats(days=1)
            
            if not stats:
                return {
                    'status': 'no_data',
                    'requests_today': 0,
                    'success_rate': 0,
                    'error': 'No usage data available'
                }
            
            success_rate = stats.get('success_rate', 0)
            total_requests = stats.get('total_requests', 0)
            
            if success_rate < 80:
                self.alerts.append(f"ScraperAPI success rate is low: {success_rate:.1f}%")
            
            if total_requests > 1000:  # Assuming daily limit
                self.alerts.append(f"High ScraperAPI usage: {total_requests} requests today")
            
            status = 'healthy'
            if success_rate < 90:
                status = 'warning'
            if success_rate < 70:
                status = 'critical'
            
            self.logger.log_script_event("INFO", f"ScraperAPI usage: {status} ({success_rate:.1f}% success)")
            
            return {
                'status': status,
                'requests_today': total_requests,
                'success_rate': success_rate,
                'failed_requests': stats.get('failed_requests', 0)
            }
            
        except Exception as e:
            self.alerts.append(f"ScraperAPI usage check failed: {str(e)}")
            self.logger.log_script_event("ERROR", f"ScraperAPI usage check failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def check_flagged_panels(self) -> Dict[str, Any]:
        """Check for panels that need attention"""
        try:
            flagged_panels = await self.db.get_flagged_panels('needs_review')
            count = len(flagged_panels)
            
            if count > 10:
                self.alerts.append(f"High number of flagged panels: {count}")
            
            status = 'healthy'
            if count > 5:
                status = 'warning'
            if count > 20:
                status = 'critical'
            
            self.logger.log_script_event("INFO", f"Flagged panels check: {status} ({count} panels)")
            
            return {
                'status': status,
                'count': count,
                'panels': flagged_panels[:5] if flagged_panels else []  # First 5 for details
            }
            
        except Exception as e:
            self.alerts.append(f"Flagged panels check failed: {str(e)}")
            self.logger.log_script_event("ERROR", f"Flagged panels check failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def check_script_logs(self) -> Dict[str, Any]:
        """Check recent script execution logs for errors"""
        try:
            # Get recent error logs (last 24 hours)
            result = self.db.client.table('script_logs').select('*').eq('level', 'ERROR').gte(
                'created_at', (datetime.now() - timedelta(days=1)).isoformat()
            ).execute()
            
            error_count = len(result.data)
            
            if error_count > 5:
                self.alerts.append(f"High number of script errors: {error_count}")
            
            status = 'healthy'
            if error_count > 2:
                status = 'warning'
            if error_count > 10:
                status = 'critical'
            
            self.logger.log_script_event("INFO", f"Script logs check: {status} ({error_count} errors)")
            
            return {
                'status': status,
                'error_count': error_count,
                'recent_errors': result.data[:3] if result.data else []  # First 3 errors
            }
            
        except Exception as e:
            self.alerts.append(f"Script logs check failed: {str(e)}")
            self.logger.log_script_event("ERROR", f"Script logs check failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def run_all_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return summary"""
        self.logger.log_script_event("INFO", "Starting comprehensive health checks")
        
        start_time = time.time()
        
        # Run all health checks
        database_health = await self.check_database_health()
        scraper_usage = await self.check_scraper_usage()
        flagged_panels = await self.check_flagged_panels()
        script_logs = await self.check_script_logs()
        
        total_time = time.time() - start_time
        
        # Compile results
        health_summary = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'healthy',
            'checks': {
                'database': database_health,
                'scraper_api': scraper_usage,
                'flagged_panels': flagged_panels,
                'script_logs': script_logs
            },
            'alerts': self.alerts,
            'check_duration': total_time
        }
        
        # Determine overall status
        statuses = [check['status'] for check in health_summary['checks'].values()]
        if 'critical' in statuses or 'error' in statuses:
            health_summary['overall_status'] = 'critical'
        elif 'warning' in statuses or 'slow' in statuses:
            health_summary['overall_status'] = 'warning'
        
        self.logger.log_script_event("INFO", f"Health check complete: {health_summary['overall_status']}")
        self.logger.log_script_event("INFO", f"Check duration: {format_duration(total_time)}")
        
        return health_summary
    
    async def send_health_report(self, health_summary: Dict[str, Any], send_email: bool = True):
        """Send health report via email"""
        if not send_email:
            return
        
        overall_status = health_summary['overall_status']
        alerts = health_summary['alerts']
        
        if overall_status == 'healthy' and not alerts:
            # Don't send email for healthy status with no alerts
            return
        
        subject = f"Solar Panel System Health: {overall_status.upper()}"
        
        # Build email body
        body = f"System Health Report - {health_summary['timestamp']}\n\n"
        body += f"Overall Status: {overall_status.upper()}\n"
        body += f"Check Duration: {format_duration(health_summary['check_duration'])}\n\n"
        
        # Add check results
        body += "Health Check Results:\n"
        for check_name, check_result in health_summary['checks'].items():
            status = check_result.get('status', 'unknown')
            body += f"  {check_name}: {status}\n"
        
        # Add alerts
        if alerts:
            body += f"\nAlerts ({len(alerts)}):\n"
            for alert in alerts:
                body += f"  - {alert}\n"
        
        await send_notification(body, subject)

async def main():
    parser = argparse.ArgumentParser(description='Monitor solar panel system health')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--no-email', action='store_true', help='Disable email notifications')
    parser.add_argument('--check', choices=['database', 'scraper', 'flags', 'logs', 'all'], 
                       default='all', help='Specific health check to run')
    
    args = parser.parse_args()
    
    with ScriptExecutionContext('health_monitor', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Initialize database and monitor
        db = SolarPanelDB()
        monitor = HealthMonitor(db, logger)
        
        try:
            logger.log_script_event("INFO", f"Starting health monitoring (check: {args.check})")
            
            if args.check == 'all':
                # Run all health checks
                health_summary = await monitor.run_all_health_checks()
                
                # Send report
                await monitor.send_health_report(health_summary, send_email=not args.no_email)
                
                # Log summary
                logger.log_script_event("INFO", f"Health monitoring complete: {health_summary['overall_status']}")
                
                # Return appropriate exit code
                if health_summary['overall_status'] == 'critical':
                    return 2
                elif health_summary['overall_status'] == 'warning':
                    return 1
                else:
                    return 0
            
            else:
                # Run specific check
                if args.check == 'database':
                    result = await monitor.check_database_health()
                elif args.check == 'scraper':
                    result = await monitor.check_scraper_usage()
                elif args.check == 'flags':
                    result = await monitor.check_flagged_panels()
                elif args.check == 'logs':
                    result = await monitor.check_script_logs()
                
                logger.log_script_event("INFO", f"{args.check} check result: {result}")
                return 0 if result.get('status') in ['healthy', 'no_data'] else 1
            
        except Exception as e:
            error_handler.handle_error(e, "Health monitoring", critical=True)
            await send_notification(f"Health monitoring failed: {str(e)}", "Health Monitor Failure")
            return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
