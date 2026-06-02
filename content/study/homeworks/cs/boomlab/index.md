---
title: boomlab
weight: 2
comments: true
type: docs
---

> Boom Boom Boom
>
> 就当这次实验是一次逆向题吧

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

- 关键函数1：`initialize_bomb()`，这里进行炸弹初始化，应该是对一些环境的检查（我已经看过了，是检测本地环境是否合法，并且会和成绩网站建立通信的，相关逻辑有那么一点点复杂，但是值得庆幸的是对我们后面的关卡挑战没有关系
- 关键函数2：`read_line()`，看字面意思就清楚，这是逐行读取，没有必要查看(如果后面逆向卡住了，再看)
- 关键函数3,5,6,7,8,9：`phase()`这里显然是各个关卡对应的函数，必须查看
- 关键函数4：`phase_defused()`我认为这个函数是检测状态的，如果上一轮关卡成功，就pass，如果失败，这个函数会直接让程序退出，也就是​Boom;本函数等后期卡住再来审计

### phase_1

跳转这个函数很简单，两个方法，一个是在左侧的functions中选中对应的函数名，第二个方法是在main的反汇编代码中双击那个函数，会自动跳转

![jump](./index.assets/image-20260423140311082.png)

查看下反汇编代码

```c

void phase_1(undefined8 param_1)

{
  int iVar1;
  
  iVar1 = strings_not_equal(param_1,"I am not part of the problem. I am a Republican.");
  if (iVar1 == 0) {
    return;
  }
                    /* WARNING: Subroutine does not return */
  explode_bomb();
}
```

逻辑很简单，函数会读取paraw_1参数，然后会调用strings_not_equal函数进行对比，那个函数应该会返回bool值吧，一会儿查看，看这个样子，如果函数返回0，就算第一关pass，否则会触发爆炸函数`explode_bomb()`

```c

undefined8 strings_not_equal(char *param_1,long param_2)

{
  int iVar1;
  int iVar2;
  undefined8 uVar3;
  long lVar4;
  char cVar5;
  
  iVar1 = string_length();
  iVar2 = string_length(param_2); //这两句是存储字符串长度的，第一句应该是隐式继承吧，结合main函数的调用，大致能猜测是程序读取的我们答案，第二个才是存储的正确答案
  uVar3 = 1; //这里是记录状态的，初始是1，默认不相等
  if (iVar1 == iVar2) { //第一部分：进行长度校验
    cVar5 = *param_1;
    if (cVar5 == '\0') { //这是校验是否是空字符串，如果过了第一部分的话，就证明读取的两个参数都是空字符串相等，自然会让uVar3更新成0
      uVar3 = 0;
    }
    else {//下面才是正常处理的流程（排除了长度不同以及都是空字符串的情况
      lVar4 = 0;//定位符吧，从第1个字母开始（注：索引都是从0开始的
      do {
        if (*(char *)(param_2 + lVar4) != cVar5) {
          return 1;
        }
        lVar4 = lVar4 + 1;
        cVar5 = param_1[lVar4];
      } while (cVar5 != '\0'); //进行循环逐字符对比，全部字符相同的话才能让uVar3更新成0，否则都是1
      uVar3 = 0;
    }
  }
  return uVar3;
}
```

我上面备注的注释都很清晰了吧,那么我们再结合实验报告的要求

```text
文件中的每行包含拆除对应炸弹阶段的字符串，程序将依次检查每一阶段拆除字符串的正确性来决定炸弹拆除成败。该文本文件必须采用Unix格式（换行字符不同于Windows格式），并且注意最后一个字符串后也要进行换行（即所有字符串必须以换行结尾）。
```

可以得到第一题的答案(注意，务必在Linux环境中执行)

```bash
◎ echo "I am not part of the problem. I am a Republican." > test.txt   /tmp 56% ↓ 14:20


◎ xxd test.txt                                                         /tmp 54% ↓ 14:25
00000000: 4920 616d 206e 6f74 2070 6172 7420 6f66  I am not part of
00000010: 2074 6865 2070 726f 626c 656d 2e20 4920   the problem. I
00000020: 616d 2061 2052 6570 7562 6c69 6361 6e2e  am a Republican.
00000030: 0a
```

---

那就简单扩展下吧，在ASCII中，换行符`\n`对应的索引值就是0x0a,如果我们在Windows下编辑文件，会默认在语句后面加上`\r\n`，这里的`\r`是光标返回第一个字节的意思，也就是所谓的回车符号，对应索引值是0x0D

---

### phase_2

如果上一关过了，应该会收到这个`puts("Phase 1 defused. How about the next one?");`

接下来看看第二关

```c

void phase_2(undefined8 param_1)

{
  int *piVar1;
  long in_FS_OFFSET;
  int local_38 [6]; //申请了一个6元素空间的数组
  long local_20;
  
  piVar1 = local_38;
  local_20 = *(long *)(in_FS_OFFSET + 0x28); //canary金丝雀，pwn里的知识，不用管
  read_six_numbers(param_1,local_38); //关键函数，应该会处理读取的输入，一会儿分析
  if ((local_38[0] != 0) || (local_38[1] != 1)) { //这里规定了，读取的前两个数字必须是0,1;否则Boom
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  // 循环处理剩下的4个数字
  do {
    if (piVar1[2] != piVar1[1] + *piVar1) {
                    /* WARNING: Subroutine does not return */
      explode_bomb();
    }
    piVar1 = piVar1 + 1;
  } while (piVar1 != local_38 + 4); 
  if (local_20 == *(long *)(in_FS_OFFSET + 0x28)) { //栈保护处理，不管
    return;
  }
                    /* WARNING: Subroutine does not return */
  __stack_chk_fail();
}
```

中间循环那部分有点关键，我扣下来讲

```c
do {
    if (piVar1[2] != piVar1[1] + *piVar1) {
                    /* WARNING: Subroutine does not return */
      explode_bomb();
    }
    piVar1 = piVar1 + 1;
  } while (piVar1 != local_38 + 4); 
```

首先需要明确，piVar1指向的是`local_38[0]`

看这里的if判断，很像斐波那契数列：`a2=a1+a0`

