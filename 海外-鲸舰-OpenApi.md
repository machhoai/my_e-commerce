# Global Parameters

**Global Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Global Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Global Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Global Auth**

> NO Auth

# Response Codes

| Response Codes | Description |
| -------------- | ----------- |
| No parameters |

# 接入须知

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-08-17 13:36:55

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 接入指南

> Creator: 龚明明

> Updater: 陈创新

> Created Time: 2021-03-25 09:36:59

> Update Time: 2026-03-05 10:25:46

#### 名字解析：

**AppId: 由系统生成，绑定对应的门店Id，用于确定唯一应用或唯一门店。,秘钥: 由系统生成，用于通信中鉴权时所使用的加密秘钥。,ApiUrl: 每家门店都有自己特定的调用url，用于通信时，所发送的目标地址。,推送地址: 由OpenApi的调用方填写，系统会在运行时，对于有通知行为的操作，调用指定接口通知到调用方。**

#### 接入步骤

##### 1. 获取门店后台

**联系宝点客服，获取门店后的登录账号和密码。**

##### 2. 获取AppId和秘钥

**进入门店后台，设置，开放平台菜单中，可看到接口对应的AppId和通信秘钥。**

**[object Object]**

##### 4. 接口对接并测试上线

#### 注意事项：

**推送规则：系统会在操作执行完成后，进行消息推送，如果推送失败，则在5秒后再次推送，共推送5次，如果5次都失败，则停止推送。,秘钥管理：秘钥是和系统进行通信的唯一凭证，请妥善保管不要泄露。**

**Query**

## 签名规则

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-08-18 23:36:06

#### 通用参数与业务参数

**接口请求中，包含“通用参数”和“业务参数”两类：,通用参数：每个接口都需要使用的参数，包括(appid, action, version, timestamp, sign)
业务参数：包含在body中的参数，每个业务所使用的参数不一样。**

#### 请求数据验签

**[object Object]**

**action: 操作名称,version: 版本号,timestamp: 时间戳,sign: 签名内容,body: 业务主体数据**

**验签方式：签名(sign)的生成规则为：appid + action + version + timestamp + body + key, 以上各字段相加后，生成的字符串进行MD5加密(大写)。,以上示例中验签规则为：be559b49662c4b609c5944eda383fefdmember_join10.11.817238229675851234567890，将此字符串进行MD5加密，得到的结果与sign进行比对。**

#### 推送数据验签

**回复的数据为包含两个参数的JSON：**

**[object Object]**

**timestamp：时间戳,sign: 签名内容,data: 数据内容**

**验签方式：将appid+timestamp+data+key的数据进行MD5加密，得到的结果与sign进行比对。**

**Query**

# 会员

> Creator: 龚明明

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-08-17 10:58:56

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | - | string | Yes | AppId |
| action | - | string | Yes | 业务函数名称 |
| version | - | string | Yes | 接口版本号 |
| timestamp | - | string | Yes | 当前13位时间戳 |
| sign | - | string | Yes | 签名字符串 |

**Folder Auth**

> Inherit auth from parent

**Query**

## 会员入会

> Creator: 石元考

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-19 13:26:13

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "fb3aa300d5694abbb807472ae405f772",
	"action": "member_join",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "E881327E4D507DF32705E85DCDB1C9E0",
	"body": "{\"openId\":\"7882967938834104333\",\"phone\":\"15111553941\",\"realName\":\"萧亚\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | be559b49662c4b609c5944eda383fefd | string | Yes | AppId |
