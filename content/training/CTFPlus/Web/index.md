---
title: Web
weight: 2
comments: true
type: docs
---

## 极客大挑战2023-web-unsign

题目地址：[CTFPlus](https://www.ctfplus.cn/problem-detail/1836246905802199040/description)

这是一道Web PHP反序列化的问题

先了解下什么是序列化和反序列化

序列化：将对象转换成字符串(或字节流)的过程，方便存储或传输

```php
<?php
class User {
    public $name;
    public $age;
    
    public function __construct($name, $age) {
        $this->name = $name;
        $this->age = $age;
    }
}

$user = new User("Alice", 25);
$serialized = serialize($user);
echo $serialized;
// 输出：O:4:"User":2:{s:4:"name";s:5:"Alice";s:3:"age";i:25;}
?>
```

例如这个php简易程序，它就是将对象User进行序列化，变成一字符串用来存储

反序列化就是把字符串还原成对象的过程

```php
$str = 'O:4:"User":2:{s:4:"name";s:5:"Alice";s:3:"age";i:25;}';
$user = unserialize($str);
echo $user->name;  // 输出：Alice
```

反序列化漏洞的本质便是，用户能够控制反序列化的数据，而程序在反序列化过程种会自动触发某些魔术方法，攻击者利用这些魔术方法来执行恶意代码

我举个完整的使用例子：

- 序列化：把用户的身份信息整合成一张身份卡（信息记录）
- 反序列化：根据那个身份卡，找到指定的那个用户
- 漏洞：这里的攻击者就能伪造身份卡，让反序列化过程恢复的时候，直接恢复到攻击者的身份上，这个时候攻击者就能劫持那个php反序列化的进程，进而获取到命令执行权限

这里有几个常见魔术方法

```php
__construct()    // 对象创建时调用
__destruct()     // 对象销毁时调用
__toString()     // 对象被当作字符串使用时调用
__invoke()       // 对象被当作函数调用时调用
__get($name)     // 访问不存在的属性时调用
__set($name, $value) // 给不存在的属性赋值时调用
__call($name, $args) // 调用不存在的方法时调用
__wakeup()       // 反序列化时调用
__sleep()        // 序列化时调用
```

这里再概括下攻击者的攻击流程

```text
攻击者构造恶意对象 → 序列化 → 提交给服务器 → 
服务器反序列化 → 触发魔术方法 → 执行恶意代码
```

看看本题源代码

```php
 <?php
highlight_file(__FILE__);
class syc
{
    public $cuit;
    public function __destruct()
    {
        echo("action!<br>");
        $function=$this->cuit;
        return $function();
    }
}

class lover
{
    public $yxx;
    public $QW;
    public function __invoke()
    {
        echo("invoke!<br>");
        return $this->yxx->QW;
    }

}

class web
{
    public $eva1;
    public $interesting;

    public function __get($var)
    {
        echo("get!<br>");
        $eva1=$this->eva1;
        $eva1($this->interesting);
    }
}
if (isset($_POST['url'])) 
{
    unserialize($_POST['url']);
}

?> 
```

先理解下代码，分析如下：

- 入口：`unserialize($_POST['url'])`,用户可以控制反序列化的内容
- `syc::__destruct()`:对象销毁时执行 `$this->cuit()`,把`$cuit`当函数调用
- `lover::__invoke()`:对象被当函数调用时执行，返回`$this->yxx->QW`
- `web::__get()`:访问不存在的属性时执行 `$eval($this->interesting)`
