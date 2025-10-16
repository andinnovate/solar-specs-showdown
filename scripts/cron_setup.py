#!/usr/bin/env python3
"""
Cron job setup and management for solar panel management scripts.
Provides utilities to install, manage, and monitor cron jobs.
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Optional
import argparse
import json

class CronManager:
    """Manage cron jobs for solar panel scripts"""
    
    def __init__(self, project_root: str = None):
        self.project_root = project_root or os.getcwd()
        self.scripts_dir = os.path.join(self.project_root, 'scripts')
        self.python_path = sys.executable
        self.cron_jobs = []
    
    def add_cron_job(self, schedule: str, script: str, args: List[str] = None, 
                    description: str = None, log_file: str = None):
        """Add a cron job to the list"""
        job = {
            'schedule': schedule,
            'script': script,
            'args': args or [],
            'description': description or f"Run {script}",
            'log_file': log_file or f"/tmp/{script}.log"
        }
        self.cron_jobs.append(job)
    
    def generate_cron_entries(self) -> List[str]:
        """Generate cron entries for all jobs"""
        entries = []
        
        for job in self.cron_jobs:
            # Build command
            script_path = os.path.join(self.scripts_dir, job['script'])
            args_str = ' '.join(job['args']) if job['args'] else ''
            command = f"{self.python_path} {script_path} {args_str}"
            
            # Add logging
            log_redirect = f" >> {job['log_file']} 2>&1"
            
            # Create cron entry
            cron_entry = f"{job['schedule']} {command}{log_redirect} # {job['description']}"
            entries.append(cron_entry)
        
        return entries
    
    def install_cron_jobs(self, dry_run: bool = False) -> bool:
        """Install cron jobs to the system"""
        try:
            # Get current crontab
            result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
            current_crontab = result.stdout if result.returncode == 0 else ""
            
            # Generate new entries
            new_entries = self.generate_cron_entries()
            
            # Filter out existing entries to avoid duplicates
            existing_lines = current_crontab.split('\n')
            filtered_entries = []
            
            for entry in new_entries:
                # Check if this entry already exists
                script_name = entry.split('#')[-1].strip()
                if not any(script_name in line for line in existing_lines):
                    filtered_entries.append(entry)
            
            if not filtered_entries:
                print("No new cron jobs to install")
                return True
            
            # Create new crontab
            new_crontab = current_crontab.rstrip() + '\n\n' + '\n'.join(filtered_entries) + '\n'
            
            if dry_run:
                print("DRY RUN - Would install the following cron jobs:")
                for entry in filtered_entries:
                    print(f"  {entry}")
                return True
            
            # Install new crontab
            process = subprocess.Popen(['crontab', '-'], stdin=subprocess.PIPE, text=True)
            process.communicate(input=new_crontab)
            
            if process.returncode == 0:
                print(f"Successfully installed {len(filtered_entries)} cron jobs")
                return True
            else:
                print("Failed to install cron jobs")
                return False
                
        except Exception as e:
            print(f"Error installing cron jobs: {e}")
            return False
    
    def remove_cron_jobs(self, dry_run: bool = False) -> bool:
        """Remove solar panel script cron jobs"""
        try:
            # Get current crontab
            result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
            if result.returncode != 0:
                print("No crontab found")
                return True
            
            current_crontab = result.stdout
            lines = current_crontab.split('\n')
            
            # Filter out solar panel script entries
            filtered_lines = []
            removed_count = 0
            
            for line in lines:
                # Check if this line is a solar panel script entry
                if any(script in line for script in ['update_prices.py', 'check_flags.py', 'discover_panels.py', 'monitor_health.py']):
                    if dry_run:
                        print(f"Would remove: {line}")
                    removed_count += 1
                else:
                    filtered_lines.append(line)
            
            if removed_count == 0:
                print("No solar panel script cron jobs found")
                return True
            
            if dry_run:
                print(f"DRY RUN - Would remove {removed_count} cron jobs")
                return True
            
            # Install filtered crontab
            new_crontab = '\n'.join(filtered_lines)
            process = subprocess.Popen(['crontab', '-'], stdin=subprocess.PIPE, text=True)
            process.communicate(input=new_crontab)
            
            if process.returncode == 0:
                print(f"Successfully removed {removed_count} cron jobs")
                return True
            else:
                print("Failed to remove cron jobs")
                return False
                
        except Exception as e:
            print(f"Error removing cron jobs: {e}")
            return False
    
    def list_cron_jobs(self):
        """List current cron jobs"""
        try:
            result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
            if result.returncode != 0:
                print("No crontab found")
                return
            
            lines = result.stdout.split('\n')
            solar_jobs = []
            
            for line in lines:
                if any(script in line for script in ['update_prices.py', 'check_flags.py', 'discover_panels.py', 'monitor_health.py']):
                    solar_jobs.append(line)
            
            if solar_jobs:
                print("Current solar panel script cron jobs:")
                for job in solar_jobs:
                    print(f"  {job}")
            else:
                print("No solar panel script cron jobs found")
                
        except Exception as e:
            print(f"Error listing cron jobs: {e}")
    
    def setup_default_jobs(self):
        """Setup default cron jobs for solar panel management"""
        
        # Price updates - every 6 hours
        self.add_cron_job(
            schedule="0 */6 * * *",
            script="update_prices.py",
            args=["--limit", "50", "--verbose"],
            description="Update solar panel prices every 6 hours"
        )
        
        # Flag checking - every 2 hours
        self.add_cron_job(
            schedule="0 */2 * * *",
            script="check_flags.py",
            args=["--auto-resolve"],
            description="Check and auto-resolve flagged panels every 2 hours"
        )
        
        # Panel discovery - daily at 2 AM
        self.add_cron_job(
            schedule="0 2 * * *",
            script="discover_panels.py",
            args=["--max-pages", "5", "--verbose"],
            description="Discover new solar panels daily at 2 AM"
        )
        
        # Health monitoring - every hour
        self.add_cron_job(
            schedule="0 * * * *",
            script="monitor_health.py",
            args=["--check", "all"],
            description="Monitor system health every hour"
        )
        
        # Weekly health report - Sundays at 9 AM
        self.add_cron_job(
            schedule="0 9 * * 0",
            script="monitor_health.py",
            args=["--check", "all", "--verbose"],
            description="Weekly comprehensive health report"
        )

def main():
    parser = argparse.ArgumentParser(description='Manage cron jobs for solar panel scripts')
    parser.add_argument('action', choices=['install', 'remove', 'list', 'setup-defaults'],
                       help='Action to perform')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be done without making changes')
    parser.add_argument('--project-root', default=os.getcwd(),
                       help='Project root directory')
    
    args = parser.parse_args()
    
    cron_manager = CronManager(args.project_root)
    
    if args.action == 'install':
        success = cron_manager.install_cron_jobs(dry_run=args.dry_run)
        sys.exit(0 if success else 1)
    
    elif args.action == 'remove':
        success = cron_manager.remove_cron_jobs(dry_run=args.dry_run)
        sys.exit(0 if success else 1)
    
    elif args.action == 'list':
        cron_manager.list_cron_jobs()
    
    elif args.action == 'setup-defaults':
        cron_manager.setup_default_jobs()
        success = cron_manager.install_cron_jobs(dry_run=args.dry_run)
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