| action | member_join | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | BFEF07041AF4ABBD237F741DCFF6AA58 | string | Yes | 签名字符串 |
| body | {"openId":"oa7Z85AStb8CcesuwUsLbXgJRfRA","phone":"18772576004","realName":"\u675C\u4E9A"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "注册成功",
	"data": {
		"uid": "9f497f7d-5be6-11ef-a734-0c42a1b7b4ae"
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 注册成功 | string | 业务描述 |
| data | - | object | 业务数据 |
| data.uid | 9f497f7d-5be6-11ef-a734-0c42a1b7b4ae | string | - |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "会员注册失败"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 会员注册失败 | string | 业务描述 |

**Query**

## 手机号入会

> Creator: 石元考

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-11-13 15:12:30

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_phone_join",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "A2B6477A1A9B3D1A1897F10BAAF1E9C6",
	"body": "{\"phone\":\"13587456711\",\"realName\":\"萧亚\",\"password\":\"456789\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | member_phone_join | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | E881327E4D507DF32705E85DCDB1C9E0 | string | Yes | - |
| body | {"phone":"15111553941","realName":"萧亚","password":"123456"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":{"mid":"c4280382-cf38-477a-99e4-6593ef9047a3","uid":"f3257f2f-08a2-4995-ba11-4b4069524b96"},"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 是否成功 |
| msg | - | string | 消息 |
| code | 0 | integer | 错误码 |
| data | - | object | 数据JSON |
| data.mid | c4280382-cf38-477a-99e4-6593ef9047a3 | string | 会员ID |
| data.uid | f3257f2f-08a2-4995-ba11-4b4069524b96 | string | 会员账户ID |
| desc | - | string | 描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员二维码

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-26 15:25:43

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_qrcode",
	"version": "10.11.8",
	"timestamp": "1733306429568",
	"sign": "A640EF328C909F2E99B0C84B9AE09396",
	"body": "{\"uid\":\"b012239a-34d4-43dc-9836-9ce9887a2004\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | be559b49662c4b609c5944eda383fefd | string | Yes | - |
| action | member_qrcode | string | Yes | 业务函数名称 |
| version | 1.0.0 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | 111 | string | Yes | 签名字符串 |
| body | {"uid": "yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "会员码生成成功",
	"data": {
		"code": "H817882967938834104324",
		"expire": 120
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 会员码生成成功 | string | 业务描述 |
| data | - | object | 业务数据 |
| data.code | H817882967938834104324 | string | 会员码文本 |
| data.expire | 120 | integer | - |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "获取会员二维码失败,原因:会员编码不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 获取会员二维码失败,原因:会员编码不存在 | string | 业务描述 |

**Query**

## 会员增加储值

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-12-22 22:24:15

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "be559b49662c4b609c5944eda383fefd",
	"action": "member_addstored",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"uid\": \"b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae\",\"tradeNo\": \"7882967938834104325\",\"category\": 1001,\"storedCategory\": 1,\"storedValue\": 50,\"effectiveDays\": 0,\"bizCode\": \"7882967938834104327\",\"remark\": \"购买套餐入账50枚游戏币\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 7882967938834104323 | string | Yes | AppId |
| action | member_addstored | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | 签名字符串 |
| body | - | object | Yes | 业务参数 |
| body.uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| body.tradeNo | 7882967938834104325 | string | No | 交易单号 |
| body.category | 1001 | integer | Yes | 入账业务类型（购买充值=1001，手工入账=1004，其它入账=1099） |
| body.storedCategory | 1 | integer | Yes | 入账储值类型（游戏币=1，积分=5，彩票=6，蓝票=7） |
| body.storedValue | 50 | integer | Yes | 入账储值数量 |
| body.effectiveDays | 0 | integer | Yes | 入账储值有效天数，为0时表示不过期 |
| body.bizCode | 7882967938834104327 | string | Yes | 业务唯一标识 |
| body.remark | 购买套餐入账50枚游戏币 | string | Yes | 入账描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "入账成功",
	"data": {
		"totalValue": 500
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 入账成功 | string | 业务描述 |
| data | - | object | 业务数据 |
| data.totalValue | 500 | integer | 账户总数量 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "入账失败,会员信息不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 入账失败,会员信息不存在 | string | 业务描述 |

**Query**

## 会员扣减储值

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-12-03 13:10:13

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "member_reducestored",
	"version": "10.11.8",
	"timestamp": "1764741313858",
	"sign": "36B52E797C166FE3B5F282CC29553469",
	"body": "{\"uid\":\"3ccf32c6-ac1f-4cd9-93e8-ac086cd7b7b1\",\"tradeNo\":\"202512031355137532\",\"category\":2001,\"storedCategory\":11,\"storedValue\":5,\"bizCode\":\"202512031355137532\",\"remark\":\"套餐退餐出账5枚游戏币\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | be559b49662c4b609c5944eda383fefd | string | Yes | AppId |
| action | member_reducestored | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | 签名字符串 |
| body | - | object | Yes | 业务参数 |
| body.uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| body.tradeNo | 7882967938834104325 | string | Yes | 交易单号 |
| body.category | 2001 | integer | Yes | 出账业务类型（会员提币=2001，销售退餐=2002，其它出账=2099） |
| body.storedCategory | 1 | integer | Yes | 出账储值类型（游戏币=1，积分=5，彩票=6，蓝票=7） |
| body.storedValue | 50 | integer | Yes | 出账储值数量 |
| body.bizCode | 7882967938834104327 | string | Yes | 业务唯一标识 |
| body.remark | 套餐退餐出账50枚游戏币 | string | Yes | 出账描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "出账成功",
	"data": {
		"totalValue": 450
	}
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员储值账户余额不足"
}
```

**Query**

## 通过会员码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:42:51

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_qrcode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "72E1A2E037A073EF6AA9B9E1DFEC1CB4",
	"body": "{\"eCode\":\"H8122CFF2CE14D65299D8A00C1BE656C47E\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | AppId |
| action | member_getmember_qrcode | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | 72E1A2E037A073EF6AA9B9E1DFEC1CB4 | string | Yes | 签名字符串 |
| body | {"eCode":"H8122CFF2CE14D65299D8A00C1BE656C47E"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
		"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
		"phone": "13100000000",
		"realName": "张三",
		"sex": "男",
		"levelName":"黄金会员",
		"storedValue": [
			{
				"category": 1001,
				"value": 500
			},
			{
				"category": 1002,
				"value": 800
			}
		]
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | - | string | 业务描述 |
| data | - | object | 业务数据 |
| data.uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | 会员编码 |
| data.phone | 13100000000 | string | 手机号码 |
| data.realName | 张三 | string | 会员名称 |
| data.sex | 男 | string | 会员性别 |
| data.levelName | 黄金会员 | string | 会员等级 |
| data.storedValue | - | array | 会员储值 |
| data.storedValue.category | 1001 | integer | 储值类型 |
| data.storedValue.value | 500 | integer | 储值数量 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员码已过期"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 操作失败,原因:会员码已过期 | string | 业务描述 |

**Query**

## 通过会员卡号获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-12-22 22:24:09

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "77c33f0f456c41d0904351eb4c18b91d",
	"action": "member_getmember_membercode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "946F6802CCBE51B5ADAE962ED59A72BC",
	"body": "{\"memberCode\":\"00243239\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | AppId |
| action | member_getmember_membercode | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | 946F6802CCBE51B5ADAE962ED59A72BC | string | Yes | 签名字符串 |
| body | {"memberCode":"MR01PAY020000059"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
		"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
		"phone": "13100000000",
		"realName": "张三",
		"sex": "男",
		"levelName": "黄金会员",
		"storedValue": [
			{
				"category": 1001,
				"value": 500
			},
			{
				"category": 1002,
				"value": 800
			}
		]
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | - | string | 业务描述 |
| data | - | object | 业务数据 |
| data.uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | 会员编码 |
| data.phone | 13100000000 | string | 手机号码 |
| data.realName | 张三 | string | 会员名称 |
| data.sex | 男 | string | 会员性别 |
| data.levelName | 黄金会员 | string | - |
| data.storedValue | - | array | 会员储值 |
| data.storedValue.category | 1001 | integer | 储值类型 |
| data.storedValue.value | 500 | integer | 储值数量 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员卡不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 操作失败,原因:会员卡不存在 | string | 业务描述 |

**Query**

## 通过会员编码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-12-22 22:24:16

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "member_getmember_uid",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "C77EB0D3EFF0161A13A078AB6444E83E",
	"body": "{\"uid\":\"3ccf32c6-ac1f-4cd9-93e8-ac086cd7b7b1\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | AppId |
| action | member_getmember_uid | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | C77EB0D3EFF0161A13A078AB6444E83E | string | Yes | 签名字符串 |
| body | {"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
		"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
		"phone": "13100000000",
		"realName": "张三",
		"sex": "男",
		"levelName":"黄金会员",
		"storedValue": [
			{
				"category": 1001,
				"value": 500
			},
			{
				"category": 1002,
				"value": 800
			}
		]
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | - | string | 业务描述 |
| data | - | object | 业务数据 |
| data.uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | 会员编码 |
| data.phone | 13100000000 | string | 手机号码 |
| data.realName | 张三 | string | 会员名称 |
| data.sex | 男 | string | 会员性别 |
| data.levelName | 黄金会员 | string | 会员等级 |
| data.storedValue | - | array | 会员储值 |
| data.storedValue.category | 1001 | integer | 储值类型 |
| data.storedValue.value | 500 | integer | 储值数量 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员编码不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 操作失败,原因:会员编码不存在 | string | 业务描述 |

**Query**

## 通过会员编码修改手机号

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-19 13:42:13

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_change_phone",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "E633CCCE097AD478FD821A93B7C7A531",
	"body": "{\"uid\":\"6629df4e-4d77-4ed5-a0eb-48d937b31fc4\",\"newphone\":\"18664702135\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | appid |
| action | member_change_phone | string | Yes | 操作内容 |
| version | 10.11.8 | string | Yes | 版本 |
| timestamp | 1723822967585 | string | Yes | 时间戳 |
| sign | E633CCCE097AD478FD821A93B7C7A531 | string | Yes | 签名 |
| body | {"uid":"6629df4e-4d77-4ed5-a0eb-48d937b31fc4","newphone":"18664702130"} | string | Yes | 内容 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"newPhone": "18664702135"
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 是否成功 |
| msg | - | string | 消息 |
| code | 0 | integer | - |
| data | - | object | - |
| data.newPhone | 18664702135 | string | 新手机号 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 通过会员卡序列号获取会员信息

> Creator: 石元考

> Updater: goodlamsx

> Created Time: 2021-03-25 09:36:59

> Update Time: 2026-04-22 10:27:54

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_serialnumber",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "847554C5A187E351736DD1A0D9D74A3D",
	"body": "{\"serialNumber\":\"1865926425\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_getmember_serialnumber | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | FBCF8E1D9C9F8073D2838D3F8332483F | string | Yes | - |
| body | {"serialNumber":"3982990773"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"uid": "76680629-6a10-48bd-9655-1b6dba37769c",
		"phone": "15111553941",
		"realName": "ABCE",
		"sex": "男",
		"levelName": "铂金会员",
		"storedValues": [
			{
				"category": 101,
				"value": 1000
			},
			{
				"category": 102,
				"value": 20
			},
			{
				"category": 104,
				"value": 0
			},
			{
				"category": 105,
				"value": 400
			},
			{
				"category": 106,
				"value": 200
			},
			{
				"category": 107,
				"value": 0
			},
			{
				"category": 108,
				"value": 0
			},
			{
				"category": 109,
				"value": 0
			},
			{
				"category": 111,
				"value": 0
			},
			{
				"category": 116,
				"value": 0
			},
			{
				"category": 117,
				"value": 0
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.uid | 76680629-6a10-48bd-9655-1b6dba37769c | string | - |
| data.phone | 15111553941 | string | - |
| data.realName | ABCE | string | - |
| data.sex | 男 | string | - |
| data.levelName | 铂金会员 | string | - |
| data.storedValues | - | array | - |
| data.storedValues.category | 101 | integer | - |
| data.storedValues.value | 1000 | integer | - |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员卡不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | - |
| code | 0 | integer | - |
| msg | 操作失败,原因:会员卡不存在 | string | - |

**Query**

## 通过会员编码获取会员卡信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:43:12

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmembercode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "F2DDA59B09208E45F060DAFF55FF8D9E",
	"body": "{\"uid\":\"36fb8e10-90ea-453b-990f-c5daf986ee5f\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | AppId |
| action | member_getmembercode | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | F2DDA59B09208E45F060DAFF55FF8D9E | string | Yes | 签名字符串 |
| body | {"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f"} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | - | string | 业务描述 |
| data | - | array | 业务数据 |
| data.category | 1 | integer | - |
| data.memberCode | 09PAYCH010391 | string | 会员卡号 |
| data.icCard | 1A6CFC6EE40804006263646566676869 | string | 会员卡芯片号 |
| data.remark | 扣除10枚游戏币在自助设备中取卡 | string | 储值变更描述 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 操作失败,原因:会员不存在 | string | 业务描述 |

**Query**

## 通过会员编码获取储值变更记录

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-07-18 11:32:06

**StoredCategory取值范围：**

**[object Object],[object Object]**

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "member_getstored_log",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "A007560604FAD23EAD8FAA8177A8BFC2",
	"body": "{\"uid\":\"87ffd217-02dc-4a14-8d2c-e1acfb04f285\",\"storedCategory\":1,\"startTime\":\"2025-01-01 00:00:00\",\"endTime\":\"2025-07-19 00:00:00\",\"page\":1,\"limit\":20}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | AppId |
| action | member_getstored_log | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | A007560604FAD23EAD8FAA8177A8BFC2 | string | Yes | 签名字符串 |
| body | {"uid":"87ffd217-02dc-4a14-8d2c-e1acfb04f285","storedCategory":1,"startTime":"2025-01-01 00:00:00","endTime":"2025-07-19 00:00:00","page":1,"limit":20} | string | Yes | 业务参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
    "success": true,
    "code": 0,
    "msg": "",
    "page":1,
    "limit":20,
    "totalPage":8,
    "totalRecord":155,
    "data": [
        {
            "createTime": "2024-08-16 18:17:14.030",
            "flowType": 1,
            "businessType": 1001,
            "businessTypeName": "购买套餐",
            "beforeAmount": 500,
            "amount": 50,
            "afterAmount": 550,
            "remark": "购买50元=50币套餐,获币50枚"
        },
        {
            "createTime": "2024-08-15 18:17:14.030",
            "flowType": 2,
            "businessType": 2001,
            "businessTypeName": "",
            "beforeAmount": 505,
            "amount": 5,
            "afterAmount": 500,
            "remark": "机台玩游戏消耗5枚游戏币"
        }
    ]
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | - | string | 业务描述 |
| page | 1 | integer | 当前页码 |
| limit | 20 | integer | 每页记录数 |
| totalPage | 8 | integer | 总页数 |
| totalRecord | 155 | integer | 总记录数 |
| data | - | object | 业务数据 |
| data.createTime | 2024-08-16 18:17:14.030 | string | 业务发生时间 |
| data.flowType | 1 | integer | 储值变更类型（1.入账 2.出账） |
| data.businessType | 1001 | integer | 储值变更业务类型编码 |
| data.businessTypeName | 购买套餐 | string | 储值变更业务类型名称 |
| data.beforeAmount | 500 | integer | 储值变更前数量 |
| data.amount | 50 | integer | 当前变更数量 |
| data.afterAmount | 550 | integer | 储值变更后数量 |
| data.remark | 购买50元=50币套餐,获币50枚 | string | 储值变更描述 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "会员信息不存在"
}
```

**Query**

## 修改会员可用状态

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-16 16:12:07

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_switch_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "803C230F8199E827F0C84E070737EB18",
	"body": "{\"employeeName\":\"张三\",\"uid\":\"00f92a73-d643-483f-a9a0-99ad11655bac\",\"enable\":true,\"remark\":\"测试备注\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | appid |
| action | member_switch_status | string | Yes | 操作内容 |
| version | 10.11.8 | string | Yes | 版本 |
| timestamp | 1723822967585 | string | Yes | 时间戳 |
| sign | 803C230F8199E827F0C84E070737EB18 | string | Yes | 签名 |
| body | {"employeeName":"张三","uid":"00f92a73-d643-483f-a9a0-99ad11655bac","enable":true,"remark":"测试备注"} | string | Yes | 内容 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 修改会员卡可用状态

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-18 13:13:32

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_card_switch_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "F857495F200E717112A33FA6DEC947EA",
	"body": "{\"employeeName\":\"张三\",\"deviceName\":\"第三方\",\"status\":1,\"uid\":\"00f92a73-d643-483f-a9a0-99ad11655bac\",\"memberCode\":true,\"remark\":\"测试备注\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | appid |
| action | member_card_switch_status | string | Yes | 操作内容 |
| version | 10.11.8 | string | Yes | 版本 |
| timestamp | 1723822967585 | string | Yes | 时间戳 |
| sign | F857495F200E717112A33FA6DEC947EA | string | Yes | 签名 |
| body | {"employeeName":"张三","deviceName":"第三方","status":1,"uid":"00f92a73-d643-483f-a9a0-99ad11655bac","memberCode":true,"remark":"测试备注"} | string | Yes | 内容 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 会员退卡

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-17 10:22:54

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_return_card",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "56EAE58DB3E939FB71E85ED13D9A12B3",
	"body": "{\"employeeName\":\"张三\",\"bizCode\":\"00f92a73-d643-483f-a9a0-99ad11655bac\",\"memberCode\":\"09PAYCH010889\",\"isReturnDeposit\":false}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_switch_status | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | E40F201B83954EE5413A32A0F9396C08 | string | Yes | - |
| key | 1BFA72FAFEE5502DA4FD423C48E7D153 | string | Yes | - |
| body | {"employeeName":"张三","uid":"00f92a73-d643-483f-a9a0-99ad11655bac","enable":"true","remark":"测试备注"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 通过手机号码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-05 18:10:31

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_phone",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "28266C4A7315035225E0BF847184960C",
	"body": "{\"shopId\":0,\"phone\":\"18817675782\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | 应用AppId |
| action | member_getmember_phone | string | Yes | 接口名称 |
| version | 10.11.8 | string | Yes | 版本号 |
| timestamp | 1723822967585 | string | Yes | 时间戳 |
| sign | 28266C4A7315035225E0BF847184960C | string | Yes | 签名串 |
| body | {"shopId":0,"phone":"18817675782"} | string | Yes | 请求参数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"mid": "2177b78f-2bce-4c96-8fd9-ac4bb452cd23",
		"phone": "18817675782",
		"realName": "石元考",
		"sex": "男",
		"items": [
			{
				"shopId": 3159,
				"shopName": "大拇指展厅",
				"uid": "23fd38be-5ae7-4667-af3b-ff2823e42dbe",
				"levelName": "",
				"storedValues": [
					{
						"category": 101,
						"value": 0
					},
					{
						"category": 102,
						"value": 0
					},
					{
						"category": 104,
						"value": 0
					},
					{
						"category": 105,
						"value": 0
					},
					{
						"category": 106,
						"value": 0
					},
					{
						"category": 107,
						"value": 0
					},
					{
						"category": 108,
						"value": 0
					},
					{
						"category": 109,
						"value": 0
					},
					{
						"category": 112,
						"value": 0
					}
				]
			},
			{
				"shopId": 3157,
				"shopName": "翠花展厅",
				"uid": "36fb8e10-90ea-453b-990f-c5daf986ee5f",
				"levelName": "",
				"storedValues": [
					{
						"category": 101,
						"value": 114882
					},
					{
						"category": 102,
						"value": 1641
					},
					{
						"category": 104,
						"value": 0
					},
					{
						"category": 105,
						"value": 200
					},
					{
						"category": 106,
						"value": 6977
					},
					{
						"category": 107,
						"value": 20
					},
					{
						"category": 108,
						"value": 0
					},
					{
						"category": 109,
						"value": 0
					},
					{
						"category": 111,
						"value": 0
					},
					{
						"category": 112,
						"value": 0
					},
					{
						"category": 116,
						"value": 0.01
					},
					{
						"category": 117,
						"value": 469.89
					},
					{
						"category": 118,
						"value": 0
					},
					{
						"category": 119,
						"value": 862
					},
					{
						"category": 120,
						"value": 0
					}
				]
			},
			{
				"shopId": 4,
				"shopName": "智科展厅",
				"uid": "7bc38688-5650-43a1-b1d8-557fb5f79c8c",
				"levelName": "",
				"storedValues": [
					{
						"category": 101,
						"value": 114882
					},
					{
						"category": 102,
						"value": 1641
					},
					{
						"category": 104,
						"value": 0
					},
					{
						"category": 105,
						"value": 200
					},
					{
						"category": 106,
						"value": 6977
					},
					{
						"category": 107,
						"value": 20
					},
					{
						"category": 108,
						"value": 0
					},
					{
						"category": 109,
						"value": 0
					},
					{
						"category": 111,
						"value": 0
					},
					{
						"category": 112,
						"value": 0
					},
					{
						"category": 116,
						"value": 0.01
					},
					{
						"category": 117,
						"value": 469.89
					},
					{
						"category": 118,
						"value": 0
					},
					{
						"category": 119,
						"value": 862
					}
				]
			},
			{
				"shopId": 3161,
				"shopName": "智绘展厅",
				"uid": "adcd2e40-941a-4f22-8d37-5795d153aaf5",
				"levelName": "",
				"storedValues": [
					{
						"category": 101,
						"value": 300
					},
					{
						"category": 104,
						"value": 0
					},
					{
						"category": 105,
						"value": 0
					}
				]
			},
			{
				"shopId": 13901,
				"shopName": "拓疆计划-番禺店",
				"uid": "f58792d8-8bbe-4adf-a2b9-e29e859dbea4",
				"levelName": "",
				"storedValues": [
					{
						"category": 101,
						"value": 14
					},
					{
						"category": 102,
						"value": 0
					},
					{
						"category": 104,
						"value": 0
					},
					{
						"category": 105,
						"value": 0
					},
					{
						"category": 106,
						"value": 0
					},
					{
						"category": 107,
						"value": 0
					},
					{
						"category": 108,
						"value": 0
					},
					{
						"category": 109,
						"value": 0
					},
					{
						"category": 111,
						"value": 0
					},
					{
						"category": 112,
						"value": 0
					},
					{
						"category": 117,
						"value": 0
					}
				]
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | object | 数据集合 |
| data.mid | 2177b78f-2bce-4c96-8fd9-ac4bb452cd23 | string | 会员编码 |
| data.phone | 18817675782 | string | 手机号码 |
| data.realName | 石元考 | string | 真实姓名 |
| data.sex | 男 | string | 会员姓名 |
| data.items | - | object | 门店储值信息 |
| data.items.shopId | 3159 | integer | 门店编码 |
| data.items.shopName | 大拇指展厅 | string | 门店名称 |
| data.items.uid | 23fd38be-5ae7-4667-af3b-ff2823e42dbe | string | 门店账户编码 |
| data.items.levelName | - | string | 会员等级名称 |
| data.items.storedValues | - | object | 会员储值 |
| data.items.storedValues.category | 101 | integer | 会员储值类型 |
| data.items.storedValues.value | 0 | integer | 会员储值名称 |
| desc | - | string | 业务详细描述 |

* 失败(404)

```javascript
{
	"success": false,
	"msg": "会员信息不存在",
	"code": 0,
	"data": null,
	"desc": "通过手机号码没有找到任何会员信息"
}
```

**Query**

## 获取会员彩票变更日志

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-16 19:59:42

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getlottery_flow",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "F69A2E9B8AA2DF2351EEA08DB1DFE66D",
	"body": "{\"uid\":\"\",\"phone\":\"18817675782\",\"startTime\":\"2024-01-11 00:00:00\",\"endTime\":\"2024-12-11 23:59:59\",\"businessCategorys\":\"1001,1004\",\"flowType\":1,\"page\":1,\"limie\":20}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_getlottery_flow | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | F69A2E9B8AA2DF2351EEA08DB1DFE66D | string | Yes | - |
| body | {"uid":"","phone":"18817675782","startTime":"2024-01-11 00:00:00","endTime":"2024-12-11 23:59:59","businessCategorys":"1001,1004","flowType":1,"page":1,"limie":20} | string | Yes | "uid":会员账户编码,"phone":会员手机号码,"startTime":开始时间,
"endTime":"截至时间","page":当前页码,"limit":每页记录数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"page": 0,
	"limit": 0,
	"totalPage": 0,
	"totalRecord": 0,
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"mId": "2177b78f-2bce-4c96-8fd9-ac4bb452cd23",
			"uId": "36fb8e10-90ea-453b-990f-c5daf986ee5f",
			"shopId": 3157,
			"shopName": "翠花科技3157#",
			"businessType": 1004,
			"flowType": 1,
			"beforeAmount": 995,
			"changeAmount": 800,
			"afterAmount": 1795,
			"remark": "收银台处理客诉，给会员补-彩票A：800张",
			"changeTime": "2024-07-10 18:24:40.266"
		},
		{
			"mId": "2177b78f-2bce-4c96-8fd9-ac4bb452cd23",
			"uId": "36fb8e10-90ea-453b-990f-c5daf986ee5f",
			"shopId": 3157,
			"shopName": "翠花科技3157#",
			"businessType": 1004,
			"flowType": 1,
			"beforeAmount": 600,
			"changeAmount": 800,
			"afterAmount": 1400,
			"remark": "收银台处理客诉，给会员补-彩票A：800张",
			"changeTime": "2024-07-10 18:23:47.547"
		},
		{
			"mId": "2177b78f-2bce-4c96-8fd9-ac4bb452cd23",
			"uId": "36fb8e10-90ea-453b-990f-c5daf986ee5f",
			"shopId": 3157,
			"shopName": "翠花科技3157#",
			"businessType": 1004,
			"flowType": 1,
			"beforeAmount": 1890,
			"changeAmount": 5000,
			"afterAmount": 6890,
			"remark": "收银台处理客诉，给会员补-彩票A：5000张",
			"changeTime": "2024-07-10 18:29:53.196"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| page | 0 | integer | 当前页码 |
| limit | 0 | integer | 每页记录数 |
| totalPage | 0 | integer | 总页码 |
| totalRecord | 0 | integer | 总记录数 |
| success | true | boolean | 业务是否成功标识 |
| msg | - | string | 业务消息 |
| code | 0 | integer | 业务代码 |
| data | - | object | 业务数据 |
| data.mId | 2177b78f-2bce-4c96-8fd9-ac4bb452cd23 | string | 会员编码 |
| data.uId | 36fb8e10-90ea-453b-990f-c5daf986ee5f | string | 会员门店账户编码 |
| data.shopId | 3157 | integer | 门店编码 |
| data.shopName | 翠花科技3157# | string | 门店名称 |
| data.businessType | 1004 | integer | 业务类型 |
| data.flowType | 1 | integer | 彩票（进/出） |
| data.beforeAmount | 995 | integer | 变更前数量 |
| data.changeAmount | 800 | integer | 变更数量 |
| data.afterAmount | 1795 | integer | 变更后数量 |
| data.remark | 收银台处理客诉，给会员补-彩票A：800张 | string | 业务描述 |
| data.changeTime | 2024-07-10 18:24:40.266 | string | 变更时间 |
| desc | - | string | 描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员储值变更概要

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-04-13 09:11:49

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_store_change_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "F7FB74FE6980FA274A4FC089D4435B77",
	"body": "{\"uid\":\"\",\"phone\":\"18817675782\",\"shopId\":3157,\"startTime\":\"2024-11-11 00:00:00\",\"endTime\":\"2024-12-11 23:59:59\",\"businessCategorys\":\"\",\"flowType\":1,\"category\":106}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_store_change_summary | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | F7FB74FE6980FA274A4FC089D4435B77 | string | Yes | - |
| body | {"uid":"","phone":"18817675782","shopId":3157,"startTime":"2024-11-11 00:00:00","endTime":"2024-12-11 23:59:59","businessCategorys":"","flowType":1,"category":106} | string | Yes | "uid":会员账户编码,"phone":会员手机号码,"shopId":门店编码,"startTime":开始时间,
"endTime":"截至时间","category":储值类型（101:本币 102:赠币 104:点数 105:积分 106:彩票 107:蓝票） |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":[{"shopId":3157,"shopName":"翠花科技3157#","mId":"2177b78f-2bce-4c96-8fd9-ac4bb452cd23","uId":"36fb8e10-90ea-453b-990f-c5daf986ee5f","totalAmount":1070}],"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务消息 |
| code | 0 | integer | 业务编码 |
| data | - | object | 业务数据 |
| data.shopId | 3157 | integer | 门店编码 |
| data.shopName | 翠花科技3157# | string | 门店名称 |
| data.mId | 2177b78f-2bce-4c96-8fd9-ac4bb452cd23 | string | 会员编码 |
| data.uId | 36fb8e10-90ea-453b-990f-c5daf986ee5f | string | 会员门店账户编码 |
| data.totalAmount | 1070 | integer | 变更总数量 |
| desc | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员等级概况

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-21 13:15:25

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_level_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "F7FB74FE6980FA274A4FC089D4435B77",
	"body": "{}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_store_change_summary | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | F7FB74FE6980FA274A4FC089D4435B77 | string | Yes | - |
| body | - | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":[{"memberLevelName":"集团-黑铁","levelType":1,"totalMembers":112},{"memberLevelName":"天璇星","levelType":1,"totalMembers":3},{"memberLevelName":"集团-青铜","levelType":1,"totalMembers":29},{"memberLevelName":"集团-铂金","levelType":1,"totalMembers":4},{"memberLevelName":"天枢星","levelType":1,"totalMembers":0},{"memberLevelName":"天权星","levelType":1,"totalMembers":1},{"memberLevelName":"集团-尊享会员","levelType":1,"totalMembers":1},{"memberLevelName":"天玑星","levelType":1,"totalMembers":3},{"memberLevelName":"集团-钻石","levelType":1,"totalMembers":2},{"memberLevelName":"集团-黄金","levelType":1,"totalMembers":0},{"memberLevelName":"集团-白银","levelType":1,"totalMembers":8},{"memberLevelName":"金卡会员","levelType":1,"totalMembers":3},{"memberLevelName":"年终抽奖专用","levelType":1,"totalMembers":0},{"memberLevelName":"门店-无取卡费会员","levelType":1,"totalMembers":6},{"memberLevelName":"门店-微星","levelType":1,"totalMembers":5},{"memberLevelName":"环游商城SSVIP","levelType":1,"totalMembers":1},{"memberLevelName":"VIP1","levelType":1,"totalMembers":1},{"memberLevelName":"游客卡","levelType":2,"totalMembers":113},{"memberLevelName":"机修卡","levelType":3,"totalMembers":9067},{"memberLevelName":"公共卡","levelType":4,"totalMembers":4}],"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务消息 |
| code | 0 | integer | 业务编码 |
| data | - | array | 业务数据 |
| data.memberLevelName | 集团-黑铁 | string | 会员等级名称 |
| data.levelType | 1 | integer | 会员类型 |
| data.totalMembers | 112 | integer | 该等级会员总人数 |
| desc | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 修改会员基本信息

> Creator: 石元考

> Updater: 孙开冰

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-07-28 16:30:56

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_info_modify",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "72E1A2E037A073EF6AA9B9E1DFEC1CB4",
	"body": "{\"uid\":\"bd7e8c23-7d6a-4b08-8d8c-59415acc6b97\",\"realName\":\"Aionso\",\"nickName\":\"Aionso\",\"email\":\"aabcc@qq.com\",\"sex\":1,\"birthday\":\"1995-01-01\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "会员资料更新成功",
	"data": true
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "会员资料更新失败",
	"data":false
}
```

**Query**

## 指定储值全部扣除

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-06-10 16:55:08

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "be559b49662c4b609c5944eda383fefd",
	"action": "member_reducestored_all",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": {"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae","tradeNo": "7882967938834104325","storedCategory": 1,"bizCode": "7882967938834104327","remark": "巨岛游戏项目扣费"}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "出账成功",
	"data": {
		"totalValue": 450
	}
}
```

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员列表

> Creator: 梁灿铭

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-12-22 22:24:13

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
        "appId": "a4ee5f8d65c1489fba8b71d490925ab0",
        "baodianscriptkey": "hkhpnjtYH2mrrdciCcSjXjH7cjr7cz4h",
        "action": "member_list",
        "version": "10.11.8",
        "timestamp": "1723822967585",
        "sign": "3377E014889A9B7B1FB2388DF7FF0B8F",
        "body": "{\"phone\":\"\",\"page\":1,\"limit\":15,\"sortField\":\"CreateTime\",\"sortType\":\"asc\",\"startTime\":\"2021-04-20 00:00:00\",\"endTime\":\"2025-05-26 23:59:59\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| StartTime | - | string | No | 创建日期开始时间 |
| EndTime | - | string | No | 创建日期结束时间 |
| Phone | - | string | No | 手机号 |
| Page | 1 | integer | No | 页码 |
| Limit | - | integer | No | 每页记录数 |
| SortField | CreateTime | string | No | 排序字段 |
| SortType | desc | string | No | 排序类型（desc asc） |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"footData": {
		"chainId": 0,
		"memberId": "00000000-0000-0000-0000-000000000000",
		"memberAcctId": "00000000-0000-0000-0000-000000000000",
		"memberIdentity": "",
		"category": 0,
		"categoryName": "0",
		"phone": "",
		"wxOpenId": "",
		"idCard": "",
		"realName": "",
		"nickName": "",
		"headImg": "",
		"faceImg": "",
		"memberLevelId": "00000000-0000-0000-0000-000000000000",
		"memberLevelName": null,
		"memberLevelType": 0,
		"shopId": 0,
		"shopName": null,
		"nativeCoin1": 103098,
		"giveCoin1": 0,
		"giveCoin1A": 0,
		"giveCoin1B": 0,
		"coinBal2": 30311,
		"integral": 30333,
		"lottery": 50116,
		"blueLottery": 30010,
		"timePointValue": 0,
		"timeCoinBal1": 10,
		"storeExtend01": 0,
		"storeExtend02": 59711.25,
		"storeExtend03": 0,
		"storeExtend04": 109,
		"storeExtend05": 11,
		"money": 0,
		"cardNumber": 0,
		"growthValue": 0,
		"keywords": "",
		"status": 0,
		"source": 0,
		"sex": 0,
		"address": "",
		"birthday": null,
		"limitTime": "0001-01-01 00:00:00.000",
		"lastTime": "0001-01-01 00:00:00.000",
		"joinTime": null,
		"remark": "",
		"disabledRemark": "",
		"consumeNumber": 386,
		"consumeMoney": 256030.96,
		"isEnabled": false,
		"lastConsumeTime": null,
		"updateTime": "0001-01-01 00:00:00.000",
		"createTime": "0001-01-01 00:00:00.000",
		"memberCardList": []
	},
	"page": 0,
	"limit": 15,
	"totalPage": 1,
	"totalRecord": 10,
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"chainId": 2,
			"memberId": "6ce53610-e75c-4039-a7aa-dde09fecabe6",
			"memberAcctId": "87ffd217-02dc-4a14-8d2c-e1acfb04f285",
			"memberIdentity": "13129712615",
			"category": 1,
			"categoryName": "会员",
			"phone": "13129712615",
			"wxOpenId": "",
			"idCard": "44162297771212",
			"realName": "Aionso",
			"nickName": "Aionso",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20240730/5f025d3956214ecb983fa5314617293e.jpg",
			"faceImg": "",
			"memberLevelId": "08dd8de0-ce6b-4b06-8159-a2de61655455",
			"memberLevelName": "五折会员",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 1023,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 30300,
			"integral": 30300,
			"lottery": 50000,
			"blueLottery": 30000,
			"timePointValue": 3000,
			"timeCoinBal1": 5,
			"storeExtend01": 0,
			"storeExtend02": 27002,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 27002,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "13129712615;02PAYDMZ255719;11SHYBQ000140;11SHYBQ000315;02PAYDMZ255683",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "2000-01-01 00:00:00.000",
			"limitTime": "2155-03-25 23:59:59.000",
			"lastTime": "2025-08-11 09:39:33.706",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 157,
			"consumeMoney": 9141.91,
			"isEnabled": true,
			"lastConsumeTime": "2025-07-30 16:56:56.135",
			"updateTime": "2025-08-31 02:20:00.364",
			"createTime": "2025-04-23 15:12:20.859",
			"memberCardList": [
				{
					"memberCardId": "8f380b0f-e63c-4d6f-a172-8533bb84526d",
					"icCard": "311231A3B10804006263646566676869",
					"memberCode": "02PAYDMZ255719",
					"serialNo": "2737902129"
				},
				{
					"memberCardId": "b6ca1678-cc0a-4652-a2b1-0c00b7298b72",
					"icCard": "5244E9AE51080400036504781F74481D",
					"memberCode": "11SHYBQ000140",
					"serialNo": "2934522962"
				},
				{
					"memberCardId": "925270e3-8601-4dea-a123-1d3b19107255",
					"icCard": "9CAE9609AD08040003AF216DCF2E441D",
					"memberCode": "11SHYBQ000315",
					"serialNo": "0160870044"
				},
				{
					"memberCardId": "f9483fea-f236-4a0c-9468-9b36c0bca8cd",
					"icCard": "B101F3A2E10804006263646566676869",
					"memberCode": "02PAYDMZ255683",
					"serialNo": "2733834673"
				}
			]
		},
		{
			"chainId": 2,
			"memberId": "7db48dc2-23e4-4a37-975e-acf4db9faf96",
			"memberAcctId": "ca28d5fb-9a53-4962-a066-14d54db13848",
			"memberIdentity": "17785222220",
			"category": 1,
			"categoryName": "会员",
			"phone": "17785222220",
			"wxOpenId": "",
			"idCard": "",
			"realName": "xxhh",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20241212/780b3675e3f54bd2a9ae46bdd8728d65.png",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 101,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "17785222220",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2035-04-27 23:59:59.000",
			"lastTime": "2025-05-07 17:37:05.177",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 4,
			"consumeMoney": 337.5,
			"isEnabled": true,
			"lastConsumeTime": "2025-05-07 17:36:27.066",
			"updateTime": "2025-05-14 10:47:29.071",
			"createTime": "2025-04-27 17:57:22.978",
			"memberCardList": []
		},
		{
			"chainId": 2,
			"memberId": "8211ddc2-a7b6-4641-aa8a-a3bc9d1d22d4",
			"memberAcctId": "3ccf32c6-ac1f-4cd9-93e8-ac086cd7b7b1",
			"memberIdentity": "15530022220",
			"category": 1,
			"categoryName": "会员",
			"phone": "15530022220",
			"wxOpenId": "",
			"idCard": "",
			"realName": "MidnightKwok",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20231122/37b94917-bdde-40e1-a6cc-e8c3f8a36023.jpg.jpg",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 911,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 11,
			"integral": 10,
			"lottery": 10,
			"blueLottery": 10,
			"timePointValue": 10,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 10,
			"storeExtend05": 10,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "15530022220;02PAYDMZ121547;02PAYDMZ127781;02PAYDMZ121587;11SHYBQ000199;02PAYDMZ127788;02PAYDMZ255670;02PAYDMZ127785;02PAYDMZ127786;02PAYDMZ127809;02PAYDMZ127787;02PAYDMZ127782;11SHYBQ000423;11SHYBQ000241",
			"status": 1,
			"source": 1,
			"sex": 3,
			"address": "",
			"birthday": "0001-01-01 00:00:00.000",
			"limitTime": "2035-05-07 23:59:59.000",
			"lastTime": "2025-06-10 14:14:06.033",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 19,
			"consumeMoney": 3595.64,
			"isEnabled": true,
			"lastConsumeTime": "2025-05-13 18:02:52.312",
			"updateTime": "2025-06-10 14:14:06.189",
			"createTime": "2025-05-07 10:51:28.316",
			"memberCardList": [
				{
					"memberCardId": "c248212a-0a50-4ea2-b8e2-f4a584ad07a4",
					"icCard": "152a376f670804006263646566676869",
					"memberCode": "02PAYDMZ121547",
					"serialNo": "1865886229"
				},
				{
					"memberCardId": "db762edc-2a90-44a7-b925-9b06abc46942",
					"icCard": "19299b3f940804006263646566676869",
					"memberCode": "02PAYDMZ127781",
					"serialNo": "1067133209"
				},
				{
					"memberCardId": "38bda9af-ee81-4138-8d69-d0c4c6a3714b",
					"icCard": "1954316f130804006263646566676869",
					"memberCode": "02PAYDMZ121587",
					"serialNo": "1865503769"
				},
				{
					"memberCardId": "2d3324e6-d9f3-47d1-92e7-b85f7127ccbe",
					"icCard": "1C244E097F08040003EB7FB2273BF41D",
					"memberCode": "11SHYBQ000199",
					"serialNo": "0156115996"
				},
				{
					"memberCardId": "ae0b9d4f-8df7-494b-9a59-c7c7a30f2601",
					"icCard": "1cf89b3f400804006263646566676869",
					"memberCode": "02PAYDMZ127788",
					"serialNo": "1067186204"
				},
				{
					"memberCardId": "69b40afc-ef80-419c-a703-dadf3a33cf28",
					"icCard": "31a0eda2de0804006263646566676869",
					"memberCode": "02PAYDMZ255670",
					"serialNo": "2733482033"
				},
				{
					"memberCardId": "d83b24d4-3917-4db4-871f-79521580e4f2",
					"icCard": "477f9e3f990804006263646566676869",
					"memberCode": "02PAYDMZ127785",
					"serialNo": "1067351879"
				},
				{
					"memberCardId": "36d3fda0-2f15-4055-84f9-23f64ebca83b",
					"icCard": "64579e3f920804006263646566676869",
					"memberCode": "02PAYDMZ127786",
					"serialNo": "1067341668"
				},
				{
					"memberCardId": "1e381191-d44b-4489-b491-0492c680d201",
					"icCard": "a75dec5f490804006263646566676869",
					"memberCode": "02PAYDMZ127809",
					"serialNo": "1609325991"
				},
				{
					"memberCardId": "91e81655-7c38-4131-bc0a-7aa1999c5598",
					"icCard": "aaaf9b3fa10804006263646566676869",
					"memberCode": "02PAYDMZ127787",
					"serialNo": "1067167658"
				},
				{
					"memberCardId": "a05eee7d-313b-4a44-b2b5-7cb6cc79a4a0",
					"icCard": "c5359e3f510804006263646566676869",
					"memberCode": "02PAYDMZ127782",
					"serialNo": "1067333061"
				},
				{
					"memberCardId": "d4b4aec4-4846-42d5-9a37-950181ffb144",
					"icCard": "dcfe9b09b008040003c9c2e1ca6a841d",
					"memberCode": "11SHYBQ000423",
					"serialNo": "0161218268"
				},
				{
					"memberCardId": "31a89d4d-a1bc-4e91-b028-90d1c8d7a308",
					"icCard": "f23b86afe00804000350dcb49d5a641d",
					"memberCode": "11SHYBQ000241",
					"serialNo": "2944809970"
				}
			]
		},
		{
			"chainId": 2,
			"memberId": "c79fb1a4-b57b-4fe3-b087-af531803475c",
			"memberAcctId": "0b1c0378-f506-4f65-882b-941bea0ea314",
			"memberIdentity": "177316752471",
			"category": 1,
			"categoryName": "会员",
			"phone": "177316752471",
			"wxOpenId": "",
			"idCard": "",
			"realName": "",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20241212/ba51d94fe59144169a236538e4aec59c.png",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 10,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "177316752471;11SHYBQ000062",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2035-05-07 23:59:59.000",
			"lastTime": "2025-05-07 16:31:42.870",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 1,
			"consumeMoney": 152.25,
			"isEnabled": true,
			"lastConsumeTime": "2025-05-07 16:31:42.870",
			"updateTime": "2025-05-08 02:20:00.249",
			"createTime": "2025-05-07 16:31:42.495",
			"memberCardList": [
				{
					"memberCardId": "20811736-4da1-438b-a265-618055f88cc7",
					"icCard": "2CD68F097C08040003F6E1E85E03AE1D",
					"memberCode": "11SHYBQ000062",
					"serialNo": "0160421420"
				}
			]
		},
		{
			"chainId": 2,
			"memberId": "2b392d00-ee38-44dc-b8f4-bd482319a35a",
			"memberAcctId": "2c5a7712-4b34-49f0-b52b-23eec73b32be",
			"memberIdentity": "15698714720",
			"category": 1,
			"categoryName": "会员",
			"phone": "15698714720",
			"wxOpenId": "",
			"idCard": "",
			"realName": "",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20241212/f17ad2f3347e4a80b6a614aa4c3e47d5.png",
			"faceImg": "",
			"memberLevelId": "08dd8de0-ce6b-4b06-8159-a2de61655455",
			"memberLevelName": "五折会员",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 9,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 100,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 99,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "15698714720",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2035-05-07 23:59:59.000",
			"lastTime": "2025-05-08 17:54:53.206",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 1,
			"consumeMoney": 152.25,
			"isEnabled": true,
			"lastConsumeTime": "2025-05-08 11:32:49.196",
			"updateTime": "2025-05-09 02:20:01.028",
			"createTime": "2025-05-07 16:33:46.743",
			"memberCardList": []
		},
		{
			"chainId": 2,
			"memberId": "b20573d5-6d0b-4dd7-b644-746a5ab3f332",
			"memberAcctId": "eeec597b-c8a9-4d49-9936-fde8c37d82bb",
			"memberIdentity": "177365871241",
			"category": 1,
			"categoryName": "会员",
			"phone": "177365871241",
			"wxOpenId": "",
			"idCard": "",
			"realName": "张天师",
			"nickName": "24K帅哥",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20241212/03747ab3a7d44a9fb4b39671ee89082a.png",
			"faceImg": "",
			"memberLevelId": "08dd8de0-ce6b-4b06-8159-a2de61655455",
			"memberLevelName": "五折会员",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 232,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 1,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 5711.25,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 1,
			"money": 5711.25,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "177365871241;09PAYCH005072",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2055-05-02 23:59:59.000",
			"lastTime": "2025-08-22 23:41:07.609",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 23,
			"consumeMoney": 1559.16,
			"isEnabled": true,
			"lastConsumeTime": "2025-08-22 23:41:07.609",
			"updateTime": "2025-09-02 02:20:01.018",
			"createTime": "2025-05-07 16:54:08.440",
			"memberCardList": [
				{
					"memberCardId": "e6b19c52-5e96-4194-8b2c-0b3f1389ac6c",
					"icCard": "598F1C53990804006263646566676869",
					"memberCode": "09PAYCH005072",
					"serialNo": "1394380633"
				}
			]
		},
		{
			"chainId": 2,
			"memberId": "1edd562b-30af-4a7d-a3e4-5b3821df2e2b",
			"memberAcctId": "a4479320-291b-439c-96ad-8c2b7ef06e24",
			"memberIdentity": "19943859741",
			"category": 1,
			"categoryName": "会员",
			"phone": "19943859741",
			"wxOpenId": "",
			"idCard": "",
			"realName": "",
			"nickName": "",
			"headImg": "",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 90,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 26998,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 26998,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "19943859741",
			"status": 1,
			"source": 1,
			"sex": 3,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2125-04-28 23:59:59.000",
			"lastTime": "2025-07-15 11:37:56.949",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 36,
			"consumeMoney": 1291.03,
			"isEnabled": true,
			"lastConsumeTime": "2025-06-25 17:52:08.151",
			"updateTime": "2025-07-29 02:20:01.095",
			"createTime": "2025-05-20 09:47:31.524",
			"memberCardList": []
		},
		{
			"chainId": 2,
			"memberId": "27d551c6-cc89-4675-9f06-b51e63e3db2a",
			"memberAcctId": "7376ff78-5d1d-4b33-92c6-a6a962f4fc61",
			"memberIdentity": "null18582667725",
			"category": 1,
			"categoryName": "会员",
			"phone": "18582667725",
			"wxOpenId": "",
			"idCard": "",
			"realName": "陈1111德福111",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20241212/f17ad2f3347e4a80b6a614aa4c3e47d5.png",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 51,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 22,
			"lottery": 6,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 5,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "null18582667725",
			"status": 1,
			"source": 1,
			"sex": 1,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2052-06-12 23:59:59.000",
			"lastTime": "2025-09-01 17:57:03.559",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 79,
			"consumeMoney": 16292.51,
			"isEnabled": true,
			"lastConsumeTime": "2025-06-17 16:11:51.455",
			"updateTime": "2025-09-01 17:57:03.624",
			"createTime": "2025-05-22 10:58:40.872",
			"memberCardList": []
		},
		{
			"chainId": 2,
			"memberId": "8e641449-f0fa-459b-affa-8cabef966fa6",
			"memberAcctId": "15366c88-5202-4b48-b8db-d72ab4f75eb3",
			"memberIdentity": "18820417343",
			"category": 1,
			"categoryName": "会员",
			"phone": "18820417343",
			"wxOpenId": "",
			"idCard": null,
			"realName": "勿",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20231206/32af0d9d-7441-4a09-b3dd-686675546130.jpg.jpg",
			"faceImg": "",
			"memberLevelId": "08dd8de0-ce6b-4b06-8159-a2de61655455",
			"memberLevelName": "五折会员",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 761,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "18820417343;02PAYDMZ255677",
			"status": 1,
			"source": 3,
			"sex": 3,
			"address": null,
			"birthday": "0001-01-01 00:00:00.000",
			"limitTime": "2035-05-21 23:59:59.000",
			"lastTime": "2025-08-27 10:10:56.432",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 65,
			"consumeMoney": 223505.71,
			"isEnabled": true,
			"lastConsumeTime": "2025-08-27 10:09:43.328",
			"updateTime": "2025-08-29 02:20:00.726",
			"createTime": "2025-05-22 12:26:59.451",
			"memberCardList": [
				{
					"memberCardId": "aab5fd4f-a5b6-40b9-82a1-9437933f83b4",
					"icCard": "D10FB2A2CE0804006263646566676869",
					"memberCode": "02PAYDMZ255677",
					"serialNo": "2729578449"
				}
			]
		},
		{
			"chainId": 2,
			"memberId": "f84d859a-29ac-4374-87d0-3ffc73256d64",
			"memberAcctId": "1c28187c-61e3-43bc-a63b-53d2b3079c9f",
			"memberIdentity": "13250562845",
			"category": 1,
			"categoryName": "会员",
			"phone": "13250562845",
			"wxOpenId": "",
			"idCard": null,
			"realName": "Vice",
			"nickName": "",
			"headImg": "https://oss.bdszh.vip/app/jingjian/20240713/c62b6b61-6863-4ef8-ab72-fee09e99440c.jpg.jpg",
			"faceImg": "",
			"memberLevelId": "08dd8235-abcf-456e-8e9b-2df174425f2c",
			"memberLevelName": "默认等级",
			"memberLevelType": 0,
			"shopId": 13256,
			"shopName": "翠花科技8888号店",
			"nativeCoin1": 99910,
			"giveCoin1": 0,
			"giveCoin1A": 0,
			"giveCoin1B": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 0,
			"blueLottery": 0,
			"timePointValue": 0,
			"timeCoinBal1": 0,
			"storeExtend01": 0,
			"storeExtend02": 0,
			"storeExtend03": 0,
			"storeExtend04": 0,
			"storeExtend05": 0,
			"money": 0,
			"cardNumber": 0,
			"growthValue": 0,
			"keywords": "13250562845;11SHYBQ000276",
			"status": 1,
			"source": 1,
			"sex": 3,
			"address": "",
			"birthday": "1900-01-01 00:00:00.000",
			"limitTime": "2035-05-22 23:59:59.000",
			"lastTime": "2025-06-18 15:07:54.393",
			"joinTime": null,
			"remark": "",
			"disabledRemark": "",
			"consumeNumber": 1,
			"consumeMoney": 3,
			"isEnabled": true,
			"lastConsumeTime": null,
			"updateTime": "2025-06-18 15:07:57.405",
			"createTime": "2025-05-22 15:35:37.054",
			"memberCardList": [
				{
					"memberCardId": "e3e210a6-2646-43f1-bd0d-24c2bfe0de14",
					"icCard": "8C45980958080400031C5FAF2D4B741D",
					"memberCode": "11SHYBQ000276",
					"serialNo": "0160974220"
				}
			]
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| footData | - | object | 页脚统计 |
| footData.chainId | 0 | integer | 集团编码 |
| footData.memberId | 00000000-0000-0000-0000-000000000000 | string | 会员编码 |
| footData.memberAcctId | 00000000-0000-0000-0000-000000000000 | string | 会员账户编码 |
| footData.memberIdentity | - | string | 会员身份标识 |
| footData.category | 0 | integer | 会员类型编码 |
| footData.categoryName | 0 | string | 会员类型名称 |
| footData.phone | - | string | 会员手机号码 |
| footData.wxOpenId | - | string | 会员微信OpenId |
| footData.idCard | - | string | 身份证号码 |
| footData.realName | - | string | 会员姓名 |
| footData.nickName | - | string | 会员昵称 |
| footData.headImg | - | string | 头像地址 |
| footData.faceImg | - | string | 人脸地址 |
| footData.memberLevelId | 00000000-0000-0000-0000-000000000000 | string | 会员等级 |
| footData.memberLevelName | null | null | 会员等级名称 |
| footData.memberLevelType | 0 | integer | 会员等级类型（1会员 2游客 3机修卡 4公共卡） |
| footData.shopId | 0 | integer | 门店编码 |
| footData.shopName | null | null | 门店名称 |
| footData.nativeCoin1 | 103098 | integer | 本币数 |
| footData.giveCoin1 | 0 | integer | 赠币数 |
| footData.giveCoin1A | 0 | integer | A类赠币 |
| footData.giveCoin1B | 0 | integer | B类赠币 |
| footData.coinBal2 | 30311 | integer | 点数数 |
| footData.integral | 30333 | integer | 积分数 |
| footData.lottery | 50116 | integer | 彩票数 |
| footData.blueLottery | 30010 | integer | 蓝票数 |
| footData.timePointValue | 0 | integer | 时点数 |
| footData.timeCoinBal1 | 10 | integer | 限时币数 |
| footData.storeExtend01 | 0 | integer | 拓客金数 |
| footData.storeExtend02 | 59711.25 | number | 预存款本金数 |
| footData.storeExtend03 | 0 | integer | 预存款赠金数 |
| footData.storeExtend04 | 109 | integer | 自定义储值数 |
| footData.storeExtend05 | 11 | integer | 弹珠数 |
| footData.money | 0 | integer | 预存款数（本金+赠金） |
| footData.cardNumber | 0 | integer | 免费卡数量 |
| footData.growthValue | 0 | integer | 成长值 |
| footData.keywords | - | string | 会员关键字 |
| footData.status | 0 | integer | 会员状态 |
| footData.source | 0 | integer | 会员来源 |
| footData.sex | 0 | integer | 会员性别 |
| footData.address | - | string | 会员地址 |
| footData.birthday | null | null | 会员生日 |
| footData.limitTime | 0001-01-01 00:00:00.000 | string | 会员过期时间 |
| footData.lastTime | 0001-01-01 00:00:00.000 | string | 会员最后到店时间 |
| footData.joinTime | null | null | 会员入会时间 |
| footData.remark | - | string | 会员备注 |
| footData.disabledRemark | - | string | 禁用备注 |
| footData.consumeNumber | 386 | integer | 消费次数 |
| footData.consumeMoney | 256030.96 | number | 消费金额 |
| footData.isEnabled | false | boolean | 是否可用 |
| footData.lastConsumeTime | null | null | 最后消费时间 |
| footData.updateTime | 0001-01-01 00:00:00.000 | string | 最后更新时间 |
| footData.createTime | 0001-01-01 00:00:00.000 | string | 创建时间 |
| footData.memberCardList | - | object | 会员卡集合 |
| page | 0 | integer | 当前页码 |
| limit | 15 | integer | 每页记录数 |
| totalPage | 1 | integer | 总页数 |
| totalRecord | 10 | integer | 总记录数 |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务消息 |
| code | 0 | integer | 业务编码 |
| data | - | object | 业务数据 |
| data.chainId | 2 | integer | 集团编码 |
| data.memberId | 6ce53610-e75c-4039-a7aa-dde09fecabe6 | string | 会员编码 |
| data.memberAcctId | 87ffd217-02dc-4a14-8d2c-e1acfb04f285 | string | 会员门店账户编码 |
| data.memberIdentity | 13129712615 | string | 会员标识 |
| data.category | 1 | integer | 会员类型 |
| data.categoryName | 会员 | string | 会员类型名称 |
| data.phone | 13129712615 | string | 手机号 |
| data.wxOpenId | - | string | 微信openid |
| data.idCard | 44162297771212 | string | 身份证号码 |
| data.realName | Aionso | string | 会员姓名 |
| data.nickName | Aionso | string | 会员昵称 |
| data.headImg | https://oss.bdszh.vip/app/jingjian/20240730/5f025d3956214ecb983fa5314617293e.jpg | string | 头像地址 |
| data.faceImg | - | string | 人脸地址 |
| data.memberLevelId | 08dd8de0-ce6b-4b06-8159-a2de61655455 | string | 会员等级 |
| data.memberLevelName | 五折会员 | string | 会员等级名称 |
| data.memberLevelType | 0 | integer | 会员等级类型（1会员 2游客 3机修卡 4公共卡） |
| data.shopId | 13256 | integer | 门店编码 |
| data.shopName | 翠花科技8888号店 | string | 门店名称 |
| data.nativeCoin1 | 1023 | integer | 本币数 |
| data.giveCoin1 | 0 | integer | 赠币数 |
| data.giveCoin1A | 0 | integer | A类赠币 |
| data.giveCoin1B | 0 | integer | B类赠币 |
| data.coinBal2 | 30300 | integer | 点数数 |
| data.integral | 30300 | integer | 积分数 |
| data.lottery | 50000 | integer | 彩票数 |
| data.blueLottery | 30000 | integer | 蓝票数 |
| data.timePointValue | 3000 | integer | 时点数 |
| data.timeCoinBal1 | 5 | integer | 限时币数 |
| data.storeExtend01 | 0 | integer | 拓客金数 |
| data.storeExtend02 | 27002 | integer | 预存款本金数 |
| data.storeExtend03 | 0 | integer | 预存款赠金数 |
| data.storeExtend04 | 0 | integer | 自定义储值1 |
| data.storeExtend05 | 0 | integer | 弹珠 |
| data.money | 27002 | integer | 预存款（本金+赠金） |
| data.cardNumber | 0 | integer | 免费卡数量 |
| data.growthValue | 0 | integer | 成长值 |
| data.keywords | 13129712615;02PAYDMZ255719;11SHYBQ000140;11SHYBQ000315;02PAYDMZ255683 | string | 关键字 |
| data.status | 1 | integer | 状态（1正常 2锁定） |
| data.source | 1 | integer | 入会渠道（1收银台入会 2小程序入会 3第三方平台入会 4跨店自动注册 99其它） |
| data.sex | 1 | integer | 性别（1男 2女 3未知） |
| data.address | - | string | 地址 |
| data.birthday | 2000-01-01 00:00:00.000 | string | 生日 |
| data.limitTime | 2155-03-25 23:59:59.000 | string | 过期时间 |
| data.lastTime | 2025-08-11 09:39:33.706 | string | 最后到店时间 |
| data.joinTime | null | null | 入会时间 |
| data.remark | - | string | 备注 |
| data.disabledRemark | - | string | 禁用备注 |
| data.consumeNumber | 157 | integer | 消费次数 |
| data.consumeMoney | 9141.91 | number | 消费金额 |
| data.isEnabled | true | boolean | 是否可用 |
| data.lastConsumeTime | 2025-07-30 16:56:56.135 | string | 最后消费时间 |
| data.updateTime | 2025-08-31 02:20:00.364 | string | 最后更新时间 |
| data.createTime | 2025-04-23 15:12:20.859 | string | 注册时间 |
| data.memberCardList | - | object | 会员卡列表 |
| data.memberCardList.memberCardId | 8f380b0f-e63c-4d6f-a172-8533bb84526d | string | 会员卡编号 |
| data.memberCardList.icCard | 311231A3B10804006263646566676869 | string | 会员卡芯片号 |
| data.memberCardList.memberCode | 02PAYDMZ255719 | string | 会员卡印刷号 |
| data.memberCardList.serialNo | 2737902129 | string | 会员卡序列号 |
| desc | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员门票信息

> Creator: 石元考

> Updater: 陈创新

> Created Time: 2021-03-25 09:36:59

> Update Time: 2026-03-03 14:49:43

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "be559b49662c4b609c5944eda383fefd",
	"action": "member_passticket_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"uid\":\"7dd63b7c-4a78-11f0-9100-0826ae3f6c66\",\"category\":1}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | be559b49662c4b609c5944eda383fefd | string | Yes | - |
| action | member_passticket_list | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | - |
| body | {"uid":"7dd63b7c-4a78-11f0-9100-0826ae3f6c66","category":1} | string | Yes | category:1计次票 2.期限票 3.计时票 |
| body.Uid | dc29c6ec-4255-4b55-8baf-244fe1d02820 | string | Yes | 会员编码(必填) |
| body.category | 1 | integer | No | 票类型（非必填 1计次票 2.期限票 3.计时票） |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"data": [
		{
			"passticketId": "96d707be-4a7a-11f0-9100-0826ae3f6c66",//门票编码
			"passticketName": "暑假10次票",//门票名称 
			"passticketCategory": 1,//门票类型:1计次票 2.期限票 3.计时票
			"activeMode": 1,//激活模式:1.销售完成 2.首次使用
			"maxNumber": 1,//扣费一次当天可进次数
			"takeMaxNumber": 1,//每天可取票数
			"maxPlayTime": "",//游玩时长（分钟）
			"maxAccompany": 0,//陪同人数
			"buyAmount": 10,//购买数量;多少次，多少天，多少小时
			"enabledAmount": 10,//可用数量
			"buyTime": "2025-06-16 15:59:44",//购买时间
			"startTime": "2025-06-16 15:59:44",//可用开始时间
			"endTime": "2025-09-16 23:59:59"//可用截至时间
		}
	],
	"success": "",
	"code": 0,
	"msg": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| data | - | object | 门票信息 |
| data.passticketId | 96d707be-4a7a-11f0-9100-0826ae3f6c66 | string | 门票编码 |
| data.passticketName | 暑假10次票 | string | 门票名称 |
| data.passticketCategory | 1 | integer | 门票类型:1计次票 2.期限票 3.计时票 |
| data.activeMode | 1 | integer | 激活模式:1.销售完成 2.首次使用 |
| data.maxNumber | 1 | integer | 扣费一次当天可进次数 |
| data.takeMaxNumber | 1 | integer | 每天可取票数 |
| data.maxPlayTime | - | string | 游玩时长（分钟） |
| data.maxAccompany | 0 | integer | 陪同人数 |
| data.buyAmount | 10 | integer | 购买数量;多少次，多少天，多少小时 |
| data.enabledAmount | 10 | integer | 可用数量 |
| data.buyTime | 2025-06-16 15:59:44 | string | 购买时间 |
| data.startTime | 2025-06-16 15:59:44 | string | 可用开始时间 |
| data.endTime | 2025-09-16 23:59:59 | string | 可用截至时间 |
| success | - | string | 是否成功 |
| code | 0 | integer | 业务编号 |
| msg | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员门票核销码

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-04 10:26:59

> Update Time: 2026-03-04 10:55:34

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "member_passticket_qrcode_get",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "D07A5460D53D69A3D88A7118D61DC8F2",
	"body": "\"uid\":\"dc29c6ec-4255-4b55-8baf-244fe1d02820\",\"PassticketId\":\"08de3ddf-1b5b-4fca-8755-6bc505470e03\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | - |
| action | member_passticket_qrcode_get | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | - |
| body | "uid":"dc29c6ec-4255-4b55-8baf-244fe1d02820","PassticketId":"08de3ddf-1b5b-4fca-8755-6bc505470e03"} | string | Yes | - |
| body.uid | dc29c6ec-4255-4b55-8baf-244fe1d02820 | string | Yes | 会员账户编码(必填) |
| body.passticketId | 08de3ddf-1b5b-4fca-8755-6bc505470e03 | string | Yes | 会员门票编码(必填) |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
    "success": true,
    "msg": "",
    "code": 0,
    "data": {
        "qrCode": "H83EB1F133B5446C9129D36F9F2E5FD3F82",
        "qrCodeExpire": 120
    },
    "desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | object | - |
| data.qrCode | H83EB1F133B5446C9129D36F9F2E5FD3F82 | string | 门票核销 |
| data.qrCodeExpire | 120 | number | 有效时长(s) |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false, //业务是否成功
	"code": 0, //业务代码
	"msg": "获取核销码失败" //消息
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | number | 业务代码 |
| msg | 获取核销码失败 | string | 消息 |

**Query**

## 会员门票核销

> Creator: 石元考

> Updater: 陈创新

> Created Time: 2021-03-25 09:36:59

> Update Time: 2026-03-03 14:54:41

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_passticket_writeoff",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"uid\":\"dc29c6ec-4255-4b55-8baf-244fe1d02820\",\"passticketId\":\"8760720a-65e8-4edc-babf-11afa576e1fe\",\"times\":1,\"bizcode\":\"SDKHJSDK12393JF3\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_passticket_writeoff | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | - |
| body | {"uid":"dc29c6ec-4255-4b55-8baf-244fe1d02820","passticketId":"8760720a-65e8-4edc-babf-11afa576e1fe","times":1,"bizcode":"SDKHJSDK12393JF3"} | string | Yes | 业务参数 |
| body.Uid | dc29c6ec-4255-4b55-8baf-244fe1d02820 | string | Yes | 会员编码(必填) |
| body.passticketId | 8760720a-65e8-4edc-babf-11afa576e1fe | string | Yes | 门票Id(必填) |
| body.times | 1 | integer | Yes | 核销次数 |
| BizCode | SDKHJSDK12393JF3 | string | Yes | 业务唯一标识 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"data": true,
	"success": true,
	"code": 0,
	"msg": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| data | true | boolean | - |
| success | true | boolean | 是否成功 |
| code | 0 | integer | 业务编号 |
| msg | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 通过会员身份类型获取会员信息

> Creator: 孙开冰

> Updater: 石元考

> Created Time: 2025-07-21 16:31:25

> Update Time: 2025-07-28 14:43:35

**返回信息包含：
会员编码、手机号码、会员昵称、会员姓名**

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
        "appId": "fb3aa300d5694abbb807472ae405f772",
        "action": "member_getmember_memberidentity",
        "version": "10.11.8",
        "timestamp": "1723822967585",
        "sign": "3377E014889A9B7B1FB2388DF7FF0B8F",
        "body": "{\"identityValue\":\"13100000000\",\"identityCategory\":1001}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | member_getmember_memberidentity | string | Yes | - |
| version | 10.11.8 | number | Yes | - |
| timestamp | 1723822967585 | number | Yes | - |
| sign | 3377E014889A9B7B1FB2388DF7FF0B8F | number | Yes | - |
| body | {"identityValue":"13100000000","identityCategory":1001} | string | Yes | identityCategory(手机号:1001,邮箱:1101),identityValue:查询的身份值，比如手机号或者邮箱的字符串 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
		"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
		"phone": "13100000000",
		"realName": "张三",
		"sex": "男",
		"levelName": "黄金会员",
		"nickName":"张三",
		"birthday":"2025-01-09",
		"storedValue": [
			{
				"category": 1001,
				"value": 500
			},
			{
				"category": 1002,
				"value": 800
			}
		]
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| footData | - | object | - |
| footData.nativeCoin1 | 13380675.07 | number | 本币数 |
| footData.giveCoin1 | 60904279 | integer | 赠币数 |
| footData.coinBal2 | 64125145.64 | number | 点数数 |
| footData.integral | 72104509 | integer | 积分数 |
| footData.lottery | 100344263 | integer | 彩票数 |
| footData.blueLottery | 1163540 | integer | 蓝票数 |
| footData.timePointValue | 0 | integer | 时点数 |
| footData.timeCoinBal1 | 3155 | integer | 限时币数 |
| footData.storeExtend01 | 0 | integer | 拓客金数 |
| footData.storeExtend02 | 22996.75 | number | 预存款本金数 |
| footData.storeExtend03 | 2307.54 | number | 预存款赠金数 |
| footData.storeExtend04 | 1137284 | integer | 自定义储值数 |
| footData.storeExtend05 | 1032894 | integer | 弹珠数 |
| footData.money | 0 | integer | 预存款数（本金+赠金） |
| footData.cardNumber | 0 | integer | 免费卡数量 |
| footData.growthValue | 79580 | integer | 成长值 |
| footData.consumeNumber | 19492 | integer | 消费次数 |
| footData.consumeMoney | 101122369973.02 | number | 消费金额 |
| page | 0 | integer | - |
| limit | 20 | integer | - |
| totalPage | 4500 | integer | - |
| totalRecord | 9305 | integer | - |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务消息 |
| code | 0 | integer | 业务编码 |
| data | - | array | 业务数据 |
| data.chainId | 2075 | integer | 集团编码 |
| data.memberId | 67382ad2-f30f-4c5e-84ad-397480a2be24 | string | 会员编码 |
| data.memberAcctId | 1146376d-d79e-43b7-aac1-e77c62b2d356 | string | 会员门店账户编码 |
| data.memberIdentity | 17727662363_del20 | string | 会员标识 |
| data.category | 1 | integer | - |
| data.categoryName | 会员 | string | - |
| data.phone | 17727662363_del20 | string | 手机号 |
| data.wxOpenId | - | string | 微信openid |
| data.idCard | - | string | - |
| data.realName | - | string | 会员姓名 |
| data.nickName | - | string | 会员昵称 |
| data.headImg | - | string | 头像地址 |
| data.faceImg | - | string | 人脸地址 |
| data.memberLevelId | 08db99a9-98d7-4abd-8521-3521900772a0 | string | 会员等级 |
| data.memberLevelName | 机修卡 | string | 会员等级名称 |
| data.memberLevelType | 0 | integer | 会员等级类型（1会员 2游客 3机修卡 4公共卡） |
| data.shopId | 3157 | integer | 门店编码 |
| data.shopName | 翠花展厅 | string | 门店名称 |
| data.nativeCoin1 | 0 | integer | 本币数 |
| data.giveCoin1 | 0 | integer | 赠币数 |
| data.giveCoin1A | 0 | integer | - |
| data.giveCoin1B | 0 | integer | - |
| data.coinBal2 | 1000198 | integer | 点数数 |
| data.integral | 0 | integer | 积分数 |
| data.lottery | 0 | integer | 彩票数 |
| data.blueLottery | 0 | integer | 蓝票数 |
| data.timePointValue | 0 | integer | 时点数 |
| data.timeCoinBal1 | 0 | integer | 限时币数 |
| data.storeExtend01 | 0 | integer | 拓客金数 |
| data.storeExtend02 | 0 | integer | 预存款本金数 |
| data.storeExtend03 | 0 | integer | 预存款赠金数 |
| data.storeExtend04 | 0 | integer | 自定义储值1 |
| data.storeExtend05 | 0 | integer | 弹珠 |
| data.money | 0 | integer | 预存款（本金+赠金） |
| data.cardNumber | 0 | integer | 免费卡数量 |
| data.growthValue | 0 | integer | 成长值 |
| data.keywords | - | string | 关键字 |
| data.status | 1 | integer | 状态（1正常 2锁定） |
| data.source | 2 | integer | 入会渠道（1收银台入会 2小程序入会 3第三方平台入会 4跨店自动注册 99其它） |
| data.sex | 3 | integer | 性别（1男 2女 3未知） |
| data.address | - | string | 地址 |
| data.birthday | 1900-01-01 00:00:00.000 | string | 生日 |
| data.limitTime | 2025-06-12 23:59:59.000 | string | 过期时间 |
| data.lastTime | 2025-05-24 18:36:07.348 | string | - |
| data.joinTime | null | null | 入会时间 |
| data.remark | - | string | 备注 |
| data.disabledRemark | - | string | 禁用备注 |
| data.consumeNumber | 94 | integer | 消费次数 |
| data.consumeMoney | 3337.86 | number | 消费金额 |
| data.isEnabled | true | boolean | 是否可用 |
| data.lastConsumeTime | 2024-09-27 17:07:31.882 | string | 最后消费时间 |
| data.updateTime | 2025-05-24 18:36:07.407 | string | - |
| data.createTime | 2024-06-12 16:50:02.887 | string | - |
| desc | - | string | 业务描述 |

* 失败(201)

```javascript
No data
```

**Query**

## 会员账号+密码登录

> Creator: 石元考

> Updater: 石元考

> Created Time: 2025-07-28 14:27:33

> Update Time: 2025-07-28 14:47:35

```text
No description
```

**API Status**

> In Progress

**URL**

> Not filled in

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
        "appId": "fb3aa300d5694abbb807472ae405f772",
        "action": "member_login",
        "version": "10.11.8",
        "timestamp": "1723822967585",
        "sign": "3377E014889A9B7B1FB2388DF7FF0B8F",
        "body": "{\"identity\":\"13134568976\",\"password\":\"123321\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
		"uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
		"phone": "13100000000",
		"realName": "张三",
		"sex": "男",
		"levelName": "黄金会员",
		"nickName":"张三",
		"birthday":"2025-01-09",
		"storedValue": [
			{
				"category": 1001,
				"value": 500
			},
			{
				"category": 1002,
				"value": 800
			}
		]
	}
}
```

* 失败(404)

```javascript
No data
```

**Query**

## 修改会员登录密码

> Creator: 石元考

> Updater: 孙开冰

> Created Time: 2025-07-28 14:30:40

> Update Time: 2025-08-04 13:10:20

```text
No description
```

**API Status**

> In Progress

**URL**

> Not filled in

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
        "appId": "fb3aa300d5694abbb807472ae405f772",
        "action": "member_modify_password",
        "version": "10.11.8",
        "timestamp": "1723822967585",
        "sign": "3377E014889A9B7B1FB2388DF7FF0B8F",
        "body": "{\"uid\":\"ec6283d6-6b84-11f0-b0f9-0826ae3f6c66\",\"newPassword\":\"123321\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | member_modify_password | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 3377E014889A9B7B1FB2388DF7FF0B8F | string | Yes | - |
| body | {"uid":"ec6283d6-6b84-11f0-b0f9-0826ae3f6c66","password":"123321"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "修改成功",
	"data": true
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | string | 成功响应 |
| code | 0 | number | - |
| msg | 修改成功 | string | 返回文字描述 |
| data | true | string | 返回数据 |

* 失败(404)

```javascript
No data
```

**Query**

## 腕带

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-22 10:27:47

> Update Time: 2026-04-22 10:28:55

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 一次性腕带绑定

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-22 10:25:07

> Update Time: 2026-04-22 10:29:18

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_passticket_wristband_bind",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"MemberId\":\"9b8bab47-1226-43f9-8983-ffa4b754c398\",\"MemberAcctId\":\"86122580-33af-47cb-bfec-aad2da7fd0ec\",\"EmployeeId\":\"12345678-1234-1234-1234-1234567890ab\",\"EmployeeName\":\"\",\"TerminalId\":\"99999999-9999-9999-9999-999999999999\",\"TerminalName\":\"\",\"BindItem\":[{\"MemberPassticketId\":\"08dea01b-46cf-4084-8e95-975c4de1d8bd\",\"GroupId\":\"00000000-0000-0000-0000-000000000000\",\"IsMaster\":true,\"PassticketName\":\"周六畅玩单人票\",\"WristbandCode\":\"H852CA851BFF373972AFA422D6B7B10FE3F2\"}]}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_passticket_wristband_bind | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"MemberId":"9b8bab47-1226-43f9-8983-ffa4b754c398","MemberAcctId":"86122580-33af-47cb-bfec-aad2da7fd0ec","EmployeeId":"12345678-1234-1234-1234-1234567890ab","EmployeeName":"","TerminalId":"99999999-9999-9999-9999-999999999999","TerminalName":"","BindItem":[{"MemberPassticketId":"08dea01b-46cf-4084-8e95-975c4de1d8bd","GroupId":"00000000-0000-0000-0000-000000000000","IsMaster":true,"PassticketName":"周六畅玩单人票","WristbandCode":"H852CA851BFF373972AFA422D6B7B10FE3F2"}]} | string | Yes | "Body": {
    // ---- 会员信息 ----
    "MemberId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",      // 【选填】买票/用票的会员ID
    "MemberAcctId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",  // 【选填】门店账户编码。
    // ---- 操作人信息 ----
    "EmployeeId": "12345678-1234-1234-1234-1234567890ab",    // 【必填】操作员工ID。第三方对接可创建一个专用的“虚拟员工”来传
    "EmployeeName": "自助机接口",                              // 【选填】员工姓名，用于日志记录
    // ---- 终端设备信息 ---
    "TerminalId": "99999999-9999-9999-9999-999999999999",    // 【选填】不传时底层会自动补齐为“第三方终端”
    "TerminalName": "大厅1号自助取票机",                       // 【选填】设备名称，用于日志追溯
    // ---- 绑带明细信息（这是一个列表，支持同时绑多条） ----
    "BindItem": [
      {
        "MemberPassticketId": "88888888-8888-8888-8888-888888888888", // 【必填】关键数据：被绑定的这张“会员门票流水”的记录 ID
        "WristbandCode": "WD20260422001",                             // 【必填】关键数据：实际拿到的实体腕带/手环上的号码/芯片码
        "GroupId": "00000000-0000-0000-0000-000000000000",            // 【选填】分组编码。多张陪同票打包在一个组时传同一个Guid，单张票可传全0
        "IsMaster": true,                                             // 【选填】是否是主票。一般单张核销时传 true 即可
        "PassticketName": "周六畅玩单人票"                              // 【选填】门票商品名称，用于内部展示或打流水日志
      }
    ]
  } |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "绑定腕带成功",
	"code": 0,
	"data": null,
	"desc": ""
}
```

* 失败(404)

```javascript
{
	"success": false,
	"msg": "绑定腕带失败",
	"code": 0,
	"data": null,
	"desc": ""
}
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 腕带绑定列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-22 10:32:53

> Update Time: 2026-04-22 10:35:14

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_wristband_log",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"page\":1,\"limit\":20}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_passticket_wristband_bind | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"MemberId":"9b8bab47-1226-43f9-8983-ffa4b754c398","MemberAcctId":"86122580-33af-47cb-bfec-aad2da7fd0ec","EmployeeId":"12345678-1234-1234-1234-1234567890ab","EmployeeName":"","TerminalId":"99999999-9999-9999-9999-999999999999","TerminalName":"","BindItem":[{"MemberPassticketId":"08dea01b-46cf-4084-8e95-975c4de1d8bd","GroupId":"00000000-0000-0000-0000-000000000000","IsMaster":true,"PassticketName":"周六畅玩单人票","WristbandCode":"H852CA851BFF373972AFA422D6B7B10FE3F2"}]} | string | Yes | // ---- 查询条件（以下全为选填，如果不加条件则返回全部记录）----
    // "VoucherCode": "WD20260422001",           // 按腕带码（芯片码/二维码）查询
    // "CardCode": "0001",                       // 按腕带表面刻的序号查
    // "StartTime": "2026-04-22T00:00:00",       // 绑定时间起始
    // "EndTime": "2026-04-22T23:59:59",         // 绑定时间结束
    // "IsUse": false,                           // 按是否已被核销使用过滤 (true/false)
    // "Phone": "13800138000",                   // 绑定的会员手机号
    // "PassticketName": "周六畅玩单人票"          // 绑定的门票名称
    // "EmployeeId": "操作人的Guid",               // 查某个特定收银员或机器绑的记录 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"pageSize": 1,
	"pageIndex": 0,
	"totals": 287,
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"id": "43683afd-1cf5-497d-b910-81e1602bba66",
			"shopId": 13256,
			"memberId": "9b8bab47-1226-43f9-8983-ffa4b754c398",
			"memberAcctId": "86122580-33af-47cb-bfec-aad2da7fd0ec",
			"groupId": "00000000-0000-0000-0000-000000000000",
			"isMaster": true,
			"voucherCode": "H852CA851BFF373972AFA422D6B7B10FE3F2",
			"orderNumber": "BD01325681776826807007490",
			"isUse": false,
			"useTime": null,
			"employeeName": "张三(自助机/第三方服务)",
			"terminalCategory": 2,
			"terminalName": "大厅1号自助机",
			"limitTime": "2026-04-23 00:00:00.000",
			"createTime": "2026-04-22 11:05:03.907",
			"passticketName": "计时票限额测试",
			"passticketCategory": 3,
			"cardCode": null,
			"realName": "kai26568",
			"phone": "13411582689",
			"remark": ""
		}
	],
	"desc": ""
}
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

# 报表

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-06-26 10:57:26

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 营业简报列表

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-06-29 16:01:25

**按日期区间和门店ID查询该门店的营业简报列表**

**API Status**

> Completed

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "action": "SimpleReportList",
    "appid": "327b94c2-35f5-11ef-a734-0c42a1b7b4ae",
    "version": "1.0.0",
    "chainId": 2075,
    "shopId": 3157,
    "startDate": "2024-06-01",
    "endDate": "2024-06-28",
    "auth": "DBEB9F00CCC911BAC0DD1A68FEC4DE6B"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"shopId": 3157,
		"shopName": "",
		"items": [
			{
				"businessDate": "2024-06-08 00:00:00.000",
				"totalMoney": 110.99,
				"validTradeOrderCount": 0,
				"validTradeOrderMoney": 110.99,
				"cashPayMoney": 221.98,
				"onlinePayMoney": 0,
				"thirtyWriteOffCount": 0,
				"thirtyWriteOffMoney": 0
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 操作结果 |
| msg | - | string | 错误原因 |
| code | 0 | integer | 错误代码 |
| data | - | object | 返回数据对象 |
| data.shopId | 3157 | integer | 门店ID |
| data.shopName | - | string | 门店名称 |
| data.items | - | array | 数据子项 |
| data.items.businessDate | 2024-06-08 00:00:00.000 | string | 营业日期 |
| data.items.totalMoney | 110.99 | number | 营收总金额 |
| data.items.validTradeOrderCount | 0 | integer | 有效订单数量 |
| data.items.validTradeOrderMoney | 110.99 | number | 有效订单金额 |
| data.items.cashPayMoney | 221.98 | number | 现金支付金额 |
| data.items.onlinePayMoney | 0 | integer | 线上支付金额 |
| data.items.thirtyWriteOffCount | 0 | integer | 第三方核销数量 |
| data.items.thirtyWriteOffMoney | 0 | integer | 第三方核销金额 |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false,
	"msg": "查询总天数不能超过100天",
	"code": 0,
	"data": null,
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 操作结果 |
| msg | 查询总天数不能超过100天 | string | 错误原因 |
| code | 0 | integer | 错误代码 |
| data | null | null | 返回数据对象 |
| desc | - | string | - |

**Query**

## 获取门店营收日报表

> Creator: 陈昆

> Updater: 陈昆

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-07 19:20:36

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_revenue_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"startDate\": \"2025-01-03\",\"endDate\": \"2025-01-03\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"shopName": "翠花科技3157号店",
			"forDate": "2025-01-03",
			"sysMoney": 13563.61,
			"realMoney": 13563.61,
			"errorMoney": 0,
			"cashSysMoney": 581,
			"cashRealMoney": 687,
			"cashErrorMoney": 106,
			"otherInMoney": 0,
			"otherOutMoney": 0,
			"preDepositEntryMoney": 0,
			"preDepositUseMoney": 39,
			"onlineMoney": 0.01,
			"customMoney": 10501,
			"writeoffMoney": 2442.6,
			"writeoffTiktokMoney": 33,
			"writeoffMeituanMoney": 2409.6,
			"writeoffOtherMoney": 0,
			"sellCoinAmount": 3716,
			"sellCoinPrice": 3.29699,
			"newMemberAmount": 4,
			"goShopMemberAmount": 15,
			"onlines": [
				{
					"channelNo": "HuifuMultiPaymentExecutor",
					"channelName": "微信",
					"money": 0.01
				}
			],
			"customs": [
				{
					"customNo": "RecordPaymentExecutor",
					"customName": "A35借记卡支付",
					"money": 10501
				}
			],
			"writeoffs": [
				{
					"channelId": "162e154f-0141-4d12-b203-79c3cc1be6de",
					"channelNo": "4",
					"channelName": "美团",
					"money": 2409.6
				},
				{
					"channelId": "64a3b888-b164-4370-a73f-537385a6e3c8",
					"channelNo": "1",
					"channelName": "抖音官方团购",
					"money": 33
				}
			]
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.shopName | 翠花科技3157号店 | string | 门店名称 |
| data.forDate | 2025-01-03 | string | 营业日期 |
| data.sysMoney | 13563.61 | number | 应收金额 |
| data.realMoney | 13563.61 | number | 实收金额 |
| data.errorMoney | 0 | integer | 误差金额 |
| data.cashSysMoney | 581 | integer | 现金应收收款 |
| data.cashRealMoney | 687 | integer | 现金实收金额 |
| data.cashErrorMoney | 106 | integer | 现金误差金额 |
| data.otherInMoney | 0 | integer | 其它收入金额 |
| data.otherOutMoney | 0 | integer | 其它支出金额 |
| data.preDepositEntryMoney | 0 | integer | 增加预存款金额 |
| data.preDepositUseMoney | 39 | integer | 消耗预存款金额 |
| data.onlineMoney | 0.01 | number | 线上支付金额 |
| data.customMoney | 10501 | integer | 自定义支付金额 |
| data.writeoffMoney | 2442.6 | number | 第三方核销支付金额 |
| data.writeoffTiktokMoney | 33 | integer | 第三方核销抖音支付金额 |
| data.writeoffMeituanMoney | 2409.6 | number | 第三方核销美团支付金额 |
| data.writeoffOtherMoney | 0 | integer | 第三方核销其他支付金额 |
| data.sellCoinAmount | 3716 | integer | 销售币数 |
| data.sellCoinPrice | 3.29699 | number | 销售币单价 |
| data.newMemberAmount | 4 | integer | 新增会员 |
| data.goShopMemberAmount | 15 | integer | 到店会员 |
| data.onlines | - | array | 线上支付信息集合 |
| data.onlines.channelNo | HuifuMultiPaymentExecutor | string | 支付渠道编码 |
| data.onlines.channelName | 微信 | string | 支付渠道名称 |
| data.onlines.money | 0.01 | number | 收款金额 |
| data.customs | - | array | 自定义支付信息集合 如：记账、线下银行卡等 |
| data.customs.customNo | RecordPaymentExecutor | string | 支付方式编码 |
| data.customs.customName | A35借记卡支付 | string | 支付方式名称 |
| data.customs.money | 10501 | integer | 收款金额 |
| data.writeoffs | - | array | 第三方核销信息集合 |
| data.writeoffs.channelId | 162e154f-0141-4d12-b203-79c3cc1be6de | string | 核销渠道编码 |
| data.writeoffs.channelNo | 4 | string | 核销渠道编号   1.抖音官方团购 2.抖音小程序  4.美团  5.快手  8.阿里本地通 |
| data.writeoffs.channelName | 美团 | string | 核销渠道名称 |
| data.writeoffs.money | 2409.6 | number | 核销金额 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取门店商品兑换报表

> Creator: 陈宝聪

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-05-18 09:37:36

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_exchange_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"startTime\": \"2025-05-01 00:00:00\",\"endTime\": \"2025-05-31 23:59:59\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"goodsId": "041486d4-06ee-4d4d-b530-5fb7e2c64c4d",
			"goodsName": "新增测试购买兑换",
			"category": 1,
			"typeName": "【售币套餐】",
			"supplierName": "",
			"amount": 1,
			"realAmount": 2,
			"giftPriceTotal": 0.01,
			"nativeCoin1": 0,
			"coinBal2": 0,
			"integral": 0,
			"lottery": 2,
			"blueLottery": 0,
			"timePointValue": 0,
			"storeExtend04": 0,
			"storeExtend05": 0
		}
	],
	"footData":{
		"amount": 1,
		"giftPriceTotal": 0.01
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.goodsId | 041486d4-06ee-4d4d-b530-5fb7e2c64c4d | string | 商品编码 |
| data.goodsName | 新增测试购买兑换 | string | 商品名称 |
| data.category | 1 | integer | 商品类型 1-虚拟商品 2-实物商品 |
| data.typeName | 【售币套餐】 | string | 商品分组 |
| data.supplierName | - | string | 供应商 |
| data.amount | 1 | integer | 兑换数量 |
| data.realAmount | 2 | integer | 实付储值数 |
| data.giftPriceTotal | 0.01 | number | 成本 |
| data.nativeCoin1 | 0 | integer | 本币数 |
| data.coinBal2 | 0 | integer | 点数 |
| data.integral | 0 | integer | 积分 |
| data.lottery | 2 | integer | 彩票 |
| data.blueLottery | 0 | integer | 蓝票 |
| data.timePointValue | 0 | integer | 时点 |
| data.storeExtend04 | 0 | integer | 自定义储值1 |
| data.storeExtend05 | 0 | integer | 自定义储值1 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取门店机台消费报表

> Creator: 何康

> Updater: 何康

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-28 13:59:51

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_machine_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"ChainId\": \"2075\",\"ShopId\": \"3157\",\"startTime\": \"2024-12-23 00:00:00\",\"endTime\": \"2024-12-23 23:59:59\",\"page\": \"1\",\"limit\": \"10\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"page": 1,
	"limit": 20,
	"totalPage": 30,
	"totalRecord": 590,
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"forDate": "2024-12-23 00:00:00.000",
			"shopId": 0,
			"shopName": "翠花科技3157号店",
			"businessCategory": 0,
			"kindId": "00000000-0000-0000-0000-000000000000",
			"kindName": "",
			"machineId": "00168b4b-1c24-4ed8-bd58-512b617f0926",
			"machineName": "海王3觉醒加强版",
			"machineNo": "海-1",
			"tags": "[\"得分率高\",\"卡片机\"]",
			"sortIndex": 0,
			"returnMode": 0,
			"shopAcctId": null,
			"createTime": "2024-12-30 12:19:41.477",
			"sumAmount": 0,
			"inTotalCount": 0,
			"inTotalAmount": 0,
			"inPhysicalTotalCount": 0,
			"inVirtuallyTotalCount": 0,
			"inVirtuallyCoinBal2TotalCount": 0,
			"inPhysicalTotalAmount": 0,
			"inVirtuallyTotalAmount": 0,
			"inVirtuallyCoinBal2TotalAmount": 0,
			"outPhysicalCoin1TotalAmount": 0,
			"outVirtuallyCoin1TotalAmount": 0,
			"outNativeCoin1TotalAmount": 0,
			"outPhysicalLotteryTotalAmount": 0,
			"outVirtuallyLotteryTotalAmount": 0,
			"outVirtuallyBlueLotteryTotalAmount": 0,
			"outLotteryTotalAmount": 0,
			"outGiftTotalAmount": 0,
			"coinAwardRateValue": 0,
			"coinAwardRate": "0.00%",
			"lotteryAwardRateValue": 0,
			"blueLotteryAwardRateValue": 0,
			"lotteryAwardRate": "0张/币",
			"blueLotteryAwardRate": "0张/币",
			"giftAwardRateValue": 0,
			"giftAwardRate": "0币/个",
			"winningCoins": 0
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| page | 1 | integer | 页码 |
| limit | 20 | integer | 一页记录数 |
| totalPage | 30 | integer | 总页数 |
| totalRecord | 590 | integer | 总记录数 |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.forDate | 2024-12-23 00:00:00.000 | string | 营业日期 |
| data.shopId | 0 | integer | 门店编码 |
| data.shopName | 翠花科技3157号店 | string | 门店名称 |
| data.kindId | 00000000-0000-0000-0000-000000000000 | string | 机种编码 |
| data.kindName | - | string | 机种名称 |
| data.machineId | 00168b4b-1c24-4ed8-bd58-512b617f0926 | string | 机台编码 |
| data.machineName | 海王3觉醒加强版 | string | 机台名称 |
| data.machineNo | 海-1 | string | 机台编号 |
| data.tags | ["得分率高","卡片机"] | string | 机台标签 |
| data.sortIndex | 0 | integer | 排序 |
| data.createTime | 2024-12-30 12:19:41.477 | string | 创建时间 |
| data.inTotalCount | 0 | integer | 耗储值次数 |
| data.inTotalAmount | 0 | integer | 耗储值汇总 |
| data.inPhysicalTotalAmount | 0 | integer | 耗实物币 |
| data.inVirtuallyTotalAmount | 0 | integer | 耗虚拟币 |
| data.inVirtuallyCoinBal2TotalAmount | 0 | integer | 耗虚拟点数 |
| data.outPhysicalCoin1TotalAmount | 0 | integer | 出实物币 |
| data.outVirtuallyCoin1TotalAmount | 0 | integer | 出电子币 |
| data.outNativeCoin1TotalAmount | 0 | integer | 出本币总数 |
| data.outPhysicalLotteryTotalAmount | 0 | integer | 出实物彩票 |
| data.outVirtuallyLotteryTotalAmount | 0 | integer | 出电子彩票 |
| data.outVirtuallyBlueLotteryTotalAmount | 0 | integer | 出电子蓝票 |
| data.outLotteryTotalAmount | 0 | integer | 出彩票总数 |
| data.outGiftTotalAmount | 0 | integer | 出实物礼品 |
| data.coinAwardRateValue | 0 | integer | 出币率 |
| data.coinAwardRate | 0.00% | string | 展示出币率 |
| data.lotteryAwardRateValue | 0 | integer | 出票率 |
| data.blueLotteryAwardRateValue | 0 | integer | 出蓝票率 |
| data.lotteryAwardRate | 0张/币 | string | 展示出彩票率 |
| data.blueLotteryAwardRate | 0张/币 | string | 展示出蓝票率 |
| data.giftAwardRateValue | 0 | integer | 出奖品率 |
| data.giftAwardRate | 0币/个 | string | 展示出奖品率 |
| data.winningCoins | 0 | integer | 展示赢币数 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取会员概况日报表

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-04-06 11:05:15

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_member_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"StartDate\": \"2025-01-03\",\"EndDate\": \"2025-01-04\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":[{"forDate":"2025-01-04 00:00:00.000","totalMembers":9188,"totalGuests":97,"newMembers":1,"goShopMembers":5,"totalNativeCoin1":108465274.90,"totalGiveCoin1":63635508.00,"totalIntegral":63891041.00,"totalLottery":85301266.00,"totalBlueLottery":62500812.00,"totalTimePointValue":100.00,"totalTimeCoinBal1":3031.00,"totalCoinBal2":63530842.00,"totalMoney":11980.96,"totalStoreExtend04":2896.00,"totalStoreExtend05":3419.00,"totalCountPassticket":2838,"totalTermPassticket":54616},{"forDate":"2025-01-03 00:00:00.000","totalMembers":9188,"totalGuests":96,"newMembers":4,"goShopMembers":15,"totalNativeCoin1":108463635.90,"totalGiveCoin1":63635508.00,"totalIntegral":63891041.00,"totalLottery":85301407.00,"totalBlueLottery":62500812.00,"totalTimePointValue":100.00,"totalTimeCoinBal1":3031.00,"totalCoinBal2":63530842.00,"totalMoney":11980.96,"totalStoreExtend04":2896.00,"totalStoreExtend05":3419.00,"totalCountPassticket":2924,"totalTermPassticket":54680}],"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | array | - |
| data.forDate | 2025-01-04 00:00:00.000 | string | 日期 |
| data.totalMembers | 9188 | integer | 会员总数 |
| data.totalGuests | 97 | integer | 游客总数 |
| data.newMembers | 1 | integer | 新会员数 |
| data.goShopMembers | 5 | integer | 到店会员数 |
| data.totalNativeCoin1 | 108465274.9 | number | 总本币数 |
| data.totalGiveCoin1 | 63635508 | integer | 总赠币数 |
| data.totalIntegral | 63891041 | integer | 总积分数 |
| data.totalLottery | 85301266 | integer | 总彩票数 |
| data.totalBlueLottery | 62500812 | integer | 总蓝票数 |
| data.totalTimePointValue | 100 | integer | 总时点数 |
| data.totalTimeCoinBal1 | 3031 | integer | 总限时币数 |
| data.totalCoinBal2 | 63530842 | integer | 总点数 |
| data.totalMoney | 11980.96 | number | 总预存款数 |
| data.totalStoreExtend04 | 2896 | integer | 总预存款本金数 |
| data.totalStoreExtend05 | 3419 | integer | 总预存款赠金数 |
| data.totalCountPassticket | 2838 | integer | 总次票剩余数（次） |
| data.totalTermPassticket | 54616 | integer | 总年票剩余数（天） |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取电子票日报表

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-10 15:48:29

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_lottery_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"StartDate\": \"2025-01-03\",\"EndDate\": \"2025-01-04\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"businessDate": "2025-01-04 00:00:00.000",
			"firstLotterys": 85301407,
			"customerAmount": 0,
			"deviceInAmount": 0,
			"packageGiveAmount": 0,
			"deviceReturnAmount": 0,
			"giftRecyclingAmount": 0,
			"otherGetAmount": 0,
			"getLotterys": 0,
			"palyAmount": 0,
			"giftExchangeAmount": 141,
			"expiredAmount": 0,
			"acrossAmount": 0,
			"otherUseAmount": 0,
			"useLotterys": 141,
			"systemLotterys": 85301266,
			"memberLotterys": 85965115,
			"guestLotterys": 177454,
			"lastLotterys": 85301266,
			"differenceLotterys": 0
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.businessDate | 2025-01-04 00:00:00.000 | string | 日期 |
| data.firstLotterys | 85301407 | integer | 期初实余票数 |
| data.customerAmount | 0 | integer | 客诉票数 |
| data.deviceInAmount | 0 | integer | 设备存票 |
| data.packageGiveAmount | 0 | integer | 套餐赠送彩票数 |
| data.deviceReturnAmount | 0 | integer | 设备返票 |
| data.giftRecyclingAmount | 0 | integer | 礼品回收 |
| data.otherGetAmount | 0 | integer | 其它获票 |
| data.getLotterys | 0 | integer | 获得总票数 |
| data.palyAmount | 0 | integer | 机台耗票 |
| data.giftExchangeAmount | 141 | integer | 兑换耗票 |
| data.expiredAmount | 0 | integer | 过期耗票 |
| data.acrossAmount | 0 | integer | 跨店耗票 |
| data.otherUseAmount | 0 | integer | 其它耗票 |
| data.useLotterys | 141 | integer | 消耗总票数 |
| data.systemLotterys | 85301266 | integer | 期末应余票数 |
| data.memberLotterys | 85965115 | integer | 会员总票数 |
| data.guestLotterys | 177454 | integer | 游客总票数 |
| data.lastLotterys | 85301266 | integer | 期末实余票数 |
| data.differenceLotterys | 0 | integer | 差额 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取销售统计报表-按商品分组

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-04-06 15:54:48

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_sell_statistics_bygoodstype",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"StartDate\": \"2025-04-01\",\"EndDate\": \"2025-04-7\",\"GoodsName\": \"\",\"GoodsSellSource\": \"\",\"GoodsTypeNameContent\": \"\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| startDate | - | string | Yes | 营收日期开始日期 |
| endDate | - | string | Yes | 营收日期结束日期 |
| GoodsTypeNameContent | 游戏币,次票,抖音套餐 | string | Yes | 商品分组名称内容，多个用逗号,隔开 |
| GoodsName | - | string | Yes | 商品名称 |
| GoodsSellSource | - | string | Yes | 销售来源 1门店销售 2第三方核销 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"shopId": 3157,
			"goodsTypeName": "文旅普通票",
			"goodsItems": [
				{
					"shopId": 3157,
					"goodsTypeName": "文旅普通票",
					"goodsId": "134ca722-bdbe-40f3-a948-ea355a412ed8",
					"goodsName": "文旅票-井冈山",
					"totalQty": 1,
					"totalMoney": 0.04,
					"totalCost": 0,
					"cancelQty": 0,
					"cancelMoney": 0,
					"cancelCost": 0,
					"realQty": 1,
					"realMoney": 0.04,
					"realCost": 0,
					"sellRatio": 0.0002,
					"sellRatioDisplay": "0.02%"
				}
			],
			"totalQty": 1,
			"totalMoney": 0.04,
			"cancelQty": 0,
			"cancelMoney": 0,
			"totalRealQty": 1,
			"totalRealMoney": 0.04,
			"realCost": 0,
			"sellRatio": 0.0002,
			"sellRatioDisplay": "0.02%"
		},
		{
			"shopId": 3157,
			"goodsTypeName": "【售币套餐】",
			"goodsItems": [
				{
					"shopId": 3157,
					"goodsTypeName": "【售币套餐】",
					"goodsId": "27e0cb8d-6473-4e2b-a610-a7d23c7b43a2",
					"goodsName": "5元5币",
					"totalQty": 19,
					"totalMoney": 95,
					"totalCost": 0,
					"cancelQty": 0,
					"cancelMoney": 0,
					"cancelCost": 0,
					"realQty": 19,
					"realMoney": 95,
					"realCost": 0,
					"sellRatio": 0.4871,
					"sellRatioDisplay": "48.71%"
				}
			],
			"totalQty": 19,
			"totalMoney": 95,
			"cancelQty": 0,
			"cancelMoney": 0,
			"totalRealQty": 19,
			"totalRealMoney": 95,
			"realCost": 0,
			"sellRatio": 0.4871,
			"sellRatioDisplay": "48.71%"
		},
		{
			"shopId": 3157,
			"goodsTypeName": "门票套餐",
			"goodsItems": [
				{
					"shopId": 3157,
					"goodsTypeName": "门票套餐",
					"goodsId": "cdb5c88d-b02e-4816-84a5-f885adcec221",
					"goodsName": "10次卡-名字超长超长的，你来看看显示是否正常",
					"totalQty": 1,
					"totalMoney": 100,
					"totalCost": 0,
					"cancelQty": 0,
					"cancelMoney": 0,
					"cancelCost": 0,
					"realQty": 1,
					"realMoney": 100,
					"realCost": 0,
					"sellRatio": 0.5127,
					"sellRatioDisplay": "51.27%"
				}
			],
			"totalQty": 1,
			"totalMoney": 100,
			"cancelQty": 0,
			"cancelMoney": 0,
			"totalRealQty": 1,
			"totalRealMoney": 100,
			"realCost": 0,
			"sellRatio": 0.5127,
			"sellRatioDisplay": "51.27%"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.goodsTypeName | 文旅普通票 | string | 商品分组 |
| data.goodsItems | - | array | 明细数据 |
| data.goodsItems.goodsId | 134ca722-bdbe-40f3-a948-ea355a412ed8 | string | 商品编码 |
| data.goodsItems.goodsName | 文旅票-井冈山 | string | 商品名称 |
| data.goodsItems.totalQty | 1 | integer | 销售数量 |
| data.goodsItems.totalMoney | 0.04 | number | 销售金额 |
| data.goodsItems.cancelQty | 0 | integer | 退单数量 |
| data.goodsItems.cancelMoney | 0 | integer | 退单金额 |
| data.goodsItems.realQty | 1 | integer | 有效订单数量 |
| data.goodsItems.realMoney | 0.04 | number | 有效订单金额 |
| data.goodsItems.sellRatio | 0.0002 | number | 销售占比 |
| data.totalQty | 1 | integer | 总销售数量 |
| data.totalMoney | 0.04 | number | 总销售金额 |
| data.cancelQty | 0 | integer | 退单数量 |
| data.cancelMoney | 0 | integer | 退单金额 |
| data.totalRealQty | 1 | integer | 总有效订单数量 |
| data.totalRealMoney | 0.04 | number | 总有效订单金额 |
| data.sellRatio | 0.0002 | number | 销售占比 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取库存分析表

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-05-26 10:07:55

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "report_stock_analysis",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"forMonth\": \"2025-04\",\"isBuyWarn\": false ,\"IsSaleWarn\": false }"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| forMonth | 2025-04 | string | Yes | 查询月份 |
| isBuyWarn | - | boolean | No | 过度采购 |
| IsSaleWarn | - | boolean | No | 滞销风险 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
    "footData": {        
        "typeGoodsNumber": 0,    
        "goodsNumber": 24,
        "outAmount": 98,
        "outMoney": 28022.33000,
        "remainGooodsNumber": 13,
        "remainAmount": -669,
        "remainMoney": 4249.23204,
        "useDays": -205
    },
    "isAsyncFoot": false,
    "pageSize": 1,
    "pageIndex": 999999,
    "totals": 15,
    "success": true,
    "msg": "",
    "code": 0,
    "data": [
        {
            "typeId": "08db7c36-031d-430c-8d97-8c9749ca221e",
            "typeName": "零售商品1",
            "typeGoodsNumber": 3,
            "typeMoneyName": "2.0元以下",
            "stockName": "ck仓库",
            "goodsNumber": 3,
            "outAmount": 1,
            "outMoney": 1.00000,
            "remainGooodsNumber": 3,
            "remainAmount": -3,
            "remainMoney": -602.08568,
            "useDays": -90,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc820b-6c6a-4ad2-86b3-191ec16488fb",
            "typeName": "带前缀分组2",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "ck仓库",
            "goodsNumber": 1,
            "outAmount": 0,
            "outMoney": 0.0,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "358b996d-96ae-47f0-ba05-90117df1988e",
            "typeName": "门店娃娃",
            "typeGoodsNumber": 1,
            "typeMoneyName": "15.0元以下",
            "stockName": "吧台陈列仓",
            "goodsNumber": 1,
            "outAmount": 1,
            "outMoney": 5.00000,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0.02%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "f190c283-2d25-4739-bf41-fa4f10693b01",
            "typeName": "玩具（集团）",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "吧台陈列仓",
            "goodsNumber": 1,
            "outAmount": 0,
            "outMoney": 0.0,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08db88d3-694c-40b3-8b7a-32649e18fe0c",
            "typeName": "衣服饰品",
            "typeGoodsNumber": 2,
            "typeMoneyName": "50.0元以下",
            "stockName": "主仓库01",
            "goodsNumber": 1,
            "outAmount": 0,
            "outMoney": 0.0,
            "remainGooodsNumber": 1,
            "remainAmount": -106,
            "remainMoney": -21.51652,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "-0.04%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08db88d3-694c-40b3-8b7a-32649e18fe0c",
            "typeName": "衣服饰品",
            "typeGoodsNumber": 2,
            "typeMoneyName": "50.0元以下",
            "stockName": "娃娃仓库",
            "goodsNumber": 1,
            "outAmount": 0,
            "outMoney": 0.0,
            "remainGooodsNumber": 1,
            "remainAmount": -4,
            "remainMoney": 870.00000,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08db88d3-694c-40b3-8b7a-32649e18fe0c",
            "typeName": "衣服饰品",
            "typeGoodsNumber": 2,
            "typeMoneyName": "50.0元以下",
            "stockName": "专用机台仓",
            "goodsNumber": 1,
            "outAmount": 0,
            "outMoney": 0.0,
            "remainGooodsNumber": 1,
            "remainAmount": -564,
            "remainMoney": -5.16576,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "-0.23%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "3320a613-6665-4e3a-ad40-bc0b14519040",
            "typeName": "0101(红彩票)",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "吧台仓",
            "goodsNumber": 1,
            "outAmount": 1,
            "outMoney": 3.33000,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0.01%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "a6c0785a-db60-4686-9758-176c6e1adfe4",
            "typeName": "031406(数码电子类)",
            "typeGoodsNumber": 8,
            "typeMoneyName": "--",
            "stockName": "ACRT仓库",
            "goodsNumber": 8,
            "outAmount": 8,
            "outMoney": 28003.00000,
            "remainGooodsNumber": 3,
            "remainAmount": 3,
            "remainMoney": 4006.00000,
            "useDays": 11,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "92.91%",
            "remainMoneyRate": "0.01%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc9f4a-528c-4d64-8312-4bb6bf52dca9",
            "typeName": "会员卡",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "机台陈列仓",
            "goodsNumber": 1,
            "outAmount": 1,
            "outMoney": 0.00000,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc9f4a-528c-4d64-8312-4bb6bf52dca9",
            "typeName": "会员卡",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "主仓库",
            "goodsNumber": 1,
            "outAmount": 8,
            "outMoney": 0.00000,
            "remainGooodsNumber": 1,
            "remainAmount": 1,
            "remainMoney": 0.00000,
            "useDays": 4,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc9f4a-528c-4d64-8312-4bb6bf52dca9",
            "typeName": "会员卡",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "ck仓库",
            "goodsNumber": 1,
            "outAmount": 2,
            "outMoney": 0.00000,
            "remainGooodsNumber": 1,
            "remainAmount": 2,
            "remainMoney": 0.00000,
            "useDays": 30,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc9f4a-528c-4d64-8312-4bb6bf52dca9",
            "typeName": "会员卡",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "吧台仓",
            "goodsNumber": 1,
            "outAmount": 58,
            "outMoney": 0.00000,
            "remainGooodsNumber": 1,
            "remainAmount": 1,
            "remainMoney": 0.00000,
            "useDays": 1,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "08dc9f4a-528c-4d64-8312-4bb6bf52dca9",
            "typeName": "会员卡",
            "typeGoodsNumber": 1,
            "typeMoneyName": "--",
            "stockName": "ACRT仓库",
            "goodsNumber": 1,
            "outAmount": 13,
            "outMoney": 0.00000,
            "remainGooodsNumber": 0,
            "remainAmount": 0,
            "remainMoney": 0.0,
            "useDays": 0,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        },
        {
            "typeId": "00479ccd-cdd5-4ea5-9413-44579dafe435",
            "typeName": "零食饮料",
            "typeGoodsNumber": 1,
            "typeMoneyName": "10.0元以下",
            "stockName": "吧台陈列仓",
            "goodsNumber": 1,
            "outAmount": 5,
            "outMoney": 10.00000,
            "remainGooodsNumber": 1,
            "remainAmount": 1,
            "remainMoney": 2.00000,
            "useDays": 6,
            "outAmountRate": "0%",
            "remainAmountRate": "0%",
            "outMoneyRate": "0.03%",
            "remainMoneyRate": "0%",
            "isBuyWarn": false,
            "isSaleWarn": false
        }
    ],
    "desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| footData | - | object | - |
| footData.typeGoodsNumber | 0 | integer | 总款式数量 |
| footData.goodsNumber | 24 | integer | 子款式数量 |
| footData.outAmount | 98 | integer | 出货量 |
| footData.outMoney | 28022.33 | number | 出货金额 |
| footData.remainGooodsNumber | 13 | integer | 剩余款式 |
| footData.remainAmount | -669 | integer | 剩余库存量 |
| footData.remainMoney | 4249.23204 | number | 剩余库存金额 |
| footData.useDays | -205 | integer | 剩余库存可用天数 |
| isAsyncFoot | false | boolean | - |
| pageSize | 1 | integer | - |
| pageIndex | 999999 | integer | - |
| totals | 15 | integer | - |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.typeId | 08db7c36-031d-430c-8d97-8c9749ca221e | string | - |
| data.typeName | 零售商品1 | string | 礼品分组 |
| data.typeGoodsNumber | 3 | integer | 总款式数量 |
| data.typeMoneyName | 2.0元以下 | string | 价格区间名称 |
| data.stockName | ck仓库 | string | 仓库名称 |
| data.goodsNumber | 3 | integer | 子款式数量 |
| data.outAmount | 1 | integer | 出货量 |
| data.outMoney | 1 | integer | 出货金额 |
| data.remainGooodsNumber | 3 | integer | 剩余款式 |
| data.remainAmount | -3 | integer | 剩余库存量 |
| data.remainMoney | -602.08568 | number | 剩余库存金额 |
| data.useDays | -90 | integer | 剩余库存可用天数 |
| data.outAmountRate | 0% | string | 出货量占比（%） |
| data.remainAmountRate | 0% | string | 剩余库存量占比（%） |
| data.outMoneyRate | 0% | string | 出货金额占比（%） |
| data.remainMoneyRate | 0% | string | 剩余库存金额占比（%） |
| data.isBuyWarn | false | boolean | 过度采购 |
| data.isSaleWarn | false | boolean | 是否有滞销风险 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

# 机台

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-09-04 16:08:37

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 获取游戏机台配置参数

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:31

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_get_settings",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6A6A9149897CF3F16A53AAEE6D063681",
	"body": "{\"machineCode\":\"SY01-MN01-HBDL01-0090\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": {
        "minAmount":500
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| code | 0 | integer | - |
| msg | - | string | - |
| data | - | object | 响应业务数据 |
| data.minAmount | 500 | integer | 最小中奖数量，大于等于这个数量时打印小票 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "游戏机台不存在",
	"data": null
}
```

**Query**

## 获取中奖打印二维码

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:35

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_generate_welfare_qrcode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "4437DE6730F67CDFA48B1C395EB89A3C",
	"body": "{\"machineCode\":\"SY01-MN01-HBDL01-0090\",\"amount\":\"88\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | machine_generate_welfare_qrcode | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D8BE40A7F2F9719819C3CFCB0D3AC60B | string | Yes | - |
| body | - | object | Yes | 业务数据：需转化为json字符串 |
| body.uid | 5f1631a6-370f-40a1-a954-31bf157cd31c | string | No | 会员编码 |
| body.machineCode | MCH0520265 | string | Yes | 机器码 |
| body.amount | 500 | string | Yes | 中奖数量 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "中奖二维码生成成功",
	"data": {
		"code": "H31956C514FFD49AF340956114DA1918CF4",
		"expire": 120,
		"remark":"奖励彩票500张",
		"storeds":[{
			"storedName":"彩票",
			"storedValue":500,
			"remark":"奖励彩票500张"
		}]
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| code | 0 | integer | - |
| msg | 中奖二维码生成成功 | string | - |
| data | - | object | 响应业务数据 |
| data.code | H31956C514FFD49AF340956114DA1918CF4 | string | - |
| data.expire | 120 | integer | - |
| data.remark | 奖励彩票500张 | string | 奖励描述 |
| data.storeds | - | array | 奖励储值信息 |
| data.storeds.storedName | 彩票 | string | 奖励储值名称 |
| data.storeds.storedValue | 500 | integer | 奖励储值数量 |
| data.storeds.remark | 奖励彩票500张 | string | 奖励储值描述 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "未满足最小中奖数量,无二维码生成",
	"data":null
}
```

**Query**

## 通过通讯编码获取机台信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-04-16 13:13:37

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_details_by_commid",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "5AB04D80944C4E61947BC698FB7EFCE6",
	"body": "{\"commId\":147190}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | machine_details_by_commid | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 4437DE6730F67CDFA48B1C395EB89A3C | string | Yes | - |
| body | {"commId":786754} | string | Yes | common:机台通讯编码 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"machineName": "龙之焰",
		"consoleNo": "1P",
		"commId": 147190,
		"isOnline": true,
		"storeSetMeals": [
			{
				"setMealId": "03b6d8b4-6809-4a4d-a604-597836c70ef6",
				"setMealName": "1币1局",
				"billingMode": 1,
				"timeNumber": 1,
				"gameAmount": 1,
				"storedCategory": 1,
				"amount": 1
			},
			{
				"setMealId": "5d9ec737-b0b6-44fb-8e19-3509f631f290",
				"setMealName": "10币1局",
				"billingMode": 1,
				"timeNumber": 1,
				"gameAmount": 1,
				"storedCategory": 1,
				"amount": 10
			},
			{
				"setMealId": "1d2153b0-fcc9-4ac8-bf3a-d73cfd51dae7",
				"setMealName": "5币5局",
				"billingMode": 1,
				"timeNumber": 1,
				"gameAmount": 5,
				"storedCategory": 1,
				"amount": 5
			},
			{
				"setMealId": "3cc023b4-6136-4b20-a216-913c8ee64e86",
				"setMealName": "100币100局",
				"billingMode": 1,
				"timeNumber": 0,
				"gameAmount": 100,
				"storedCategory": 1,
				"amount": 100
			},
			{
				"setMealId": "4301f7ab-cee9-4372-8728-7896471fcde7",
				"setMealName": "10币10局",
				"billingMode": 1,
				"timeNumber": 0,
				"gameAmount": 10,
				"storedCategory": 1,
				"amount": 10
			}
		],
		"paymentSetMeals": [
			{
				"setMealId": "139839ef-710e-462c-b21c-0e30fbc0a2e1",
				"setMealName": "反扫套餐",
				"billingMode": 1,
				"timeNumber": 1,
				"gameAmount": 2,
				"storedCategory": 99,
				"amount": 0.01
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.machineName | 龙之焰 | string | 游戏机台名称 |
| data.consoleNo | 1P | string | 游戏机台P位编号 |
| data.commId | 147190 | integer | 机台通讯编码 |
| data.isOnline | true | boolean | 是否在线 |
| data.storeSetMeals | - | object | 储值套餐列表 |
| data.storeSetMeals.setMealId | 03b6d8b4-6809-4a4d-a604-597836c70ef6 | string | - |
| data.storeSetMeals.setMealName | 1币1局 | string | 套餐名称 |
| data.storeSetMeals.billingMode | 1 | integer | 计费模式（1.计次 2.计时） |
| data.storeSetMeals.timeNumber | 1 | integer | 可玩分钟数 |
| data.storeSetMeals.gameAmount | 1 | integer | 可玩局数 |
| data.storeSetMeals.storedCategory | 1 | integer | 消费储值类型 |
| data.storeSetMeals.amount | 1 | integer | 消费数量 |
| data.paymentSetMeals | - | object | - |
| data.paymentSetMeals.setMealId | 139839ef-710e-462c-b21c-0e30fbc0a2e1 | string | 套餐编码 |
| data.paymentSetMeals.setMealName | 反扫套餐 | string | - |
| data.paymentSetMeals.billingMode | 1 | integer | - |
| data.paymentSetMeals.timeNumber | 1 | integer | - |
| data.paymentSetMeals.gameAmount | 2 | integer | - |
| data.paymentSetMeals.storedCategory | 99 | integer | - |
| data.paymentSetMeals.amount | 0.01 | number | - |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取当前设备在线状态

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-16 13:27:12

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_terminal_get_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "D9BB7AA5EDD628651DBFFA0D859CCFCB",
	"body": "{\"commId\":441274}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | machine_terminal_get_status | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 4437DE6730F67CDFA48B1C395EB89A3C | string | Yes | - |
| body | {"commId":385852} | string | Yes | commId:通讯编码 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"isOnline": false
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.isOnline | false | boolean | 是否在线 |
| desc | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 扣币启动游戏机台

> Creator: 石元考

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-26 14:26:33

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_remote_start_by_store",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "0EE7B771C07C6D8777367EC8CB7E03AF",
	"body": "{\"commId\":518744,\"orderId\":\"CLC522664-173694308558978221\",\"uid\":\"b8d5cb9f-f93f-4973-af34-e617b14ae4ca\",\"cardId\":null,\"cardCode\":null,\"gameAmount\":1,\"totalCoinBal\":3,\"totalTicketBal\":0}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | machine_remote_start_by_store | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 4437DE6730F67CDFA48B1C395EB89A3C | string | Yes | - |
| body | {"commId":385852,"orderId":"SM00315721736421477949471-00009","uid":"610425f4-ce78-11ef-a325-1070fda8acec","cardId":"aac374eb-ce79-11ef-a325-1070fda8acec","cardCode":"16962657323","gameAmount":5,"totalCoinBal":500,"totalTicketBal":300} | string | Yes | commId:卡头通讯编码,orderId:订单号,uid:会员账户编码,cardId:会员卡号编码,cardCode:会员卡号,gameAmount:游玩局数,totalCoinBal:剩余币数,totalTicketBal:剩余彩票数 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"remark": "2025/1/9 16:38:13-狂飙追击02远程启动成功"
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.remark | 2025/1/9 16:38:13-狂飙追击02远程启动成功 | string | 远程上币描述 |
| desc | - | string | 业务描述 |

* 失败(404)

```javascript
No data
```

**Query**

## 支付启动游戏机台

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-03 20:56:16

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_remote_start_by_pay",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "4437DE6730F67CDFA48B1C395EB89A3C",
	"body": "{\"commId\":786754}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 扫码选择套餐玩游戏

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-05-06 21:22:29

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
  "appId": "ac321a3935234a108880ae156e7df8e6",
  "action": "machine_scan_play_setmeal",
  "version": "10.11.8",
  "timestamp": "1723822967585",
  "sign": "760A5B6FA85EB6714F1647C0BC452634",
  "body": "{\"uid\":\"bcd7e8b9-585a-45d0-9e34-92e2306e6d3f\",\"commId\":532516,\"setMealId\":\"bd7e8c23-7d6a-4b08-8d8c-59415acc6b97\",\"bizCode\":\"CLC532516-174487075726762447\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | machine_scan_play_setmeal | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | B99C16E57637260C4EB25382673D71DE | string | Yes | - |
| body | {"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f","commId":147190,"setMealId":"1d2153b0-fcc9-4ac8-bf3a-d73cfd51dae7","bizCode":"59AYAD3UFELG7C7U656AJ46EPNFQLU125"} | string | Yes | uid:会员编码;
commid:卡头通讯编码;
setMealId:卡头套餐编码;
bizCode:交易业务唯一标识(如订单号，不能重复) |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"remark": ""
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.remark | - | string | - |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

# 核销

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-09-11 06:55:22

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 第三方团购-预核销

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:39

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "fb3aa300d5694abbb807472ae405f772",
	"action": "writeoff_prepare",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "1AF43EFB3BC26387EE1FFFE9C88998C4",
	"body": "{\"uid\":\"5f1631a6-370f-40a1-a954-31bf157cd31c\",\"code\":\"BD109110267410304268\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | writeoff_prepare | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D8BE40A7F2F9719819C3CFCB0D3AC60B | string | Yes | - |
| body | - | object | Yes | - |
| body.uid | 36fb8e10-90ea-453b-990f-c5daf986ee5f | string | Yes | 会员编码 |
| body.code | 351288524 | string | Yes | 待核销券码 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "预核销成功",
	"data": {
		"couponId": "bd6447b6-6fd1-11ef-aa84-00e04c360239",
        "goodsName":"100元=150币",
        "qty":1
	}
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| code | 0 | integer | - |
| msg | 预核销成功 | string | - |
| data | - | object | - |
| data.couponId | bd6447b6-6fd1-11ef-aa84-00e04c360239 | string | 预核销券编码 |
| data.goodsName | 100元=150币 | string | 待核销商品名称 |
| data.qty | 1 | integer | 待核销商品数量 |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "团单不存在",
	"data": null
}
```

**Query**

## 第三方团购-确认核销

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:44

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "fb3aa300d5694abbb807472ae405f772",
	"action": "writeoff_submit",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "D8BE40A7F2F9719819C3CFCB0D3AC60B",
	"body": {
        "uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f",
		"couponId": "52b233fa-6fd1-11ef-aa84-00e04c360239",
        "qty":1
	}
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | fb3aa300d5694abbb807472ae405f772 | string | Yes | - |
| action | writeoff_submit | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D8BE40A7F2F9719819C3CFCB0D3AC60B | string | Yes | - |
| body | - | object | Yes | - |
| body.uid | 36fb8e10-90ea-453b-990f-c5daf986ee5f | string | Yes | 会员编码 |
| body.couponId | 52b233fa-6fd1-11ef-aa84-00e04c360239 | string | Yes | 预核销生成的待核销券编码 |
| body.qty | 1 | integer | Yes | 核销数量，默认为1 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "核销成功",
	"data": null
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "核销失败",
	"data": null
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | - |
| code | 0 | integer | - |
| msg | 核销失败 | string | - |
| data | null | null | - |

**Query**

# 设备

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-18 15:34:04

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 设备扫码登录

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-18 16:17:05

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_scan_login",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"uid\":\"36fb8e10-90ea-453b-990f-c5daf986ee5f\",\"commId\":493755,\"randomCode\":\"16962491932330688525\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | device_scan_login | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f","commId":493755,"randomCode":"16962491932330688525"} | string | Yes | uid:会员账户编码 commId:自助设备通讯编码 randomCode:"自助设备生成的登录随机码" |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "扫码登录成功",
	"code": 0,
	"data": {},
	"desc": ""
}
```

* 失败(404)

```javascript
No data
```

**Query**

## 销售终端列表查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 11:24:41

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_workplace_simple_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"category\":1}" // 收银台 1，pos机 2
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"workPlaceId": "760b1fa6-15e7-40cc-80b5-7dc56a9c0d0f",
			"placeName": "收银台#209",
			"commId": 806887,
			"deviceId": "7f2286dd-f5e5-4a5e-af69-12dac7672325"
		},
		{
			"workPlaceId": "1ed3a4f1-c2ed-401e-9d38-8473743dafc9",
			"placeName": "收银台#208",
			"commId": 806885,
			"deviceId": "a3bbd6ba-3dc2-41f5-81ba-247c2440878e"
		},
		{
			"workPlaceId": "1ce9cc2a-0266-4357-b08c-78e5dbd26e3f",
			"placeName": "收银台#207",
			"commId": 806860,
			"deviceId": "6e3f7bc8-b2c9-49c6-bd37-99db51427fa4"
		},
		{
			"workPlaceId": "5edd4ef4-7d49-454e-bf92-9d23efd7f46b",
			"placeName": "收银台#206",
			"commId": 803661,
			"deviceId": "17bb0e29-cd14-4718-89ac-5bc825fdcc37"
		},
		{
			"workPlaceId": "4704bb48-d74b-4a72-8279-ec6182974a27",
			"placeName": "收银台#205",
			"commId": 803649,
			"deviceId": "5373dbaf-59a2-4a2a-87c1-650795a408ca"
		},
		{
			"workPlaceId": "42d7eee6-dada-4494-95e3-a6c207a75bd9",
			"placeName": "收银台#204",
			"commId": 803575,
			"deviceId": "8a9c796e-b16a-4b43-98e8-7406683b043a"
		},
		{
			"workPlaceId": "da387eb7-9bf1-4a82-bb92-87aa967fa563",
			"placeName": "收银台#203",
			"commId": 643584,
			"deviceId": "d2eac84b-8c1f-4314-b2cb-2b983c43c208"
		},
		{
			"workPlaceId": "c7713438-70b4-4afa-8353-a78df4d627e9",
			"placeName": "收银台#202",
			"commId": 800239,
			"deviceId": "679438ae-6198-4d8a-bba6-b4be8e74091c"
		},
		{
			"workPlaceId": "57491954-dea2-47f4-867f-df8c506d6e3f",
			"placeName": "收银台#201",
			"commId": 794502,
			"deviceId": "f3f89630-1368-4835-a8f9-80726a272551"
		},
		{
			"workPlaceId": "01a4dbdf-c0f9-44cb-8157-07127a30f8f1",
			"placeName": "收银台#200",
			"commId": 794501,
			"deviceId": "6b18747d-70e0-4032-bd13-7d790d6c20f9"
		},
		{
			"workPlaceId": "db1c0134-d734-4957-ab17-ee4dbdad1482",
			"placeName": "收银台#199",
			"commId": 759370,
			"deviceId": "457dd2a4-cfc3-46f8-9bfe-82edea551f4c"
		},
		{
			"workPlaceId": "b6a30583-8259-4332-a229-10196abc40a4",
			"placeName": "收银台#198",
			"commId": 734665,
			"deviceId": "b417f7d4-c0e4-437c-80ec-5640e86f3185"
		},
		{
			"workPlaceId": "2e66a808-a12f-40d0-a4c2-d001a9aa3475",
			"placeName": "收银台#197",
			"commId": 793423,
			"deviceId": "a9920cf1-194e-4b3c-a33c-e4d8bf6ca8dd"
		},
		{
			"workPlaceId": "4391d64f-fcc7-484e-a5ab-130ca57e419a",
			"placeName": "收银台#196",
			"commId": 791260,
			"deviceId": "9be8e3f9-d28f-4683-b586-b9588c0f63a2"
		},
		{
			"workPlaceId": "97681f42-b6f4-4940-bd25-ffe60d467777",
			"placeName": "收银台#195",
			"commId": 790268,
			"deviceId": "cab157a3-55c5-4a94-b5e4-bc89a781f0c9"
		},
		{
			"workPlaceId": "c269afff-bb8d-4a5e-bf16-dd35cba07ee3",
			"placeName": "收银台#194",
			"commId": 787715,
			"deviceId": "ddcaf431-b5ad-45d7-ba85-511eab36734f"
		},
		{
			"workPlaceId": "8f21eba8-100d-47e3-be47-0e88fe7b8e19",
			"placeName": "收银台#193",
			"commId": 786752,
			"deviceId": "9cc51319-7531-44f6-8749-cc910d903980"
		},
		{
			"workPlaceId": "7f168306-3b99-431a-bda7-c221d002931d",
			"placeName": "收银台#192",
			"commId": 786722,
			"deviceId": "7e28c4c8-83be-4efa-973f-a18e51aa14e1"
		},
		{
			"workPlaceId": "399a6313-c869-4b62-ace0-7666f86e6ddf",
			"placeName": "收银台#191",
			"commId": 786664,
			"deviceId": "3934d0bc-4e16-427e-9b77-d51c4518feea"
		},
		{
			"workPlaceId": "82020970-3a32-4b15-b745-19f6e62b67f3",
			"placeName": "收银台#190",
			"commId": 786588,
			"deviceId": "9aac430a-5cee-4f9a-a49a-4e1330edba19"
		},
		{
			"workPlaceId": "def48c65-ab90-4abe-ab88-08da04c5a759",
			"placeName": "收银台#189",
			"commId": 786484,
			"deviceId": "ec6a0ab8-eeca-4652-bcf0-2cc18b1815bf"
		},
		{
			"workPlaceId": "c4de0b88-76a8-482b-975b-7ff503dec659",
			"placeName": "收银台#188",
			"commId": 786471,
			"deviceId": "d1bd88ab-3e74-4a28-8086-734827b8d35e"
		},
		{
			"workPlaceId": "f41b14b1-d561-4929-8968-95567eb03bf7",
			"placeName": "收银台#187",
			"commId": 786065,
			"deviceId": "a7cf7444-3f8e-4040-890e-80e9137fac10"
		},
		{
			"workPlaceId": "7b12a5d1-9ff7-4457-a5a9-c22ee2448a14",
			"placeName": "收银台#186",
			"commId": 785502,
			"deviceId": "5732e8ca-0ffe-4646-b3d6-5addb7a132ac"
		},
		{
			"workPlaceId": "b0184694-4493-47ca-8aa0-da22cb0c6577",
			"placeName": "收银台#185",
			"commId": 785077,
			"deviceId": "e8e5a3a7-9bbe-4cb7-b8e9-3ea152939d1b"
		},
		{
			"workPlaceId": "28288506-c3a7-4aa4-96a7-bf15f18b8076",
			"placeName": "收银台#184",
			"commId": 784777,
			"deviceId": "8898a598-1930-41b0-9ea2-39db4d53e1e8"
		},
		{
			"workPlaceId": "2e33c43f-1f31-41ae-b6d6-31f481338735",
			"placeName": "收银台#183",
			"commId": 784645,
			"deviceId": "db7ed783-2f17-4917-a618-6d0b6a3b814e"
		},
		{
			"workPlaceId": "a0940be5-2769-415b-a5b6-f65e44980246",
			"placeName": "收银台#182",
			"commId": 780170,
			"deviceId": "eed4e34b-f495-44fa-a2d7-f8b4cdc44396"
		},
		{
			"workPlaceId": "86c96ee6-c341-4ee8-8966-c96941b121de",
			"placeName": "收银台#181",
			"commId": 779797,
			"deviceId": "fdeea47b-db04-4df9-b702-a7007ffed4a7"
		},
		{
			"workPlaceId": "74e6c671-5577-422c-bd32-65bee6e7f3d7",
			"placeName": "收银台#180",
			"commId": 779620,
			"deviceId": "6d07bf30-d3b1-4ea9-8b1a-6b13ea573c7b"
		},
		{
			"workPlaceId": "9bccee19-ae13-4bb4-971a-7458ee30e7cc",
			"placeName": "收银台#179",
			"commId": 778312,
			"deviceId": "c4495c9f-5157-4a81-ae6f-150bc382a708"
		},
		{
			"workPlaceId": "b72fdf52-198d-4986-94d4-6ca26fcb178c",
			"placeName": "收银台#178",
			"commId": 778263,
			"deviceId": "be609678-212a-4e98-8de8-2f51524fb822"
		},
		{
			"workPlaceId": "9edcb763-ffe1-4095-b9aa-0000da8d06d9",
			"placeName": "收银台#177",
			"commId": 777710,
			"deviceId": "faa35526-0be0-4189-8d04-e755df88b89c"
		},
		{
			"workPlaceId": "5176ca31-1b48-4ce1-98ab-5fcdebf28241",
			"placeName": "收银台#176",
			"commId": 777202,
			"deviceId": "e0719b46-6519-48e9-bb4a-13aa297bbe52"
		},
		{
			"workPlaceId": "5b821d53-475e-4102-971f-5af2d3710287",
			"placeName": "收银台#175",
			"commId": 775658,
			"deviceId": "75575846-dc2d-4571-ae15-060e244f04fe"
		},
		{
			"workPlaceId": "f500b19a-cbfe-4aae-882c-7c402c0d1228",
			"placeName": "收银台#174",
			"commId": 773965,
			"deviceId": "6ca298c6-0ebf-49b6-868a-556426c60225"
		},
		{
			"workPlaceId": "c677f2ed-ce0f-48b2-9189-4e6debd30c85",
			"placeName": "收银台#173",
			"commId": 772993,
			"deviceId": "ccc3f624-2d16-496a-bc3b-6eb4efc4c369"
		},
		{
			"workPlaceId": "f16a525f-3fa9-44a6-8671-e8f7d4b01aa1",
			"placeName": "收银台#172",
			"commId": 770048,
			"deviceId": "0b9183c6-d122-4443-9cef-3597d85a9f97"
		},
		{
			"workPlaceId": "67f0eeea-1179-433b-a0d3-4600ba5024db",
			"placeName": "收银台#171",
			"commId": 769801,
			"deviceId": "b0f75424-bc41-4734-b8f4-ec551d1bceb5"
		},
		{
			"workPlaceId": "19e7ea97-c4fb-45ca-b6c8-88183164dd7e",
			"placeName": "收银台#170",
			"commId": 405083,
			"deviceId": "c60f2552-a95d-44cf-9504-d522024b9355"
		},
		{
			"workPlaceId": "62fe6e16-3542-46da-97e0-b9fe8a6ba3c9",
			"placeName": "收银台#169",
			"commId": 760652,
			"deviceId": "c833c1ab-fb1b-4da7-a87f-4d374cb1cef4"
		},
		{
			"workPlaceId": "bee5e1a5-7897-4ba0-a500-a5ae72c8badf",
			"placeName": "收银台#168",
			"commId": 760649,
			"deviceId": "dd5a932a-6218-4aa7-9bd7-80eed0d87b37"
		},
		{
			"workPlaceId": "db3e2790-9ddf-4956-8775-92ff89bdc71f",
			"placeName": "收银台#167",
			"commId": 760157,
			"deviceId": "f83eece9-d25f-4a4b-becd-1897282f11b7"
		},
		{
			"workPlaceId": "9c334071-0547-40bd-a342-72cebc648818",
			"placeName": "收银台#166",
			"commId": 759837,
			"deviceId": "90394db0-361d-4c5e-a571-fd079a56cc3d"
		},
		{
			"workPlaceId": "140b4d5f-f112-47da-b382-fbd9fe116b9a",
			"placeName": "收银台#165",
			"commId": 757102,
			"deviceId": "189e1c05-49be-43f6-907a-962852617e5f"
		},
		{
			"workPlaceId": "169cdb54-0ce1-4da8-a9ab-c9a43efb8c81",
			"placeName": "收银台#164",
			"commId": 756999,
			"deviceId": "1080e699-ed2f-40a2-b6c8-299fbabd1138"
		},
		{
			"workPlaceId": "76819d1d-d31d-4039-9f8a-8f20399e8481",
			"placeName": "收银台#163",
			"commId": 756914,
			"deviceId": "a7dc3c42-289e-495a-be8b-2381759e88d4"
		},
		{
			"workPlaceId": "26d3da92-bac5-456a-bc4e-c756e62b7de5",
			"placeName": "收银台#162",
			"commId": 756857,
			"deviceId": "7c629fcd-730f-41b6-a93c-1819dbb032c9"
		},
		{
			"workPlaceId": "d8ebee23-0ee2-4eaa-82ab-f39f9d332988",
			"placeName": "收银台#161",
			"commId": 756755,
			"deviceId": "a12e2a0d-2b5e-4cde-b556-83ff139cc300"
		},
		{
			"workPlaceId": "566a570f-36a4-4c96-9a4a-180ed9d807da",
			"placeName": "收银台#160",
			"commId": 756749,
			"deviceId": "4de1d9f2-e058-4080-8076-dbb1c57ceddd"
		},
		{
			"workPlaceId": "70f6a79f-e986-4211-90a5-c259495471a0",
			"placeName": "收银台#159",
			"commId": 756747,
			"deviceId": "8ebafc73-843a-4a22-be67-b7fde2ded8f4"
		},
		{
			"workPlaceId": "4e37df2b-4686-4444-a317-9656e7bf6edd",
			"placeName": "收银台#158",
			"commId": 756746,
			"deviceId": "0d5ecc88-699c-4379-b9a2-1c47a8378c91"
		},
		{
			"workPlaceId": "9b56a88e-8eee-4bd7-b128-4f89968b5a0f",
			"placeName": "收银台#157",
			"commId": 756722,
			"deviceId": "094722e3-3bbc-41ac-9777-1b6de1c7038e"
		},
		{
			"workPlaceId": "4d1412f0-c11c-482e-a377-4a909d772cd7",
			"placeName": "收银台#156",
			"commId": 756673,
			"deviceId": "96443d45-84b4-4f7c-8aaf-e1451bc27f0b"
		},
		{
			"workPlaceId": "242b3409-0196-4d08-ab80-cfc84887ab1a",
			"placeName": "收银台#155",
			"commId": 756672,
			"deviceId": "82d10ab8-6c92-471d-af9a-a4aca97dc86d"
		},
		{
			"workPlaceId": "a706a9c1-e2f4-4e17-95db-a08be9acc5e0",
			"placeName": "收银台#154",
			"commId": 756671,
			"deviceId": "e6aeabf8-73fb-40f6-a2f2-f84a7d8647d2"
		},
		{
			"workPlaceId": "8c2b4a26-a3bb-495b-a68b-3dfdeb2349ef",
			"placeName": "收银台#153",
			"commId": 756670,
			"deviceId": "5ed0b98b-0eda-4729-b760-9583f0e03c44"
		},
		{
			"workPlaceId": "786cdc9f-f26b-42a7-b1c0-09c81100ef03",
			"placeName": "收银台#152",
			"commId": 756669,
			"deviceId": "8970966e-27f8-4ff8-8081-a6ccc2ed29c7"
		},
		{
			"workPlaceId": "07c4d74f-c71d-46b6-8919-5cc4ff46f603",
			"placeName": "收银台#151",
			"commId": 756642,
			"deviceId": "05ff1b83-57bb-4a2f-bd18-16386e706245"
		},
		{
			"workPlaceId": "99d29056-330d-418f-a8da-3642e918f1fa",
			"placeName": "收银台#150",
			"commId": 756640,
			"deviceId": "e8e9e3c0-bfa3-46a0-a48e-e157743618e2"
		},
		{
			"workPlaceId": "b84a0c01-2b7b-4c36-b4fe-79b805a86c02",
			"placeName": "收银台#149",
			"commId": 756639,
			"deviceId": "8c0dbbe4-25a8-452a-8a9c-5ccfa1e3c92b"
		},
		{
			"workPlaceId": "be51b13c-fcd7-4098-b340-fb47c32e258c",
			"placeName": "收银台#148",
			"commId": 756637,
			"deviceId": "5f24f153-f9c9-43cc-a087-b7a585267c05"
		},
		{
			"workPlaceId": "e4e289af-710c-4982-a759-7c339148f96e",
			"placeName": "收银台#147",
			"commId": 756636,
			"deviceId": "66508615-3850-4223-8859-0b857758cac4"
		},
		{
			"workPlaceId": "92b8e0f0-3f83-4274-8b50-223c9201b0e1",
			"placeName": "收银台#146",
			"commId": 756602,
			"deviceId": "2425f3cd-f937-443e-b60c-d8e44823234a"
		},
		{
			"workPlaceId": "a6d558d3-de56-4431-a5b4-3eca9e999eb0",
			"placeName": "收银台#145",
			"commId": 756576,
			"deviceId": "cf0a37b2-224e-4856-b688-c7facef64e4c"
		},
		{
			"workPlaceId": "b3c29137-a973-4f46-8e05-060b970527af",
			"placeName": "收银台#144",
			"commId": 756500,
			"deviceId": "2c77ee40-692b-4983-8f63-f9dc9ad3ecdd"
		},
		{
			"workPlaceId": "2273c8b5-d373-4efc-a1a5-d5b93b3d29d0",
			"placeName": "收银台#143",
			"commId": 756495,
			"deviceId": "ebbd423b-d8d8-49bb-928b-3fb20ef135a8"
		},
		{
			"workPlaceId": "23c026e5-9aeb-4736-bcb9-f379b3f56d1d",
			"placeName": "收银台#142",
			"commId": 756494,
			"deviceId": "aa4065c4-f3a9-4207-877c-c10de5a752c7"
		},
		{
			"workPlaceId": "02a3635b-8629-4300-ba78-c1dfb77f0224",
			"placeName": "收银台#141",
			"commId": 756493,
			"deviceId": "b41d735e-2374-4331-bf84-3e44b96ef0c9"
		},
		{
			"workPlaceId": "b77df092-2707-4d4a-bdb8-2f58aae99934",
			"placeName": "收银台#140",
			"commId": 756487,
			"deviceId": "fc80dd5d-411f-4260-a48f-ba4b10922745"
		},
		{
			"workPlaceId": "51b6251f-5df9-4199-8790-828549c6a1d4",
			"placeName": "收银台#139",
			"commId": 755767,
			"deviceId": "f03aea21-9b7f-418c-be47-ee63f4137159"
		},
		{
			"workPlaceId": "799963fd-e905-4dc6-8825-d5fa5d8862e8",
			"placeName": "收银台#138",
			"commId": 755766,
			"deviceId": "f4267b73-298d-46c2-ab8f-2ed8c7d18c56"
		},
		{
			"workPlaceId": "58c2d92d-a30f-476b-9ca6-97d5e1da4d47",
			"placeName": "收银台#137",
			"commId": 755212,
			"deviceId": "a2f909c2-f54f-4f97-a6ff-a3507d0243c3"
		},
		{
			"workPlaceId": "ac7225ea-0d9f-4e8e-8a4c-061559f1a32d",
			"placeName": "收银台#136",
			"commId": 753165,
			"deviceId": "b89c57fa-cc62-48b0-87f9-d1ad9409adcb"
		},
		{
			"workPlaceId": "c8f40f3f-5ce7-4ecf-bb80-70f280dd8c09",
			"placeName": "收银台#135",
			"commId": 752601,
			"deviceId": "11a13f1f-d5fa-4569-84b4-6739ea037f62"
		},
		{
			"workPlaceId": "d5317507-0a3e-404e-9f3a-c22c40b25e77",
			"placeName": "收银台#134",
			"commId": 752550,
			"deviceId": "b8ff724a-b473-42b5-88d4-fc1a29fe6992"
		},
		{
			"workPlaceId": "3481b158-14ef-4dd3-80bd-d6b30a8a6917",
			"placeName": "收银台#133",
			"commId": 752369,
			"deviceId": "543c1daf-446f-4aa7-9540-e86d4dd0b080"
		},
		{
			"workPlaceId": "eb7f8a43-c9ef-4f94-af87-9d0a4bcfa142",
			"placeName": "Cashier#132",
			"commId": 752320,
			"deviceId": "4043d27c-44d2-49b9-bcf5-a853899f2ee4"
		},
		{
			"workPlaceId": "3116f000-55ee-474b-a66c-16587f99dc4c",
			"placeName": "收银台#131",
			"commId": 749653,
			"deviceId": "23d59724-9159-4ed7-86a1-0d6801e68630"
		},
		{
			"workPlaceId": "ba4897b5-d16d-4b7e-8fd4-0322af9983d3",
			"placeName": "收银台#130",
			"commId": 749489,
			"deviceId": "2aca737a-624b-4cd1-bfb9-5bedcf6e80bb"
		},
		{
			"workPlaceId": "f94f1a4b-1bf0-439c-b5ca-5592d4a5e943",
			"placeName": "收银台#129",
			"commId": 749107,
			"deviceId": "9c7be7cf-3ec6-4da8-a7e7-a714ba2047d3"
		},
		{
			"workPlaceId": "41afca29-e08c-480c-b878-bc5be0b8d4ff",
			"placeName": "收银台#128",
			"commId": 737708,
			"deviceId": "93b13253-c003-4c14-aa27-83142e08742d"
		},
		{
			"workPlaceId": "3cdb1a10-ee2a-42ce-b547-efa6fc7d1aa6",
			"placeName": "收银台#127",
			"commId": 737504,
			"deviceId": "e33ded24-2a1b-42ec-89c4-642530558529"
		},
		{
			"workPlaceId": "298c9258-c5bb-42b2-8035-322e4a008dcb",
			"placeName": "收银台#126",
			"commId": 737410,
			"deviceId": "fa55112a-10db-4791-a143-9de77b60fd76"
		},
		{
			"workPlaceId": "96a89e24-25a7-43af-8799-b74829199c32",
			"placeName": "收银台#125",
			"commId": 737403,
			"deviceId": "9ea1280a-ae34-48eb-b0c4-d8ac2398fe9c"
		},
		{
			"workPlaceId": "fad21b0e-ede5-42f0-811c-66d888a02153",
			"placeName": "收银台#124",
			"commId": 737394,
			"deviceId": "7b5e6a5a-7bb1-4fc3-8281-457607511989"
		},
		{
			"workPlaceId": "a3134aaa-cfaf-4933-94f1-863806406366",
			"placeName": "收银台#123",
			"commId": 392896,
			"deviceId": "cd4afecb-129b-4707-83e2-f00cc74a0511"
		},
		{
			"workPlaceId": "dc886794-4766-4d31-b552-f88238fd8b33",
			"placeName": "收银台#122",
			"commId": 735880,
			"deviceId": "f9df986f-66a8-4bb3-83bb-bd35991788b5"
		},
		{
			"workPlaceId": "83dade02-0f3e-46b3-8110-e70320bb3188",
			"placeName": "收银台#121",
			"commId": 733929,
			"deviceId": "ea01ef1f-4d3b-480d-bc4f-347fbb6b9ab9"
		},
		{
			"workPlaceId": "9d8d093b-3938-4b39-8c11-9860685f15e4",
			"placeName": "收银台#120",
			"commId": 734486,
			"deviceId": "08175eb6-3a05-4acd-b039-53fed0be7f29"
		},
		{
			"workPlaceId": "d61ea99e-c038-4bfb-8408-9908c1cd7381",
			"placeName": "收银台#119",
			"commId": 728880,
			"deviceId": "ab864a78-c298-4369-ac8e-793206900101"
		},
		{
			"workPlaceId": "3dee7f5c-333d-4580-9311-b17ddb52fe70",
			"placeName": "收银台#118",
			"commId": 727619,
			"deviceId": "2334ee24-44d4-4bd0-b850-78c85537a133"
		},
		{
			"workPlaceId": "9a2b5b76-146e-4685-8dbd-c9b3299b79aa",
			"placeName": "收银台#117",
			"commId": 726935,
			"deviceId": "18a2c5ab-ffab-4918-8c78-29e2256c6ced"
		},
		{
			"workPlaceId": "24dc6b73-55c9-4888-8e7a-43d29f217eae",
			"placeName": "收银台#116",
			"commId": 722184,
			"deviceId": "5804db4e-68d6-47b4-bdc7-ade36ac241fc"
		},
		{
			"workPlaceId": "ff862ea3-0a04-41ae-9513-ad76abc0c2bd",
			"placeName": "收银台#115",
			"commId": 720067,
			"deviceId": "f9c8d4b7-cac1-4892-9151-61fc67f01840"
		},
		{
			"workPlaceId": "e453bd44-035b-4653-86b9-179ec8021e4f",
			"placeName": "收银台#114",
			"commId": 719985,
			"deviceId": "2027f6a1-52b4-4ee7-8b84-20d489e4658f"
		},
		{
			"workPlaceId": "0b6ce9f0-8c9d-4661-b84c-b211923c0c19",
			"placeName": "收银台#113",
			"commId": 719796,
			"deviceId": "151f055b-9ce3-48d5-b1ad-c73a6f5d7fed"
		},
		{
			"workPlaceId": "3cd4b202-906e-418b-8120-06ff057df253",
			"placeName": "收银台#112",
			"commId": 714974,
			"deviceId": "4c5b5352-b878-45ea-861e-060a22e192ae"
		},
		{
			"workPlaceId": "de46515c-547f-4428-8e40-ee5bd18cfc62",
			"placeName": "收银台#111",
			"commId": 713601,
			"deviceId": "38483d6d-d092-4a8f-96af-2d2fe929a2f0"
		},
		{
			"workPlaceId": "765aa9c0-e8f5-4800-8aac-27064e6174cb",
			"placeName": "收银台#110",
			"commId": 712393,
			"deviceId": "bb8b46ee-6d82-465c-9c9e-6e874f6f0aec"
		},
		{
			"workPlaceId": "e6adf32d-954e-4034-9930-4122b7cd8f32",
			"placeName": "收银台#109",
			"commId": 692927,
			"deviceId": "d451c5e7-6583-499e-b8bd-e5f166cedce7"
		},
		{
			"workPlaceId": "dfce0859-c98e-4500-a488-8fb7e9456a36",
			"placeName": "收银台#108",
			"commId": 692717,
			"deviceId": "a4e8943b-e680-4551-8be3-2d924988abfd"
		},
		{
			"workPlaceId": "0d9984c9-69c7-46f6-bf5e-c7798733818f",
			"placeName": "收银台#107",
			"commId": 691447,
			"deviceId": "c6f19de0-bf86-4155-a329-ff20cfa318ea"
		},
		{
			"workPlaceId": "fed7d4fb-122c-449c-a44e-9d4d3bb1f196",
			"placeName": "收银台#106",
			"commId": 690508,
			"deviceId": "3686d679-cea3-456e-bf71-5b5d1df3ccf8"
		},
		{
			"workPlaceId": "d108d33f-2a65-4cec-be37-4e33c067a0ea",
			"placeName": "收银台#105",
			"commId": 690088,
			"deviceId": "1d8e0d57-681c-43e0-b1f6-2174fa1a0b5b"
		},
		{
			"workPlaceId": "55a6214f-75ac-4f98-b6e8-e9e98730e109",
			"placeName": "收银台#104",
			"commId": 689235,
			"deviceId": "2297dab6-7d70-434b-89ce-ab779761130e"
		},
		{
			"workPlaceId": "0c53aa91-8e00-4eaf-96ba-2dce25f03ee8",
			"placeName": "收银台#103",
			"commId": 688277,
			"deviceId": "68cc44cf-5d27-4c07-8ecc-cc81a08505b4"
		},
		{
			"workPlaceId": "eedab522-2d94-408f-9dda-a578b0de333d",
			"placeName": "收银台#102",
			"commId": 687352,
			"deviceId": "56fb678e-df00-491f-bce2-20a2ab28a2a7"
		},
		{
			"workPlaceId": "358dc961-2c0b-4db1-8d3a-f6e51cf243c4",
			"placeName": "收银台#101",
			"commId": 687330,
			"deviceId": "ee5c254e-3f2c-4511-8683-2a8c14ffd82f"
		},
		{
			"workPlaceId": "7dfc3408-9ca1-43ef-8349-a0201f62156d",
			"placeName": "收银台#100",
			"commId": 687250,
			"deviceId": "a736c6a8-a57a-4d3e-b685-2302e0fea95e"
		},
		{
			"workPlaceId": "34ef798a-99c1-483f-a52b-9ff1d1adefa6",
			"placeName": "收银台#99",
			"commId": 687228,
			"deviceId": "c77f6ed7-4aa8-45bd-9b1d-6ed822047617"
		},
		{
			"workPlaceId": "7c55cd55-08b7-46fd-9a01-158b80ac1f34",
			"placeName": "收银台#98",
			"commId": 685637,
			"deviceId": "eb2414d0-444b-4338-89ad-7ce6e5fe7171"
		},
		{
			"workPlaceId": "2d6a893b-516f-4311-8067-42694899713f",
			"placeName": "收银台#97",
			"commId": 685610,
			"deviceId": "a6335b07-7e02-451b-8922-8c555bc47ccb"
		},
		{
			"workPlaceId": "79b711fb-d848-4fb5-be05-9e3947d38f15",
			"placeName": "收银台#96",
			"commId": 685307,
			"deviceId": "683006e9-d814-47a7-9e61-183316ccb4ca"
		},
		{
			"workPlaceId": "86609703-c208-4300-84f8-25ca8d470a87",
			"placeName": "收银台#95",
			"commId": 685299,
			"deviceId": "01dc4b2f-26f1-4d8e-ab09-e0dfd418b469"
		},
		{
			"workPlaceId": "097fcbad-5b5b-486f-990b-a34b83633066",
			"placeName": "收银台#94",
			"commId": 684899,
			"deviceId": "cd9a745f-79fb-4f43-9c1c-a0b52f8ddce8"
		},
		{
			"workPlaceId": "6510830e-3385-45da-9c2d-47d519609b1e",
			"placeName": "收银台#93",
			"commId": 670957,
			"deviceId": "9d94d011-3dab-4135-ab5d-acf563415350"
		},
		{
			"workPlaceId": "67308033-e1a8-4937-9c36-010651e64adf",
			"placeName": "收银台#92",
			"commId": 669748,
			"deviceId": "9d306724-0603-4e34-882a-10fbedaacd6c"
		},
		{
			"workPlaceId": "7db44e9d-2a39-4d92-a4ef-9bd19f9afd99",
			"placeName": "收银设备#kai",
			"commId": 668703,
			"deviceId": "7692af3f-d65b-499a-aee2-f28017919f84"
		},
		{
			"workPlaceId": "0d30b55c-96f4-4e58-b04e-2182c14ae639",
			"placeName": "收银台#90",
			"commId": 667262,
			"deviceId": "d745ede5-743a-49b3-9f7a-81367b4fa522"
		},
		{
			"workPlaceId": "6857e2bc-5b87-4316-bd81-637b78402c93",
			"placeName": "Cashier Station#89",
			"commId": 663970,
			"deviceId": "e094a6b9-f7d6-4ef5-bca6-e17c0367954a"
		},
		{
			"workPlaceId": "6c6feea4-0094-48cd-ad76-ee77d2d60291",
			"placeName": "收银台#88",
			"commId": 662605,
			"deviceId": "f23ce538-d9f6-472e-aa76-b07a8c9b2ca2"
		},
		{
			"workPlaceId": "f5b88951-160f-44e2-a280-ef98b410cd8a",
			"placeName": "收银台#87",
			"commId": 663631,
			"deviceId": "5d0c912f-d9aa-4122-95b1-ea9d2c15bb90"
		},
		{
			"workPlaceId": "06a36db1-b855-47e4-b33c-0baedf35d36f",
			"placeName": "收银台#86",
			"commId": 663553,
			"deviceId": "b6c975d6-85c4-4003-9736-a46f625de37b"
		},
		{
			"workPlaceId": "ec409e65-dcbb-494f-9828-a090c4aca044",
			"placeName": "收银台#85",
			"commId": 663402,
			"deviceId": "5d90a4eb-5738-4c63-962a-f747fde753ad"
		},
		{
			"workPlaceId": "449031f5-249f-41b0-b04c-a0d99306acf5",
			"placeName": "收银台#84",
			"commId": 663398,
			"deviceId": "a02ff12f-3c5c-4dfe-bb53-1cf18cb8ad64"
		},
		{
			"workPlaceId": "c831d8c8-6cc8-4d9a-b945-2d8e8b692f5e",
			"placeName": "收银台#83",
			"commId": 663393,
			"deviceId": "e970d051-f417-4e97-8005-23ba8d483fe7"
		},
		{
			"workPlaceId": "828ccedb-f050-418c-af6c-60b8e04f5f4e",
			"placeName": "收银台#82",
			"commId": 663392,
			"deviceId": "7c71a085-dfeb-4d76-b25a-cc79adb94d2a"
		},
		{
			"workPlaceId": "d9420c9d-7dc8-451d-84c5-b02fc3159ca4",
			"placeName": "收银台#81",
			"commId": 663390,
			"deviceId": "66537259-4323-4186-b672-cf5a5db53cae"
		},
		{
			"workPlaceId": "4969dba8-e804-40e0-bfc3-a12043e41dce",
			"placeName": "收银台#80",
			"commId": 663276,
			"deviceId": "af6ec3c3-4ea6-4e5c-a072-5b5146247592"
		},
		{
			"workPlaceId": "1d6ec28d-2301-4b7b-9faf-f2a8dd53835e",
			"placeName": "收银台#79",
			"commId": 656597,
			"deviceId": "e1a58278-c239-4657-bb46-a5a09c1c809d"
		},
		{
			"workPlaceId": "bff44689-2b7d-49dc-982b-5e3910af733f",
			"placeName": "收银台#78",
			"commId": 656518,
			"deviceId": "18c8e469-5481-409b-a81f-036f5793f4fc"
		},
		{
			"workPlaceId": "62d10e6a-9504-4ae9-9492-e558aa4a0f52",
			"placeName": "收银台#77",
			"commId": 656106,
			"deviceId": "c88603c2-93a9-4cd0-b97c-0736d2de9fd3"
		},
		{
			"workPlaceId": "e816938a-5833-455e-923d-92e5d8baddfa",
			"placeName": "收银台#76",
			"commId": 656298,
			"deviceId": "b18f3575-3b9b-48aa-91b2-2366da44fc57"
		},
		{
			"workPlaceId": "bdbe8f11-bf2c-45e6-9195-f578175b8be4",
			"placeName": "收银台#75",
			"commId": 653534,
			"deviceId": "1084a942-6453-4413-adfa-891af60b8aea"
		},
		{
			"workPlaceId": "6358ada0-7b7f-4c8b-aaa3-856463ead5a6",
			"placeName": "收银台#74",
			"commId": 653178,
			"deviceId": "58522b04-9a49-4169-8f75-621360ea8a1d"
		},
		{
			"workPlaceId": "740606d0-d752-4516-b84e-b26e576b6c0e",
			"placeName": "收银台#73",
			"commId": 652888,
			"deviceId": "98aa35d4-f487-42cb-8bd6-cef1da6a2137"
		},
		{
			"workPlaceId": "cc8ff4e3-be2d-4bc5-a2df-296204d6a1a0",
			"placeName": "收银台#72",
			"commId": 652220,
			"deviceId": "752aac17-264b-4c10-9ab0-10445286b5dd"
		},
		{
			"workPlaceId": "5fdc863b-e6b5-4faa-9113-dc2101555a11",
			"placeName": "收银台#71",
			"commId": 652038,
			"deviceId": "5688d9e7-8814-4aef-aa3c-6c2d54bf6c88"
		},
		{
			"workPlaceId": "65edc9a9-d41e-44df-80dd-e5f7ac026b6a",
			"placeName": "收银台#70",
			"commId": 650613,
			"deviceId": "30cc6b6c-c27d-41f0-8020-f1623ac88266"
		},
		{
			"workPlaceId": "2ee457bd-f36f-48e5-8175-e19c38cb8af4",
			"placeName": "收银台#69",
			"commId": 648136,
			"deviceId": "a642997b-e955-4af7-9b68-275982398c46"
		},
		{
			"workPlaceId": "59973149-73f5-439f-9f01-81549ff5cc8d",
			"placeName": "收银台#68",
			"commId": 646448,
			"deviceId": "9cef1d89-5244-4204-8d97-307c7e44a2be"
		},
		{
			"workPlaceId": "bb03af72-9bc0-4b71-9be2-ca69d1299837",
			"placeName": "收银台#67",
			"commId": 646418,
			"deviceId": "042408d4-435d-4c47-a74d-aa984e466040"
		},
		{
			"workPlaceId": "1e490571-9042-4115-8014-e0b5816c8502",
			"placeName": "收银台#66",
			"commId": 646214,
			"deviceId": "ae1c20e7-9951-44e5-be7f-4f05e7a6d0b3"
		},
		{
			"workPlaceId": "eba7abe6-0850-4b4a-b65b-edf0b0ff4cd5",
			"placeName": "收银台#65",
			"commId": 645964,
			"deviceId": "6bc3512c-54e2-496f-aed0-64f200145d54"
		},
		{
			"workPlaceId": "1f581506-88af-4ae2-a122-9537be25d70b",
			"placeName": "收银台#64",
			"commId": 645918,
			"deviceId": "7a2c67ee-dd6d-4479-a348-d39ce05543bd"
		},
		{
			"workPlaceId": "233bd08f-3421-47fd-a10b-b83cbfeffe79",
			"placeName": "收银台#63",
			"commId": 645186,
			"deviceId": "3115fb8f-6042-48ee-9271-edd3a6d63b15"
		},
		{
			"workPlaceId": "aa1f670d-fca1-4a9f-b7d6-e49cc54e4d38",
			"placeName": "收银台#62",
			"commId": 644958,
			"deviceId": "472fcf72-1f35-4d37-8357-db759f5465c3"
		},
		{
			"workPlaceId": "6af7a4bb-b9ea-4fe8-934a-3002b46c7c93",
			"placeName": "收银台#61",
			"commId": 644602,
			"deviceId": "6cd8ddd5-2d2e-4448-ba5b-5fdbb3f7b125"
		},
		{
			"workPlaceId": "ac20c864-17da-43b0-b3b2-0d9095b4fa80",
			"placeName": "收银台#60",
			"commId": 644237,
			"deviceId": "47fe7315-f764-4691-a738-3d57e8a64261"
		},
		{
			"workPlaceId": "067f2e43-056f-4d66-a003-b69630a0cf21",
			"placeName": "收银台#59",
			"commId": 644202,
			"deviceId": "17138045-7ad6-4b4c-80b0-46b866e95ee7"
		},
		{
			"workPlaceId": "d25de367-4a12-49e0-a24b-1f6033065a0a",
			"placeName": "收银台#58",
			"commId": 644055,
			"deviceId": "727cfebc-d6fd-4dfd-b28d-0ce23d6e15fa"
		},
		{
			"workPlaceId": "6db13fe3-e4c2-4ae1-9f15-fed8994d75fd",
			"placeName": "收银台#57",
			"commId": 644005,
			"deviceId": "86284ae1-18d0-49cd-bdb1-c1fe895f1720"
		},
		{
			"workPlaceId": "cdaf81c5-e5d1-4520-baca-e825e754688a",
			"placeName": "收银台#56",
			"commId": 643578,
			"deviceId": "52ffca06-973b-4bd3-8d96-a6733ce7089d"
		},
		{
			"workPlaceId": "007882d9-3ef5-4864-8011-c7e0c7652e5d",
			"placeName": "收银台#55",
			"commId": 643523,
			"deviceId": "66f4a216-ef50-4d2e-b5e6-36a347e24873"
		},
		{
			"workPlaceId": "ee20fdad-7605-45b0-b500-ba938189c158",
			"placeName": "收银台#54",
			"commId": 643507,
			"deviceId": "1336709c-1fed-45d3-aaab-f79dc60de1fc"
		},
		{
			"workPlaceId": "ecef4bd0-5942-427a-9b5e-5e7eb80191ba",
			"placeName": "收银台#53",
			"commId": 641792,
			"deviceId": "b358cbb2-4093-4f7e-aa56-28efef00afae"
		},
		{
			"workPlaceId": "f510d527-8314-4b67-9f33-257cfe2cc66d",
			"placeName": "收银台#52",
			"commId": 641514,
			"deviceId": "a8ba5299-f8f7-45c0-a344-8c8e42540fe1"
		},
		{
			"workPlaceId": "eeacaa82-ccc8-4b99-87ab-92f500aae819",
			"placeName": "收银台#51",
			"commId": 641333,
			"deviceId": "efee6b15-7c51-46be-a4fe-37686faf2459"
		},
		{
			"workPlaceId": "4656cca6-1b71-4320-8be2-1b74ee5b3b0b",
			"placeName": "收银台#50",
			"commId": 638443,
			"deviceId": "8891f02e-3963-427e-b5fe-1c80bfed2aa6"
		},
		{
			"workPlaceId": "f0555ae1-5375-4dbd-94ea-b1275b94615f",
			"placeName": "收银台#49",
			"commId": 637210,
			"deviceId": "7126164b-0e25-4285-b343-edf8ab630e78"
		},
		{
			"workPlaceId": "c1fc9971-c9e0-45b6-bec5-12349b00348d",
			"placeName": "收银台#48",
			"commId": 632567,
			"deviceId": "c1f753ed-ebee-4e3c-8559-23cd7d55ffa4"
		},
		{
			"workPlaceId": "cf3c4777-5a0e-45cb-8080-421bd663214b",
			"placeName": "收银台#47",
			"commId": 630165,
			"deviceId": "5c4383bc-2af7-4103-8a8e-ae1ba953d416"
		},
		{
			"workPlaceId": "a592279d-2b02-4bd3-ac80-db1aab665340",
			"placeName": "收银台#46",
			"commId": 629669,
			"deviceId": "4e11c5d5-717f-43a7-b00e-44c592df5a42"
		},
		{
			"workPlaceId": "7121edea-4a40-452f-a290-f86845b336ac",
			"placeName": "收银台#45",
			"commId": 628753,
			"deviceId": "9e5520af-96ca-4e94-8a96-7952da8f0a0a"
		},
		{
			"workPlaceId": "33af0b86-7d94-487c-932b-08dd362511ef",
			"placeName": "收银台#44",
			"commId": 628274,
			"deviceId": "eb5228b2-a4f4-449e-b680-8f5b2994ae56"
		},
		{
			"workPlaceId": "8b6aa244-ea8c-4407-9e2e-d6f68043a5a9",
			"placeName": "收银台#43",
			"commId": 626920,
			"deviceId": "f76f596c-1397-4cc3-9f21-3e3cb10f0a2e"
		},
		{
			"workPlaceId": "f2e804c4-91cc-42d5-9bec-80af4c897af5",
			"placeName": "收银台#42",
			"commId": 624465,
			"deviceId": "37ba3368-f1d1-4c65-a643-c53121ef48eb"
		},
		{
			"workPlaceId": "7d34b832-75b8-43d5-a113-2316d320714e",
			"placeName": "收银台#41",
			"commId": 624121,
			"deviceId": "c5c19c70-211b-49e9-8485-755797249b7e"
		},
		{
			"workPlaceId": "adb09deb-1a90-4180-8769-222e118f9154",
			"placeName": "收银台#40",
			"commId": 623708,
			"deviceId": "fe02f1f0-5254-4027-9890-7cd8d9e552a3"
		},
		{
			"workPlaceId": "38626b5c-3577-476e-ad43-2a2a4b006487",
			"placeName": "收银台#39",
			"commId": 622365,
			"deviceId": "7997a733-4d58-46e5-925b-2d3debdbe874"
		},
		{
			"workPlaceId": "777ebeb1-657f-4ec0-9346-c22f7ab63200",
			"placeName": "收银台#38",
			"commId": 620983,
			"deviceId": "9d0dae8b-a890-4c16-98a0-7ba09321cc29"
		},
		{
			"workPlaceId": "efbf9c3e-e820-4da1-b6b2-a7f2d05bd932",
			"placeName": "收银台#37",
			"commId": 620788,
			"deviceId": "9d52ae4e-5cc2-4877-b563-dc52ffac0411"
		},
		{
			"workPlaceId": "953094a4-150b-4e75-8c81-e17eb9b65870",
			"placeName": "收银台#36",
			"commId": 620367,
			"deviceId": "56e49782-1598-47a3-86c8-d999417ea279"
		},
		{
			"workPlaceId": "4fc247d2-3fc3-458f-aa09-e8ac91fb4ba8",
			"placeName": "收银台#35",
			"commId": 619439,
			"deviceId": "6bec125b-77aa-41c0-9492-aafad18426cf"
		},
		{
			"workPlaceId": "b18af9d5-8ce9-4da2-ad65-cc003e2cc7d8",
			"placeName": "收银台#34",
			"commId": 619208,
			"deviceId": "f8ce470d-2f7c-4603-9d4e-99f8bfc2fa3d"
		},
		{
			"workPlaceId": "fd92f47e-af3b-4043-b9c2-e97aff3aa233",
			"placeName": "Cashier Station#33",
			"commId": 619169,
			"deviceId": "693eacc0-bcb4-44d7-9e17-05fee5a21498"
		},
		{
			"workPlaceId": "2d5b5244-acc5-48ec-b7eb-b1e0a1c158f7",
			"placeName": "收银台#32",
			"commId": 619000,
			"deviceId": "0a46138c-a12c-4c50-93e4-69a44cf91110"
		},
		{
			"workPlaceId": "a0da5935-1922-437f-820b-a9c7a9d87131",
			"placeName": "收银台#31",
			"commId": 618131,
			"deviceId": "7e11a1b3-dbc2-46eb-91f0-194de569ca2f"
		},
		{
			"workPlaceId": "9fac8c50-73de-4901-992d-cfddd72fe752",
			"placeName": "收银台#30",
			"commId": 617889,
			"deviceId": "f8d9a812-3414-48cd-9c43-3b42f67f214d"
		},
		{
			"workPlaceId": "41e08f8a-04c7-4e5e-b427-6a5a284ffe26",
			"placeName": "收银台#29",
			"commId": 617796,
			"deviceId": "c45583ba-70cf-43c4-b728-5fd0b183220d"
		},
		{
			"workPlaceId": "587ee77a-30a6-4191-9d44-ef34c4534dd1",
			"placeName": "Cashier Station#28",
			"commId": 617383,
			"deviceId": "8eac11aa-39ac-4911-aab3-b266ddfa3a64"
		},
		{
			"workPlaceId": "1d68330f-198a-4a89-b980-0ed2e583e0c8",
			"placeName": "Cashier Station#27",
			"commId": 617342,
			"deviceId": "dcb2c905-0447-4aa5-888f-7a09d8df5718"
		},
		{
			"workPlaceId": "ba1f68cc-c18d-4acf-9c05-3c4c9c3d3ccb",
			"placeName": "Cashier Station#26",
			"commId": 617337,
			"deviceId": "26a7decc-87c2-45fe-bdcc-4c3307317a7f"
		},
		{
			"workPlaceId": "12fc8675-cec2-4311-a63f-d30fdb524aa5",
			"placeName": "Cashier Station#25",
			"commId": 617241,
			"deviceId": "5f393de8-a769-487a-b2bc-a3240c553025"
		},
		{
			"workPlaceId": "d6ac2f15-5e68-4bdb-b461-ee34e95f9ffd",
			"placeName": "Cashier Station#24",
			"commId": 615312,
			"deviceId": "860a7ad5-17a0-4272-b5fa-551bc7b832b2"
		},
		{
			"workPlaceId": "5d83dfd0-bd50-42ec-9fb9-6fde7ab5d020",
			"placeName": "收银台#23",
			"commId": 615007,
			"deviceId": "0e812a79-17cc-4677-963b-9b7f982ddc0c"
		},
		{
			"workPlaceId": "b3a2c1e8-838b-4781-9922-74be48d914d4",
			"placeName": "收银台#22",
			"commId": 608769,
			"deviceId": "5ad529ee-79a7-4457-8498-a020ced44777"
		},
		{
			"workPlaceId": "fad9d578-7c52-46bb-8379-3673a393026c",
			"placeName": "收银台#21",
			"commId": 539934,
			"deviceId": "c10540d0-0613-4f8c-97c5-2605fe183812"
		},
		{
			"workPlaceId": "37f2b855-279b-466b-8f54-9581b10c4363",
			"placeName": "收银台#20",
			"commId": 608338,
			"deviceId": "052188e6-1446-4420-89d5-aca28ab6296d"
		},
		{
			"workPlaceId": "d9a7428e-7b04-419e-9810-f9800b264b3c",
			"placeName": "收银台#19",
			"commId": 608337,
			"deviceId": "bea6b787-2d30-4f31-84a7-64e627d6b739"
		},
		{
			"workPlaceId": "6bb6765b-75b5-4a77-ad56-ce29a9d325f8",
			"placeName": "收银台#18",
			"commId": 318622,
			"deviceId": "fb6f128a-d01b-4fb7-8e65-670beaa71ea1"
		},
		{
			"workPlaceId": "f129b0a8-db48-4351-a8ba-64d1d22e68d0",
			"placeName": "收银台#17",
			"commId": 608130,
			"deviceId": "d144fc04-d278-43ec-9d20-52ae5d86e5c7"
		},
		{
			"workPlaceId": "caefc2a2-a909-4e35-a20a-cbc08a7b32d0",
			"placeName": "收银台#16",
			"commId": 608185,
			"deviceId": "b3cb6292-1107-45a3-a949-b2949983b50c"
		},
		{
			"workPlaceId": "351d7443-b0ea-4ac8-b031-ba2d3a627939",
			"placeName": "收银台#15",
			"commId": 608065,
			"deviceId": "871dd2e1-33e1-4858-87cd-a7f22b021b6e"
		},
		{
			"workPlaceId": "167aa537-a17f-43b1-809b-762a5cc4a5f3",
			"placeName": "收银台#14",
			"commId": 382956,
			"deviceId": "c48035b9-04eb-4b26-83a9-3b1dc59f6c0d"
		},
		{
			"workPlaceId": "21637a26-26c0-4e48-968a-10da21ae5c6b",
			"placeName": "收银台#13",
			"commId": 604633,
			"deviceId": "56b8c87d-90b6-44cb-9bbc-3cc0ef28972a"
		},
		{
			"workPlaceId": "53b8a271-ef4d-47cf-ba58-d772b8d52f35",
			"placeName": "收银台#12",
			"commId": 478229,
			"deviceId": "f940f5d4-2eff-4eef-917e-ee3b7cb13561"
		},
		{
			"workPlaceId": "8a5373dd-8d3f-4867-981e-9931d76db7ed",
			"placeName": "收银台#11",
			"commId": 301549,
			"deviceId": "63df28db-34c7-438a-ae73-1286cfdead8c"
		},
		{
			"workPlaceId": "7109dbbe-ea24-46b1-866e-bcd4824350e9",
			"placeName": "收银台#100",
			"commId": 602509,
			"deviceId": "7dd88922-b4ed-4a81-8f7a-043f291717a6"
		},
		{
			"workPlaceId": "528e80a7-62ff-4147-8a74-2622c804ac4f",
			"placeName": "收银台#09",
			"commId": 536337,
			"deviceId": "2f513194-705a-44fa-8e6d-b333a6302e9f"
		},
		{
			"workPlaceId": "050c6e27-cf28-45e2-addd-1bac619f3a36",
			"placeName": "收银台#08",
			"commId": 600415,
			"deviceId": "e200bf27-8447-4b43-9499-b36bdc2a2282"
		},
		{
			"workPlaceId": "47ec90ea-3ac7-4b66-96c8-449d660c74ae",
			"placeName": "收银台#07",
			"commId": 584233,
			"deviceId": "9208ce1c-fa40-4599-aed4-c75e19e99ca8"
		},
		{
			"workPlaceId": "2cf2fcd4-e484-4be4-9370-4fa277aa99b3",
			"placeName": "收银台#06",
			"commId": 595418,
			"deviceId": "0741882d-a0e4-4b26-a570-01e48548d71d"
		},
		{
			"workPlaceId": "e0f7c193-0b5e-4530-9ebb-d7f204269e99",
			"placeName": "收银台#05",
			"commId": 591166,
			"deviceId": "1d2e201e-0a86-4dd4-b888-d11ae79e8767"
		},
		{
			"workPlaceId": "a211b9ff-9602-4e5b-b0f8-6fc756ab2cd4",
			"placeName": "收银台#04",
			"commId": 576746,
			"deviceId": "a6e3e47e-d1dc-43c8-ad2a-7ada4096f544"
		},
		{
			"workPlaceId": "cccd9c4b-f55a-4911-9a8a-c86cea4dabe0",
			"placeName": "收银台#03",
			"commId": 550930,
			"deviceId": "1a4a089a-7774-4ee0-b154-9a90a252ed4e"
		},
		{
			"workPlaceId": "de579453-f612-4029-9de0-d07ab041f875",
			"placeName": "收银台#02",
			"commId": 580080,
			"deviceId": "36fc07bb-0f2c-442d-a42e-8d180e99ad96"
		},
		{
			"workPlaceId": "bb80a9cf-8693-482e-a5b7-8070b1c7c7fd",
			"placeName": "收银台#01",
			"commId": 576523,
			"deviceId": "ff77b719-3b2c-4adb-a900-945e75edfbf7"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | array | - |
| data.workPlaceId | 760b1fa6-15e7-40cc-80b5-7dc56a9c0d0f | string | - |
| data.placeName | 收银台#209 | string | - |
| data.commId | 806887 | number | - |
| data.deviceId | 7f2286dd-f5e5-4a5e-af69-12dac7672325 | string | - |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 设备机台标签列表查询接口

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 09:44:55

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_machinetag_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 设备机台所属机种查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 11:23:24

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_machine_kind_select",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
    "success": true,
    "msg": "",
    "code": 0,
    "data": [
        {
            "key": "08dda958-159b-41eb-8a01-b7418b5ac150",
            "value": "模拟机",
            "valueCategory": 0
        },
        {
            "key": "08dda958-159e-40f3-8b76-df806da2f68a",
            "value": "礼品机",
            "valueCategory": 1
        },
        {
            "key": "08dda958-159e-410a-8a9d-90a064141262",
            "value": "彩票机",
            "valueCategory": 2
        },
        {
            "key": "08dda958-159e-4113-80f3-361ba7682195",
            "value": "娱乐机",
            "valueCategory": 3
        },
        {
            "key": "08dda958-159e-4119-8d5d-b1dde2044040",
            "value": "推奖机",
            "valueCategory": 4
        },
        {
            "key": "08dda958-159e-411f-8dd1-52e87ee0098a",
            "value": "卡片机",
            "valueCategory": 5
        }
    ],
    "desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | array | - |
| data.key | 08dda958-159b-41eb-8a01-b7418b5ac150 | string | 机种ID |
| data.value | 模拟机 | string | 机台名称 |
| data.valueCategory | 0 | number | 机种分类值 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 设备机台列表查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 11:17:18

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_machine_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"isFilterSluice\":false,\"page\":1,\"limit\":20}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"key": "016fa470-deca-4402-8172-73b14afec167",
			"value": "iPlus08[08]"
		},
		{
			"key": "01dc9f0e-83b0-42d6-a91f-9055ae4b10fb",
			"value": " 蛋飞天04[01]"
		},
		{
			"key": "02411f0f-2cee-4de0-bb72-0433c2ad4be7",
			"value": "夹博士10[10]"
		},
		{
			"key": "04c7d1e9-5dd3-47f1-89fb-9ab102c41212",
			"value": "iPlus41[41]"
		},
		{
			"key": "0670a4c8-33b9-4177-bb3e-4e7ae2af7d3c",
			"value": "long_name_testlong_name_testlong_name_testlong_nam[90000000]"
		},
		{
			"key": "06fdb3db-0058-425e-9dbf-448f7f5a1562",
			"value": "iPlus29[29]"
		},
		{
			"key": "0878c04e-c90c-4509-9088-193bfb16c81e",
			"value": "iPlus25[25]"
		},
		{
			"key": "099fb8b5-d026-458f-be1c-f6c3e04a3f07",
			"value": "778774卡头配置机台[72]"
		},
		{
			"key": "0aad89b9-8bde-46e3-8339-ea6b5f08373f",
			"value": "iPlus70[70]"
		},
		{
			"key": "0bcaf76a-d7e3-4bfb-a3a2-a3c85008225f",
			"value": "iPlus110[110]"
		},
		{
			"key": "0cd67591-4e43-4f5c-aa4e-e797043ffb1c",
			"value": "QQ篮球02[01]"
		},
		{
			"key": "10b5bf49-283b-41fa-b443-c85ccd40a4bd",
			"value": "体育项目08[08]"
		},
		{
			"key": "10ce7502-b253-472f-b049-61c37a318e9c",
			"value": "iPlus76[76]"
		},
		{
			"key": "11fcb8eb-5e12-4922-b84c-b026b777ef7e",
			"value": "iPlus59[59]"
		},
		{
			"key": "1314acf0-ed0e-4676-9b28-c5f5ca950ae6",
			"value": "iPlus15[15]"
		},
		{
			"key": "1318bd94-8f10-454c-b8a6-fce04367d55e",
			"value": "iPlus50[50]"
		},
		{
			"key": "13e402a3-9a0f-4540-a44b-bf8892481bf0",
			"value": "iPlus37[37]"
		},
		{
			"key": "13f6d728-9b38-4b4c-a684-0491d8f1bd3e",
			"value": "iPlus81[81]"
		},
		{
			"key": "15a341a9-5892-4ea8-9a7f-2f14d791a0f7",
			"value": "iPlus82[82]"
		},
		{
			"key": "15c99841-dbac-486e-a938-1351802c4f26",
			"value": "iPlus06[06]"
		},
		{
			"key": "18f2b3cb-ce2d-40af-801f-e34726fcb1da",
			"value": "惊天动地 DX(立式)01[01]"
		},
		{
			"key": "1c449597-3c39-4403-a01f-053d37cb49b5",
			"value": "iPlus109[109]"
		},
		{
			"key": "1c61664f-0cb7-4cf8-9555-cc3686782904",
			"value": "iPlus36[36]"
		},
		{
			"key": "1cd1022f-1840-4815-8114-731d4e3565b0",
			"value": "疯狂射绳201[01]"
		},
		{
			"key": "1da2d272-2095-43d7-9e65-dbbfe377d5bd",
			"value": "虚拟消费机台01000000[01]"
		},
		{
			"key": "1f0f3726-85da-42d3-bd58-15b006544928",
			"value": "体育项目05[05]"
		},
		{
			"key": "1fb4adbe-875d-4a5b-98d6-061c1d74d94d",
			"value": "iPlus12[12]"
		},
		{
			"key": "203581ff-2ea0-403e-a17b-24bdb257f062",
			"value": "iPlus19[19]"
		},
		{
			"key": "20f89997-0f13-4a8b-9ff8-b63ba32bf5c6",
			"value": "iPlus105[105]"
		},
		{
			"key": "24fc24a9-6340-4cd4-a965-dc99cc8a499f",
			"value": "淘气堡虚拟机01[01]"
		},
		{
			"key": "25010e66-031f-4b7d-8399-abc4cc3c5ae2",
			"value": "翠花闸机A[01]"
		},
		{
			"key": "25668bee-dca5-4b95-9ad5-24d9c2ab7ffb",
			"value": "iPlus108[108]"
		},
		{
			"key": "2867d0cc-9ff0-4ce2-83c3-17037554a6a6",
			"value": "iPlus78[78]"
		},
		{
			"key": "2a1a8900-99b2-4877-b911-b4b42d10bc18",
			"value": "iPlus69[69]"
		},
		{
			"key": "2a48c9a4-0f37-46eb-baeb-303288b82e0b",
			"value": "iPlus80[80]"
		},
		{
			"key": "2aa8796d-1a36-4f54-af19-dd300dfa3736",
			"value": "iPlus42[42]"
		},
		{
			"key": "2ad82337-d83e-4558-97f1-109fa97862db",
			"value": "iPlus57[57]"
		},
		{
			"key": "2f3cea32-74de-422c-bc73-6fd8bcf72cbd",
			"value": "iPlus05[05]"
		},
		{
			"key": "31026047-1297-4b3d-896f-ed67a0004823",
			"value": "iPlus56[56]"
		},
		{
			"key": "37350558-799a-4418-a68e-39ab663a510f",
			"value": "iPlus60[60]"
		},
		{
			"key": "387b3036-eba9-45da-9d27-56c58ad8d075",
			"value": "iPlus43[43]"
		},
		{
			"key": "38eb5cff-2b25-44dd-9a9d-36971132a849",
			"value": "iPlus14[14]"
		},
		{
			"key": "3b7dac64-1611-458d-84f0-2c39684dd59c",
			"value": "体育项目04[04]"
		},
		{
			"key": "3c2fee7e-5ca1-4384-ae13-c9e6cd2ff729",
			"value": "iPlus64[64]"
		},
		{
			"key": "3c480e96-e165-4e50-919a-4da367abcae1",
			"value": "iPlus13[13]"
		},
		{
			"key": "3f0dda79-704d-450e-8ed7-3afcf06a7c15",
			"value": "夹博士07[07]"
		},
		{
			"key": "3f17c021-8dae-4741-be8b-fc1944d6f878",
			"value": "捞鱼达人01[01]"
		},
		{
			"key": "3f207898-c1f3-4d2b-bc55-5b9ac5cb1a2f",
			"value": "iPlus52[52]"
		},
		{
			"key": "3f315934-7689-4194-827e-6331e54709a2",
			"value": "iPlus63[63]"
		},
		{
			"key": "3f414a14-ad81-4433-8159-3a2d776ec14b",
			"value": "iPlus75[75]"
		},
		{
			"key": "40e238a6-0142-452d-90d7-c32dcd4ba2bb",
			"value": "iPlus07[07]"
		},
		{
			"key": "41a96549-7f4f-4d6a-95d1-78769407d56b",
			"value": "二号桌[231]"
		},
		{
			"key": "41c1b728-749f-4d72-955c-ecb9f83f984a",
			"value": "iPlus73[73]"
		},
		{
			"key": "43a3b5ae-7a69-43a3-a8ed-be2289cf949c",
			"value": "夹博士02[02]"
		},
		{
			"key": "4aabc302-3f6e-4177-b01a-918816955e77",
			"value": "iPlus54[54]"
		},
		{
			"key": "4ae79c7b-f822-4522-a402-df988a417f73",
			"value": "iPlus49[49]"
		},
		{
			"key": "4fca8755-474a-438b-9a29-18ca7d7acb5c",
			"value": "iPlus106[106]"
		},
		{
			"key": "500df13a-1fc4-4d0f-ace0-e145aeb8030e",
			"value": "夹博士(硬件用勿动)[11]"
		},
		{
			"key": "50bb5a52-3557-4f02-be9b-c4377b3d701d",
			"value": "iPlus47[47]"
		},
		{
			"key": "52030bd3-9870-4208-8090-3a4348b48698",
			"value": "iPlus34[34]"
		},
		{
			"key": "53b4d354-ac8d-4576-b74d-f8b74441cadf",
			"value": "iPlus102[102]"
		},
		{
			"key": "5692b7c7-5605-44e2-b4cc-1817b433a94a",
			"value": "展厅闸机[01]"
		},
		{
			"key": "56cbf4e7-26e5-4e42-b495-fc7b35df8c29",
			"value": "夹博士05[05]"
		},
		{
			"key": "58144a54-279c-4980-ae80-db85df2af02c",
			"value": "虚拟消费机台[0122]"
		},
		{
			"key": "59015a5a-e917-40b1-8c53-bd7a9ac16cf6",
			"value": "体育项目11[11]"
		},
		{
			"key": "59cc699e-ad94-4959-b59f-095caf28a4c8",
			"value": "iPlus26[26]"
		},
		{
			"key": "59d3c290-c907-40d9-9014-916dad19e564",
			"value": "iPlus97[97]"
		},
		{
			"key": "5a76bfa8-95b1-461b-b9cf-bebb1ef6cbd8",
			"value": "夹博士06[06]"
		},
		{
			"key": "5b1374df-04f8-4125-b3f2-a649d1b8bd6a",
			"value": "iPlus107[107]"
		},
		{
			"key": "5fc421af-a3d0-49df-8ce4-e51c3f239353",
			"value": "iPlus85[85]"
		},
		{
			"key": "61559b7e-ac55-4381-b7fb-0a8f35ff3cf4",
			"value": "iPlus11[11]"
		},
		{
			"key": "61a98f45-9884-4b55-83ff-30a40bc6fc62",
			"value": "iPlus09[09]"
		},
		{
			"key": "61b83f42-e2cd-408e-9f9b-9540b8881f3e",
			"value": "一号桌[]"
		},
		{
			"key": "64310603-6482-4390-ad81-fdd4ec94d3a9",
			"value": "夹博士08[08]"
		},
		{
			"key": "68d04f36-0b15-463c-8a71-bcec12c9c494",
			"value": "测试机台[01]"
		},
		{
			"key": "6960d0b0-c888-41df-b38d-741da1d1f5be",
			"value": "幸运矿工01[01]"
		},
		{
			"key": "6d4a6459-5ce7-482e-9f46-d0aa013ee276",
			"value": "iPlus16[16]"
		},
		{
			"key": "6d7b637d-0016-4175-8393-01bae955b372",
			"value": "iPlus44[44]"
		},
		{
			"key": "713892af-bbb0-45a4-8730-3ed4faa0eaac",
			"value": "iPlus101[101]"
		},
		{
			"key": "74dd9e8d-998c-4e68-ad5f-030ef00d9e8e",
			"value": "iPlus03[03]"
		},
		{
			"key": "752ce386-40c0-4779-b8ec-e6299a84dc1d",
			"value": "夹博士03[03]"
		},
		{
			"key": "767e098e-0144-4311-8e85-d242ff15b13b",
			"value": "iPlus67[67]"
		},
		{
			"key": "769c7284-f86e-471a-97f9-d5c98742b4f4",
			"value": "次元玩家02[01]"
		},
		{
			"key": "7711f50c-1afc-4f27-be9a-793552154551",
			"value": "iPlus88[88]"
		},
		{
			"key": "77a273b8-41f6-45b5-bb96-0f78252e1c95",
			"value": "体育项目03[03]"
		},
		{
			"key": "7912739f-092c-4cd6-9f0e-954abef45cd2",
			"value": "iPlus18[18]"
		},
		{
			"key": "7d81b8ec-0549-49da-87df-f7f13ecff0e0",
			"value": "iPlus58[58]"
		},
		{
			"key": "7e404937-6f13-4d4f-ae1d-66dca07e7443",
			"value": "iPlus21[21]"
		},
		{
			"key": "7ecb03fb-4c7f-4c8c-9c6a-3afe8a155120",
			"value": "炫动摩托02[01]"
		},
		{
			"key": "8110960d-29d0-4a4e-816b-7412a8cc2a3e",
			"value": "夹博士01[01]"
		},
		{
			"key": "81931c26-3f8b-4644-b566-2af294d57bf2",
			"value": "iPlus01[01]"
		},
		{
			"key": "838bf3b7-a9a1-4034-aa36-ba0c9b1dbca4",
			"value": "iPlus93[93]"
		},
		{
			"key": "865ee50b-1663-4e54-85b3-53e26558b1bb",
			"value": "体育项目01[01]"
		},
		{
			"key": "88b635e0-bac4-4f0c-8196-5cd6ba2026be",
			"value": "iPlus98[98]"
		},
		{
			"key": "8bd01f2a-d515-4b0c-8d55-523ca9e66a99",
			"value": "体育项目07[07]"
		},
		{
			"key": "8d05a8e8-e507-46e8-a7e5-88d7c772416f",
			"value": "iPlus83[83]"
		},
		{
			"key": "8e45f9a0-2c82-47e0-9983-8a7e9c533bc6",
			"value": "iPlus24[24]"
		},
		{
			"key": "90132954-197a-407e-8391-47164bba29a3",
			"value": "iPlus94[94]"
		},
		{
			"key": "913aa770-2b72-46db-9fbd-48ab14faad38",
			"value": "夹博士09[09]"
		},
		{
			"key": "91fb6940-2fc1-4d06-9b14-a6ca79c4ecd8",
			"value": "iPlus32[32]"
		},
		{
			"key": "928dad73-47ba-4df1-bb4a-fc2be4e1a622",
			"value": "iPlus91[91]"
		},
		{
			"key": "92e45eec-9529-4884-a5e7-f469325455e6",
			"value": "iPlus46[46]"
		},
		{
			"key": "92e95526-69fd-40d2-a8be-422803ce592c",
			"value": "次元玩家01[01]"
		},
		{
			"key": "944604d3-f6a6-482b-8183-429b12ce8630",
			"value": "iPlus48[48]"
		},
		{
			"key": "9641c514-5692-4d65-8406-5d5df5115289",
			"value": "炫动摩托01[01]"
		},
		{
			"key": "96fb6266-696d-42ea-b73e-38a58c0f142e",
			"value": "iPlus51[51]"
		},
		{
			"key": "983e0123-9a6a-46b7-b24c-e29325ba938b",
			"value": "iPlus55[55]"
		},
		{
			"key": "989234ff-f28d-4a34-9da4-a3fe1a1154dd",
			"value": "畅玩次数限制机台1[01]"
		},
		{
			"key": "98ded915-31f3-4f85-8428-25e02241ef99",
			"value": "iPlus62[62]"
		},
		{
			"key": "9a43b2ad-add9-45ca-99fa-402744af1da2",
			"value": "iPlus40[40]"
		},
		{
			"key": "9ca9fbbe-6bcd-47b4-b8df-0512a5800e98",
			"value": "麻将争霸VS双龙抢珠01[01]"
		},
		{
			"key": "9cca0e40-6add-49ba-82ba-af758379040c",
			"value": "iPlus71[71]"
		},
		{
			"key": "9cd4e194-6c0f-4078-87bb-2468932df0f9",
			"value": "iPlus61[61]"
		},
		{
			"key": "a2c8c6fe-2b7a-45e5-95f8-001f3e28cdaf",
			"value": "iPlus84[84]"
		},
		{
			"key": "a2d10915-ce26-4a76-9e0c-43ef43e877b3",
			"value": "iPlus104[104]"
		},
		{
			"key": "aa7c3c7a-6b33-410e-8ec8-7fdf03132cd2",
			"value": "iPlus17[17]"
		},
		{
			"key": "ab67c615-482f-4afd-aaab-7318e61867fe",
			"value": "iPlus92[92]"
		},
		{
			"key": "ad983c43-50b6-4654-8bc1-e7aa9760e55c",
			"value": "体育项目10[10]"
		},
		{
			"key": "aec4367b-b437-462f-ab65-60278c4b2b94",
			"value": "iPlus96[96]"
		},
		{
			"key": "b37ed198-30f7-469c-8a13-8ec9e5346328",
			"value": "iPlus31[31]"
		},
		{
			"key": "b4dd8d38-1a30-44e5-aaf3-3d1fa2efbd81",
			"value": "iPlus79[79]"
		},
		{
			"key": "b6b3dc96-9a32-4423-bc32-9677e8177f31",
			"value": "iPlus20[20]"
		},
		{
			"key": "b7a3bb89-1009-492e-89f9-dfd05ec47332",
			"value": "iPlus89[89]"
		},
		{
			"key": "bdfedf17-14a4-4d53-af14-02f07b0fe3da",
			"value": "iPlus27[27]"
		},
		{
			"key": "becff181-54ea-4fee-8c9f-24a70ad493ad",
			"value": "翠花闸机02[01]"
		},
		{
			"key": "bf022f8a-eab7-4d86-8750-53687f27ceae",
			"value": "iPlus02[02]"
		},
		{
			"key": "c118bf2c-2c6b-4567-80a6-7fa384c470cb",
			"value": "体育项目06[06]"
		},
		{
			"key": "c349e5b7-f1e6-4a02-b704-5c73bddfdab6",
			"value": "iPlus95[95]"
		},
		{
			"key": "c47a4cef-bbb1-430c-940c-47041ea7c0d6",
			"value": "夹博士04[04]"
		},
		{
			"key": "c77d374a-83ed-40fe-9f2d-9dfee1bb76d1",
			"value": "超时累加规则检查[01]"
		},
		{
			"key": "c9389255-90a2-484b-8a20-a07a0f199652",
			"value": "三号桌[22]"
		},
		{
			"key": "cafee78f-c231-48d1-9d39-551d4f671699",
			"value": "虚拟消费机台（开发用）[01]"
		},
		{
			"key": "ce7dc943-c12d-45bb-87ff-eda8cb512c09",
			"value": "iPlus39[39]"
		},
		{
			"key": "d2e3661f-0ba6-434c-a841-a862db566477",
			"value": "Lucy Rolling beads Machine[01]"
		},
		{
			"key": "d413ef61-ae7b-45a9-982a-86d36c7a7349",
			"value": "iPlus99[99]"
		},
		{
			"key": "d5f6562a-1307-495c-a7f1-d6ea5920bc36",
			"value": "iPlus28[28]"
		},
		{
			"key": "d6087e37-7dcb-4d16-8a5e-f0aea90f30a6",
			"value": "iPlus38[38]"
		},
		{
			"key": "d6d2fae1-23a0-48f3-aa5e-7b79598b2bd6",
			"value": "iPlus04[04]"
		},
		{
			"key": "d7f585c4-86e2-436b-aa5e-cc5ecbbcd775",
			"value": "重力星球01[01]"
		},
		{
			"key": "d97e9ac4-8c49-42f1-a63f-478cb136fbc7",
			"value": "畅玩次数限制机台2[01]"
		},
		{
			"key": "da8cf9f0-d55b-40e0-a643-4d0325e5021e",
			"value": "iPlus77[77]"
		},
		{
			"key": "db178fd1-6e0b-45b1-af48-fcc5f052322e",
			"value": "体育项目02[02]"
		},
		{
			"key": "e31d24d8-7bbe-4701-8dbb-a5753daf87b1",
			"value": "iPlus53[53]"
		},
		{
			"key": "e54ab0b4-c0ef-4c9a-bd9f-6555a9bd381a",
			"value": "iPlus33[33]"
		},
		{
			"key": "e5988488-43dd-4626-90a0-091ec0b6ec01",
			"value": "雪花云人脸识别闸机[01]"
		},
		{
			"key": "e678320b-c12b-4f5a-8abb-7c26da5badbd",
			"value": "iPlus23[23]"
		},
		{
			"key": "e70990a9-bd89-4712-b628-bb63aec06370",
			"value": "iPlus103[103]"
		},
		{
			"key": "e861ca2e-a01f-4447-bf4f-ca033775194b",
			"value": "iPlus87[87]"
		},
		{
			"key": "ea8f5489-060f-45bb-afc3-effc86d70400",
			"value": "iPlus74[74]"
		},
		{
			"key": "eaba952e-6fc9-4ec8-a167-61a0b282b1d4",
			"value": "iPlus100[100]"
		},
		{
			"key": "eb4dc21e-0b0f-43ac-a556-b3a46a0bc1a6",
			"value": "iPlus30[30]"
		},
		{
			"key": "ee0dc2e0-9c7c-450b-a8d9-ca4d1de15ff0",
			"value": "iPlus22[22]"
		},
		{
			"key": "ef17206f-85ac-48d1-bce4-ce36fa46a693",
			"value": "迷你世界（三人动感版）01[01]"
		},
		{
			"key": "efc24419-c2e6-427c-b0a0-7338bdadd13a",
			"value": "iPlus66[66]"
		},
		{
			"key": "efd14b18-549e-4f46-bba7-8b0527ff2e76",
			"value": "iPlus65[65]"
		},
		{
			"key": "f0487707-4b27-4333-beb6-b96bca856be8",
			"value": "iPlus45[45]"
		},
		{
			"key": "f3c371b5-b95d-410f-b008-b3bb402338bb",
			"value": "齐天大圣II立式六人01[01]"
		},
		{
			"key": "f42220a5-f620-4536-bd9c-5f4b758d5185",
			"value": "iPlus86[86]"
		},
		{
			"key": "f48df865-1d1c-4f4d-9b43-5887600abd0f",
			"value": "翠花闸机01[01]"
		},
		{
			"key": "f576edee-bc24-46ce-b9d1-375f36730606",
			"value": "iPlus10[10]"
		},
		{
			"key": "f58cd0b8-d44b-4825-8a12-f9618c8fa84a",
			"value": "海外卡头配置测试[0]"
		},
		{
			"key": "f6e948c7-e9ba-4cfe-9f9c-c6be6687c176",
			"value": " 蛋飞天02[01]"
		},
		{
			"key": "f806828e-d225-4e98-ab54-895d8b6de156",
			"value": "扭蛋机01[01]"
		},
		{
			"key": "fda21024-e74a-4112-8968-6da929d92637",
			"value": "iPlus111[111]"
		},
		{
			"key": "fe0039ea-3205-41b5-8404-761be2e35c25",
			"value": "iPlus68[68]"
		},
		{
			"key": "ffd3285c-5450-4f99-8a70-fad0bdac3241",
			"value": "iPlus35[35]"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | array | - |
| data.key | 016fa470-deca-4402-8172-73b14afec167 | string | 机台ID |
| data.value | iPlus08[08] | string | 机台名称 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

# 财务

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-20 15:42:02

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 获取门店考核指标

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-02 16:33:57

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "finance_get_daily_kpi",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"startDate\":\"2024-01-01\",\"endDate\":\"2024-12-12\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | finance_get_daily_kpi | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"startDate":"2024-01-01","endDate":"2024-12-12"} | string | Yes | "startDate":开始日期，"endDate":截至日期 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"forDate": "2024-06-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.42",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10027.00",
					"currentValue": "0.06",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.20",
					"currentValue": "2.16",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "4.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.05",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "2.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.40",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "1.96",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.15",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "10.09",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.05",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.04",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.30",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "1.89",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.75",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.20",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "3.02",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.59",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.37",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10023.00",
					"currentValue": "0.17",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10022.00",
					"currentValue": "0.56",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.33",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.10",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.44",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "1.48",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.40",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.21",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "1.53",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.80",
					"currentValue": "0.11",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10024.00",
					"currentValue": "0.39",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10018.00",
					"currentValue": "4.55",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.18",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.19",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "6.95",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.07",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10011.00",
					"currentValue": "0.14",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10005.00",
					"currentValue": "0.18",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10028.00",
					"currentValue": "1.54",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10001.00",
					"currentValue": "0.46",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.03",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.08",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.22",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "3.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-31",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "2.26",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10013.00",
					"currentValue": "0.13",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10015.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "1.60",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "4.52",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-31",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.09",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10016.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "3.09",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.37",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.03",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "-0.07",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.20",
					"currentValue": "0.18",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.03",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-31",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10007.00",
					"currentValue": "0.02",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.90",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.33",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.11",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "2.91",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10020.00",
					"currentValue": "0.07",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.08",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-24",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "3.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.24",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10004.00",
					"currentValue": "0.06",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "7.17",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.33",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-31",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10025.00",
					"currentValue": "0.24",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-08",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.63",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10019.00",
					"currentValue": "0.06",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.87",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.50",
					"currentValue": "0.08",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10017.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-23",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-12",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10021.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.03",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10026.00",
					"currentValue": "1.53",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10029.00",
					"currentValue": "0.11",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "2.04",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "1.84",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.50",
					"currentValue": "0.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.07",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.06",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10008.00",
					"currentValue": "0.14",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.04",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10006.00",
					"currentValue": "0.48",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-05",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.04",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "3.26",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-16",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.01",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "1.51",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "1.82",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-22",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.03",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-20",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10000.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.40",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10014.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "1.67",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.40",
					"currentValue": "114.06",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.70",
					"currentValue": "0.08",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-25",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.30",
					"currentValue": "0.20",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10003.00",
					"currentValue": "0.40",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10009.00",
					"currentValue": "-0.02",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-28",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10010.00",
					"currentValue": "1.86",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-06",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10012.00",
					"currentValue": "0.28",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-21",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "1.69",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-13",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-02",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-10",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.39",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-29",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-30",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "-0.08",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-27",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-12-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "20.29",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-19",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-01",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-11",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.12",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.32",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-06-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-18",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.00",
					"currentValue": "0.38",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-26",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "1.80",
					"currentValue": "3.70",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-15",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.34",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-11-17",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-10-07",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.71",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-05-04",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-09-03",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "10002.00",
					"currentValue": "0.14",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-07-14",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "2.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		},
		{
			"forDate": "2024-08-09",
			"items": [
				{
					"kpiCode": 1001,
					"kpiName": "营收",
					"itemCode": 1001,
					"itemName": "营收金额",
					"targetValue": "0.00",
					"currentValue": "0.00",
					"completeRate": "0.00"
				}
			]
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.forDate | 2024-06-05 | string | 营收日期 |
| data.items | - | object | 指标数据 |
| data.items.kpiCode | 1001 | integer | 考核指标编号 |
| data.items.kpiName | 营收 | string | 考核指标名称 |
| data.items.itemCode | 1001 | integer | 统计项编号 |
| data.items.itemName | 营收金额 | string | 统计项名称 |
| data.items.targetValue | 0.00 | string | 目标值 |
| data.items.currentValue | 0.00 | string | 当前完成值 |
| data.items.completeRate | 0.00 | string | 完成率 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

# 商品

> Creator: 陈宝聪

> Updater: 陈宝聪

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-20 15:51:29

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 获取门店商品分组

> Creator: 陈宝聪

> Updater: 陈宝聪

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-20 16:24:00

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "gift_type",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | gift_type | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | - |
| body | {} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
		{
			"typeId": "00479ccd-cdd5-4ea5-9413-44579dafe435",
			"typeName": "零食饮料"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.typeId | 00479ccd-cdd5-4ea5-9413-44579dafe435 | string | 分组编码 |
| data.typeName | 零食饮料 | string | 商品分组名称 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取门店商品库存

> Creator: 陈宝聪

> Updater: 陈宝聪

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-04-07 09:52:00

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "gift_realtime_stock",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "6e5d8fba6a3086550498a61e5a01baf3",
	"body": "{\"typeId\":\"08db7c36-031d-430c-8d97-8c9749ca221e\",\"giftName\":\"布偶猫\",\"giftNo\":\"\",\"stockId\":\"08db7c60-698f-4d89-8e4c-f21a5de8be16\",\"isFilterZero\":false}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | gift_realtime_stock | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 6e5d8fba6a3086550498a61e5a01baf3 | string | Yes | - |
| body | {\"typeId\":\"08db7c36-031d-430c-8d97-8c9749ca221e\",\"giftName\":\"02\",\"giftNo\":\"0001\",\"stockId\":\"08db7c60-698f-4d89-8e4c-f21a5de8be16\",\"isFilterZero\":false} | string | Yes | - |
| body.typeId | - | string | No | 商品分组编码 |
| body.giftName | - | string | No | 商品名称 |
| body.giftNo | - | string | No | 商品编码 |
| body.stockId | - | string | No | 仓库编码 |
| body.isFilterZero | true | string | No | 是否过滤0库存，默认true |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":[{"giftName":"布偶猫","giftNo":"000001","typeName":"零售商品1","stockName":"主仓库","amount":590,"totalMoney":28908.64000,"giftPrice":49.00000,"price":0.01,"supplierNames":"供应商001","exchangeIntegral":4.00,"exchangeLottery":5.00,"recoveryIntegral":1.00,"recoveryLottery":2.00}],"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | array | 业务数据 |
| data.giftName | 布偶猫 | string | 商品名称 |
| data.giftNo | 000001 | string | 商品编码 |
| data.typeName | 零售商品1 | string | 商品分组名称 |
| data.stockName | 主仓库 | string | 仓库名称 |
| data.amount | 590 | integer | 当前库存 |
| data.totalMoney | 28908.64 | number | 库存价值 |
| data.giftPrice | 49 | integer | 进货单价 |
| data.price | 0.01 | number | 销售价 |
| data.supplierNames | 供应商001 | string | 供应商 |
| data.exchangeIntegral | 4 | integer | 兑换积分 |
| data.exchangeLottery | 5 | integer | 兑换彩票 |
| data.recoveryIntegral | 1 | integer | 回收积分 |
| data.recoveryLottery | 2 | integer | 回收彩票 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 获取商品列表

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-05 14:57:40

> Update Time: 2026-03-11 13:48:49

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "setmeal_getsellgoods",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "D07A5460D53D69A3D88A7118D61DC8F2",
	"body": "{\"SetmealName\":\"第三方\",\"TypeId\":\"08dd8c3d-e56c-4fea-869e-8c9371c7faf3\",\"Category\":\"4\"}"
}	
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | - |
| action | setmeal_getsellgoods | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | - |
| body | {"SetmealName":"第三方","TypeId":"08dd8c3d-e56c-4fea-869e-8c9371c7faf3"} | string | Yes | - |
| body.SetmealName | 第三方 | string | No | 商品名称(可选) |
| body.TypeId | 08dd8c3d-e56c-4fea-869e-8c9371c7faf3 | string | No | 商品分类编码(可选) |
| body.Category | 4 | string | Yes | 商品类型(可选) 1.代币 2.点数 3.限时币 4.门票 5.优惠券 6.预存款 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"goodsItems": [
			{
				"goodsId": "9a7c0bb6-ef50-49fb-a62c-4ccc814a9c89",
				"goodsName": "第三方次票",
				"category": 4,
				"subCategory": 1,
				"price": 10,
				"underlinePrice": 0,
				"badge": "",
				"isOpenRemark": false,
				"remark": ""
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | object | - |
| data.goodsItems | - | array | - |
| data.goodsItems.goodsId | 9a7c0bb6-ef50-49fb-a62c-4ccc814a9c89 | string | 商品编码 |
| data.goodsItems.goodsName | 第三方次票 | string | 商品名称 |
| data.goodsItems.category | 4 | number | 商品类型 (1.代币 2.点数 3.限时币 4.门票 5.优惠券 6.预存款) |
| data.goodsItems.subCategory | 1 | number | 商品子类型 |
| data.goodsItems.price | 10 | number | 销售价格 |
| data.goodsItems.underlinePrice | 0 | number | 划线价 |
| data.goodsItems.badge | - | string | 角标 |
| data.goodsItems.isOpenRemark | false | boolean | 是否显示详情 |
| data.goodsItems.remark | - | string | 商品备注信息 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

# 基础

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-26 18:46:53

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 获取门店列表信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-13 15:02:47

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "7c94492f05b14c5eada5c765f80a9cd2",
	"action": "basic_shop_list",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "1A0D843862B993A5EC439C94DEF1E6C2",
	"body": "{}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | basic_shop_list | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 8DF646B6A25C2F6DC97981BC628477FF | string | Yes | - |
| body | {} | string | Yes | 不带任何参数，传递{} 字对象字符串 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "获取门店列表信息成功",
	"code": 0,
	"data": [
		{
			"shopId": 4,
			"shopName": "智科展厅"
		},
		{
			"shopId": 3157,
			"shopName": "翠花科技3157号店"
		},
		{
			"shopId": 3159,
			"shopName": "大拇指展厅"
		},
		{
			"shopId": 3160,
			"shopName": "自然源展厅"
		},
		{
			"shopId": 3161,
			"shopName": "智绘展厅"
		},
		{
			"shopId": 13536,
			"shopName": "潮吉夹-深圳店"
		},
		{
			"shopId": 13901,
			"shopName": "拓疆计划-番禺店"
		}
	],
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | 获取门店列表信息成功 | string | - |
| code | 0 | integer | - |
| data | - | object | - |
| data.shopId | 4 | integer | 门店编码 |
| data.shopName | 智科展厅 | string | 门店名称 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 设置会员码刷新时间

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-26 15:25:07

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_code_setting_refreshtime",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"sign": "30590CA4C0BB766471CCFCF599FBB482",
	"body": "{\"refreshTime\":88}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_code_setting_refreshtime | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 30590CA4C0BB766471CCFCF599FBB482 | string | Yes | - |
| body | {"refreshTime":88} | string | Yes | 单位为秒 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "操作成功",
	"code": 0,
	"data": {},
	"desc": ""
}
```

* 失败(404)

```javascript
No data
```

**Query**

## 获取赠送内容

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:06:52

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "basic_account_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"scene\":2}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

# 推送

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-08-16 21:03:02

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 会员消费-消息推送

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:43:31

```text
No description
```

**API Status**

> Completed

**URL**

> /member/consume

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "memberCode": "09PAYCH010391",
    "storedCategory": 1,
    "storedValue": 10,
    "businessCateory": 1001,
    "machineNo": "55",
    "consoleNo": "5P",
    "commId": 458264,
    "businessName": "机台玩游戏",
    "businessTime": "2024-08-17 12:29:13.037",
    "bizCode": "7882967938834104329",
    "remark": "在[E舞成名]游戏机台玩一局,扣除游戏币10枚"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| memberCode | 09PAYCH010391 | string | No | 会员卡号 |
| storedCategory | 1 | integer | Yes | 消费-储值类型 |
| storedValue | 10 | integer | Yes | 出奖-储值数量 |
| businessCateory | 1001 | integer | Yes | 消费-业务类型 |
| machineNo | 55 | string | Yes | 机台编号 |
| consoleNo | 5P | string | Yes | P位编号 |
| commId | 458264 | integer | Yes | 机台通讯编码 |
| businessName | 机台玩游戏 | string | Yes | 消费-业务名称 |
| businessTime | 2024-08-17 12:29:13.037 | string | Yes | 消费时间 |
| bizCode | 7882967938834104329 | string | Yes | 业务防重码 |
| remark | 在[E舞成名]游戏机台玩一局,扣除游戏币10枚 | string | No | 消费描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "操作成功"
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败"
}
```

**Query**

## 会员取卡-消息推送

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:43:37

```text
No description
```

**API Status**

> Completed

**URL**

> /member/takecard

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "icCard": "7CA6B17A110804006263646566676869",
    "memberCode": "09PAYCH010391",
    "storedCategory": 1,
    "storedValue": 5,
    "businessTime": "2024-08-17 12:29:13.037",
    "bizCode": "7882967938834104330",
    "remark": "在[小智3-5467889]领取一张会员卡,押金-游戏币5枚"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| icCard | 7CA6B17A110804006263646566676869 | string | Yes | 会员卡芯片号 |
| memberCode | 09PAYCH010391 | string | Yes | 会员卡号 |
| storedCategory | 1 | integer | Yes | 会员卡押金-储值类型 |
| storedValue | 5 | integer | Yes | 出奖-储值数量 |
| businessTime | 2024-08-17 12:29:13.037 | string | Yes | 取卡时间 |
| bizCode | 7882967938834104330 | string | Yes | 业务防重码 |
| remark | 在[小智3-5467889]领取一张会员卡,押金-游戏币5枚 | string | No | 取卡描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "操作成功"
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败"
}
```

**Query**

## 会员退卡-消息推送

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:43:41

```text
No description
```

**API Status**

> Completed

**URL**

> /member/returncard

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "icCard": "7CA6B17A110804006263646566676869",
    "memberCode": "09PAYCH010391",
    "storedCategory": 1,
    "storedValue": 5,
    "businessTime": "2024-08-17 12:29:13.037",
    "bizCode": "7882967938834104331",
    "remark": "在[小智3-5467889]退一张会员卡,退还押金-游戏币5枚"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| icCard | 7CA6B17A110804006263646566676869 | string | Yes | 会员卡芯片号 |
| memberCode | 09PAYCH010391 | string | Yes | 会员卡号 |
| storedCategory | 1 | integer | Yes | 会员卡押金-储值类型 |
| storedValue | 5 | integer | Yes | 出奖-储值数量 |
| businessTime | 2024-08-17 12:29:13.037 | string | Yes | 退卡时间 |
| bizCode | 7882967938834104331 | string | Yes | 业务防重码 |
| remark | 在[小智3-5467889]退一张会员卡,退还押金-游戏币5枚 | string | No | 退卡描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "操作成功"
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | integer | 业务代码 |
| msg | 操作失败 | string | 业务描述 |

**Query**

## 机台出奖-消息推送

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:43:44

```text
No description
```

**API Status**

> Completed

**URL**

> /member/payout

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "memberCode": "09PAYCH010391",
    "machineNo": "55",
    "consoleNo": "5P",
    "commId": 458264,
    "storedCategory": 1,
    "storedValue": 10,
    "businessTime": "2024-08-17 12:29:13.037",
    "bizCode": "7882967938834104328",
    "remark": "[E舞成名]玩游戏,奖励彩票500张"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| memberCode | 09PAYCH010391 | string | Yes | 会员卡号 |
| storedCategory | 1 | integer | Yes | 出奖-储值类型(1.游戏币 5.积分 6.彩票 7.蓝票 50.实物-游戏币 51.实物-彩票 52.实物-蓝票 53.实物-礼品 54.实物-零食) |
| storedValue | 10 | integer | Yes | 出奖-储值数量 |
| businessTime | 2024-08-17 12:29:13.037 | string | Yes | 业务发生时间 |
| bizCode | 7882967938834104328 | string | Yes | 业务防重码 |
| remark | [E舞成名]玩游戏,奖励彩票500张 | string | Yes | 业务描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 会员核销-消息推送

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:14

```text
No description
```

**API Status**

> Completed

**URL**

> /grouporder/writeoff

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "memberCode": "09PAYCH010391",
    "phone": "13000000000",
    "couponId": "ca156b1c-6fe6-11ef-b4b4-1070fda8acec",
    "orderId": "xxxxxxxxx",
    "code": "101014809629163520",
    "goodsName": "100元=150币",
    "price": 0.00,
    "sysMoney": 0.00,
    "realMoney": 0.00,
    "platformRealMoney": 0.00,
    "qty": 1,
    "storeds": [
        {
            "storedCategory": 1,
            "storedValue": 10,
        },
        {
            "storedCategory": 2,
            "storedValue": 50,
        }
    ],
    "businessTime": "2024-08-17 12:29:13.037",
    "bizCode": "7882967938834104328",
    "remark": "[美团]团购核销"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| uid | b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae | string | Yes | 会员编码 |
| memberCode | 09PAYCH010391 | string | Yes | 会员卡号 |
| couponId | ca156b1c-6fe6-11ef-b4b4-1070fda8acec | string | Yes | 预核销券编码 |
| code | 101014809629163520 | string | Yes | 团购券码 |
| goodsName | 100元=150币 | string | Yes | 团购商品名称 |
| price | 0 | number | Yes | 单价 |
| sysMoney | 0 | number | Yes | 应收金额 |
| realMoney | 0 | number | Yes | 实收金额 |
| platformRealMoney | 0 | number | Yes | 平台实收金额 |
| qty | 1 | integer | Yes | 购买数量 |
| storeds | - | array | Yes | 商品储值信息 |
| storeds.storedCategory | 1 | integer | Yes | 储值类型 |
| storeds.storedValue | 10 | integer | Yes | 储值数量 |
| businessTime | 2024-08-17 12:29:13.037 | string | Yes | 核销时间 |
| bizCode | 7882967938834104328 | string | Yes | 业务防重标识 |
| remark | [美团]团购核销 | string | Yes | 业务描述 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "操作成功"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| code | 0 | integer | 团购券码 |
| msg | 操作成功 | string | - |

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败"
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | - |
| code | 0 | integer | 团购券码 |
| msg | 操作失败 | string | - |

**Query**

## 会员入会-消息推送

> Creator: 龚明明

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-10 10:44:15

```text
No description
```

**API Status**

> Completed

**URL**

> /member/join

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "bizcode": "56173aa7d8ab4204ae3448fe943016bc",
    "mid": "b5b25333-3498-113f-2734-0c43a1b7b4ae",
    "uid": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "memberCode": "09PAYCH010391",
    "phone": "13000000000",
    "levelId": "b5ba39a1-5bea-11ef-a734-0c42a1b7b4ae",
    "remark": "会员注册"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

# 其它

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-08-18 22:37:02

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 【生成签名】会员入会

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:28:48

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "fb3aa300d5694abbb807472ae405f772",
	"action": "member_join",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "hkhpnjtYH2mrrdciCcSjXjH7cjr7cz4h",
	"data": {
		"openId": "7882967938834104333",
		"phone": "15111553941",
		"realName": "萧亚"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":{"body":"{\u0022openId\u0022:\u0022oeOrI5TfBrCKszbFT0lQaYNuSchY\u0022,\u0022phone\u0022:\u002213100000000\u0022,\u0022realName\u0022:\u0022\\u5F20\\u4E09\u0022,\u0022password\u0022:\u0022123456\u0022}","original":"be559b49662c4b609c5944eda383fefdmember_join10.11.81723822967585{\u0022openId\u0022:\u0022oeOrI5TfBrCKszbFT0lQaYNuSchY\u0022,\u0022phone\u0022:\u002213100000000\u0022,\u0022realName\u0022:\u0022\\u5F20\\u4E09\u0022,\u0022password\u0022:\u0022123456\u0022}yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC","sign":"9DAE66C101D801C51B1C8C5137B1F742"},"desc":""}
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】 手机号入会

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:10

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_phone_join",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"phone": "13587456711",
		"realName": "萧亚",
		"password": "456789"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取会员二维码

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-26 15:26:46

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_qrcode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"uid": "4e3d1711-6ed2-4681-adff-1052e251457e"
	}
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appid | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_qrcode | string | Yes | 业务函数名称 |
| version | 10.11.8 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| data | - | object | Yes | 业务数据 |
| data.uid | 36fb8e10-90ea-453b-990f-c5daf986ee5f | string | Yes | 会员编码 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{"success":true,"msg":"","code":0,"data":{"body":"{\u0022uid\u0022:\u002236fb8e10-90ea-453b-990f-c5daf986ee5f\u0022}","original":"8c9f2200a1834c6fb306682281e293e3member_qrcode10.11.81723822967585{\u0022uid\u0022:\u002236fb8e10-90ea-453b-990f-c5daf986ee5f\u0022}yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC","sign":"9BE13174BFB34F8F1CFE80EA790817EC"},"desc":""}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 业务描述 |
| code | 0 | integer | 业务代码 |
| data | - | object | 业务数据 |
| data.body | {"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f"} | string | 业务参数 |
| data.original | 8c9f2200a1834c6fb306682281e293e3member_qrcode10.11.81723822967585{"uid":"36fb8e10-90ea-453b-990f-c5daf986ee5f"}yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC | string | - |
| data.sign | 9BE13174BFB34F8F1CFE80EA790817EC | string | 签名字符串 |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过会员码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:23

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_qrcode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
    "key": "yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC",
	"data": {
		"eCode": "H8140B04A8E8FE7C3A69DFE36E9367E145C"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过会员卡序列号获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:28

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_serialnumber",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"serialNumber": "1865926425"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过会员卡号获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:33

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_membercode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
    "key":"yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC",
	"data": {
		"memberCode": "MR01PAY020000059"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过会员编码修改手机号

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-19 13:42:04

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_change_phone",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"uid": "6629df4e-4d77-4ed5-a0eb-48d937b31fc4",
		"newphone": "18664702135"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

**Query**

## 【生成签名】通过会员编码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:39

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_uid",
	"version": "10.11.8",
	"timestamp": "1723822967585",
    "key": "yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC",
	"data": {
		"uid": "36fb8e10-90ea-453b-990f-c5daf986ee5f"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

**Query**

## 【生成签名】通过会员编码获取会员卡信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:45

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmembercode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
    "key": "yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC",
	"data": {
		"uid": "36fb8e10-90ea-453b-990f-c5daf986ee5f"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

**Query**

## 【生成签名】获取游戏机台配置参数

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:29:54

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_get_settings",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"machineCode": "SY01-MN01-HBDL01-0090"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

**Query**

## 【生成签名】获取中奖打印二维码

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:30:10

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appid": "8c9f2200a1834c6fb306682281e293e3",
	"action": "machine_generate_welfare_qrcode",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"machineCode": "SY01-MN01-HBDL01-0090",
		"amount": "88"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"code": 0,
	"msg": "",
	"data": [
        {
            "category":1,
            "memberCode":"09PAYCH010391",
            "icCard":"1A6CFC6EE40804006263646566676869",
            "remark":"扣除10枚游戏币在自助设备中取卡"
        },
        {
            "category":2,
            "memberCode":"E00315771723692475846462",
            "icCard":"oeOrI5eMvUeBDD2-RFZ2p-A5iumo",
            "remark":"注册小程序自动生成电子会员"
        }
    ]
}
```

* 失败(404)

```javascript
{
	"success": false,
	"code": 0,
	"msg": "操作失败,原因:会员不存在"
}
```

**Query**

## 【生成签名】第三方团购-预核销

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:30:16

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "fb3aa300d5694abbb807472ae405f772",
	"action": "writeoff_prepare",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "hkhpnjtYH2mrrdciCcSjXjH7cjr7cz4h",
	"data": {
		"uid": "5f1631a6-370f-40a1-a954-31bf157cd31c",
		"code": "BD109110267410304268"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】修改会员可用状态

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-18 09:16:20

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_switch_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
        "employeeName": "张三",
        "uid": "00f92a73-d643-483f-a9a0-99ad11655bac",
        "enable": true,
        "remark": "测试备注"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】修改会员卡可用状态

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-18 13:13:48

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_card_switch_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"employeeName": "张三",
		"deviceName": "第三方",
		"status": 1,
		"uid": "00f92a73-d643-483f-a9a0-99ad11655bac",
		"memberCode": true,
		"remark": "测试备注"
	}
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | member_card_switch_status | string | Yes | - |
| version | 10.11.8 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| key | 9DAE66C101D801C51B1C8C5137B1F742 | string | Yes | - |
| data | - | object | Yes | - |
| data.employeeName | 张三 | string | Yes | - |
| data.deviceName | 第三方 | string | Yes | - |
| data.status | 1 | integer | Yes | - |
| data.uid | 00f92a73-d643-483f-a9a0-99ad11655bac | string | Yes | - |
| data.memberCode | true | boolean | Yes | - |
| data.remark | 测试备注 | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】会员退卡

> Creator: 龚明明

> Updater: 龚明明

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-10-18 09:16:28

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_return_card",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"employeeName": "张三",
		"bizCode": "00f92a73-d643-483f-a9a0-99ad11655bac",
		"memberCode": "09PAYCH010889",
		"isReturnDeposit": false
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过手机号码获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:30:24

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getmember_phone",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"shopId": 0,
		"phone": "18817675782"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取会员彩票变更日志

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-11 23:30:36

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_getlottery_flow",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"uid": "",
		"phone": "18817675782",
		"startTime": "2024-01-11 00:00:00",
		"endTime": "2024-12-11 23:59:59",
		"businessCategorys":"1001,1004",
		"flowType": 1,
		"page": 1,
		"limie": 20
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取会员储值变更概要

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-16 14:48:55

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_store_change_summary",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"uid": "",
		"phone": "18817675782",
		"startTime": "2024-11-11 00:00:00",
		"endTime": "2024-12-11 23:59:59",
		"businessCategorys":"",
		"flowType": 1,
		"category": 106
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】设备扫码登录

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2024-12-18 16:17:08

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_scan_login",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"uid": "36fb8e10-90ea-453b-990f-c5daf986ee5f",
		"commId": 493755,
		"randomCode": "16962491932330688525"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】扣币启动游戏机

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-09 22:38:03

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "device_scan_login",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"commId": 493755,
	    "uid":"610425f4-ce78-11ef-a325-1070fda8acec",
        "cardId":"16962657323401084928",
        "cardCode":"16962657323",
        "gameAmount":1,
        "totalCoinBal":500,
        "totalTicketBal":300
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取当前设备在线状态

> Creator: 龚明明

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-15 22:35:44

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_terminal_get_status",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "yYMpBFsFhDYnfwfn4BcKkJhhJ6QKpiZC",
	"data": {
		"commId": 441274
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过通讯编码获取机台信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-01-15 22:36:11

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_details_by_commid",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
		"commId": 522790
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】扣币启动游戏机台

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-13 15:02:57

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_remote_start_by_store",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
		"commId": 518744,
		"orderId": "CLC522664-173694308558978221",
		"uid": "b8d5cb9f-f93f-4973-af34-e617b14ae4ca",
		"cardId": null,
		"cardCode": null,
		"gameAmount": 1,
		"totalCoinBal": 3,
		"totalTicketBal": 0
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取门店列表

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-02-13 15:02:50

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "7c94492f05b14c5eada5c765f80a9cd2",
	"action": "basic_shop_list",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "ec6719a4e8e111ef87e3043f72e56cc2",
	"data": {}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】设置会员码刷新时间

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-03-26 15:17:55

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "member_code_setting_refreshtime",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "9DAE66C101D801C51B1C8C5137B1F742",
	"data": {
		"refreshTime": 88
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】扫码选择套餐玩游戏

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-05-06 21:22:33

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "machine_scan_play_setmeal",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
	  "uid": "bcd7e8b9-585a-45d0-9e34-92e2306e6d3f",
	  "commId": 532516,
	  "setMealId": "bd7e8c23-7d6a-4b08-8d8c-59415acc6b97",
	  "bizCode": "CLC532516-174487075726762447"
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】获取会员列表

> Creator: 梁灿铭

> Updater: 梁灿铭

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-05-27 11:09:55

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "bf9a0c68727f40c5b814646314802e31",
	"action": "member_list",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "3jcmnXa3yZFQRTiRbR2TRsK455S5mQ5d",
	"data": {
		
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】修改会员基本信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-06-10 12:57:17

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "member_info_modify",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
	  "uid": "bcd7e8b9-585a-45d0-9e34-92e2306e6d3f",
	  "mid": "bd7e8c23-7d6a-4b08-8d8c-59415acc6b97",
	  "realName": "Aionso",
      "nickName":"Aionso",
      "email":"aabcc@qq.com",
      "sex":1
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】分页获取会员信息

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-06-16 11:26:12

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "member_list",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
		"phone": "18817675782",
		"startTime": "2025-01-01 00:00:00",
		"endTime": "2025-03-31 23:59:59",
		"page": 1,
		"pageSize": 10
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】会员门票核销

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-07-18 11:25:57

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "member_passticket_writeoff",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
		"uid": "87ffd217-02dc-4a14-8d2c-e1acfb04f285",
		"storedCategory": 1,
		"startTime":"2025-01-01 00:00:00",
		"endTime":"2025-07-19 00:00:00",
		"page":1,
		"limit":20
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

## 【生成签名】通过会员编码获取储值变更记录

> Creator: 石元考

> Updater: 石元考

> Created Time: 2021-03-25 09:36:59

> Update Time: 2025-07-18 11:24:33

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/generatesign

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "ac321a3935234a108880ae156e7df8e6",
	"action": "member_passticket_writeoff",
	"version": "10.11.8",
	"timestamp": "1723822967585",
	"key": "AeHTwQpWNbWzSRcwFYfbkQSepWAEtJKX",
	"data": {
		"uid": "87b05961-4a8c-11f0-9100-0826ae3f6c66",
		"passticketId": "81080597-4a8c-11f0-9100-0826ae3f6c66",
		"times": 1
	}
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Query**

# 订单

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-02 15:46:07

> Update Time: 2026-03-02 15:46:07

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 订单预计算接口

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-06 15:12:59

> Update Time: 2026-03-09 13:45:59

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "order_precalculate",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "D07A5460D53D69A3D88A7118D61DC8F2",
	"body": "{\"Uid\":\"dc29c6ec-4255-4b55-8baf-244fe1d02820\",\"GoodsItems\":[{\"GoodsId\":\"cc581d73-51e1-4dcc-9c4a-f5401df45812\",\"Quantity\":\"2\" }]}"
}	
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | - |
| action | order_precalculate | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | - |
| body | {"ShopId":"13256","Uid":"dc29c6ec-4255-4b55-8baf-244fe1d02820","GoodsItems":[{"GoodsId":"cc581d73-51e1-4dcc-9c4a-f5401df45812","Quantity":"2" }]} | string | Yes | - |
| body.Uid | dc29c6ec-4255-4b55-8baf-244fe1d02820" | string | No | 会员编码(可选) |
| body.GoodsItems | - | string | Yes | - |
| body.GoodsItems.GoodsId | cc581d73-51e1-4dcc-9c4a-f5401df45812 | string | Yes | 商品编码(必填) |
| body.GoodsItems.Quantity | 2 | string | Yes | 数量(必填) |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"totalOriginalMoney": 5775.86,
		"totalDiscountMoney": 0,
		"totalMoney": 5775.86,
		"totalQty": 2,
		"goodsList": [
			{
				"goodsId": "cc581d73-51e1-4dcc-9c4a-f5401df45812",
				"goodsName": "一年票",
				"price": 2887.93,
				"qty": 2,
				"category": 1,
				"subCategory": 4,
				"isVerifyIdentity": false,
				"imgUrl": ""
			}
		]
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | - |
| msg | - | string | - |
| code | 0 | number | - |
| data | - | object | - |
| data.totalOriginalMoney | 5775.86 | number | - |
| data.totalDiscountMoney | 0 | number | - |
| data.totalMoney | 5775.86 | number | - |
| data.totalQty | 2 | number | - |
| data.goodsList | - | array | - |
| data.goodsList.goodsId | cc581d73-51e1-4dcc-9c4a-f5401df45812 | string | 商品编码 |
| data.goodsList.goodsName | 一年票 | string | 商品名称 |
| data.goodsList.price | 2887.93 | number | 单价 |
| data.goodsList.qty | 2 | number | 数量 |
| data.goodsList.category | 1 | number | 商品类别 |
| data.goodsList.subCategory | 4 | number | 商品子类别 |
| data.goodsList.isVerifyIdentity | false | boolean | 是否需要身份验证 |
| data.goodsList.imgUrl | - | string | 商品图片URL |
| desc | - | string | - |

* 失败(404)

```javascript
No data
```

**Query**

## 创建订单

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-02 15:46:11

> Update Time: 2026-03-09 13:46:06

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "order_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "D07A5460D53D69A3D88A7118D61DC8F2",
	"body": "{\"Uid\":\"dc29c6ec-4255-4b55-8baf-244fe1d02820\",\"GoodsItems\":[{\"GoodsId\":\"2a10a193-ddaa-4473-9d79-b9461ddaa1fc\",\"Quantity\":\"1\"}]}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | AppId |
| action | order_create | string | Yes | 业务函数名称 |
| version | 11.7.1 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | 签名字符串 |
| body | {"ShopId":"13256","Uid":"dc29c6ec-4255-4b55-8baf-244fe1d02820","GoodsItems":[{"GoodsId":"2a10a193-ddaa-4473-9d79-b9461ddaa1fc","Quantity":"1"}]} | string | Yes | 业务参数 |
| body.Uid | dc29c6ec-4255-4b55-8baf-244fe1d02820 | string | Yes | 会员编码(必填) |
| body.GoodsItems | - | object | Yes | 商品列表(必填) |
| body.GoodsItems.GoodsId | 2a10a193-ddaa-4473-9d79-b9461ddaa1fc | string | Yes | 商品编码(必填) |
| body.GoodsItems.Quantity | 1 | number | Yes | 数量(必填) |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,  //业务是否成功
	"msg": "", //消息
	"code": 0,  //业务代码
	"data": {
		"orderNumber": "O01325651772437086903635", //订单号
		"totalAmount": 30, //总金额
		"discountAmount": 0, //优惠金额
		"actualPayment": 30 //实际付款
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 消息 |
| code | 0 | number | 业务代码 |
| data | - | object | - |
| data.orderNumber | O01325651772437086903635 | string | 订单号 |
| data.totalAmount | 30 | number | 总金额 |
| data.discountAmount | 0 | number | 优惠金额 |
| data.actualPayment | 30 | number | 实际付款 |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false, //业务是否成功
	"code": 0, //业务代码
	"msg": "订单创建失败" //消息
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | number | 业务代码 |
| msg | 订单创建失败 | string | 消息 |

**Query**

## 订单支付

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-02 16:57:45

> Update Time: 2026-03-09 13:46:14

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
    "appId": "a4ee5f8d65c1489fba8b71d490925ab0",
    "action": "order_pay",
    "version": "11.7.1",
    "timestamp": "1723822967585",
    "sign": "D07A5460D53D69A3D88A7118D61DC8F2",
    "body": "{\"OrderNumber\":\"O01325651772437086903635\",\"PayAmount\":null}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | AppId |
| action | order_pay | string | Yes | 业务函数名称 |
| version | 11.7.1 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | 签名字符串 |
| body | {"ShopId":"13256","OrderNumber":"O01325651772437086903635"} | string | Yes | - |
| body.OrderNumber | O01325651772437086903635 | string | Yes | 订单号 |
| body.PayAmount | 30 or null | integer | No | 支付金额(可选，默认为订单金额) |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"orderNumber": "O01325651772445671192654"
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 消息 |
| code | 0 | number | 业务代码 |
| data | - | object | - |
| data.orderNumber | O01325651772445671192654 | string | 订单 |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false, //业务是否成功
	"code": 0, //业务代码
	"msg": "支付失败" //消息
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | number | 业务代码 |
| msg | 支付失败 | string | 消息 |

**Query**

## 查询支付状态

> Creator: 陈创新

> Updater: 陈创新

> Created Time: 2026-03-02 17:13:30

> Update Time: 2026-03-09 13:47:21

```text
No description
```

**API Status**

> In Progress

**URL**

> openapi/action

**Method**

> POST

**Content-Type**

> json

**Body**

```javascript
{
	"appId": "a4ee5f8d65c1489fba8b71d490925ab0",
	"action": "order_pay_query",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "D07A5460D53D69A3D88A7118D61DC8F2",
	"body": "{\"OrderNumber\":\"O01325651772445671192654\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | a4ee5f8d65c1489fba8b71d490925ab0 | string | Yes | AppId |
| action | order_pay_query | string | Yes | 业务函数名称 |
| version | 11.7.1 | string | Yes | 接口版本号 |
| timestamp | 1723822967585 | string | Yes | 当前13位时间戳 |
| sign | D07A5460D53D69A3D88A7118D61DC8F2 | string | Yes | 签名字符串 |
| body | {"ShopId":"13256","OrderNumber":"O01325651772445671192654"} | string | Yes | 业务参数 |
| body.OrderNumber | O01325651772445671192654 | string | Yes | 订单号 |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "",
	"code": 0,
	"data": {
		"orderNumber": "O01325651772445671192654",
		"payStatus": 2,
		"payStatusDesc": "已支付"
	},
	"desc": ""
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | true | boolean | 业务是否成功 |
| msg | - | string | 消息 |
| code | 0 | number | 业务代码 |
| data | - | object | - |
| data.orderNumber | O01325651772445671192654 | string | 订单 |
| data.payStatus | 2 | number | 支付状态 0-待支付, 1-支付中, 2-已支付, 3-支付失败, 4-已取消, 5-已退款 |
| data.payStatusDesc | 已支付 | string | 支付状态描述 |
| desc | - | string | - |

* 失败(404)

```javascript
{
	"success": false, //业务是否成功
	"code": 0, //业务代码
	"msg": "支付失败" //消息
}
```

| Key | Example Value | Type | Description |
| --- | ------------- | ---- | ----------- |
| success | false | boolean | 业务是否成功 |
| code | 0 | number | 业务代码 |
| msg | 支付失败 | string | 消息 |

**Query**

# 套餐

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 08:51:26

> Update Time: 2026-04-10 10:07:50

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 计次票、期限票

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:08:02

> Update Time: 2026-04-10 10:12:27

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 票套餐创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 11:56:06

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_passticket_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"setMealName\":\"8888387738\",\"typeId\":\"08dd8565-91ad-4a6f-8993-e377fb5c453c\",\"price\":\"00009\",\"underlinePrice\":0,\"amount\":8,\"remark\":\"\",\"sortIndex\":9,\"effectiveMode\":1,\"enableDays\":0,\"conditionJson\":\"[]\",\"useConditionJson\":\"[]\",\"isOpenSales\":true,\"isOpenAuthorize\":false,\"foreColor\":\"#ffffff\",\"backColor\":\"#465288\",\"badge\":\"\",\"cancelMode\":1,\"isEnabled\":true,\"imgUrl\":\"\",\"isOpenRemark\":false,\"category\":4,\"subCategory\":1,\"strategyValue\":1,\"strategyMode\":1,\"isOpenExchange\":false,\"applyScenes\":[{\"applyScene\":1,\"selectState\":1},{\"applyScene\":2,\"selectState\":1},{\"applyScene\":3,\"selectState\":1},{\"applyScene\":4,\"selectState\":1},{\"applyScene\":5,\"selectState\":1},{\"applyScene\":8,\"selectState\":1}],\"methodId\":null,\"numberLimitType\":0,\"purchaseLimit\":0,\"maxAccompany\":0,\"maxNumber\":1,\"dailyMaxNumber\":10,\"isLimitUserNumber\":false,\"maxBindRelative\":1,\"chargingMode\":1,\"chargingAfterDays\":0,\"useMachineCategory\":3,\"machineKindIds\":[],\"machineTags\":[],\"machineIds\":[],\"discountDesc\":\"\",\"taxRate\":20,\"isNoBuyDiscount\":false,\"renewalProtectDays\":0,\"renewalProtectInPrice\":0,\"renewalProtectOutPrice\":0,\"buyActivity\":{\"category\":1,\"couponInfo\":[],\"date\":[],\"isSelectLeveAll\":false,\"isIndeterminate\":false,\"remark\":\"\",\"conditionInfo\":{\"memberLevelInfo\":[],\"memberTagInfo\":[],\"newMemberDefinition\":1,\"kindInfo\":[],\"frequency\":1,\"memberRangeType\":1,\"playStoreInfo\":[],\"registerDays\":null,\"storeConsumStatisticsMethod\":1,\"playAccountInfo\":[],\"consumStatisticsMethod\":1,\"giveMethod\":1,\"limitMoney\":1,\"useRangeType\":3,\"goodsInfo\":[]}},\"useRulesJson\":\"\",\"giveConfigs\":[],\"exchangeSetts\":[]}"//typeId:商品分类 price:销售价格 underlinePrice:划线价 amount:门票数 remark:商品详情信息 sortIndex:排序 effectiveMode:券生效方式 conditionJson:购买条件Json useConditionJson:使用条件Json isOpenSales:是否允许销售 isOpenAuthorize:是否开启授权 foreColor:文字颜色 backColor:背景颜色 badge:角标 cancelMode:退货方式 isEnabled:是否可用 imgUrl:代表图片 isOpenRemark:是否显示详情 category:套餐类型 subCategory:套餐子类型，1=计次票，2=期限票，当前OpenApi v1不支持3=计时票 strategyValue:有效时间策略值 strategyMode:有效时间策略方式 isOpenExchange:是否允许兑换 applyScenes:套餐应用场景 methodId:支付方式ID numberLimitType:套餐数量限制类型 purchaseLimit:限制份数 maxAccompany:陪同人数 maxNumber:扣费一次当天可进次数 dailyMaxNumber:每天可进闸机次数 isLimitUserNumber:是否限制使用人数 maxBindRelative:绑定亲友人数 chargingMode:计费方式 chargingAfterDays:购买后多少天开始计费 useMachineCategory:可用机台条件分类 machineKindIds:可用机种集合 machineTags:可用机台标签集合 machineIds:可用机台集合 discountDesc:优惠描述 taxRate:税率 isNoBuyDiscount:购买不打折 renewalProtectDays:续期保护天数 renewalProtectInPrice:保护期内续期金额 renewalProtectOutPrice:保护期外续期金额 buyActivity:购买送券信息 useRulesJson:使用规则Json giveConfigs:赠送配置信息 exchangeSetts:兑换配置
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | setmeal_passticket_create | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"setMealName":"8888387738","typeId":"08dd8565-91ad-4a6f-8993-e377fb5c453c","price":"00009","underlinePrice":0,"amount":8,"remark":"","sortIndex":9,"effectiveMode":1,"enableDays":0,"conditionJson":"[]","useConditionJson":"[]","isOpenSales":true,"isOpenAuthorize":false,"foreColor":"#ffffff","backColor":"#465288","badge":"","cancelMode":1,"isEnabled":true,"imgUrl":"","isOpenRemark":false,"category":4,"subCategory":1,"strategyValue":1,"strategyMode":1,"isOpenExchange":false,"applyScenes":[{"applyScene":1,"selectState":1},{"applyScene":2,"selectState":1},{"applyScene":3,"selectState":1},{"applyScene":4,"selectState":1},{"applyScene":5,"selectState":1},{"applyScene":8,"selectState":1}],"methodId":null,"numberLimitType":0,"purchaseLimit":0,"maxAccompany":0,"maxNumber":1,"dailyMaxNumber":10,"isLimitUserNumber":false,"maxBindRelative":1,"chargingMode":1,"chargingAfterDays":0,"useMachineCategory":3,"machineKindIds":[],"machineTags":[],"machineIds":[],"discountDesc":"","taxRate":20,"isNoBuyDiscount":false,"renewalProtectDays":0,"renewalProtectInPrice":0,"renewalProtectOutPrice":0,"buyActivity":{"category":1,"couponInfo":[],"date":[],"isSelectLeveAll":false,"isIndeterminate":false,"remark":"","conditionInfo":{"memberLevelInfo":[],"memberTagInfo":[],"newMemberDefinition":1,"kindInfo":[],"frequency":1,"memberRangeType":1,"playStoreInfo":[],"registerDays":null,"storeConsumStatisticsMethod":1,"playAccountInfo":[],"consumStatisticsMethod":1,"giveMethod":1,"limitMoney":1,"useRangeType":3,"goodsInfo":[]}},"useRulesJson":"","giveConfigs":[],"exchangeSetts":[]} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 11:56:33

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
    "appId": "8c9f2200a1834c6fb306682281e293e3",
    "action": "setmeal_passticket_update",
    "version": "11.7.1",
    "timestamp": "1723822967585",
    "sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
    "body": "{\"setMealId\":\"997563ef-4d4f-4a4d-871d-fd8d00387975\",\"setMealName\":\"mini卡头期限票验证\",\"typeId\":\"08de2ccc-1b1f-4b83-872d-4ce51fd097f3\",\"price\":100,\"underlinePrice\":0,\"amount\":1,\"remark\":\"\",\"sortIndex\":1,\"conditionJson\":\"[]\",\"useConditionJson\":\"[]\",\"isOpenSales\":true,\"isOpenAuthorize\":false,\"foreColor\":\"#ffffff\",\"backColor\":\"#465288\",\"badge\":\"\",\"cancelMode\":1,\"isEnabled\":true,\"imgUrl\":\"\",\"isOpenRemark\":false,\"category\":4,\"subCategory\":2,\"strategyValue\":1,\"strategyMode\":1,\"isOpenExchange\":false,\"applyScenes\":[{\"applyScene\":1,\"selectState\":3},{\"applyScene\":8,\"selectState\":3},{\"applyScene\":3,\"selectState\":2},{\"applyScene\":4,\"selectState\":2},{\"applyScene\":5,\"selectState\":2},{\"applyScene\":2,\"selectState\":3},{\"applyScene\":10,\"selectState\":1}],\"methodId\":\"44c439bb-68dc-4c89-ae3d-6410ec8b3ae0\",\"numberLimitType\":0,\"purchaseLimit\":0,\"maxAccompany\":0,\"maxNumber\":1,\"dailyMaxNumber\":1,\"isLimitUserNumber\":false,\"maxBindRelative\":1,\"chargingMode\":1,\"chargingAfterDays\":0,\"passticketId\":\"21d3aa39-c50b-4c13-a78b-60d218ba37b3\",\"useMachineCategory\":3,\"machineKindIds\":[],\"machineTags\":[],\"machineIds\":[\"0aad89b9-8bde-46e3-8339-ea6b5f08373f\"],\"discountDesc\":\"\",\"taxRate\":7,\"isNoBuyDiscount\":false,\"renewalProtectDays\":0,\"renewalProtectInPrice\":0,\"renewalProtectOutPrice\":0,\"buyActivity\":{\"category\":1,\"couponInfo\":[],\"date\":[],\"remark\":\"\",\"isSelectLeveAll\":false,\"isIndeterminate\":false,\"conditionInfo\":{\"memberLevelInfo\":[],\"memberTagInfo\":[],\"newMemberDefinition\":1,\"kindInfo\":[],\"frequency\":1,\"memberRangeType\":1,\"playStoreInfo\":[],\"registerDays\":null,\"storeConsumStatisticsMethod\":1,\"playAccountInfo\":[],\"consumStatisticsMethod\":1,\"giveMethod\":1,\"limitMoney\":1,\"useRangeType\":3,\"goodsInfo\":[]}},\"useRulesJson\":\"\",\"giveConfigs\":[],\"exchangeSetts\":[]}"//setMealName:套餐名称 typeId:商品分类 price:销售价格 underlinePrice:划线价 amount:门票数 remark:商品详情信息 sortIndex:排序 conditionJson:购买条件Json useConditionJson:使用条件Json isOpenSales:是否允许销售 isOpenAuthorize:是否开启授权 foreColor:文字颜色 backColor:背景颜色 badge:角标 cancelMode:退货方式 isEnabled:是否可用 imgUrl:代表图片 isOpenRemark:是否显示详情 category:套餐类型 subCategory:套餐子类型 strategyValue:有效时间策略值 strategyMode:有效时间策略方式 isOpenExchange:是否允许兑换 applyScenes:套餐应用场景 methodId:支付方式ID numberLimitType:套餐数量限制类型 purchaseLimit:限制份数 maxAccompany:陪同人数 maxNumber:扣费一次当天可进次数 dailyMaxNumber:每天可进闸机次数 isLimitUserNumber:是否限制使用人数 maxBindRelative:绑定亲友人数 chargingMode:计费方式 chargingAfterDays:购买后多少天开始计费 passticketId:门票编码 useMachineCategory:可用机台条件分类 machineKindIds:可用机种集合 machineTags:可用机台标签集合 machineIds:可用机台集合 discountDesc:优惠描述 taxRate:税率 isNoBuyDiscount:购买不打折 renewalProtectDays:续期保护天数 renewalProtectInPrice:保护期内续期金额 renewalProtectOutPrice:保护期外续期金额 buyActivity:购买送券信息 useRulesJson:使用规则Json giveConfigs:套餐赠送配置信息 exchangeSetts:兑换配置
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐删除

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:55:24

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_passticket_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"setMealIds\":[\"635762b7-37c3-4f72-9bfa-1fb7375110df\"]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-13 13:35:49

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_passticket_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"category\":4,\"subCategory\":2,\"page\":1,\"limit\":20}" 
}//subCategory:1 计次票，2期限票 page:当前页码 limit:每页记录数, 
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"page": 0,
	"limit": 20,
	"totalPage": 2,
	"totalRecord": 22,
	"success": true,
	"msg": "",
	"code": 0,
	"data": [
        {
            // --- 核心基础信息 ---
            "setMealId": "9305f227-d14d-4a61-a8f1-c5957dd5d502",     // 【PK】套餐ID/主键
            "passticketId": "f61c9d7f-4bdc-47dc-af86-11dd977c3316",  // 【关联ID】绑定的底层计次票/门票模板ID
            "setMealName": "8888387738",                             // 商品/套餐的展示名称
            "category": 4,             // 【大类】商品一级大类枚举 (如：4-门票组合类的代码)
            "subCategory": 1,          // 【小类】具体细分种类枚举编码
            "subCategoryName": "计次票",// 【小类名称】前端UI展示的小类文案
            "typeId": "08de96d6-7101-4ab4-8c5e-78fcd671aff0",        // 所属套餐类型组或税率分组的外键ID
            "typeName": "1231",        // 类型组的名称
            "source": 1,               // 创建来源源头 (如：1-后台总部建立)
            
            // --- 价格与次数配置 ---
            "price": 9,             // 【售卖价】实际对客销售的展示价 
            "underlinePrice": 23,   // 【划线价】用于UI衬托打折的原始原价/门市价
            "amount": 8,            // 【包含额度/次数】此计次票购买后，会员将获得的核销可用次数（如8次）
            
            // --- 效期策略 ---
            "strategyMode": 1,      // 【可用策略类型】定义套票的有效期计算模式（如：1代表购买后经过x天作废 等）
            "strategyValue": 1,     // 【可用策略值】上面维度的具体值 （此处模式1搭配值1，可能指"购买后1个月内有效"或类似概念）
            
            // --- 开关控制矩阵 (重点开关) ---
            "isEnabled": true,            // 基础功能项：此项配置是否被启用 (上下架的底线逻辑)
            "isOpenSales": true,          // 是否允许前端/收银端售卖该计次票
            "isOpenExchange": false,      // 是否支持积分/虚拟币直接兑换获取
            "isOpenRemark": true,         // 前端/收银端购卡时是否弹出或可以输入备注要求
            "isOpenAuthorize": false,     // 购买该套餐时是否需要更高权限的店长/主管刷卡授权
            "isNoBuyDiscount": false,     // 设为true时，此商品不参与购物车整单打折活动（即不折商品）
            "isPrepaidOnlyBuy": false,    // 是否**仅允许**使用储值卡/会员余额购买 (排斥微信等第三方支付)
            "isResetMemberExpiry": false, // 购买此票后，是否重置/延长该会员的账户过期时间
            
            // --- 核销扣减规则 ---
            "cancelMode": 2,          // 【核销模式】例如扣次方式或过期后的失效方案
            "cancelValue": 0,         // 【核销模式配置值】配合CancelMode使用
            "numberLimitType": 0,     // 单笔购物车的加购数量限制模式
            "purchaseLimit": 0,       // 具体的限制数量数值（0代表无限制）
            "memberDelayMode": 0,     // 购买后会员延期模式（对应前面的isResetMemberExpiry的补充规则）
            "memberDelayValue": 0,    // 会员具体延期的量（如30天等）
            
            // --- 动态售卖条件限制 Json(反序列化为List<FilterRule>) ---
            "conditionJson": "[...]",  /* 核心拦截器逻辑，内部含有多个数组，例如您的JSON里定义了：
                1. DateTimeRangeCondition: 指定发售时间范围 (4月23~4月26)
                2. TimeRestrictCondition: 能够购买的具体星期、时间段
                3. LimitBuyCountCondition: 限购条件(每周期限购1件)及要求必须验证会员身份等
                4. MemberLevelCondition: 限制只能由特定会员级别ID的顾客购买，且允许散客(Guest)购买
                5. CouponCondition: 送赠券/搭配券配置信息
                6. AgreementLimitCondition: 每次购买时必须让用户签署名为《隐私政策协议》的PPA条款。
            */ 

            // --- UI展示与备注属性 ---
            "remark": "<p>12313</p>",  // 【富文本】商品图文详情备注（主要用于移动端App显示）
            "discountDesc": "",        // 打折或优惠的促销标签文本
            "foreColor": "#743535",    // 前端列表/卡包展示时渲染的字体色
            "backColor": "#465288",    // 前端渲染的卡片主背景色
            "badge": "2",              // 角标(UI上小红点或提示标记)
            "imgUrl": "",              // 配图/封面图的 OSS 图片地址
            "lastOperator": "Yearning",// 最后一位在后端修改此纪录的操作员工名
            "sortIndex": 9,            // 列表排序权重 (越小越靠前等规则)
            
            // --- 时间字段 ---
            "createTime": "2026-04-09 10:06:27.948", // 记录在数据库创建的时间
            "updateTime": "2026-04-10 15:57:15.197", // 最后被修改时间
            "salesStartTime": "2026-04-23 00:00:00", // (与condition联动)独立字段标识可售日期起点
            "salesEndTime": "2026-04-26 23:59:59",   // 停售日期终点
            
            // --- （海外）财税结构化体系 ---
            "taxRate": 6.36,            // 【单品税率】当前计次票本身的独立税点 (6.36%)
            "setmealTypeTaxRate": 6.36, // 【归属分类税率】其所属分类级别设置的通用税点 (通常用作级联兜底)
            "taxRateType": 1,           // 【税率类型】税前价外税 / 税后价内税 (1可能代表包含税或者外加税)
            "afterTaxPrice": 9.57,      // 【税后计算价】基于原售卖价 9元 加上 6.36% 税率等演算后最终消费者或财务台账认定的价格 (如 9 * 1.0636 ≈ 9.57)
            
            // --- 物联网游艺设备附送体系 (游戏机厅/乐园属性) ---
            "nativecoin1": 0,     // 购买该票附赠的 实物币/本金币数
            "givecoin1": 0,       // 购买该票附赠的 赠币数
            "coinbal2": 0,        // 购买该票附带相关币种的增量
            "integral": 0,        // 购买此票额外赠与的 会员积分
            "lottery": 0,         // 购买后奖励的 彩票数/代金券数
            "bluelottery": 0,     // 奖励特别类彩票（蓝彩）数值
            "physicalcard": 0,    // 连带发起的实体卡增量相关
            "storeextend04": 0,   // 店铺/商户备用业务扩展字段 4
            "storeextend05": 0,   // 商户备用业务扩展字段 5

            "applyScenes": null,  // 适用场景(例如：特定门店/子设备游玩场景)的补充集合
            "buyActivity": null,  // 挂载的营销满减或关联活动项集合
            "methodId": null      // 特殊归类Method方法ID
        },
        // ... 后面的列表结构复用上述字段
		{
			"setMealId": "9305f227-d14d-4a61-a8f1-c5957dd5d502",
			"passticketId": "f61c9d7f-4bdc-47dc-af86-11dd977c3316",
			"setMealName": "8888387738",
			"category": 4,
			"subCategory": 1,
			"subCategoryName": "计次票",
			"typeId": "08de96d6-7101-4ab4-8c5e-78fcd671aff0",
			"typeName": "1231",
			"source": 1,
			"price": 9,
			"underlinePrice": 23,
			"amount": 8,
			"strategyMode": 1,
			"strategyValue": 1,
			"isEnabled": true,
			"isOpenSales": true,
			"isOpenExchange": false,
			"isOpenRemark": true,
			"isOpenAuthorize": false,
			"isNoBuyDiscount": false,
			"isPrepaidOnlyBuy": false,
			"isResetMemberExpiry": false,
			"cancelMode": 2,
			"cancelValue": 0,
			"numberLimitType": 0,
			"purchaseLimit": 0,
			"memberDelayMode": 0,
			"memberDelayValue": 0,
			"conditionJson": "[{\"conditionKey\":\"DateTimeRangeCondition\",\"startTime\":\"2026-04-23 00:00:00\",\"endTime\":\"2026-04-26 23:59:59\"},{\"conditionKey\":\"TimeRestrictCondition\",\"canBuyWeekDay\":[1,2,3,4,5,6,0],\"canBuyTime\":[{\"startTime\":\"00:00:00\",\"endTime\":\"23:59:59\"}]},{\"conditionKey\":\"LimitBuyCountCondition\",\"limitCycleType\":1,\"limit\":1,\"isVerifyIdentity\":false,\"isVerifyBirthday\":false,\"isLimitAge\":false,\"ages\":[],\"daysBeforeBirthday\":1},{\"conditionKey\":\"MemberLevelCondition\",\"isFitCanUse\":true,\"isGuestCanUse\":true,\"canUseGuestLevels\":[\"08dd9132-9fde-42a1-8fa3-d8316aea30cb\"],\"isMemberCanUse\":true,\"isAllowAllMemberLevel\":false,\"canUseMemberLevels\":[\"08de4123-eee0-4528-838d-9c64188fc8cd\",\"1a48dba8-7e36-40a8-a139-c4a3dd2787ca\"]},{\"conditionKey\":\"CouponCondition\",\"coupons\":[{\"couponId\":\"f83da533-4eb2-48e3-913b-598410d66584\",\"couponName\":\"去问问\"}]},{\"conditionKey\":\"AgreementLimitCondition\",\"agreementId\":\"e9c64476-cd41-486e-a3c3-83c1607a8564\",\"agreementName\":\"隐私政策协议\",\"signRulesName\":\"每次需签署\",\"agreementCode\":\"SYS_PPA_001\"}]",
			"remark": "<p>12313</p>",
			"discountDesc": "",
			"foreColor": "#743535",
			"backColor": "#465288",
			"badge": "2",
			"imgUrl": "",
			"lastOperator": "Yearning",
			"sortIndex": 9,
			"createTime": "2026-04-09 10:06:27.948",
			"updateTime": "2026-04-10 15:57:15.197",
			"salesStartTime": "2026-04-23 00:00:00.000",
			"salesEndTime": "2026-04-26 23:59:59.000",
			"salesRangeDate": null,
			"listingStatus": 0,
			"isOpenReview": false,
			"reviewRemark": "",
			"taxRate": 6.36,
			"setmealTypeTaxRate": 6.36,
			"taxRateType": 1,
			"afterTaxPrice": 9.57,
			"nativecoin1": 0,
			"givecoin1": 0,
			"coinbal2": 0,
			"integral": 0,
			"lottery": 0,
			"bluelottery": 0,
			"physicalcard": 0,
			"storeextend04": 0,
			"storeextend05": 0,
			"applyScenes": null,
			"buyActivity": null,
			"methodId": null
		}
	],
	"desc": ""
}
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:55:17

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_passticket_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"setmealId\":\"1e9f37de-6f9d-4ca7-8a16-005d36e63f72\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 优惠卷列表查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-13 13:43:31

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"action": "coupon_marketcoupon_list",
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"startTime\":\"2023-01-16 00:00:00\",\"endTime\":\"2026-04-26 00:00:00\",\"couponName\"\"\":,\"page\":1,\"limit\":20}"//都是可选参数
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
    "id": "916908cb-4810-4797-bbcc-ff986b6a3fbc", // 【主键】卡券模板的唯一标识 ID
    "chainId": 2,          // 归属的总流水线/连锁总部 ID
    "shopId": 13256,       // 归属的具体建立门店的 ID
    "sourceName": "门店",  // 券来源说明
    "employeeName": "员工名",  // 最初建立此模板的员工名
    "lastOperator": "员工名",  // 最后一次修改配置的操作员名

    // ====== 【券类别与核心属性层】 ======
    "category": 5,                     // 【大类枚举】5 代表“储值兑换券”机制
    "categoryName": "储值兑换券",      // 类别名称
    "couponName": "自动核销弹珠券",    // 券名称（展示给前端用户及管理端看的名字）
    "remark": "",                      // 券后台文字备注
    "isEnabled": true,                 // 【开关】此券模板是否可用，false即代表停发/下架
    "useRangeType": 1,                 // 【适用门店范围】通常1代表“全国/全连锁通用”，其他可能代表只在指定门店组使用

    // ====== 【生命周期效期控制层】 ======
    "effectiveMode": 1,                // 【生效模式】1 通常代码相对模式（即领券后X日有效，而不是特定的某年某月某日）
    "effectiveModeName": "立即生效",   // 对应上面枚举的中文涵义
    "delayDays": 0,                    // 延迟生效天数（0 表示领券后立马能用）
    "days": 1,                         // 有效天数（结合上面的0，表示：领取后立即生效，且有效期为 1 天）
    "startTime": "2026-03-24 15:04:22.226", // 若采用绝对日期模式，这里标识活动的起始时间点
    "endTime": "2026-03-24 15:04:22.226",   // 绝对日期模式的废止时间点

    // ====== 【核销与使用场景控制】 ======
    "writeoffMode": 3,                 // 【核销模式】3 代表最核心的行为枚举对应下方
    "writeOffModeName": "自动核销",    // 自动核销意味着发放到用户账后，不需要用户点“使用”，系统监听后会自动走核销流程
    "isUsedOnline": false,             // 是否允许在C端线上商城/小程序主动用券抵扣
    "isUsedOffline": false,            // 是否允许在线下收银台台面核销抵扣
                                       //

   
    "exchangeStoreInfo": [
        {
            "shopAcctId": "03dfd8e0-9058-11ef-b4b4-1070fda8acec", // 门店支持的账本体系中的某特定底层账户ID
            "amount": 3,                          // 获得的额度值：核销一张券发 3 颗弹珠 / 3单位资产
            "storeCategory": 21,                  // 对应的资产组类别编码：21
            "storeCategoryName": "自定义储值2",   // 账户名字（这里的自定义储值2应该隐式用作了存放“弹珠”的业务）
            "effectiveMode": 0,                   // 这笔“换来的储值”的有效期模式（0可能指永久或随会员卡生命周期）
            "effectiveModeName": "0",             
            "enableDays": 0                       // 入账资产本身的有效天数（0则无限制）
        }
    ],

    "exchangeGoodsInfo": [],   // 用于“实物兑换券”，配置能换取什么真正的实物商品，当前为空
    "discountInfo": null,      // 用于“折扣券”，配置如打折力度或满减封顶等，当前为空
    "qualificationInfo": [],   // 用于获取资质过滤，配置（哪些级别/标签会员）才能获这张券
    "writeoffGoodsInfo": [],   // 配置该券“必须搭配买什么东西时才能触发核销”
    "rangeGoodsInfo": [],      // 用于“代金券/满减券”，圈定能用于抵扣的商品分类或白名单范围
    "updateTime": "2026-03-24 15:04:22.232", // 最后变更时间
    "createTime": "2026-03-24 15:04:22.232"  // 首次建档时间
}

```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐销售终端批量绑定

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:10:23

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_batch_apply_scene",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"deviceId\":\"d2eac84b-8c1f-4314-b2cb-2b983c43c208\",\"applyScene\":1,\"setmealIds\":[\"1e9f37de-6f9d-4ca7-8a16-005d36e63f72\"]}"//applyScene:场景值
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | {{sys_appid}} | string | Yes | - |
| action | setmeal_batch_apply_scene | string | Yes | - |
| version | {{sys_version}} | string | Yes | - |
| timestamp | {{sys_timestamp}} | string | Yes | - |
| sign | {{auto_sign}} | string | Yes | - |
| body | {"deviceId":"d2eac84b-8c1f-4314-b2cb-2b983c43c208","applyScene":1,"setmealIds":["1e9f37de-6f9d-4ca7-8a16-005d36e63f72"]} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐销售终端批量解绑

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:11:14

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_batch_unapply_scene",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"deviceId\":\"17bb0e29-cd14-4718-89ac-5bc825fdcc37\",\"applyScene\":1,\"setmealIds\":[\"1e9f37de-6f9d-4ca7-8a16-005d36e63f72\"]}"//applyScene:场景值
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | {{sys_appid}} | string | Yes | - |
| action | setmeal_batch_apply_scene | string | Yes | - |
| version | {{sys_version}} | string | Yes | - |
| timestamp | {{sys_timestamp}} | string | Yes | - |
| sign | {{auto_sign}} | string | Yes | - |
| body | {"deviceId":"d2eac84b-8c1f-4314-b2cb-2b983c43c208","applyScene":1,"setmealIds":["1e9f37de-6f9d-4ca7-8a16-005d36e63f72"]} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐已设置终端详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:55:15

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_applydevices_get",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"setmealId\":\"1e9f37de-6f9d-4ca7-8a16-005d36e63f72\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 套餐条件-协议列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:53:30

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "agreement_manager_agreement_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 所有营销卡券列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-11 10:17:13

> Update Time: 2026-04-11 10:45:06

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "coupon_marketcoupon_alllist",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"page\":1,\"limit\":20}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 计次票、期限票-分组

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:51:59

> Update Time: 2026-04-10 10:12:25

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 票套餐分组税信息接口

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:11:44

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",	
	"action": "setmeal_type_taxinfo_get",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"typeId\":\"08dd821c-783e-41a4-8322-9da473210684\"}"//typeId:分组编码
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐分组新增

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:12:02

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "setmeal_type_add",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"typeName\":\"891231988\",\"sortIndex\":0,\"category\":1,\"isEnabled\":true,\"taxCategoryId\":\"08de0c8d-385c-45a9-883e-269f630d5314\"}"//sortIndex:排序 category:套餐类型 isEnabled:是否启用 taxCategoryId:税种编码
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 票套餐分组下拉查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 09:56:31

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"action": "setmeal_type_select",
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 税费配置列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-11 10:17:13

> Update Time: 2026-04-11 10:47:40

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "basic_taxcategory_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"startTime\":\"2023-01-16 00:00:00\",\"endTime\":\"2026-04-26 00:00:00\",\"couponName\"\"\":,\"page\":1,\"limit\":20}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | basic_taxcategory_list | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"startTime":"2023-01-16 00:00:00","endTime":"2026-04-26 00:00:00","couponName""":,"page":1,"limit":20} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 预约套餐

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:09:50

> Update Time: 2026-04-10 10:09:50

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 预约套餐修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:12:32

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_base_update",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"179a075c-4992-46b6-8699-1048ee838f00\",\"employeeId\":\"aee3313b-f0a1-4d79-9b0b-9d2053b11179\",\"employeeName\":\"Yearning\",\"goodsName\":\"自定义定金为0套餐\",\"groupId\":\"872140a5-fac5-44a9-b4b1-d86d7672e68f\",\"groupName\":\"ccx专用\",\"goodsCode\":\"\",\"sellMoney\":100,\"goodsType\":0,\"ticketNum\":1,\"effectiveType\":0,\"effectiveCycle\":[1,2,3,4,5,6,7],\"advanceDays\":1,\"noReservationDays\":0,\"noReservationTip\":\"\",\"adultMoney\":0,\"childrenMoney\":0,\"adolescentMoney\":0,\"timeOutMin\":1,\"timeOutMoney\":0,\"timeOutMostMoney\":0,\"category\":0,\"isOpenDeposit\":true,\"isDepositAmountCustomize\":true,\"depositRatio\":0,\"frontMoney\":0,\"finalMoney\":100,\"totalQty\":0,\"exceedMoney\":0,\"exceedFrontMoney\":0,\"exceedFinalMoney\":0,\"exceedAuditMoney\":4,\"exceedAuditFrontMoney\":0,\"exceedAuditFinalMoney\":4,\"exceedChildrenMoney\":4,\"exceedChildrenFrontMoney\":0,\"exceedChildrenFinalMoney\":4,\"avgChildrenNum\":1,\"mostCustodianNum\":1,\"describe\":\"\",\"sortIndex\":1,\"isEnabled\":true,\"overseaSubscribePeriod\":[{\"id\":\"b682b100-15e1-43ac-befe-2f98ca7729e9\",\"employeeId\":\"aee3313b-f0a1-4d79-9b0b-9d2053b11179\",\"employeeName\":\"Yearning\",\"subscribeBaseId\":\"179a075c-4992-46b6-8699-1048ee838f00\",\"startTime\":\"2026-03-19 00:00:00\",\"endTime\":\"2026-03-19 00:00:00\",\"startHour\":0,\"startMin\":0,\"endHour\":0,\"endMin\":0,\"limitNum\":0,\"cycleType\":1,\"isAllDay\":false,\"ticketCategory\":0}],\"overseaSubscribeProject\":[{\"id\":\"a9d43ed1-a126-4385-a7fd-f176539423a2\",\"overseaSubscribePeriod\":[],\"employeeId\":\"00000000-0000-0000-0000-000000000000\",\"employeeName\":\"\",\"projectName\":\"房间ccx\",\"limitNum\":15,\"addressDescribe\":\"地点\",\"sort\":1,\"describe\":\"说明\",\"imgUrl\":\"https://oss.bdszh.vip/app/jingjian/20241118/e989809ba331401cb9167e44cc765d2d.png\"}],\"taxRate\":10,\"exceedRuleType\":0,\"excessFeePaymentMode\":0,\"expandJson\":\"\",\"themeRoomMapping\":[{\"id\":\"8a1f821f-062d-45d2-841a-e0a1fbe6950c\",\"themeName\":\"海洋主题房-更新\",\"themeImageUrl\":\"https://oss.bdszh.vip/app/jingjian/20250711/99a2f0e5d2ea43ff9133a16781ae29fa.png\",\"sort\":2}],\"imageUrl\":\"\",\"entryExitCount\":1}" //employeeId:员工编码 employeeName:员工姓名 goodsName:商品名称 groupId:分组编码 groupName:分组名称 sellMoney:售价 goodsType:商品类型 ticketNum:门票次数 effectiveType:有效期类型 effectiveCycle:有效周期 advanceDays:可提前预约天数 noReservationDays:提前多少天不可预约 noReservationTip:不可预约提示 adultMoney:成人金额 childrenMoney:儿童金额 adolescentMoney:青少年金额 timeOutMin:超时时间 timeOutMoney:超时金额 timeOutMostMoney:超时封顶金额 category:套餐类型 isOpenDeposit:是否开启定金 isDepositAmountCustomize:是否定金金额自定义 depositRatio:定金比例 frontMoney:定金金额 finalMoney:尾款金额 totalQty:销售总数量 exceedMoney:超出人数全款 exceedFrontMoney:超出人数定金 exceedFinalMoney:超出人数尾款 exceedAuditMoney:成人超出人数全款 exceedAuditFrontMoney:成人超出人数定金 exceedAuditFinalMoney:成人超出人数尾款 exceedChildrenMoney:儿童超出人数全款 exceedChildrenFrontMoney:儿童超出人数定金 exceedChildrenFinalMoney:儿童超出人数尾款 avgChildrenNum:每儿童人数 mostCustodianNum:每儿童最多监护人 describe:描述 sortIndex:排序 isEnabled:是否可用 overseaSubscribePeriod:预约时段配置 overseaSubscribeProject:预约项目配置 taxRate:税率 exceedRuleType:超额规则类型 expandJson:扩展字段 themeRoomMapping:主题房间映射 imageUrl:图片地址 entryExitCount:门票进出次数
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐分组创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:16:33

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_group_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"groupName\":\"21318793\",\"sortIndex\":3}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:12:13

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_base_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"094eec89-9da4-4b97-9118-f021d5f319fe\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:23

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_base_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"page\":1,\"limit\":20}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:13:30

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_base_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"goodsName\":\"\",\"groupId\":\"e8554d64-35e3-4bb7-8612-80d107f0230b\",\"sellMoney\":\"2\",\"goodsType\":0,\"ticketNum\":1,\"effectiveType\":0,\"effectiveCycle\":[1,2,3,4,5,6,7],\"advanceDays\":\"7\",\"noReservationDays\":\"8\",\"adultMoney\":0,\"childrenMoney\":0,\"adolescentMoney\":0,\"timeOutMin\":30,\"entryExitCount\":20,\"timeOutMoney\":10,\"timeOutMostMoney\":200,\"category\":0,\"isOpenDeposit\":false,\"isDepositAmountCustomize\":false,\"depositRatio\":100,\"frontMoney\":2,\"finalMoney\":0,\"totalQty\":\"3\",\"exceedRuleType\":0,\"exceedMoney\":0,\"exceedFrontMoney\":0,\"exceedFinalMoney\":0,\"exceedAuditMoney\":5,\"exceedAuditFrontMoney\":5,\"exceedAuditFinalMoney\":0,\"exceedChildrenMoney\":6,\"exceedChildrenFrontMoney\":6,\"exceedChildrenFinalMoney\":0,\"avgChildrenNum\":1,\"mostCustodianNum\":1,\"isEnabled\":true,\"sortIndex\":1,\"taxRate\":\"4\",\"themeRoomMapping\":[{\"id\":\"8a1f821f-062d-45d2-841a-e0a1fbe6950c\",\"themeName\":\"海洋主题房-更新\",\"themeImageUrl\":\"https://oss.bdszh.vip/app/jingjian/20250711/99a2f0e5d2ea43ff9133a16781ae29fa.png\",\"sort\":2,\"isEnabled\":true,\"createTime\":\"2025-06-09 15:23:58.000\",\"updateTime\":\"2025-07-11 14:56:04.000\"}],\"imageUrl\":\"https://oss.bdszh.vip/app/jingjian/20260408/a0962b5b77804e86aa8980c0b7aac2b3.jpg\",\"overseaSubscribePeriod\":[{\"startTime\":\"2026-04-08 00:00:00\",\"endTime\":\"2026-04-08 00:00:00\",\"limitNum\":0,\"cycleType\":1}],\"overseaSubscribeProject\":[{\"id\":\"d6343ce9-2a56-4669-9be7-963bece710aa\",\"chainId\":2,\"shopId\":13256,\"employeeId\":\"3ee2f604-2e29-48bc-81d1-0a9351482d82\",\"employeeName\":\"陈志楷\",\"isEnabled\":true,\"isDelete\":false,\"updateTime\":\"2026-01-17 15:57:43.000\",\"createTime\":\"2025-07-21 15:59:41.000\",\"projectName\":\"美食主题\",\"limitNum\":18,\"addressDescribe\":\"1102\",\"sort\":2,\"describe\":\"吃啥\",\"isChecked\":true}]}"
	//groupId:分组编码 sellMoney:售价 goodsType:商品类型 ticketNum:门票次数 effectiveType:有效期类型 effectiveCycle:有效周期 advanceDays:可提前预约天数 noReservationDays:提前多少天不可预约 adultMoney:成人金额 childrenMoney:儿童金额 adolescentMoney:青少年金额 timeOutMin:超时时间 entryExitCount:门票进出次数 timeOutMoney:超时金额 timeOutMostMoney:超时封顶金额 category:类别 isOpenDeposit:是否开启定金 isDepositAmountCustomize:是否定金金额自定义 depositRatio:定金比例 frontMoney:定金金额 finalMoney:尾款金额 totalQty:套餐总人数 exceedRuleType:超额规则类型 exceedMoney:超出人数全款 exceedFrontMoney:超出人数定金 exceedFinalMoney:超出人数尾款 exceedAuditMoney:成人超出人数全款 exceedAuditFrontMoney:成人超出人数定金 exceedAuditFinalMoney:成人超出人数尾款 exceedChildrenMoney:儿童超出人数全款 exceedChildrenFrontMoney:儿童超出人数定金 exceedChildrenFinalMoney:儿童超出人数尾款 avgChildrenNum:每儿童人数 mostCustodianNum:每儿童最多监护人 isEnabled:是否可用 sortIndex:排序 taxRate:税率 themeRoomMapping:主题房间映射 imageUrl:图片地址 overseaSubscribePeriod:预约时段配置 overseaSubscribeProject:预约项目配置
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 预约套餐-分组

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:15:45

> Update Time: 2026-04-10 10:15:45

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 预约套餐分组下拉查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:15:55

```text
No description
```

**API Status**

> Completed

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_group_select",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐分组详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:15:56

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_group_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"8886f620-c737-4ce0-bb84-5790c1d968d0\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | oversea_subscribe_group_details | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"id":"8886f620-c737-4ce0-bb84-5790c1d968d0"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐分组修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:16:24

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_group_update",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"8886f620-c737-4ce0-bb84-5790c1d968d0\",\"groupName\":\"aaaaa8CCCC\",\"sortIndex\":1}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-分组列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:53:47

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_group_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"page\":1,\"limit\":20}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 预约套餐-派对房间

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:17:01

> Update Time: 2026-04-10 10:17:01

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 预约套餐派对房间创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:14:31

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_project_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"projectName\":\"213113123\",\"limitNum\":1,\"addressDescribe\":\"88\",\"describe\":\"8\",\"sort\":1,\"imgUrl\":\"https://oss.bdszh.vip/app/jingjian/20241118/e989809ba331401cb9167e44cc765d2d.png\",\"overseaSubscribePeriod\":[{\"startTime\":\"2026-04-09 00:00:00\",\"endTime\":\"2026-04-09 00:00:00\",\"cycleType\":1},{\"startTime\":\"2026-04-09 00:54:00\",\"endTime\":\"2026-04-09 11:54:12\",\"cycleType\":3},{\"startTime\":\"2026-04-09 11:54:22\",\"endTime\":\"2026-04-09 23:54:25\",\"cycleType\":3}]}" //limitNum:限制人数/数量 addressDescribe:地址描述 describe:项目描述 sort:排序 imgUrl:图片地址 overseaSubscribePeriod:预约时段配置
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐派对房间详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:18:36

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_project_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\": \"a3885b8b-9449-45dc-9178-05b62bc48a7d\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐派对房间修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:14:45

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_project_update",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"00522a70-4fe5-47b3-bb82-474d47a4d1e2\",\"projectName\":\"213113123\",\"limitNum\":1,\"addressDescribe\":\"88\",\"sort\":1,\"describe\":\"8\",\"imgUrl\":\"https://oss.bdszh.vip/app/jingjian/20241118/e989809ba331401cb9167e44cc765d2d.png\",\"overseaSubscribePeriod\":[{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":1},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":2},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":3},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":4},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":5},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":6},{\"startTime\":\"2026-04-09 01:23:44\",\"endTime\":\"2026-04-09 23:23:44\",\"cycleType\":7}]}"
	 //limitNum:限制人数/数量 addressDescribe:地址描述 describe:项目描述 sort:排序 imgUrl:图片地址 overseaSubscribePeriod:预约时段配置
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-派对房间删除

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:28

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_project_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"ids\":[\"a3885b8b-9449-45dc-9178-05b62bc48a7d\"]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-派对房间列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:37

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_project_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"page\":1,\"limit\":20}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 预约套餐-商品

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:23:12

> Update Time: 2026-04-10 10:23:12

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 预约套餐-商品分类分组创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:15:24

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_goods_category_group_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"groupName\":\"ccasa\",\"sort\":0,\"category\":1,\"isEnabled\":true,\"taxId\":\"08dd8c3d-d638-4a14-83c1-ea0bc7c8dd8d\"}" //sort:排序 category:套餐类型 isEnabled:是否可用
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-商品分类删除

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:08

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_goods_category_group_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"ids\":[\"558eabb3-b6df-4d64-9f94-32abd77c4486\"]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-商品分类-分组详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:10

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_goods_category_group_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"043b1983-b552-4688-9f5c-f560ec1dfe04\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-商品分类列表 

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:12

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_goods_category_group_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"limit\":99999,\"page\"=1}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-商品分类分组-修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:52:14

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_goods_category_group_update",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"043b1983-b552-4688-9f5c-f560ec1dfe04\",\"groupName\":\"6.66%税组8\",\"sort\":0,\"isEnabled\":true,\"taxId\":\"08ddf043-f955-4f5a-832f-55d6efcf7e3f\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-加购商品-添加商品-列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 13:16:47

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_add_goods_add_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"SubscribeBaseId\":\"094eec89-9da4-4b97-9118-f021d5f319fe\",\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\"}"
	 //categoryGroupId:商品分组ID SubscribeBaseId门票id
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 加购商品-主数据列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-11 10:17:13

> Update Time: 2026-04-11 10:49:30

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_goodsmanage_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | oversea_goodsmanage_list | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"categoryGroupId":"f9d40e5b-61a1-4561-a306-88913b5d536b"} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-加购商品-添加商品

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-11 10:45:11

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_goods_mapping_save",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"subscribeBaseId\":\"094eec89-9da4-4b97-9118-f021d5f319fe\",\"items\":[{\"id\":\"81abb44a-13fb-4ea6-8cad-22b43d365ea5\",\"goodsName\":\"测试商品\",\"goodsNo\":\"123\",\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\",\"describe\":\"用于测试\",\"sort\":0,\"imgUrl\":\"https://oss.bdszh.vip/app/jingjian/20250825/b880ec1abc4b4bfab12ff8b2ca725216.png\",\"specs\":[{\"isCheck\":true,\"mappingId\":null,\"id\":\"fb75e747-8f3b-49e8-884c-9a0ed8fe4b49\",\"specName\":\"A类\",\"price\":50,\"sort\":0,\"count\":0,\"checked\":true}],\"goodsId\":\"81abb44a-13fb-4ea6-8cad-22b43d365ea5\"},{\"id\":\"b4e16d9b-731f-403e-96f1-394b2943b706\",\"goodsName\":\"美食1\",\"goodsNo\":\"1000\",\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\",\"describe\":\"123\",\"sort\":0,\"imgUrl\":\"https://oss.bdszh.vip/app/jingjian/20250721/6679a82302d349f5bd630369bb5e4fc6.png\",\"specs\":[{\"isCheck\":true,\"mappingId\":null,\"id\":\"1eefb675-3a2d-4818-bcbc-5364ce9a62b4\",\"specName\":\"大杯\",\"price\":6,\"sort\":0,\"count\":0,\"checked\":true}],\"goodsId\":\"b4e16d9b-731f-403e-96f1-394b2943b706\"}]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-加购商品-删除

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-11 10:17:13

> Update Time: 2026-04-11 10:46:13

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_goodsmanage_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"ids\":[\"5c94a200-738f-4182-abbc-e6238b4cb1f2\"]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-商品分类-商品创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-11 10:59:25

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",	
	"action": "oversea_goods_create",
"version": "11.7.1",
"timestamp": "1723822967585",
"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	  "body": "{\"goodsName\":\"222\",\"goodsNo\":\"44324\",\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\",\"describe\":\"324\",\"imgUrl\":\"\",\"sort\":0,\"isEnabled\":true,\"isSystem\":false,\"specs\":[{\"specName\":\"34\",\"price\":34,\"sort\":2}]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-移除加购商品的映射关系 

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-11 10:59:27

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_goods_mapping_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"53ca4e7d-1784-466e-bade-ac10b9db8cd1\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 加购商品-映射列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-11 10:59:29

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",	
	"action": "oversea_subscribe_add_goods_mapping_list",
"version": "11.7.1",
"timestamp": "1723822967585",
"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"subscribeBaseId\":\"179a075c-4992-46b6-8699-1048ee838f00\",\"categoryGroupId\":\"f9d40e5b-61a1-4561-a306-88913b5d536b\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 预约套餐-主题房间

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:44:20

> Update Time: 2026-04-10 10:53:19

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

### 预约套餐-主题房间创建

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:46:54

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_themeroom_create",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"themeName\":\"999888\",\"themeImageUrl\":\"https://oss.bdszh.vip/app/jingjian/20250725/81acd37f659740c1befa992707632ca0.png\",\"sort\":0}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-主题房间删除

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:47:13

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_themeroom_delete",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"ids\":[\"2ac07b28-d8c5-4aa7-8d30-c72987e4b32b\"]}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-主题房间列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:49:56

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_themeroom_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-主题房间修改

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:50:25

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "{{sys_appid}}",
	"action": "oversea_subscribe_themeroom_update",
	"version": "{{sys_version}}",
	"timestamp": "{{sys_timestamp}}",
	"sign": "{{auto_sign}}",
	"body": "{\"id\":\"c099aa5c-6725-4807-a5b5-c93cff0bf0dd\",\"themeName\":\"88883123218882\",\"themeImageUrl\":\"https://oss.bdszh.vip/app/jingjian/20250725/81acd37f659740c1befa992707632ca0.png\",\"sort\":0,\"isEnabled\":true,\"updateTime\":\"2026-04-09 15:30:45.000\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

### 预约套餐-主题房间详情

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-10 10:47:38

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "oversea_subscribe_themeroom_details",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"c099aa5c-6725-4807-a5b5-c93cff0bf0dd\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 套餐相关的状态码

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-13 10:11:55

> Update Time: 2026-04-13 10:34:47

#### 1. 业务模式与处理方式类

##### effectiveMode (生效模式)

**永久有效: 1,指定时长: 2**

**指定时长: 2**

**[object Object]**

##### cancelMode (核销方式 / 返回方式)

**随时退: 1,不可退: 2,指定时间: 3**

**[object Object]**

**指定时间: 3**

**[object Object]**

##### rateType (税率类型 - 位于英文版模块中)

**按百分比: 1,按固定金额: 2**

**按固定金额: 2**

**[object Object]**

##### source (来源归属)

**门店: 1,集团: 2**

**集团: 2**

**[object Object]**

##### timeIconEffectiveMode (时间币的生效模式)

**天: 1,小时: 2,分钟: 3**

**[object Object]**

**分钟: 3**

**[object Object]**

##### timePassticketOverTimeRuleMode (计时套餐超时扣减规则)

**统一规则: 1,阶梯规则: 2**

**阶梯规则: 2**

**[object Object]**

##### selectState (通用选择状态校验)

**未选中: 1,半选中: 2,全选中: 3**

**[object Object]**

**全选中: 3**

**[object Object]**

#### 2. 套餐商品体系（大类/子类及券）

##### category (通用一级资源大类)

**代币: 1,限时币: 3,门票: 4,预存款: 6**

**门票: 4**

**[object Object]**

**预存款: 6**

**[object Object]**

##### mealType (内部商品餐组类型)

**代币: 1,点数: 2,限时币: 3,门票: 4,优惠劵: 5**

**[object Object]**

**门票: 4**

**[object Object]**

**优惠劵: 5**

**[object Object]**

##### couponCategory (优惠券分类表)

**代金券: 1,折扣券: 2,资格券: 3,体验券: 4,储值兑换券: 5,实物商品兑换券: 6**

**体验券: 4**

**[object Object]**

**储值兑换券: 5**

**[object Object]**

**实物商品兑换券: 6**

**[object Object]**

##### ticketCategory (门票主要大类)

**计次票: 1,期限票: 2**

**期限票: 2**

**[object Object]**

##### ticketSubCategory (门票子集细分)

**计次票: 1,期限票: 2,计时票: 3**

**[object Object]**

**计时票: 3**

**[object Object]**

##### iconSubCategory (代币性质细分)

**本币: 1**

**[object Object]**

##### timeStoreCategory (基于时间维度的库存类型)

**本币: 1,点数: 4,元: 15**

**[object Object]**

**元: 15**

**[object Object]**

##### combinationType (组合套餐的结构配比标识)

**组合套餐: 0,入会套餐: 1,等级变更套餐: 2**

**[object Object]**

**等级变更套餐: 2**

**[object Object]**

#### 3. 约束限制与策略时间类

##### ticketChargingMode (门票计费生效触发条件)

**购买后立即生效: 1,指定多少天后开始生效: 2,第一次使用后开始生效: 3,指定日期有效: 4**

**第一次使用后开始生效: 3**

**[object Object]**

**指定日期有效: 4**

**[object Object]**

##### ticketStrategyMode (门票统筹有效时间策略)

**天: 1,周: 2,月: 3,年: 4**

**月: 3**

**[object Object]**

**年: 4**

**[object Object]**

##### termTicketStrategyMode (期限票专属时间策略)

**天: 1,周: 2,月: 3,年: 4**

**月: 3**

**[object Object]**

**年: 4**

**[object Object]**

##### timeTicketStrategyMode (计时票专属时间策略)

**小时: 5**

**[object Object]**

##### numberLimitType (次数与数量底线校验规则)

**不限: 0,限制份数: 1**

**限制份数: 1**

**[object Object]**

#### 4. 应用终端与运维生命周期类

##### setMealApplyScene (套餐发行/首发业务场景)

**收银台套餐销售: 1,小程序套餐销售: 2,小智8会员充值: 3,小智8现金购币: 4,小智8在线购币: 5,POS机套餐销售: 8,售票网站: 10**

**[object Object]**

**小智8在线购币: 5**

**[object Object]**

**POS机套餐销售: 8**

**[object Object]**

**售票网站: 10**

**[object Object]**

##### applyScenes (应用场景使用端)

**收银台: 1,小程序: 2,会员充值: 3,现金购币: 4,在线购币: 5,POS机: 8,自助设备: 99**

**[object Object]**

**在线购币: 5**

**[object Object]**

**POS机: 8**

**[object Object]**

**自助设备: 99**

**[object Object]**

**Query**

# 文件

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 10:57:08

> Update Time: 2026-04-10 10:57:08

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 上传图片

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-10 09:10:17

> Update Time: 2026-04-11 13:12:41

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/upload

**Method**

> POST

**Content-Type**

> form-data

**Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| file | - | file | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
{
	"success": true,
	"msg": "上传成功",
	"code": 0,
	"data": "https://oss.bdszh.vip/app/jingjian/13256/openapi/7ee9b7dfe7c44a9080bb5ffa28fcec18.jpeg",
	"desc": ""
}
```

* 失败(404)

```javascript
No data
```

**Query**

# 支付

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:09

> Update Time: 2026-04-14 10:52:09

```text
No description
```

**Folder Param Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Query**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Param Body**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| No parameters |

**Folder Auth**

> Inherit auth from parent

**Query**

## 获取支付方式列表 

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 10:54:39

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "system_payment_method_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"sortField\":\"SortIndex\",\"sortType\":\"asc\",\"page\":1,\"limit\":999999999}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 线上支付方式下拉查询

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 10:55:10

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",	
	"action": "system_payment_method_online_select",
"version": "11.7.1",
"timestamp": "1723822967585",
"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 门店支付方式列表

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 10:58:36

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "system_payment_method_list",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"sortField\":\"sortIndex\",\"sortType\":\"asc\",\"page\":1,\"limit\":999999999}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 新增门店支付方式 

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 10:59:32

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "system_payment_method_add",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"methodName\":\"QQQ1231\",\"sortIndex\":1,\"isEnabled\":true,\"remark\":\"\"}"
}
```

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| appId | 8c9f2200a1834c6fb306682281e293e3 | string | Yes | - |
| action | system_payment_method_add | string | Yes | - |
| version | 11.7.1 | string | Yes | - |
| timestamp | 1723822967585 | string | Yes | - |
| sign | 2BC1B7C3A7D076458B1C7C1AB7089E2D | string | Yes | - |
| body | {"methodName":"QQQ1231","sortIndex":1,"isEnabled":true,"remark":""} | string | Yes | - |

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 修改门店支付方式

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 11:00:15

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
	"appId": "8c9f2200a1834c6fb306682281e293e3",
	"action": "system_payment_method_update",
	"version": "11.7.1",
	"timestamp": "1723822967585",
	"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"b75837fb-4f0d-4a28-a692-2e72234f33c1\",\"sortIndex\":0,\"isEnabled\":true,\"methodName\":\"QQQ12313QQQQ\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**

## 删除-门店支付方式 

> Creator: goodlamsx

> Updater: goodlamsx

> Created Time: 2026-04-14 10:52:58

> Update Time: 2026-04-14 11:01:03

```text
No description
```

**API Status**

> In Progress

**URL**

> /openapi/action

**Method**

> POST

**Content-Type**

> json

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Body**

```javascript
{
"appId": "8c9f2200a1834c6fb306682281e293e3",	
	"action": "system_payment_method_delete",
"version": "11.7.1",
"timestamp": "1723822967585",
"sign": "2BC1B7C3A7D076458B1C7C1AB7089E2D",
	"body": "{\"id\":\"5558458a-41eb-462b-aa4a-7bac60d68ac5\"}"
}
```

**Authentication**

> Inherit auth from parent

**Response**

* 成功(200)

```javascript
No data
```

* 失败(404)

```javascript
No data
```

**Headers**

| Key | Example Value | Type | Required | Description |
| --- | ------------- | ---- | -------- | ----------- |
| Content-Type | application/json | string | Yes | - |

**Query**