如果判断通过，那么不会爆炸，开始自增，让piVar1指向`local_38[1]`,重新开始判断

至于这里的停止循环条件为啥是`local_38+4`而不是`+6`，原因很简单，这样理解，理论上最后一个斐波那契数是`a5=a4+a3`(索引从a0开始)，那么这个时候a3是6元素数组中的第四个，如果再往上自增，系统内部是找不到a6的，会导致逻辑奔溃

再来看看这里的处理函数（我稍微格式上美化了下

```c
void read_six_numbers(undefined8 param_1, long param_2)
{
    int iVar1;
    
    iVar1 = __isoc99_sscanf(
        param_1,                     // 输入字符串（用户输入的那一行）
        "%d %d %d %d %d %d",         // 格式：读取 6 个整数
        param_2,                     // 第 1 个整数 → &numbers[0]
        param_2 + 4,                 // 第 2 个整数 → &numbers[1]
        param_2 + 8,                 // 第 3 个整数 → &numbers[2]
        param_2 + 0xc,               // 第 4 个整数 → &numbers[3]
        param_2 + 0x10,              // 第 5 个整数 → &numbers[4]
        param_2 + 0x14               // 第 6 个整数 → &numbers[5]
    );
    
    if (5 < iVar1) {   // 实际检查 iVar1 >= 6
        return;        // 成功读到 6 个整数 → 正常返回
    }
    
    explode_bomb();    // 读到的数字少于 6 个 → 炸弹爆炸
}
```

它会读取6个整数，至于这里的数组索引，我来解释下为啥递增4字节

记得phase_2最上面定义的数组`int local_38 [6];`

这里有个很重要的标志int，这意味着local_38数组内部都装的是4字节大小的int整数，超过4字节就进入下一个元素的空间

那么本关卡就能解决了，答案应该这样写入：

```bash
◎ echo "0 1 1 2 3 5" >> test.txt                                       /tmp 54% ↓ 14:25 

◎ xxd test.txt                                                         /tmp 40% ↓ 14:55
00000000: 4920 616d 206e 6f74 2070 6172 7420 6f66  I am not part of
00000010: 2074 6865 2070 726f 626c 656d 2e20 4920   the problem. I
00000020: 616d 2061 2052 6570 7562 6c69 6361 6e2e  am a Republican.
00000030: 0a30 2031 2031 2032 2033 2035 0a         .0 1 1 2 3 5.
```

在Linux终端中，echo可以用来追增文件内容，一定记得用`>>`，如果只写一个，作用就变成了覆盖

关于这里的0x0a换行符，我觉得还是有必要说一下，echo里会默认对每个字符串末尾追加换行符，如果说不用换行的话，一定要在前面加上`-n`修饰

```bash
◎ echo "yolo is handsome" | xxd                                        /tmp 40% ↓ 14:55
00000000: 796f 6c6f 2069 7320 6861 6e64 736f 6d65  yolo is handsome
00000010: 0a                                       .


◎ echo -n "yolo is handsome" | xxd                                     /tmp 39% ↓ 14:58
00000000: 796f 6c6f 2069 7320 6861 6e64 736f 6d65  yolo is handsome

```

相信这两个例子能让大家理解

### phase_3

这一个关卡代码相对上一题简单点

```c

void phase_3(undefined8 param_1)

{
  int iVar1;
  long in_FS_OFFSET;
  undefined4 local_18;
  int local_14;
  long local_10;
  
  local_10 = *(long *)(in_FS_OFFSET + 0x28);
  iVar1 = __isoc99_sscanf(param_1,"%d %d",&local_18,&local_14);//这里读取了两个整数，10进制就行
  if (iVar1 < 2) { //必须至少读两个数
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  switch(local_18) {//这里开始进行case选择了，读取的第一个数就是case用的
  case 0:
    iVar1 = 0x21a; //538
    break;
  case 1:
    iVar1 = 0x135; //309
    break;
  case 2:
    iVar1 = 0x1a6; //422
    break;
  case 3:
    iVar1 = 0x238; //568
    break;
  case 4:
    iVar1 = 0xf1; //241
    break;
  case 5:
    iVar1 = 0x39b; //923
    break;
  case 6:
    iVar1 = 0x1b2; //434
    break;
  case 7:
    iVar1 = 0x23e; //574
    break;
  default:
                    /* WARNING: Subroutine does not return */
    explode_bomb(); //如果8个case都没有匹配上，就会触发Boom
  }
  if (local_14 != iVar1) { //这里在校验读取的第二个数字是否和case对应的数字相同，不同就会boom
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  if (local_10 != *(long *)(in_FS_OFFSET + 0x28)) { //栈安全检查，不管
                    /* WARNING: Subroutine does not return */
    __stack_chk_fail();
  }
  return;
}


```

在ghidra里很好快速计算的,点击十六进制，然后右键下就能看到

![tonumber](./index.assets/image-20260423150420794.png)

理论上这里有8组答案，提交任意一条即可

```bash
◎ echo "1 309" >> test.txt                                             /tmp 39% ↓ 14:58


◎ xxd test.txt                                                         /tmp 34% ↓ 15:08
00000000: 4920 616d 206e 6f74 2070 6172 7420 6f66  I am not part of
00000010: 2074 6865 2070 726f 626c 656d 2e20 4920   the problem. I
00000020: 616d 2061 2052 6570 7562 6c69 6361 6e2e  am a Republican.
00000030: 0a30 2031 2031 2032 2033 2035 0a31 2033  .0 1 1 2 3 5.1 3
00000040: 3039 0a                                  09.
```

### phase_4

看看第四关

```c

void phase_4(undefined8 param_1)

{
  int iVar1;
  long in_FS_OFFSET;
  int local_18;
  int local_14;
  long local_10;
  
  local_10 = *(long *)(in_FS_OFFSET + 0x28);
  iVar1 = __isoc99_sscanf(param_1,"%d %d",&local_14,&local_18); //读取两个整数
  if ((iVar1 != 2) || (2 < local_18 - 2U)) { //进行两次判断，读取整数必须两个，输入的第二个参数必须小于等于2+2=4，否则会boom
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  iVar1 = func4(5,local_18); //关键函数 func4
  if (local_14 != iVar1) { //第一个参数的值必须等于func4算出来的值，否则Boom
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  if (local_10 == *(long *)(in_FS_OFFSET + 0x28)) { //栈检查
    return;
  }
                    /* WARNING: Subroutine does not return */
  __stack_chk_fail();
}
```

