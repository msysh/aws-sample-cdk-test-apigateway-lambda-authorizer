import datetime
import json
import logging
import os

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv('LOG_LEVEL', 'WARNING'))

def lambda_handler(event, context):

    logger.debug(f"event: {event}")

    return {
        'statusCode': 200,
        'body': json.dumps({
            'invokedAt': datetime.datetime.now().strftime('%Y/%m/%d %H:%M:%S.%f')
        })
    }