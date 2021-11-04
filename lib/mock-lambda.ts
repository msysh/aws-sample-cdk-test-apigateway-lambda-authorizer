import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';

export interface MockLambdaProps {

}

export class MockLambda extends cdk.Construct {

    public readonly lambda: lambda.Function;

    constructor(scope: cdk.Construct, id: string, props: MockLambdaProps = {}) {
        super(scope, id);

        const STACK_NAME :string = id;

        // -----------------------------
        // Mock Lambda
        // -----------------------------

        // Role
        const role = new iam.Role(this, 'mock-lambda-role', {
            roleName: `${STACK_NAME}-Mock-Lambda-Role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Role for Mock Lambda by CDK',
            managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });

        // Lambda
        const lambdaFunction = new lambda.Function(this, 'mock-lambda', {
            functionName: `${STACK_NAME}-Mock-Lambda`,
            runtime: lambda.Runtime.PYTHON_3_9,
            code: lambda.AssetCode.fromAsset('lambda-mock'),
            handler: 'app.lambda_handler',
            timeout: cdk.Duration.seconds(300),
            role: role,
            environment: {
                NAME_PREFIX: STACK_NAME,
                LOG_LEVEL: 'DEBUG'
            }
            // tracing: lambda.Tracing.ACTIVE
        });

        this.lambda = lambdaFunction;
    }
}