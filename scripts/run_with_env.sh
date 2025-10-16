#!/bin/bash
# Helper script to run Python scripts with proper environment setup
# Usage: ./scripts/run_with_env.sh <script_name> [args...]
# Example: ./scripts/run_with_env.sh check_flags.py --verbose

# Check if SUPABASE_SERVICE_KEY is set
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_KEY environment variable is not set"
    echo ""
    echo "To fix this, set your Supabase service role key:"
    echo "  export SUPABASE_SERVICE_KEY='your-service-role-key'"
    echo ""
    echo "You can get your service role key from:"
    echo "  https://supabase.com/dashboard/project/wmdurgdpktfmyykonrus/settings/api"
    echo ""
    echo "Look for the 'service_role' key (starts with 'eyJ'), NOT the 'anon' key"
    echo ""
    echo "Or run the script inline:"
    echo "  SUPABASE_SERVICE_KEY='your-key' $0 $@"
    exit 1
fi

# Activate virtual environment
if [ -f "dev/bin/activate" ]; then
    source dev/bin/activate
else
    echo "❌ Error: Virtual environment not found at dev/bin/activate"
    echo "Please run: python3 -m venv dev && source dev/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Run the script with all arguments
echo "🚀 Running: python scripts/$1 ${@:2}"
echo "📍 Using Supabase URL: $(python -c "from scripts.config import config; print(config.SUPABASE_URL)")"
echo ""

python "scripts/$1" "${@:2}"
