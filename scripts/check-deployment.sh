#!/bin/bash

# Check deployment status of MCP Server stack

STAGE=${STAGE:-dev}
STACK_NAME="VoltasisMCPServerStack-${STAGE}"

echo "Checking deployment status for ${STACK_NAME}..."
echo ""

# Check stack status
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Stack ${STACK_NAME} not found or error occurred"
    exit 1
fi

echo "📊 Stack Status: ${STACK_STATUS}"

# Check if deployment is complete
if [[ "$STACK_STATUS" == "CREATE_COMPLETE" || "$STACK_STATUS" == "UPDATE_COMPLETE" ]]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔑 Stack Outputs:"
    aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
    
    # Extract key values
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --query 'Stacks[0].Outputs[?OutputKey==`MCPApiUrl`].OutputValue' \
        --output text)
    
    API_KEY_ID=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --query 'Stacks[0].Outputs[?OutputKey==`MCPApiKeyId`].OutputValue' \
        --output text)
    
    BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --query 'Stacks[0].Outputs[?OutputKey==`MCPDocsBucketName`].OutputValue' \
        --output text)
    
    echo ""
    echo "📝 Next Steps:"
    echo "1. Get your API key value:"
    echo "   aws apigateway get-api-key --api-key ${API_KEY_ID} --include-value --query 'value' --output text"
    echo ""
    echo "2. Upload documentation:"
    echo "   ./scripts/upload-docs.sh"
    echo ""
    echo "3. Configure Cursor:"
    echo "   ./scripts/configure-cursor-aws.sh"
    
elif [[ "$STACK_STATUS" == *"IN_PROGRESS" ]]; then
    echo "⏳ Deployment in progress..."
    echo "Run this script again in a few minutes to check status."
elif [[ "$STACK_STATUS" == *"FAILED" || "$STACK_STATUS" == *"ROLLBACK" ]]; then
    echo "❌ Deployment failed!"
    echo "Check CloudFormation events for details:"
    echo "aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --query 'StackEvents[?ResourceStatus==\`CREATE_FAILED\`]'"
fi 