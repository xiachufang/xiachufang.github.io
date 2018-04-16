---
layout: default
title: "iOS Auto Layout 细节手册"
author: cikelengfeng
tags:
  - ios
---

1. Auto Layout 的第一原则就是一个简单的等式 `y = a * x + b`，其中 `x` 和 `y` 是属性（leading、top 等等），`a` 是倍数，`b` 是常数。
2. Auto Layout 的第二原则就是等式两边的属性变化时都会影响另一边的属性值，所以 Auto Layout 是没有 side-effect 的赋值系统。
3. 在 IB 中设置约束时尽量不要有不明确的布局 (Ambiguity)，即使你会在代码中完善相关的约束，因为当 IB 发现不明确的布局时，会将相关的 View 在 xib 中的描述添加一段标记，然后 iOS 会做一些优化，但是具体是什么样的优化我们不得而知，对此我们要注意的是当你的布局出了一些诡异的问题时，首先应该解决这些不明确的布局 (Ambiguity)，而不同的情况下解决办法也是不同的。
    - IB 中缺失约束并且你的约束都是在 IB 中设置时，你应该在 IB 中补全相应的约束。
    - IB 中缺失约束但是缺失的约束是通过代码设置的，你应该在 IB 中补全相应的约束，并且将其设置为 placeholder
    - 约束有冲突时，你应该减少约束或者通过设置约束优先级来解决冲突
4. 设置约束时有些属性是不能配对出现在等式两边的，比如 `view1.leading = a * view2.width + b`。想要这样的效果时，可以通过使用 `placeholderView` 做中间人的办法来连接两个不能配对的属性。
5. 通常情况下 `ScrollView` 的 `SubView` 想要依赖 `ScrollView` 的相关属性做布局的话，只有几个属性是可依赖的，他们是 `leading` `left` 和 `top`。为什么是这样？因为 `ScrollView` 总是要依赖它的 `SubView` 来确定 `ContentSize`。
6. 当你决定在你的项目中大规模使用 Auto Layout 时，那么 `NSAutoresizingMaskLayoutConstraint` 大部分情况下是非常不和谐的东西，它通常会把你的程序搞崩溃，幸好 IB 中的 View 不会出现这个问题，如果你使用代码添加了 View 并且出现了 `NSAutoresizingMaskLayoutConstraint` 相关的问题，你应该将该 View 的 `translatesAutoresizingMaskIntoConstraints` 设置为 `NO`。