查看下关键函数

```c

int func4(int param_1,int param_2)

{
  int iVar1;
  int iVar2;
  
  if (0 < param_1) {
    if (param_1 != 1) {
      iVar1 = func4(param_1 + -1); //warning:有没有发现这里仅仅读取了一个参数？
      iVar2 = func4(param_1 + -2,param_2);
      param_2 = iVar2 + iVar1 + param_2;
    }
    return param_2;
  }
  return 0;
}

```

emm，大致看了下，发现这次的反编译效果并不理想，可以大致了解到，这里的func4是一个递归函数，但是在iVar1变量处理中，只读取了一个参数（我猜哈，第二个参数大概率是param_2，不过在计算机里，用猜测并立不住跟脚

接下来我打算查看下相关汇编来进行确定

> 在ghidra中，选中你想重命名的变量名，右键可以看到rename，或者按`l`键

```assembly
                             *************************************************************
                             *                           FUNCTION                         
                             *************************************************************
                             undefined  __stdcall  func4 (undefined4  x,  undefined4  y)
             undefined         <UNASSIGNED>   <RETURN>
             undefined4        EDI:4          x
             undefined4        ESI:4          y
                             func4                                           XREF[6]:     Entry Point (*) ,  00401786 (c) , 
                                                                                          00401794 (c) , 
                                                                                          phase_4:004017eb (c) ,  00403630 , 
                                                                                          00403804 (*)   
        00401767 f3  0f  1e       ENDBR64
                 fa
        0040176b b8  00  00       MOV        EAX ,0x0
                 00  00
        00401770 85  ff           TEST       x,x
        00401772 7e  2d           JLE        LAB_004017a1
        00401774 41  54           PUSH       R12
        00401776 55              PUSH       RBP
        00401777 53              PUSH       RBX
        00401778 89  fb           MOV        EBX ,x
        0040177a 89  f5           MOV        EBP ,y
        0040177c 89  f0           MOV        EAX ,y
        0040177e 83  ff  01       CMP        x,0x1
        00401781 74  19           JZ         LAB_0040179c
        00401783 8d  7f  ff       LEA        x,[x + -0x1 ]
        00401786 e8  dc  ff       CALL       func4                                            undefined func4(undefined4 x, un
                 ff  ff
        0040178b 44  8d  24       LEA        R12D ,[RAX  + RBP *0x1 ]
                 28
        0040178f 8d  7b  fe       LEA        x,[RBX  + -0x2 ]
        00401792 89  ee           MOV        y,EBP
        00401794 e8  ce  ff       CALL       func4                                            undefined func4(undefined4 x, un
                 ff  ff
        00401799 44  01  e0       ADD        EAX ,R12D
                             LAB_0040179c                                    XREF[1]:     00401781 (j)   
        0040179c 5b              POP        RBX
        0040179d 5d              POP        RBP
        0040179e 41  5c           POP        R12
        004017a0 c3              RET
                             LAB_004017a1                                    XREF[1]:     00401772 (j)   
        004017a1 c3              RET

```

