#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ApigatewayLambdaAuthorizerStack } from '../lib/apigateway-lambda-authorizer-stack';

const app = new cdk.App();
new ApigatewayLambdaAuthorizerStack(app, 'TestApigatewayLambdaAuthorizerStack', {});
