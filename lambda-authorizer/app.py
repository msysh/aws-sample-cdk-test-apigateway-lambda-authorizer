import datetime
import json
import logging
import os
import re

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv('LOG_LEVEL', 'WARNING'))
formatter = logging.Formatter("%(asctime)s %(name)s:%(lineno)s [%(levelname)s] %(funcName)s : %(message)s", "%Y-%m-%dT%H:%M:%S%z")

for handler in logger.handlers:
    handler.setFormatter(formatter)

class Authorizer:

    __re_validate_resource = re.compile(r'.+/res(1|3/.+)$')

    @property
    def token(self):
        return self.__token

    @property
    def path(self):
        return self.__path

    def __init__(self, token, path) -> None:
        self.logger = logger.getChild('Authorizer')
        self.__token = token
        self.__path = path
        logger.debug(f"token: {self.token}")
        logger.debug(f"path: {self.path}")

    def authorize(self):
        if self.token == '123':
            is_authorized = True
            resource_path = "*/*"
        elif self.token == '456':
            if re.match(r'/res3/(.+)', self.path):
                is_authorized = True
                resource_path = "*/res3/*"
            else:
                is_authorized = False
                #resource_path = f"*{self.path}"
                resource_path = "*/*"
        else:
            is_authorized = False
            resource_path = "*/*"

        return self.response_builder(is_authorized, resource_path)

    def response_builder(self, isAuthorized, resource_path):
        effect = 'Deny'
        if isAuthorized:
            effect = 'Allow'

        logger.debug(f"policy effect: {effect}")

        response = {
            'principalId' : 1,
            'policyDocument' : {
                'Version' : '2012-10-17',
                'Statement' : [
                    {
                        'Action': 'execute-api:Invoke',
                        'Effect': effect,
                        'Resource': f"arn:aws:execute-api:*:*:*/*/{resource_path}"
                    }
                ]
            },
            'context': {
                'authrized_time': datetime.datetime.now().strftime('%Y/%m/%d %H:%M:%S.%f')
            }
        }

        logger.debug(f"response: {response}")
        return response

def lambda_handler(event, context):

    logger.debug(f"event: {event}")
    logger.debug(f"context: {context}")

    if 'authorizationToken' in event:
        token = event['authorizationToken']
    else:
        token = event['headers']['authtoken']

    auth = Authorizer(token, event['path'])
    return auth.authorize()