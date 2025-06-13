#!/bin/bash

echo "MCP Debug Log Monitor"
echo "===================="
echo "Monitoring /tmp/mcp-debug.log"
echo "Press Ctrl+C to stop"
echo ""

# Clear the log file to start fresh
> /tmp/mcp-debug.log

# Monitor the log file
tail -f /tmp/mcp-debug.log | while read line; do
    # Color code based on log level
    if [[ $line == *"[ERROR]"* ]]; then
        echo -e "\033[31m$line\033[0m"  # Red
    elif [[ $line == *"[WARN]"* ]]; then
        echo -e "\033[33m$line\033[0m"  # Yellow
    elif [[ $line == *"[INFO]"* ]]; then
        echo -e "\033[32m$line\033[0m"  # Green
    elif [[ $line == *"[DEBUG]"* ]]; then
        echo -e "\033[36m$line\033[0m"  # Cyan
    else
        echo "$line"
    fi
done 