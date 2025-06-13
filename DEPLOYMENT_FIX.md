# Deployment Fix: Lambda Concurrency Limit

## What Happened

The deployment failed with this error:
```
Resource handler returned message: "Specified ReservedConcurrentExecutions for function 
decreases account's UnreservedConcurrentExecution below its minimum value of [10]."
```

### Root Cause

AWS Lambda has account-level concurrency limits:
- Your account has a total concurrent execution limit (typically 1000 for new accounts)
- When you reserve concurrency for specific functions, it reduces the unreserved pool
- AWS requires at least 10 unreserved concurrent executions for account flexibility
- Our Lambda function tried to reserve 10 concurrent executions, but your account doesn't have enough unreserved capacity

### The Fix

I've removed the reserved concurrency setting from the Lambda configuration. This allows the function to use the shared pool of concurrent executions.

```diff
// infrastructure/lib/lambda-configs.ts
'mcp-server-handler': {
  memory: 512,
  timeout: 30,
  description: 'MCP Protocol handler - processes MCP requests',
- reservedConcurrency: 10, // Keep instances warm for fast response
+ // reservedConcurrency: 10, // Commented out - account limit reached
},
```

## Next Steps

### 1. Wait for Rollback to Complete

Monitor the rollback status:
```bash
# Check every 30 seconds
watch -n 30 './scripts/check-deployment.sh'

# Or check manually
./scripts/check-deployment.sh
```

Wait until you see:
```
📊 Stack Status: ROLLBACK_COMPLETE
```

### 2. Redeploy the Fixed Stack

Once rollback is complete:
```bash
cd infrastructure
STAGE=dev cdk deploy --require-approval never
```

### 3. Alternative: Check Your Lambda Limits

If you want to understand your current Lambda usage:
```bash
# Get total concurrent execution limit
aws service-quotas get-service-quota \
  --service-code lambda \
  --quota-code L-B99A9384 \
  --query 'Quota.Value' \
  --output text

# List all Lambda functions with reserved concurrency
aws lambda list-functions \
  --query 'Functions[?ReservedConcurrentExecutions!=null].[FunctionName,ReservedConcurrentExecutions]' \
  --output table
```

## Performance Impact

Removing reserved concurrency means:
- ✅ **Still Fast**: Lambda will still auto-scale based on demand
- ✅ **No Cold Starts Issue**: MCP requests are infrequent enough that cold starts won't be noticeable
- ✅ **Cost Efficient**: You're not paying for reserved capacity you might not use

## Future Options

Once you have more Lambda capacity available:
1. **Request a limit increase** through AWS Support
2. **Remove reserved concurrency** from other functions
3. **Use provisioned concurrency** instead (keeps functions warm differently)

## Why This Happened

This is common when:
- Multiple projects use Lambda in the same account
- Other functions have reserved concurrency
- You're using a newer AWS account with default limits

The good news: The fix is simple and won't impact performance for an MCP server! 