---
layout: default
title: "Android 如何实现一个边播放边下载的 mp3 播放器"
author: cikelengfeng
tags:
  - android
---

咱们开门见山

### 1. 做过哪些尝试？

首先我们应该尝试一下 Android 框架提供的 [`MediaPlayer`][1]，它可以用来播放本地和网络音视频，API 也很简洁，但是他并没有提供任何可以获得正在播放的音频数据的公共 API，也无法通过继承它来得到音频数据的处理权。

有的同学说：“我们可以一边使用 `MediaPlayer` 播放网络音频，一边使用自己的下载器下载相应的音频数据”，这样做也能实现，但是作为一个工程师，你肯定不满意这样的设计，既然能播放了，那音频数据在本地肯定是有了，又何必再下载一次？

### 2. 再次尝试

既然 MediaPlayer 不行，我们再看看框架中还有什么可以使用的工具，浏览一下同样处于 `android.media` 包下的其他类，首先看名字和播放相关的还有两个 [`AsyncPlayer`][2] 和 [`AudioTrack`][3]，但 `AsyncPlayer` 的功能比 `MediaPlayer` 还简单。剩下的就是 `AudioTrack` 了，看一下他的介绍：

> The `AudioTrack` class manages and plays a single audio resource for Java applications. It allows streaming PCM audio buffers to the audio hardware for playback. This is achieved by "pushing" the data to the `AudioTrack` object using one of the `write(byte[], int, int)` and `write(short[], int, int)` methods.

当看到它的 write 方法时，你一定有了眼前一亮的感觉，别急，先看一下该方法的介绍：

> Writes the audio data to the audio hardware for playback. Will block until all data has been written to the audio mixer. Note that the actual playback of this data might occur after this function returns. This function is thread safe with respect to `stop()` calls, in which case all of the specified data might not be written to the mixer.

该方法用于给音频硬件的缓冲区 “喂” 数据，这下基本上就有方案了：我们可以自己下载某个 URL 对应的音频文件，获得一个相应的输入流，然后通过一个循环来从输入流读数据，同时向文件和 `AudioTrack` 的缓冲区写数据（向 `AudioTrack` 缓冲区写数据要求是 PCM 数据，所以我们需要同时将下载下来的音频数据解码），当缓冲区有足够的数据时，开始播放。当输入流读完时，本地的文件也下载好了。

这里只给出一种思路，还有其他的实现方式。我建议需要的同学按照上边的思路自己实现一下

最后附上[我实现的代码][4]，其中使用了著名的 [DiskLruCache][5] 来存储音频数据，[JLayer][6] 用来解码。

[1]: https://developer.android.com/reference/android/media/MediaPlayer.html
{:target="_blank"}
[2]: https://developer.android.com/reference/android/media/AsyncPlayer.html
{:target="_blank"}
[3]: https://developer.android.com/reference/android/media/AudioTrack.html
{:target="_blank"}
[4]: https://github.com/cikelengfeng/YueDu/blob/dev/src/com/yuedu/fm/StreamingDownloadMediaPlayer.java
{:target="_blank"}
[5]: https://github.com/JakeWharton/DiskLruCache
{:target="_blank"}
[6]: http://www.javazoom.net/javalayer/javalayer.html
{:target="_blank"}