这里是复制出来的func4部分的汇编代码，好了，接下来把《深入理解计算机系统》翻到p120页，哈哈，版本是第三版，封面在[这里](https://docs.yo1o.top/docs/study/homeworks/cs/)能看到，主要是看里面一些寄存器的作用

我们先定位`0x40177a`和`0x40177c`

```assembly
        0040177a 89  f5           MOV        EBP ,y
        0040177c 89  f0           MOV        EAX ,y
```

前者将y值copy到`%EBP`保存寄存器中了，后者则是将y保存到`%EAX`返回值寄存器中，需要明白一点，MOV操作符并不是move剪切，而是copy，这也就意味着之前的`%esi`寄存的y值一直没有动

接下来回头看看函数签名

```assembly
                             undefined  __stdcall  func4 (undefined4  x,  undefined4  y)
             undefined         <UNASSIGNED>   <RETURN>
             undefined4        EDI:4          x
             undefined4        ESI:4          y
                             func4                                           XREF[6]:   
```

全局初始化里，就将y保存到`%ESI`中了，查表会知道，它是第二个参数的寄存器，所以说啊，这一部分并没有y相关的汇编代码是正常的

```assembly
        0040177e 83  ff  01       CMP        x,0x1
        00401781 74  19           JZ         LAB_0040179c
        00401783 8d  7f  ff       LEA        x,[x + -0x1 ]
        00401786 e8  dc  ff       CALL       func4    
```

哦，趁这个机会，再去看看第二次递归调用

```assembly
        0040178f 8d  7b  fe       LEA        x,[RBX  + -0x2 ]
        00401792 89  ee           MOV        y,EBP
        00401794 e8  ce  ff       CALL       func4   
```

会看到一个惊喜的地方，这里对y重新定义了，读取的是`%EBP`里的值，但是这和前面第一次调用时候的y值一样的，那么这里能不能直接删除这一句呢？答案是不行的，因为第二次调用的时候，系统无法信任已经被调用过的参数，简单来说就是用过的参数会消失，必须重新配置参数，尽管两次的值是一样的

我对反汇编的代码简单手动修复下

```c

int func4(int x,int y)

{
  int iVar1;
  int iVar2;
  
  if (0 < x) {
    if (x != 1) {
      iVar1 = func4(x + -1,y);
      iVar2 = func4(x + -2,y);
      y = iVar2 + iVar1 + y;
    }
    return y;
  }
  return 0;
}
```

其实还能再简化的，就像下面这样

```c
int func4(int x, int y) {
    if (x <= 0) return 0;
    if (x == 1) return y;
    return func4(x-1, y) + func4(x-2, y) + y;
}
```

关于func4的逆向分析就到这里截至吧，我们可以思考下phase_4的限制是y必须小于等于4

> 这里有个小陷阱，不知道读者有没有意识到呢？我先不告诉你

我们按照上面的分析逻辑，phase_4要读取两个数，其中第二个数必须小于等于4，第一个数必须是`func4(5,第二个数)`

那么理论上第二个数可以是0,1,2,3,4和所有负数?

Boom!

恭喜我们掉进坑里了，还是得回顾下前面的if判断

```c
if ((iVar1 != 2) || (2 < local_18 - 2U))
```

这里的2u是一个无符号整数，关键看它的后缀U，它的值确实是2没错，但是类型有问题，前面的local_18是int，但是运算中的2U是`unsigned int`

在表达式中同时出现有符号和无符号时，c语言标准规定：有符号数会被隐式转换为无符号数

这个时候我们我们想想看，如果`local_18=1`,转换成无符号数1U，然后`1U-2U`在无符号运算中会发生下溢，具体看看这个运算过程

```text
  0x00000001
- 0x00000002
-------------
  0xFFFFFFFF  (借位溢出)
```

这里的0xFFFFFFFF是`2^32 − 1`，这个时候再回到与2的比较中，显然结果true，自然会触发`explode_bomb()`

学懂了吧

<img src="./index.assets/LS20260423170644.png" alt="老君" style="zoom:50%;" />

那么我们口头算算，原先的y<=4一定要有个下限，那么这个整数可选项只有2,3,4了

然后再算算func4，就用3算好了

这是一个递归函数，手算多慢，还可能会算错，我这里写了一个简单的c程序

```c
#include<stdio.h>
int func4(int x, int y) {
    if (x <= 0) return 0;
    if (x == 1) return y;
    return func4(x-1, y) + func4(x-2, y) + y;
}
int main(){
    int x=5, y=3;
    printf("result is %d\n", func4(x, y));
    return 0;
}
```

![test](./index.assets/image-20260423172022254.png)

脚本运行结果是36，那么本题的答案我们可以写`36 3`

### phase_5

> 呼~，拆弹进度4/6

审计代码

```c

void phase_5(long param_1)

{
  int iVar1;
  long lVar2;
  long in_FS_OFFSET;
  char local_17 [6];
  undefined1 local_11;
  long local_10;
  
  local_10 = *(long *)(in_FS_OFFSET + 0x28); //栈检查，忽略
  iVar1 = string_length(); //读取输入的字符串长度，这里应该是省略了参数？
  if (iVar1 != 6) { //key1:输入的字符串长度为6
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  lVar2 = 0; //定义初始状态为0
  do {
    local_17[lVar2] =
         "maduiersnfotvbylSo you think you can stop the bomb with ctrl-c, do you?"
         [*(byte *)(param_1 + lVar2) & 0xf];
    lVar2 = lVar2 + 1; //状态递增
  } while (lVar2 != 6);
  local_11 = 0;
  iVar1 = strings_not_equal(local_17,"bruins");
  if (iVar1 == 0) {
    if (local_10 == *(long *)(in_FS_OFFSET + 0x28)) {
      return;
    }
                    /* WARNING: Subroutine does not return */
    __stack_chk_fail();
  }
                    /* WARNING: Subroutine does not return */
  explode_bomb();
}
```

这里的循环有点复杂，单独看看

```c
  lVar2 = 0; //定义初始状态为0
  do {
    local_17[lVar2] =
         "maduiersnfotvbylSo you think you can stop the bomb with ctrl-c, do you?"
         [*(byte *)(param_1 + lVar2) & 0xf];
    lVar2 = lVar2 + 1; //状态递增
  } while (lVar2 != 6);
```

这是核心步骤，用图片看会轻松点

![simplify](./index.assets/image-20260423184046641.png)

可以大致读出来这是一个创建表的过程吧，我用`lVar2=1`来举例，至于这里的`param_1`，我就随意写个`pyccsb`满足六个字母条件即可

先看左边`local_17[1]`它是在写入元素到local_17数组中，当前写的是第二个元素

然后看右式`plain[*(byte *)(param_1 + lVar2) & 0xf]`

前面的`*(byte *)`不作考虑分析，仅仅是申明元素类型为字节，不懂可以直接跳过

`(param_1 + lVar2)`的作用是指向param_1字符串的某个字母，当前的lVar2是1，那么这里指向的就是第二个字母`y`，需要注意，二进制中，这些字符都是以ASCII值的形式参与运算操作的，我用python快速查下

```bash
yolo@Yolo:~$ python -c "print(ord('y'))"
121
```

最后一部分的`& 0xf`换算一下，就是`& 15`，这个与运算的作用是让结果小于等于15，就拿上面的`y`来举例：

```text
	0111 1001 (121)
	0000 1111 (15)
&____________________
	0000 1001 (9)
```

一样，我给这里放上怎么用python快速求

```bash
yolo@Yolo:~$ python -c "print(ord('y')&15)"
9
```

好啦，那么我刚刚把`[*(byte *)(param_1 + lVar2) & 0xf]`化简整理成`[9]`,如果前面是一个字符串，那么组合起来的作用就是提取出字符串中索引为9的字符，在这里就应该是f（索引从0开始，f恰好是第10个字母

应该get到本题的考点了吧，通过处理读取的6个字母，逐个字母与15进行与运算，然后读取密文表获得映射后的值，那么我们先写个字典对比吧（这里的与15操作有个很直观的概念，就是扣字符的低4位，转换成8位二进制自己看看

```text
索引 0 → 'm'
索引 1 → 'a'
索引 2 → 'd'
索引 3 → 'u'
索引 4 → 'i'
索引 5 → 'e'
索引 6 → 'r'
索引 7 → 's'
索引 8 → 'n'
索引 9 → 'f'
索引 10 → 'o'
索引 11 → 't'
索引 12 → 'v'
索引 13 → 'b'
索引 14 → 'y'
索引 15 → 'l'
```

下一步要读的代码是这里：

```c
iVar1 = strings_not_equal(local_17,"bruins"); 
if (iVar1 == 0) {
    if (local_10 == *(long *)(in_FS_OFFSET + 0x28)) {
      return;
    }
                    /* WARNING: Subroutine does not return */
    __stack_chk_fail();
  }
```

首先配置了一个bool变量iVar1，它是函数strings_not_equal作用的结果，这个函数可以回顾phase_1，我有讲过，如果对比的两个字符串相同，会返回0，否则是1

然后这里的local_17就是读取param_1的字符串后编码得到的密文

现在的情况就是我们知道了密文，需要找到得到密文的原文，方法不难，先看目标索引值：

```text
bruins 在密文表中的索引：
b → 13
r → 6
u → 3
i → 4
n → 8
s → 7
```

接下来我们要做的是在可打印字符中找到低4位恰好是索引值的6个字符

有个特别简单的方法，首先找一个低4位全是0的字符，我这里就用ASCII为96的字符反引号,打不出来:(

```bash
yolo@Yolo:~$ echo -n '`' | xxd -b
00000000: 01100000
```

查看那个`0110 0000`，低4位恰好是0，如果在这个基础上加上小于16的数，可以保证低四位就是我们要找的那些索引

```bash
yolo@Yolo:~$ python -c "print((ord('\`')+13)&15)"
13
```

> 这里的反斜杠很关键，因为在bash中，反引号可能会被当作命令处理，用反斜杠可以得到一个单纯的字符反斜杠，否则会报错

这个结果已经很美了，再处理下变成字符

```bash
yolo@Yolo:~$ python -c "print(chr(ord('\`')+13))"
m
yolo@Yolo:~$ python -c "print(chr(ord('\`')+6))"
f
yolo@Yolo:~$ python -c "print(chr(ord('\`')+3))"
c
yolo@Yolo:~$ python -c "print(chr(ord('\`')+4))"
d
yolo@Yolo:~$ python -c "print(chr(ord('\`')+8))"
h
yolo@Yolo:~$ python -c "print(chr(ord('\`')+7))"
g
```

所以说应该写入的答案应该是`mfcdhg`

### phase_6

最后一个关卡代码有点多,拆成三部分读

```c

void phase_6(undefined8 param_1)

{
  int iVar1;
  undefined1 *puVar2;
  long lVar3;
  int *piVar4;
  long lVar5;
  long in_FS_OFFSET;
  int local_88 [8];
  int *local_68;
  long local_60;
  long local_58;
  long local_50;
  long local_48;
  long local_40;
  long local_30;
  
  piVar4 = local_88;
  local_30 = *(long *)(in_FS_OFFSET + 0x28); //栈保护，忽略
  read_six_numbers(param_1,local_88); //此函数已经在phase_2中分析过，作用是读取6个数字
  lVar5 = 1; //定义某个状态量为1
  while( true ) {
    if (5 < *piVar4 - 1U) { //这里的*piVar4实质上指向我们输入的6个数，这里也存在一个坑，无符号整数参与运算，要避免下溢，口算了下，只能填写1,2,3,4,5,6(理论上我写6个3也没有非法处理)
                    /* WARNING: Subroutine does not return */
      explode_bomb();
    }
    lVar3 = lVar5; // 1
    if (5 < (int)lVar5) break;
    do {
      if (*piVar4 == local_88[lVar3]) {//禁止重复，上面想偷的懒也被算到了，只能填写{1,2,3,4,5,6}的一个全排列
                    /* WARNING: Subroutine does not return */
        explode_bomb();
      }
      lVar3 = lVar3 + 1;
    } while ((int)lVar3 < 6);
    lVar5 = lVar5 + 1;
    piVar4 = piVar4 + 1;
  }
```

上一部分感觉是处理元素列表，并查重，暂时好分析，下一部分才是本次挑战的关键代码（坏消息，数据结构忘完了

```c
lVar5 = 0;
  do {
    iVar1 = 1; //初始化索引值
    puVar2 = node1;  //全局链表头，每次从头开始遍历
    if (1 < local_88[lVar5]) { //lVar5初始化到第0位了，而且
      do {
        puVar2 = *(undefined1 **)((long)puVar2 + 8); //让指针puVar2指向下一个指针，可以大致体会到，每一个节点的value和ID区域共8字节，跳过8字节后就到达next指针了，关于这里为啥会有ID区域，我后面会提供汇编看的
        iVar1 = iVar1 + 1; //更新索引值
      } while (iVar1 != local_88[lVar5]);
    }
    (&local_68)[lVar5] = (int *)puVar2; //保存找到的节点地址
    lVar5 = lVar5 + 1;
  } while (lVar5 != 6); //简单来说就是按数字选节点
//下面是按照输入的数字序列将6个节点重新链接
  *(long *)(local_68 + 2) = local_60; 
  *(long *)(local_60 + 8) = local_58;
  *(long *)(local_58 + 8) = local_50;
  *(long *)(local_50 + 8) = local_48;
  *(long *)(local_48 + 8) = local_40;
  *(undefined8 *)(local_40 + 8) = 0;
//[你输入的第1个节点] -> [第2个] -> [第3个] -> [第4个] -> [第5个] -> [第6个] -> NULL
```

我这样介绍吧，这里是通过1~6的全排列进行映射，将所有存储在汇编的.data或.rodata段中定义的6个节点按照我们输入的全排列进行排序，最终我们能获取到一个包含6个节点指针的数组

比如说顺序是654321，这部分代码处理完，我们就得到了数组[node6,node5,node4,node3,node2,node1]

接下来就是最后一部分关键代码了

```c
iVar1 = 5;
  do {
    if (**(int **)(local_68 + 2) < *local_68) {//遍历数组中的节点，判断当前节点的值是否大于等于下一个节点的值，如果不是，就会Boom，这也就意味着我们自定义的node链表必须走顺序，从低到高，可以保证下一个节点值大于当前节点，这里还有个关键信息，判断的时候，使用的是int类，读取的是节点的前4字节，这就能解释为啥下面推测node结构体的时候，判断value占据前4字节了
                    /* WARNING: Subroutine does not return */
      explode_bomb();
    }
    local_68 = *(int **)(local_68 + 2);
    iVar1 = iVar1 + -1;
  } while (iVar1 != 0);
  if (local_30 != *(long *)(in_FS_OFFSET + 0x28)) {
                    /* WARNING: Subroutine does not return */
    __stack_chk_fail();
  }
  return;
}
```

呼~，这最后一关卡代码总算读完了

<img src="./index.assets/c3cf3df374b59b441a25319ecea88add.jpg" alt="呼~" style="zoom:50%;" />

通过上述分析，我们知道本题的解题要求是找到二进制程序内部存储的6个node值的大小，并进行排序，按照降序，然后将对应的索引值作为答案提交

查看所有node的方法可以直接通过暴力搜索，首先点击中间的汇编代码区域，使用ctrl+f调出查找框，然后输入node，关于过滤fields应该选择`All Fields`，然后`Search All`

![find](./index.assets/image-20260423210357784.png)

我标注了6处

![nodes](./index.assets/image-20260423223907917.png)

可以看到哈，这里显然存在小坑，如果我们不通过暴力搜索的话，node6不是很轻松找到，它对应的偏移是0x405210,这与其它node差距很大很大，一时半会可能无法找到

这里我就举一个例子哈，双击node6,回到汇编代码中查看，还记得我在第二段代码分析中说到的节点大小嘛？是4+4+8=16字节，前4个字节是数值，中间4个字节是node_id，后8个字节是next指针

```
                             node6                                           XREF[1]:     Entry Point (*)   
        00405210 38  00  00       undefine
                 00  06  00 
                 00  00  00 
           00405210 38              undefine  38h                     [0]                               XREF[1]:     Entry Point (*)   
           00405211 00              undefine  00h                     [1]
           00405212 00              undefine  00h                     [2]
           00405213 00              undefine  00h                     [3]
           00405214 06              undefine  06h                     [4]
           00405215 00              undefine  00h                     [5]
           00405216 00              undefine  00h                     [6]
           00405217 00              undefine  00h                     [7]
           00405218 00              undefine  00h                     [8]
           00405219 00              undefine  00h                     [9]
           0040521a 00              undefine  00h                     [10]
           0040521b 00              undefine  00h                     [11]
           0040521c 00              undefine  00h                     [12]
           0040521d 00              undefine  00h                     [13]
           0040521e 00              undefine  00h                     [14]
           0040521f 00              undefine  00h                     [15]

```

既然这样的话，我们能确定node6对应的值应该是0x38(一定要看下面16个值，按照4+4+8)

索引为4的值是0x06,恰好代表这个node是node6,至于剩下的值都是0，我觉得也能解释，因为一共6个节点，链表如果排完后，最后肯定是NULL

我这里推测出这样的结构体

```c
struct Node {
    int value;      // 0~3 字节
    int node_id;         // 4~7 字节（maybe）
    Node* next;     // 8~15 字节
};
```

剩下的几个node我就不一一列举了，不过这里说明下，可能会遇到下面这样看不到完整内容的情况,点击框框里的+号就能展开了

![cantsee](./index.assets/image-20260423225852116.png)

我来说说我的二进制中各个node的值

| node1  | node2  | node3 | node4  | node5  | node6 |
| ------ | ------ | ----- | ------ | ------ | ----- |
| 0x018a | 0x0204 | 0x7e  | 0x02f0 | 0x0120 | 0x38  |

用python快速转换十进制

```bash
◎ python -c "print(0x18a,0x204,0x7e,0x2f0,0x120,0x38)"                                                          ⌂ 23:03
394 516 126 752 288 56
```

---

最后一次扩展了吧，大家还记得我在start里进行的架构检查嘛，这个二进制程序是64位架构小端序，如果看到某个寄存器中存了多个字节的值，一定不要按照偏移顺序读，必须必须必须倒序读，就拿node1举个例子

![node1](./index.assets/image-20260423230548497.png)

这里读取的node1的值的错误答案是0x8a01,正确答案是0x18a,至于大端序和小端序，看书去吧，或者拷打拷打ai

---

这个结果`394 516 126 752 288 56`是我按照顺序node_id看的值，我们上面分析过，需要重排列的node必须是按照顺序，从低到高排列的，那么正确的答案应该是`6 3 5 1 2 4`

## 提交答案

呼，理论上我们的拆弹旅程快要结束了，临门一脚了，一定要漂漂亮亮的提交

- 提交第一个

  - ```bash
    echo "I am not part of the problem. I am a Republican." > B24041429.txt
    ```

- 提交第二个

  - ```bash
    echo "0 1 1 2 3 5" >> B24041429.txt
    ```

  - 这里的`>>`不能忽略，否则会覆盖第一次提交

- 提交第三个

  - ```bash
     echo "1 309" >> B24041429.txt
    ```

- 提交第四个

  - ```bash
    echo "36 3" >> B24041429.txt
    ```

- 提交第五个

  - ```bash
    echo "mfcdhg" >> B24041429.txt
    ```

- 提交第六个

  - ```bash
    echo "6 3 5 1 2 4" >> B24041429.txt
    ```

- 检查下提交过的内容

  - ```bash
    B24041429@ICS:~/bombk$ xxd B24041429.txt
    00000000: 4920 616d 206e 6f74 2070 6172 7420 6f66  I am not part of
    00000010: 2074 6865 2070 726f 626c 656d 2e20 4920   the problem. I 
    00000020: 616d 2061 2052 6570 7562 6c69 6361 6e2e  am a Republican.
    00000030: 0a30 2031 2031 2032 2033 2035 0a31 2033  .0 1 1 2 3 5.1 3
    00000040: 3039 0a33 3620 330a 6d66 6364 6867 0a36  09.36 3.mfcdhg.6
    00000050: 2033 2035 2031 2032 2034 0a               3 5 1 2 4.
    ```

- 运行

  - ```bash
    B24041429@ICS:~/bombk$ ./bomb B24041429.txt
    Welcome to my fiendish little bomb. You have 6 phases with
    which to blow yourself up. Have a nice day!
    Phase 1 defused. How about the next one?
    That's number 2.  Keep going!
    Halfway there!
    So you got that one.  Try this one.
    Good work!  On to the next...
    Congratulations! You've defused the bomb!
    Your instructor has been notified and will verify your solution.
    B24041429@ICS:~/bombk$ ls
    B24041429.txt  B24041429.TXT  bomb  bomb.c  README
    B24041429@ICS:~/bombk$ cat README 
    This is bomb 209.
    
    It belongs to B24041429 (b24041429@njupt.edu.cn)
    ```

- 测试成功，Win!!!（我是满分哦

![截图留念](./index.assets/image-20260423232253728.png)

## summary

爽歪歪，这次实验确实很有意思，老师上课讲到的部分知识确实有用到，接下来要做的是尽快完善对应的实验报告

> 看到这里，大家应该都学到不少了吧，能帮助到大家也挺不错的，实验报告自己写昂，要我写也不是不行，至少请几杯奶茶吧，哈哈哈



<img src="./index.assets/bd83e77056a59897a413207a0248fa80.jpg" alt="爽" style="zoom: 80%;" />

## 番外

我写报告的时候发现这里存在7个阶段，但是我只遇到了6个phase啊，再结合scoreboard里，有同学`Phases defused`次数最高为7次，我仅仅是6次

这里显然存在一个隐藏关卡（找老师确认过的

回忆main函数里哪些函数我没有分析，范围很小了，仅仅有`read_line()`和`phase_defused()`，也许后者并不是状态量检测？具体还是需要进行逆向分析

### phase_defaused

```c
void phase_defused(void)

{
  int iVar1;
  long in_FS_OFFSET;
  undefined1 local_70 [4];
  undefined1 local_6c [4];
  undefined1 local_68 [88];
  long local_10;
  
  local_10 = *(long *)(in_FS_OFFSET + 0x28);
  send_msg(1); //关键函数1
  if (num_input_strings == 6) { //这个变量应该是全局变量，需要找到定义点
    iVar1 = __isoc99_sscanf(0x405910,"%d %d %s",local_70,local_6c,local_68); //看这里的读取，是两个整数加一个字符串
    if (iVar1 == 3) {
      iVar1 = strings_not_equal(local_68,"DrEvil"); //对比第三个字符串是不是DrEvil
      if (iVar1 == 0) { //对比成功，进入隐藏关卡
        puts("Curses, you\'ve found the secret phase!");
        puts("But finding it and solving it are quite different...");
        secret_phase(); //关键函数2
      }
    }
    puts("Congratulations! You\'ve defused the bomb!");
    puts("Your instructor has been notified and will verify your solution.");
  }
  if (local_10 == *(long *)(in_FS_OFFSET + 0x28)) {
    return;
  }
                    /* WARNING: Subroutine does not return */
  __stack_chk_fail();
}
```

看到`secret phase`就知道这里找对了

- `send_msg()`这个函数我看过了，是负责将我们的成功信息发送给服务器的，嗯，让服务器给我们加分用的，而且相对来说挺复杂的，这里我就不占用篇幅来分析了，对彩蛋关卡没有帮助
- `num_input_strings`这是一个全局变量，需要找到交叉引用这个变量的地方，然后还要找到和写入操作相关的函数
  - 选中这个变量后右键,点击`References->Find References to num_input_strings`
    - ![xf](./index.assets/image-20260424094951324.png)
  - 这个时候一定能看到这样的面板，我标注了两处write操作的引用
    - ![write](./index.assets/image-20260424095159087.png)
  - 挨个看呗
- `read_line()`第一个write引用就带我们找到位置了，看看下面的截图
  - ![bingo](./index.assets/image-20260424095445348.png)
  - 这里的加一操作为我们解惑了，每读一次数据，都会为全局变量num_input_strings+1，这样看的话，隐藏关卡必须在前6关pass后才能触发一部分（还有其它条件

触发隐藏关卡的后半部分就是这句

```c
    iVar1 = __isoc99_sscanf(0x405910,"%d %d %s",local_70,local_6c,local_68);
    if (iVar1 == 3) {
      iVar1 = strings_not_equal(local_68,"DrEvil");
      if (iVar1 == 0) {
        puts("Curses, you\'ve found the secret phase!");
        puts("But finding it and solving it are quite different...");
        secret_phase();
      }
```

iVar1要读取地址为0x405910处的三个值，两个整数，一个字符串，如果那个字符串恰好是DrEvil才能调用`secret_phase()`

### read_line

但是问题来了，0x405910所在的位置明显是缓冲区，周围都是空白数据，我们接下来要做的是找到是谁申请的这一块缓冲区，以及缓冲区里预计要写哪些数据，好在这里的`read_line()`特别直接，写明它是怎么调用的了

```c
  iVar1 = num_input_strings; //保存当前num_input_strings到iVar1中，初始0
  lVar2 = (long)num_input_strings; //转换64位索引，用于指针运算
  sVar3 = strlen(input_strings + lVar2 * 0x50); //确认存储在缓冲区的内容长度
  if ((int)sVar3 < 0x4f) { //长度必须小于79b,所以最多78个非空字符,留一个存储\0
    input_strings[(long)((int)sVar3 + -1) + (long)iVar1 * 0x50] = 0; //将元素中最后一个字节，通常来说应该是换行符'\n'，替换成'\0'
    num_input_strings = iVar1 + 1; //将索引值更新
    return input_strings + lVar2 * 0x50; //返回fix后的内容
  }
```

我上面截取的部分代码的作用是将逐行读取的字符串的末尾换行符\n替换掉\0，乍一看感觉对我们找触发彩蛋关系不是很大，但是我们能从中找到两个关键信息：

- 缓冲区就是input_strings申请的数组
- 数组内的每个元素大小是0x50=80字节

双击那个input_strings能让左侧汇编窗口快速跳转缓冲区，上面的那个240什么信息我暂时没搞清楚为啥会这样，也许是Ghidra的小bug?不用管，可以向下查看缓冲区长度，会发现索引值一直到1599，一共1600b的空间，一个元素占据80字节，理论上甚至能装20个元素

![input_strings](./index.assets/image-20260424121850416.png)

接下来再回忆下我们上面需要确定的地址：0x405910

目标地址恰好在input_strings数组缓冲区中(0x405820~0x405e5f)

简单算算，就按照80为步长

```bash
>>> hex(0x405820 + 80*0)
'0x405820'
>>> hex(0x405820 + 80*1)
'0x405870'
>>> hex(0x405820 + 80*2)
'0x4058c0'
>>> hex(0x405820 + 80*3)
'0x405910'
```

win了，这里的触发点应该是在phase_4，那么我应该在phase_4的正确答案基础上，再加个字符串，应该是这样的：`36 3 DrEvil`

---

扩展下，应该会有人疑惑，这里的phase_4只能读取两个数字啊，这里的字符串写进去不会报错？

![phase_4](./index.assets/image-20260424122935871.png)

可以这样解释，解释器在读取参数的时候，会先统一将所有数据存储在上面讲的缓冲区里，然后再按照格式化参数读取数据，比如这里就是`"%d %d"`它只能利用`数字+空格+数字`，至于它后面有没有数据，程序并不在乎，只要缓冲区没有溢出，程序不奔溃，后面可以任意写的

---

### secret_phase

截止到这里，我们仅仅做到了触发隐藏关卡，具体怎么通关还需要分析函数`secret_phase()`

```c
void secret_phase(void)

{
  int iVar1;
  char *__nptr;
  ulong uVar2;
  
  __nptr = (char *)read_line();//等待我在终端中输入一行字符串
  uVar2 = strtol(__nptr,(char **)0x0,10); //将字符串转换成长整数存入uVar2
  if (1000 < (int)uVar2 - 1U) { //长整数的值范围[1,1001]
                    /* WARNING: Subroutine does not return */
    explode_bomb();
  }
  iVar1 = fun7(n1,uVar2 & 0xffffffff); //关键函数fun7,应该会返回一个数字
  if (iVar1 == 2) { //上面返回的数字如果是2，我就真的通关了
    puts("Wow! You\'ve defused the secret stage!");
    phase_defused();
    return;
  }
                    /* WARNING: Subroutine does not return */
  explode_bomb();
}
```

### fun7

```c
int fun7(int *param_1,int param_2)

{
  int iVar1;
  
  if (param_1 != (int *)0x0) { //空节点就Boom
    if (param_2 < *param_1) { //输入值<节点值
      iVar1 = fun7(*(undefined8 *)(param_1 + 2)); //param_1是int4字节，+2会偏移8字节，恰好指向左子节点指针，也就是说当我们输入小于当前节点，就会递归调用左子节点，并且返回值乘2
      iVar1 = iVar1 * 2;
    }
    else { //输入值>=节点值
      iVar1 = 0; //假设iVar1=0，输入值==节点值就不会进入下面的if了
      if (*param_1 != param_2) { //排除不等的情况，输入值>节点值
        iVar1 = fun7(*(undefined8 *)(param_1 + 4)); //右偏移，并且返回值乘2+1
        iVar1 = iVar1 * 2 + 1;
      }
    }
    return iVar1;
  }
  return -1;
}
```

很清晰的二叉搜索树BST遍历算法

通关条件是`fun7(n1,input)==2`

说下fun7函数的功能

- 找到目标：返回0
- 如果目标值比当前值大，向右边查找：返回值x2+1
- 如果目标值比当前值小，向左边查找：返回值x2

我们接下来要做的应该是画出这个二叉树，需要找到不同节点对应的值，这个不难，可以双击`secret_parse`函数中的这一句`iVar1 = fun7(n1,uVar2 & 0xffffffff);`里的n1,应该能得到下面这张图

![n1](./index.assets/image-20260424170553300.png)

各个节点的值确实是前四字节，但是应该有人会问，这个值是怎么确定为前四字节的，明明内存栈上后面还有值啊，我来解释下，可以看看fun7的函数签名

![fun7](./index.assets/image-20260424170919428.png)

这里的fun7只能读取两个int参数，一个int参数也就4字节，后面的内存内容，fun7根本读不了，因此我才说各个节点的值都是前四字节，就按照我上面的方法吧，把各个节点的值记录下来

我先画下这个二叉树：

<img src="./index.assets/Screenshot_2026-04-24-16-56-12-16_f019c1a0ba3b2cc.jpg" alt="二叉树" style="zoom:50%;" />

正确答案确实是22，我给大家说说遍历流程哈（温馨提示，这里涉及数据结构的pop,push的相关知识，务必复习下

- `fun7(36,22)`,当前值大于目标值，需要向左查找，返回值需要:`result*2`
- `fun7(8,22)`,当前值小于目标值，需要向右查找，返回值需要:`result*2+1`
- `fun7(22,22)`,当前值等于目标值，返回值为0

当我们查找到值的时候，需要从栈顶向下获取返回值，那就只能倒着来了

`0 -> 2*0+1=1 -> 2*1=2`，这就是2的来源，如果还是感觉抽象，可以看看下面的gif动态图，是Gemini生成的，效果还不错

![poppush](./index.assets/poppush.gif)

### submit

这个隐藏关卡的答案已经出来了，就是22，那么怎么提交呢？

先触发隐藏关卡，然后第七行写上22吧

赢啦!!!

```bash
B24041429@ICS:~/bombk$ cat B24041429.txt 
I am not part of the problem. I am a Republican.
0 1 1 2 3 5
1 309
36 3 DrEvil
mfcdhg
6 3 5 1 2 4
22
B24041429@ICS:~/bombk$ ./bomb B24041429.txt 
Welcome to my fiendish little bomb. You have 6 phases with
which to blow yourself up. Have a nice day!
Phase 1 defused. How about the next one?
That's number 2.  Keep going!
Halfway there!
So you got that one.  Try this one.
Good work!  On to the next...
Curses, you've found the secret phase!
But finding it and solving it are quite different...
Wow! You've defused the secret stage!
Congratulations! You've defused the bomb!
Your instructor has been notified and will verify your solution.
```

![win](./index.assets/image-20260424172206900.png)

## summary+

到这里应该算是完美的做完了实验（实验报告我一会儿补

有一点点想法，自己一个人读汇编，读伪代码，真的很有意思，算是在ctf赛道以外第一次这么上心的一次操作题

还有啊，这样简单的代码我下次就不要想当然去跳过一些函数了，这里的隐藏关卡本来很明显的摆在我的面前，我硬是没有意识到，以为那个`phase_defaused`和`read_line`单纯是个状态函数，没有什么大的用途就跳过了

还好老师提醒了一下下，最终完成了，感觉还挺不错，结尾补上今天看到的大橘老师吧

![大橘为重](./index.assets/c7ae0cea2647cc4bda49e242eddfce2a.jpg)









