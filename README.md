# API Gateway Lambda Authorizer のテスト

API Gateway のリソースポリシーが認証ワークフローに与える影響の検証  
参考 : https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-authorization-flow.html#apigateway-resource-policies-iam-policies-interaction

## 要件

リクエストヘッダー : `AuthToken` の値によって Lambda Authorizer が接続可否を判断。Authorizer 結果はキャッシュされる。

## 実現したいこと

リクエストヘッダー : `AuthToken` の値が...

* `123` の時
    * /res1, /res2, /res3/{id} に接続可能
* `456` の時
    * /res1, /res2 は接続不可
    * /res3/{id} は接続可能
* それ以外の時
    * 全てのリソースに接続不可

## リクエスト例

* AuthToken: 123 で /res1 に接続（許可されるはず）
    ```
    $ curl -H 'AuthToken: 123' https://&lt;API Gateway&gt;/prod/res1
    ```

* AuthToken: 456 で /res3/{id} に接続（許可されるはず）
    ```
    $ curl -H 'AuthToken: 456' https://&lt;API Gateway&gt;/prod/res3/abc
    ```

* AuthToken: 789 で /res2 に接続（拒否されるはず）
    ```
    $ curl -H 'AuthToken: 789' https://&lt;API Gateway&gt;/prod/res2
    ```

## 作成される API Gateway リソース

* /res1  (Authorizer:有効、AuthToken: 123 が接続できる)
* /res2  (Authorizer:有効、AuthToken: 123 が接続できる)
* /res3/{id} (Authorizer:有効、AuthToken: 123、456 が接続できる)
* /res4  (Authorizer:無効、API キー必須)