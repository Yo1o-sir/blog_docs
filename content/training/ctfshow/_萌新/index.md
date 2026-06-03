---
title: _萌新
weight: 1
comments: true
type: docs
---
## 萌新\_密码1
遇到这样的编码题，一定要准备工具Cyberchef以及随波逐流

这类题要关注题面以及答案的格式

```plaintext
密文：
53316C6B5A6A42684D3256695A44566A4E47526A4D5459774C5556375A6D49324D32566C4D4449354F4749345A6A526B4F48303D

提交格式：KEY{XXXXXXXXXXXXXX}
```

题目可能会告诉我们编码类型、加密方式，flag格式则特别关键，我们要尽可能让解密过程接近flag格式，简单来说就是凑flag

这里的密文可以肉眼观察，会发现字符都出现在`0-9，a-f`之间，找不到其它超过范围的字符，那么心里应该有猜测，这里是十六进制，比赛的时候，可以直接将密文复制到Cyberchef里，工具可以智能帮助我们进行编码种类预测

![image](assets/image-20260602175522-m4mq8a9.png)

一旦出现魔法棒，直接点击即可，一些基本的编码类型预测准确率还是很高的

![image](assets/image-20260602175904-uwc1e5q.png)

又出现了一次魔法棒，先看看密文，它在字符集{0-9,a-z,A-Z,=}之间，应该可以猜测是base64编码（我只能说是经验，还有，比赛常考的编码类型就一些常见的，可以挨个试

点击魔法棒，可以确定这里就是base64编码

![image](assets/image-20260602192537-2dseowe.png)

base64解码后，发现是一可读字符串，这里我凭借经验，可以轻松确定这里是栅栏密码，我说说判断依据

- 存在flag格式中的花括号
- 存在flag头的字母

我再讲解下栅栏密码，它会将一个字符串按照栅栏，平均进行分割，这里的shift就是分割时候的字母，比如说我要编码处理字符串：123456abc

一共9个字母，栅栏密码追求平均分配，那我们就shift=3,恰好分成3组，我们按照上下进行并行处理,然后依次从上往下读

```plaintext
1 2 3
4 5 6
a b c
```

那么它对应的栅栏密码就应该是14a25b36c

回到本题，我们要处理的是`KYdf0a3ebd5c4dc160-E{fb63ee0298b8f4d8}`，如果真的手算的话，难度不大，就是麻烦，要排列长度过大，这个时候，我们可以借助随波逐流，它能帮助我们暴力遍历所有可能的shift，我们在结果中查看满足flag格式的那个即可

![image](assets/image-20260602193340-rx5hnhu.png)

将密文复制上去，点击一键解码，向下翻找，可以看到分为2栏的结果（看看其它的情况，就知道如果我们真的手算的话，计算量还是太大了

那么本题的答案应该是`KEY{dffb06a33eeeb0d259c84bd8cf146d08-}`

## 萌新\_密码2

这类题算是那种脑洞题，见见就好了，不要深入研究

查看题目描述，这里的密码和键盘有关，然后再在键盘上看看题目描述的三串字符`rdcvbg 2qase3 6tghu7`会看到它们依次包裹了f,w,y

那么本题答案：KEY{fwy}

## 萌新_密码3

看题目描述，这里和培根密码有关系，知道这个名词就好，可以上网找一些在线解密工具

但是这里有个坑再等我们挑，上网搜索培根密码，会发现它的特征是密文只有两种字符组成，但是本题却出现了四种

![image](assets/image-20260602194509-1zk5sm1.png)

注意，空格也算一种字符组成，因此是四种

如果去除斜杠的话，这里明显是一种莫斯密码，这也能解释出空格的作用，否则，我们就要考虑，让`-`​代替`A`​,`.`​代替`B`

下图是我用在线工具进行培根加密的效果，这里不存在第三种字符的

![image](assets/image-20260602194640-lvvb0kr.png)

那么本题我们应该清楚怎么处理了，将斜杠删除，然后进行摩斯密码解密

![image](assets/image-20260602194800-a0dc5p1.png)

一定要熟练掌握cyberchef，这样的话，我们就能省很大力气进行脚本处理，这里的斜杠我用`FIND / Replace`进行查找去除的

因此本题的答案应该是`flag{MORSE_IS_COOL_BUT_BACON_IS_COOLER_MMDDMDMDMMMDDDMDMDDMMMMMMMDDMDMMDDM}`?

