import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getMCPLambdaConfig } from './lambda-configs';

export interface VoltasisMCPServerStackProps extends cdk.StackProps {
  stage: string;
}

export class VoltasisMCPServerStack extends cdk.Stack {
  public readonly docsBucket: s3.Bucket;
  public readonly indexTable: dynamodb.Table;
  public readonly distribution: cloudfront.Distribution;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: VoltasisMCPServerStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // S3 Bucket for MCP Documentation
    this.docsBucket = new s3.Bucket(this, 'MCPDocsBucket', {
      bucketName: `voltasis-mcp-docs-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // DynamoDB Table for Document Index and Metadata
    this.indexTable = new dynamodb.Table(this, 'MCPIndexTable', {
      tableName: `voltasis-mcp-index-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for search functionality
    this.indexTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for tag-based search
    this.indexTable.addGlobalSecondaryIndex({
      indexName: 'TagIndex',
      partitionKey: { name: 'tag', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'relevance', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'MCPOAI', {
      comment: `OAI for Voltasis MCP Documentation ${stage}`,
    });

    // Grant CloudFront access to S3
    this.docsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.docsBucket.arnForObjects('*')],
        principals: [originAccessIdentity.grantPrincipal],
      })
    );

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'MCPDistribution', {
      comment: `Voltasis MCP Documentation Distribution ${stage}`,
      defaultBehavior: {
        origin: new origins.S3Origin(this.docsBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: new cloudfront.CachePolicy(this, 'MCPCachePolicy', {
          defaultTtl: cdk.Duration.hours(24),
          maxTtl: cdk.Duration.days(7),
          minTtl: cdk.Duration.minutes(0),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        }),
        compress: true,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'MCPLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        MCPServerAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
              ],
              resources: [
                this.indexTable.tableArn,
                `${this.indexTable.tableArn}/index/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: [this.docsBucket.bucketArn, `${this.docsBucket.bucketArn}/*`],
            }),
          ],
        }),
      },
    });

    // MCP Server Lambda Function
    const mcpServerConfig = getMCPLambdaConfig('mcp-server-handler');
    const mcpServerFunction = new lambdaNodejs.NodejsFunction(this, 'MCPServerFunction', {
      functionName: `voltasis-mcp-server-${stage}`,
      entry: 'lambda/mcp-server/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(mcpServerConfig.timeout),
      memorySize: mcpServerConfig.memory,
      reservedConcurrentExecutions: mcpServerConfig.reservedConcurrency,
      role: lambdaRole,
      environment: {
        STAGE: stage,
        DOCS_BUCKET: this.docsBucket.bucketName,
        INDEX_TABLE: this.indexTable.tableName,
        CLOUDFRONT_URL: `https://${this.distribution.distributionDomainName}`,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: stage === 'prod',
        sourceMap: true,
        sourcesContent: false,
        target: 'es2020',
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-s3',
          '@aws-sdk/lib-dynamodb',
        ],
        forceDockerBundling: false,
      },
      description: mcpServerConfig.description,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });

    // API Gateway for MCP Protocol
    this.api = new apigateway.RestApi(this, 'MCPAPI', {
      restApiName: `voltasis-mcp-api-${stage}`,
      description: 'Voltasis MCP Server API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-MCP-Version',
        ],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: stage,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        metricsEnabled: true,
        dataTraceEnabled: stage !== 'prod',
        loggingLevel: stage === 'prod' ? apigateway.MethodLoggingLevel.ERROR : apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
      },
      // API Key for authentication
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
    });

    // Create API Key
    const apiKey = new apigateway.ApiKey(this, 'MCPApiKey', {
      apiKeyName: `voltasis-mcp-key-${stage}`,
      description: 'API Key for Voltasis MCP Server access',
      enabled: true,
    });

    // Create Usage Plan
    const usagePlan = new apigateway.UsagePlan(this, 'MCPUsagePlan', {
      name: `voltasis-mcp-usage-${stage}`,
      description: 'Usage plan for MCP Server API',
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.DAY,
      },
    });

    // Associate API Key with Usage Plan
    usagePlan.addApiKey(apiKey);

    // MCP Protocol endpoints
    const mcpResource = this.api.root.addResource('mcp');
    
    // Main MCP handler - handles all protocol methods
    mcpResource.addMethod('POST', new apigateway.LambdaIntegration(mcpServerFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    }), {
      apiKeyRequired: true,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Document Processor Lambda
    const docProcessorConfig = getMCPLambdaConfig('mcp-document-processor');
    const docProcessorFunction = new lambdaNodejs.NodejsFunction(this, 'DocProcessorFunction', {
      functionName: `voltasis-mcp-doc-processor-${stage}`,
      entry: 'lambda/document-processor/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(docProcessorConfig.timeout),
      memorySize: docProcessorConfig.memory,
      role: lambdaRole,
      environment: {
        STAGE: stage,
        DOCS_BUCKET: this.docsBucket.bucketName,
        INDEX_TABLE: this.indexTable.tableName,
      },
      bundling: {
        minify: stage === 'prod',
        sourceMap: true,
        target: 'es2020',
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-s3',
          '@aws-sdk/lib-dynamodb',
        ],
      },
      description: docProcessorConfig.description,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant write permissions to document processor
    this.docsBucket.grantWrite(docProcessorFunction);
    this.indexTable.grantWriteData(docProcessorFunction);

    // Index Builder Lambda
    const indexBuilderConfig = getMCPLambdaConfig('mcp-index-builder');
    const indexBuilderFunction = new lambdaNodejs.NodejsFunction(this, 'IndexBuilderFunction', {
      functionName: `voltasis-mcp-index-builder-${stage}`,
      entry: 'lambda/index-builder/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(indexBuilderConfig.timeout),
      memorySize: indexBuilderConfig.memory,
      role: lambdaRole,
      environment: {
        STAGE: stage,
        DOCS_BUCKET: this.docsBucket.bucketName,
        INDEX_TABLE: this.indexTable.tableName,
      },
      bundling: {
        minify: stage === 'prod',
        sourceMap: true,
        target: 'es2020',
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-s3',
          '@aws-sdk/lib-dynamodb',
        ],
      },
      description: indexBuilderConfig.description,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to index builder
    this.docsBucket.grantRead(indexBuilderFunction);
    this.indexTable.grantWriteData(indexBuilderFunction);

    // Webhook Handler Lambda for CI/CD Integration
    const webhookHandlerConfig = getMCPLambdaConfig('mcp-webhook-handler');
    const webhookHandlerFunction = new lambdaNodejs.NodejsFunction(this, 'WebhookHandlerFunction', {
      functionName: `voltasis-mcp-webhook-handler-${stage}`,
      entry: 'lambda/webhook-handler/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(webhookHandlerConfig.timeout),
      memorySize: webhookHandlerConfig.memory,
      role: lambdaRole,
      environment: {
        STAGE: stage,
        DOCS_BUCKET: this.docsBucket.bucketName,
        INDEX_TABLE: this.indexTable.tableName,
        CLOUDFRONT_DISTRIBUTION_ID: this.distribution.distributionId,
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'default-webhook-secret',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      },
      bundling: {
        minify: stage === 'prod',
        sourceMap: true,
        target: 'es2020',
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-s3',
          '@aws-sdk/lib-dynamodb',
          '@aws-sdk/client-cloudfront',
        ],
      },
      description: webhookHandlerConfig.description,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant permissions to webhook handler
    this.docsBucket.grantReadWrite(webhookHandlerFunction);
    this.indexTable.grantReadWriteData(webhookHandlerFunction);

    // Add CloudFront invalidation permissions
    webhookHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::*:distribution/${this.distribution.distributionId}`],
    }));

    // Webhook endpoints
    const webhookResource = this.api.root.addResource('webhook');
    
    // GitHub webhook endpoint (no API key required for webhooks)
    webhookResource.addMethod('POST', new apigateway.LambdaIntegration(webhookHandlerFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    }), {
      apiKeyRequired: false, // Webhooks use signature verification instead
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'MCPApiUrl', {
      value: this.api.url,
      description: 'MCP Server API URL',
      exportName: `MCPApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPApiKeyId', {
      value: apiKey.keyId,
      description: 'MCP API Key ID',
      exportName: `MCPApiKeyId-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPDocsBucketName', {
      value: this.docsBucket.bucketName,
      description: 'MCP Documentation S3 bucket name',
      exportName: `MCPDocsBucketName-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPCloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'MCP Documentation CloudFront URL',
      exportName: `MCPCloudFrontUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPCloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID for cache invalidation',
      exportName: `MCPCloudFrontDistributionId-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPIndexTableName', {
      value: this.indexTable.tableName,
      description: 'DynamoDB table for document indexes',
      exportName: `MCPIndexTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'MCPWebhookUrl', {
      value: `${this.api.url}webhook`,
      description: 'Webhook URL for CI/CD integration',
      exportName: `MCPWebhookUrl-${stage}`,
    });
  }
} 