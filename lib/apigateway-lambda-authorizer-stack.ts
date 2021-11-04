import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';

import * as mock from './mock-lambda';

const allowedIpCidr: string[] = [
  // Allowed IP CIDR list for API Gateway resource policy (or specify context as string[] at cdk.json)
  // ex) 'x.x.x.x/32'
];

export class ApigatewayLambdaAuthorizerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const STACK_NAME :string = id;

    const allowedIpCidrFromContext = this.node.tryGetContext('allowedIpCidr') as string[];

    // -----------------------------
    // Authorizer Lambda
    // -----------------------------

    // Role
    const role = new iam.Role(this, 'authorizer-lambda-role', {
      roleName: `${STACK_NAME}-Authorizer-Lambda-Role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Authorizer Lambda by CDK',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Lambda
    const lambdaFunction = new lambda.Function(this, 'authorizer-lambda', {
      functionName: `${STACK_NAME}-Authorizer-Lambda`,
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.AssetCode.fromAsset('lambda-authorizer'),
      handler: 'app.lambda_handler',
      timeout: cdk.Duration.seconds(300),
      role: role,
      environment: {
        NAME_PREFIX: STACK_NAME,
        LOG_LEVEL: 'DEBUG'
      }
      // tracing: lambda.Tracing.ACTIVE
    });

    // -----------------------------
    // Mock Lambda
    // -----------------------------
    const mockLambda = new mock.MockLambda(this, id);

    // -----------------------------
    // API Gateway (REST)
    // -----------------------------

    // Resource policy for API Gateway
    const whitelistedIps = (allowedIpCidr.length > 0 ? allowedIpCidr : allowedIpCidrFromContext)
    const apiResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*'],
        }),
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*'],
          conditions: {
            'NotIpAddress': {
              "aws:SourceIp": whitelistedIps
            }
          }
        })
      ]
    });

    // Access Log for API Gateway
    const apiGatewayAccessLogGroup = logs.LogGroup.fromLogGroupName(this, 'apigateway-access-logs', '/aws/apigateway/accesslog');

    // API Gateway (REST)
    const api = new apigateway.RestApi(this, 'apigateway',{
      restApiName: `${STACK_NAME}-Apigw`,
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      description: 'API Gateway by CDK',
      policy: apiResourcePolicy,
      deployOptions: {
        dataTraceEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiGatewayAccessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        stageName: 'prod',
        cacheClusterEnabled: true,
        cachingEnabled: true,
        cacheDataEncrypted: true,
        cacheTtl: cdk.Duration.seconds(300),
        cacheClusterSize: '0.5'
      }
    });

    // API Key
    const apiKey = api.addApiKey('api-key', {
      apiKeyName: 'MyAPIKey'
    });

    const usagePlan = api.addUsagePlan('usage-plan-res4', {
      name: 'UsagePlan-For-res4',
      apiStages: [
        {
          api: api,
          stage: api.deploymentStage
        }
      ]
    });
    usagePlan.addApiKey(apiKey);

    /*
    // -----------------------------
    // Lambda Authorizer (Token)
    // -----------------------------
    const lambdaAuthorizerForToken = new apigateway.TokenAuthorizer(this, `${PREFIX}-authorizer`, {
      handler: lambdaFunction,
      authorizerName: 'token-authorizer',
      identitySource: apigateway.IdentitySource.header('AuthToken'),
      resultsCacheTtl: cdk.Duration.seconds(300),
      validationRegex: '[0-9]{1,3}'
    });
    */

    // -----------------------------
    // Lambda Authorizer (Request)
    // -----------------------------
    const lambdaAuthorizerForRequest = new apigateway.RequestAuthorizer(this, `${STACK_NAME}-authorizer-for-request`, {
      handler: lambdaFunction,
      authorizerName: 'token-authorizer-for-request',
      identitySources: [
        apigateway.IdentitySource.header('AuthToken'),
        apigateway.IdentitySource.context('resourcePath')
      ],
      resultsCacheTtl: cdk.Duration.seconds(300)
    });

    // -----------------------------
    // Resources
    // -----------------------------

    // 'res1' -> /res1
    const resource1 = api.root.addResource('res1');
    const mockIntegration_for_res1 = new apigateway.MockIntegration({
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': '{ "requested": "/res1", "authrized_time": "$context.authorizer.authrized_time" }'
          }
        }
      ]
    });
    resource1.addMethod('GET', mockIntegration_for_res1, {
      methodResponses: [
        {
          statusCode: '200'
        }
      ],
      authorizer: lambdaAuthorizerForRequest
    });

    // 'res2' -> /res2
    const resource2 = api.root.addResource('res2');
    const mockIntegration_for_res2 = new apigateway.MockIntegration({
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': '{ "requested": "/res2", "authrized_time": "$context.authorizer.authrized_time" }'
          }
        }
      ]
    });
    resource2.addMethod('GET', mockIntegration_for_res2, {
      methodResponses: [
        {
          statusCode: '200'
        }
      ],
      authorizer: lambdaAuthorizerForRequest
    });

    // 'res3' -> /res3/{vin}
    const resource3 = api.root.addResource('res3');
    const resource3_param = resource3.addResource('{id}');
    const mockIntegration_for_res3 = new apigateway.MockIntegration({
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': '{ "requested": "/res3/{id}", "authrized_time": "$context.authorizer.authrized_time" }'
          }
        }
      ]
    });
    resource3_param.addMethod('GET', mockIntegration_for_res3, {
      methodResponses: [
        {
          statusCode: '200'
        }
      ],
      authorizer: lambdaAuthorizerForRequest
    });

    // 'res4' -> /res4
    const resource4 = api.root.addResource('res4');
    resource4.addMethod('GET', new apigateway.LambdaIntegration(mockLambda.lambda), {
      apiKeyRequired: true
    });

    // -----------------------------
    // Output
    // -----------------------------
    new cdk.CfnOutput(this, 'URL', {
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/`
    });
    new cdk.CfnOutput(this, 'APIKey', {
        value: apiKey.keyId
    });
  }
}