提交上去后发现错误，这个时候关注下我们上面得到的字符串末尾`MMDDMDMDMMMDDDMDMDDMMMMMMMDDMDMMDDM`

它恰好是满足培根密码特征，就是只有两种字符，那么我们尝试将M替换成A，D替换成B，进行培根解密，依旧使用cyberchef灵活处理

![image](assets/image-20260602195118-cb6arnk.png)

注意，Cyberchef自带培根解密工具，得到密文GUOWANG,那么尝试本题flag：`flag{GUOWANG}`

## 萌新_密码#4

这个题和前面考法一样，我就不多说了，依然cyberchef一把梭

![image](assets/image-20260602195431-qfndgq1.png)

> 一般来说，考察的隐写中图片居多，各种图片文件的常规考察知识点会是一样的，所以说啊，你后面遇到不同类型的图片隐写一定要整理出来考点

## 隐写1

本题考察的是png图片隐写，第一步应该是用010 editor查看

![image](assets/image-20260602205447-sqcwpca.png)

会发现到图片无法打开，提示被损坏了，这个时候我们必须掌握常见文件的magic魔数头

比如png中，各种文件的前缀都应该是`89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52`,在比赛中如果忘记了，可以在本地找个合法的png图片，借鉴参考正常的png结构

![image](assets/image-20260602205731-xgwikge.png)

常规png文件头，就是前16字节应该是一致的，这里还有个考点，就是zip的明文攻击，也很喜欢用png考察

那么针对本题，解决方案是用010 editor将第一个字节从99改成89，然后保存重新查看图片

记得右键跑下模板，选中png.bt，看看文件是否修复成功了

![image](assets/image-20260602205954-pygk7c1.png)

如果看到successfully，就代表成功了

‍

![image](assets/image-20260602210024-s3o0m54.png)

下图就是我们修复好的flag，得到flag：`flag{zhe_ci_meiyou_ctfshow}`

![flag](assets/flag-20260602210039-sz1jwbe.png)

## 隐写2

这个题挺不错的，还提供了隐写工具jphs，那么解决完本题后，务必将它保存起来，按照我的经验来说，应该是在jpg隐写中经常能用得到这个工具

![image](assets/image-20260602213238-1pr64xc.png)

先open jpeg，选中题目下发得那个jpg文件，然后选择seek，这个是解密提取按钮，如果说出题，就用的是hide

![image](assets/image-20260602213341-9v7u7si.png)

这里的密码也可以是空的，当然，比赛中会经常看到弱密码的那种题目，遇到再说

点击OK后，会弹出一个文件选择框，就新建个flag.txt保存进去好了，处理好后的效果如下：

![image](assets/image-20260602213447-47iptql.png)

会看到中间部分确实看到Hidden部分有内容，这意味着我们解密成功

读取刚刚新建的flag.txt文件内容，获取flag：`flag{202cb962ac59075b964b07152d234b70}`

## 萌新 隐写2

这个题目直接下发了压缩包，没有其它注释信息，查看过010 十六进制，也没找到帮助信息，使用zipcenop尝试处理伪加密处理，也没有成功，那么本题只能能弱密码爆破了

建议弱密码爆破的时候，先单纯爆破数字，如果没有爆破出来，再递增爆破字母、符号

![image](assets/image-20260602214902-h22bucq.png)

注意，长度一定要超过8位，不然这里会爆破失败的

拿到了密码19981000后解压，获取flag内容：`flag{brute_force}`

## 萌新 隐写3

这次的题目附件是一个jpg，首先把它放到010 editor中

跑完jpg的模板后，发现没有问题

![image](assets/image-20260602215259-kdl3wc7.png)

然后仔细观看图片内容，发现能直接读出来flag：`flag{xinti_gkd}`

![image](assets/image-20260602215350-3covsgk.png)

## 萌新 隐写4

题目附件是doc文件，如果是docx就考察知识点docx也是zip文件这个考点，但是针对本题，考点就是常规的隐藏文字了，对于doc，我们可以用wps打开

![image](assets/image-20260602220155-tppmcnu.png)

先点击左上角的文件，然后选中选项

![image](assets/image-20260602220232-6z0elib.png)

在选项中将格式标记中的隐藏文字勾选上，点击确定返回，就能看到flag：`flag{word_stega}`

