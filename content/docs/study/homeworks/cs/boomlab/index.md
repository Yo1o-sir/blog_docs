---
title: boomlab
weight: 2
comments: true
type: docs
---

> :boom::boom::boom:就当这次实验是一次逆向题吧

## start

先查看下二进制程序的架构

```bash
◎ checksec bomb                                                                □ 计算机组成/bomb209 ℂ v14.2.0-gcc 22:04
[*] '/mnt/c/Users/24062/Documents/计算机组成/bomb209/bomb'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    FORTIFY:    Enabled
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
    Debuginfo:  Yes
```

这里不打`pwn`,我们就关注下第一行，它是64位小端序程序

比较喜欢用`IDA pro`查看，但是考虑到有些同学不太会配置破解版`ida pro`，这里就用`ghidra`好了，这是[仓库地址](https://github.com/NationalSecurityAgency/ghidra)(安装过程去网上搜吧，这是开源免费的，那种收钱工具下载链接都是假的，实在不行找我吧)

运行那个启动bat程序后，会看到一个空白页面，我们先点击左上角File，选择`New Project`，选中我们自定义的路径即可，这里随机，不作要求

![ghidra](./index.assets/image-20260422222405963.png)

接下来还是点击左上角File，应该能看到下面的`Import File...`吧，点击后将我们需要进行逆向的bomb二进制程序选中，然后啥也不用调，点两次ok就可以了

![import file](./index.assets/image-20260422222645005.png)

然后应该看到这里长得差不多，我们就成功了,接下来我们应该做的是双击bomb，它会自动调用tool chest的龙图标，它的作用是查看源代码的

![catcode](./index.assets/image-20260422222726215.png)

简单讲讲里面的布局，一般来说初始化都是这样

![layout](./index.assets/image-20260422223143085.png)

左侧框框是符号表树，里面可以看到二进制中引用的库，以及内置的函数列表，一定关注那个functions，里面能找到main，这是关键的主函数，中间框框是反编译代码，就是老师开始讲的汇编函数，第三个框框是反汇编代码，或者叫它伪c代码，它是ghidra帮我们将反编译出来的汇编代码整理成高级语言，方便我们阅读审计

> 温馨提示，如果遇到一些混淆严重的二进制程序，我觉得应该相信反编译出来的汇编代码，而不是伪c代码，不然一些花指令会让伪c代码误导我们进行逆向分析

## 审计代码

### main

先来审计main函数，我分析的时候一般喜欢一部分一部分读

```c
int main(int argc,char **argv)

{
  undefined8 uVar1;
  
  if (argc == 1) {
    infile = stdin;
  }
  else {
    if (argc != 2) {
      __printf_chk(1,"Usage: %s [<input_file>]\n",*argv);
                    /* WARNING: Subroutine does not return */
      exit(8);
    }
    infile = (FILE *)fopen(argv[1],"r");
    if ((FILE *)infile == (FILE *)0x0) {
      __printf_chk(1,"%s: Error: Couldn\'t open %s\n",*argv,argv[1]);
                    /* WARNING: Subroutine does not return */
      exit(8);
    }
  }
}
```

这部分代码的作用很简单:处理输入

- 如果我们单纯在命令行中输入了`./bomb`，那么这个二进制会从键盘输入里读取炸弹答案
- 如果我们写入的参数超过2（记住，程序名也算一个），二进制程序会提示用法`"Usage: %s [<input_file>]\n"`，然后退出
- 如果参数是2个，第二个参数就会被程序当作要读取的文件名，以读模式打开文件，打开失败也会报错退出

这里是后半部分main函数

```c
  initialize_bomb(); //关键函数1：initialize_bomb()
  puts("Welcome to my fiendish little bomb. You have 6 phases with");
  puts("which to blow yourself up. Have a nice day!");
  uVar1 = read_line(); //关键函数2：read_line()
  phase_1(uVar1); //关键函数3：phase_1()
  phase_defused(); //关键函数4：phase_defused()
  puts("Phase 1 defused. How about the next one?");
  uVar1 = read_line();
  phase_2(uVar1); //关键函数5：phase_2()
  phase_defused();
  puts("That\'s number 2.  Keep going!");
  uVar1 = read_line();
  phase_3(uVar1); //关键函数6：phase_3()
  phase_defused();
  puts("Halfway there!");
  uVar1 = read_line();
  phase_4(uVar1); //关键函数7：phase_4()
  phase_defused();
  puts("So you got that one.  Try this one.");
  uVar1 = read_line();
  phase_5(uVar1); //关键函数8：phase_5()
  phase_defused();
  puts("Good work!  On to the next...");
  uVar1 = read_line();
  phase_6(uVar1); //关键函数9：phase_6()
  phase_defused();
  return 0;
```

后半部分很有规律的，初始化炸弹后，无非是输出一些欢迎信息，然后读一行字符串，接下来调用对应的关卡函数，最后调用`phase_defused()`,我发现每一轮都有这个函数，那么我们可以大概揣测各个关键函数的作用了

- 关键函数1：`initialize_bomb()`，这里进行炸弹初始化，也许有什么seed信息？需要查看
- 关键函数2：`read_line()`，看字面意思就清楚，这是逐行读取，没有必要查看(如果后面逆向卡住了，再看)
- 关键函数3,5,6,7,8,9：`phase()`这里显然是各个关卡对应的函数，必须查看
- 关键函数4：`phase_defused()`我认为这个函数是检测状态的，如果上一轮关卡成功，就pass，如果失败，这个函数会直接让程序退出，也就是:boom:;本函数等后期卡住再来审计

### initialize_bomb

to be continued...

洗洗睡了，明天再分析吧