## 萌新隐写5

用本地notepad打开，看不出来有什么用

![image](assets/image-20260602220452-vnh505w.png)

不过看到那串不可打印的古中文字符，显然是某种乱码，这个时候我们用010 editor打开，看看有没有可读字符串

![image](assets/image-20260602220604-z3kccti.png)

一定要点击Hex，这会帮我们将文件按照十六进制打开源代码，右侧是十六进制转换ASCII的结果，解决了那些古典密码的题，应该能对这里有所敏感，直接复制右侧貌似不能成功，可以先选中，使用`ctrl+shift+c`，这样做会将左侧对应的十六进制复制

![image](assets/image-20260602221013-xuj3a4l.png)

复制出来后，粘贴到cyberchef中

![image](assets/image-20260602221111-notzrqs.png)

这个时候就看不到魔法棒了，需要在左侧搜索`from hex`​，将右侧的ASCII恢复出来，然后两字符中间存在00，这在ASCII中可以用`\0`​替换，然后会得到`MZWGCZZINBQW6X3KNF2V6YTVL54W63THL5RDGMS7FE======`

这个时候就能触发魔法棒进行base32解密，读取flag：`flag(hao_jiu_bu_yong_b32_)`

## 萌新隐写6

这次的附件是flac文件，格式很少见，但是电脑的默认打开方式告诉我们，这里是音频文件

![image](assets/image-20260602221521-g3s65b1.png)

遇到这类音频隐写题，一般遇到wav比较多，但是处理方法很接近，都是用Audacity查看波形图或频谱图，从中获取隐写信息

![image](assets/image-20260602221616-59mcoj6.png)

放大一点点，会留意到左声道是摩斯密码，手动敲出来即可

![image](assets/image-20260602221728-nfwzk2v.png)

用cyberchef解密，得到明文，套上flag格式：`flag{MUZIKISG00D}`
## 杂项1

看题面，这里需要用在线网站恢复下md5对应的明文，这类题的工具只需要知道有个[cmd5](https://www.cmd5.com/)和[somd5](https://www.somd5.com/)网站就好了，如果这两恢复不出来，那就没辙，那应该考察的是其它知识点了

![image](assets/image-20260603175447-bvks0bc.png)

本题答案：`flag{hello}`

## 杂项2

本题使用010 editor打开，查看文件末尾，发现存在明文flag

![image](assets/image-20260603175703-zyhwkja.png)那么本题答案：`flag{ctfshow_im_coming}`

## 萌新 杂项3

蛮抽象的题，算是社工类型题面，结合生日等信息，猜测可能的密码

![image](assets/image-20260603175847-n3gmt8s.png)

将所有数字拼接起来就好了

## 杂项4

这类题考察的是压缩包掩码爆破，只要提前准备好工具archpr，就能正常进行

根据题面信息，密码一共9位，且都是数字，前三个数字是372，flag的内容就是压缩包密码

![image](assets/image-20260603180229-ulpria1.png)

按照我图上编辑的，先选择攻击类型为掩码，然后手动输入掩码内容：372??????，接着在暴力范围里选中所有数字0-9，最后打开下发的那个附件即可，爆破速度特别快的，得到本题的flag：`flag{372619038}`

## 杂项5

这题考察你眼神咯，仔细观察，会看到很显眼的花括号，这是flag一定有的，出现在这里并不是意外，是出题师傅故意的

![image](assets/image-20260603180615-98zfalu.png)

然后再观察文字内容，会发现正文部分几乎都是小写字母，只有个别是大写，就连i都用小写表示，肯定有鬼，仔细检查每个大写字母，发现最开始的是`FLAG{`​,这恰好是flag头，将它们拼接一起，可以得到`FLAG{CTFSHOWNB}`，提交即可

## 杂项6

通过题面描述，这里考察的是伪压缩包，这类题其实也不太算安全题目，它的出题原理就是将压缩包里负责判断是否有密码的标志位从奇数改成了偶数，在Windows下使用解压工具一定会显示这里存在加密

解决方案很多，我说两个

第一个是最轻松的，提前准备好小工具zipcenops，它能将所有可能改动的标志位改回去，保存成新的文件，我们可以直接解压，温馨提示，如果题面没有考察伪加密，用zipcenops导出的压缩包是无法正常解压的

![image](assets/image-20260603181611-1xux2rk.png)

第二个方法贴近原理，我们可以用010 editor将对应的标志位改回去，推荐[这篇文章](https://blog.csdn.net/xiaozhaidada/article/details/124538768)，讲得很好

![image](assets/image-20260603182007-ova5s5q.png)

如何变成无加密呢？

![image](assets/image-20260603182036-tjq1sqw.png)![image](assets/image-20260603182120-b6gdasp.png)

将原本的09覆盖成00即可，对了，这两处的标记在我看来，只有奇数和偶数的区别，比如说00和08效果差不多，就没有必要改变前面的那个标志位了

​<kbd>ctrl+s</kbd>​进行保存，重新解压压缩包，获取到flag：`flag{c_t_f_s_h_o_w}`

## 杂项7

本题考察crc32爆破，出题原理是出题人将png图片的宽高篡改了，一般情况是篡改小了，这会导致一些图片内容显示不出来，这类就考察的是crc32爆破，为啥会和crc32有关系呢？这是因为一个合法的png数据块结构一定包含了对应的crc校验，将它当作哈希即可，关于png的考点，具体可以看我之前在[先知写的文章](https://xz.aliyun.com/news/17831)

![image](assets/image-20260603182908-zmtfq1c.png)

在图书馆不能看图片，太尴尬了，得到flag：`flag{beautiful}`

关于我用的脚本，我在先知文章里有写过，这里再复制一次，下次打比赛一定要把工具多积累

```python
import zlib
import struct
import argparse
import itertools
from pathlib import Path

def check_png(bin_data, file_path):
    """检查 PNG 文件头和 IHDR 块完整性"""
    correct_header = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    if len(bin_data) < 33:
        return False, f"文件{file_path}太短，不是有效的PNG文件"
    if bin_data[:8] != correct_header:
        return False, f"文件{file_path}不是PNG文件，预期头{correct_header}，实际头{bin_data[:8]}"
    length = struct.unpack('>I', bin_data[8:12])[0]
    chunk_type = bin_data[12:16].decode('ascii', errors='ignore')
    if length != 13 or chunk_type != 'IHDR':
        return False, f"文件{file_path}的IHDR块无效，长度应为13，类型应为IHDR，实际长度{length}，类型{chunk_type}"
    return True, f"文件{file_path}是一个有效的PNG文件"

def repair_png(file_path, bin_data, width, height):
    """生成修复后的 PNG 文件"""
    output_path = str(Path(file_path).with_stem(Path(file_path).stem + '_fixed'))
    try:
        new_data = (
            bin_data[:16] +
            struct.pack('>I', width) +
            struct.pack('>I', height) +
            bin_data[24:]
        )
        with open(output_path, 'wb') as f:
            f.write(new_data)
        return True, f"修复成功，保存为 {output_path}"
    except Exception as e:
        return False, f"保存修复文件失败: {e}"

def main():
    parser = argparse.ArgumentParser(description="通过CRC爆破PNG文件的IHDR宽高并修复")
    parser.add_argument("-f", type=str, default=None, required=True,
                        help="输入同级目录下图片的名称")
    args = parser.parse_args()

    try:
        bin_data = open(args.f, 'rb').read()
    except FileNotFoundError:
        print(f"文件{args.f}不存在")
        return

 
    is_valid, message = check_png(bin_data, args.f)
    print(message)
    if not is_valid:
        return


    ihdr_data = bin_data[12:29]
    original_crc32 = struct.unpack('>I', bin_data[29:33])[0]
    crc32key = zlib.crc32(ihdr_data)
    width, height = struct.unpack('>II', bin_data[16:24])

    print(f"原始宽度: {width}, hex: {hex(width)}")
    print(f"原始高度: {height}, hex: {hex(height)}")
    print(f"CRC 校验: {'通过' if crc32key == original_crc32 else '失败'}")

    if crc32key == original_crc32:
        print("宽高没有问题!")
        return

  
    input_ = input("宽高被改了，是否CRC爆破宽高? (Y/n): ")
    if input_.lower() not in ["y", ""]:
        print("退出爆破")
        return

    common_resolutions = [
        (300, 200), (1920, 1080), (1280, 720), (1024, 768), (800, 600),
        (2560, 1440), (3840, 2160), (512, 512), (640, 480)
    ]

    print("\n开始 CRC 宽高爆破：")
   
    for i, j in common_resolutions:
        data = (
            bin_data[12:16] +
            struct.pack('>I', i) +
            struct.pack('>I', j) +
            bin_data[24:29]
        )
        crc32 = zlib.crc32(data)
        if crc32 == original_crc32:
            print(f"\n找到匹配的宽高！")
            print(f"CRC32: {hex(original_crc32)}")
            print(f"宽度: {i}, hex: {hex(i)}")
            print(f"高度: {j}, hex: {hex(j)}")
            
           
            success, repair_message = repair_png(args.f, bin_data, i, j)
            print(repair_message)
            return

 
    print("常见分辨率未找到匹配，尝试穷举 1 到 4095...")
    for i, j in itertools.product(range(1, 4096), range(1, 4096)):
        data = (
            bin_data[12:16] +
            struct.pack('>I', i) +
            struct.pack('>I', j) +
            bin_data[24:29]
        )
        crc32 = zlib.crc32(data)
        if crc32 == original_crc32:
            print(f"\n找到匹配的宽高！")
            print(f"CRC32: {hex(original_crc32)}")
            print(f"宽度: {i}, hex: {hex(i)}")
            print(f"高度: {j}, hex: {hex(j)}")
            
            
            success, repair_message = repair_png(args.f, bin_data, i, j)
            print(repair_message)
            return

    print("\n爆破失败，未找到匹配CRC的宽高")

if __name__ == "__main__":
    main() 
```

我的脚本属于一把梭了，有个古典的手法，我们用010 editor直接将高度拉足够大就好了

![image](assets/image-20260603183142-lvbl9xs.png)

注意，一定要跑png模板，会在Variables下面看到ihdr，里面的width控制宽度，height控制高度，将高度拉到1000都行，ctrl+s保存后，图片下面一定能看到flag

![image](assets/image-20260603183310-vvo7wvc.png)

效果类似这样

## 杂项8

这题和上题考察点一样，我上一题有个知识点没有讲到，当我们跑完模板后，看到这个crc报错是正常的，因为出题师傅篡改了宽高，crc校验一定会出错，毕竟错误的宽高怎么可能计算出正确的crc呢？

![image](assets/image-20260603183608-bgm32o0.png)

用脚本跑吧，因为图片并不好看，我也不太确定是宽度变量还是高度变了

![image](assets/image-20260603183705-c0lhexj.png)

看得出来，是宽度变了哎，直接看恢复出来的图片，得到flag：`flag{you_are_very_well}`

![flag_fixed](assets/flag_fixed-20260603183729-c3b7381.png)

## 杂项10

这是一道神人出的题，没有技术含量，将图片缩小，会大致看出来五个汉字：我好喜欢你，再套上格式得到flag:`flag{我好喜欢你}`

![image](assets/image-20260603183910-i8sqisi.png)

## 杂项11

依然是个工具题，ctfshow这方面处理的不错，提供要用的工具链接，我看了下，是jphs，这在前面的隐写里遇到过，做法一样

![image](assets/image-20260603184249-d9ulsz9.png)

先open jpeg，然后点击seek，它让我们输入密码的时候不用管，这个jphs是支持空密码的，保存解密出来的文件的时候，就命名为output好了，因为我也不晓得是什么文件，需要用010 editor查看

![image](assets/image-20260603184411-yyl2b7b.png)

做了这么久的题了，应该很轻松的认出来这是png图片吧，右键跑一下png模板，如果没问题的话，我们将output重命名成output.png

可以看到一个QR code，离线工具用起来感觉一般般，建议使用[在线兔子解码工具](https://tuzim.net/decode/)

![image](assets/image-20260603184720-fvrqit7.png)

得到字符串：`https://ctf.show/?ZmxhZ3vmiJjnpZ7lvZLmnaXlj5HnjrDoh6rlt7HlhL/lrZDlnKjliLfpopjvvIzkuIDmgJLkuYvkuIvlj6zllKQxMOS4h+WwhuWjq+adpeaKpeS7h30=`

看到Zmxh应该条件反射，想起这是base64编码，毕竟flag的base64编码就是Zmxh

![image](assets/image-20260603184828-erazb8k.png)

base64解码后得到flag：`flag{战神归来发现自己儿子在刷题，一怒之下召唤10万将士来报仇}`
